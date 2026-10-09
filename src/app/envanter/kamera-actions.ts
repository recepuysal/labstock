'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { sozlukAl } from '@/lib/i18n/sunucu';

/* Kamera sayımı (telefon kamerası + bilgisayardaki görüntü işleme servisi) için sunucu eylemleri.
 * Masaüstü uygulamasındaki kamera istasyonu (kamera-istasyonu.tsx) telefondan gelen istekleri bunlarla yanıtlar.
 * Sadece giriş yapan kullanıcının KENDİ deposu üzerinde çalışır; yazma yetkisi yine RLS'de. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAKS_ADET = 1_000_000;

export type KameraParca = {
  ok: true;
  stokId: string;
  mpn: string;
  aciklama: string | null;
  adet: number;
  birim: string;
  konum: string | null;
};
export type KameraKonum = {
  ok: true;
  konumId: string;
  konumAdi: string;
  parcalar: { stokId: string; mpn: string; aciklama: string | null; adet: number }[];
};
export type KameraSayimSonucu = { ok: true; mpn: string; eski: number; yeni: number; degisti: boolean };
export type KameraHata = { ok: false; hata: string };

async function kullanici() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function konumMetni(kod: string | null, ad: string | null): string | null {
  if (kod && ad) return `${kod} · ${ad}`;
  return kod ?? ad ?? null;
}

/** QR'dan okunan stok kalemi (LSTK:P:<stokId>) için telefonda gösterilecek bilgi. */
export async function kameraStokBilgisi(stokId: string): Promise<KameraParca | KameraHata> {
  const h = (await sozlukAl()).kamera.hata;
  if (typeof stokId !== 'string' || !UUID.test(stokId)) return { ok: false, hata: h.gecersizQr };
  const { supabase, user } = await kullanici();
  if (!user) return { ok: false, hata: h.oturumYok };

  const { data, error } = await supabase
    .from('envanter')
    .select('stok_id, mpn, aciklama, adet, birim, konum_kodu, konum_adi')
    .eq('stok_id', stokId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, hata: error.message };
  if (!data) return { ok: false, hata: h.parcaYok };

  return {
    ok: true,
    stokId: data.stok_id,
    mpn: data.mpn,
    aciklama: data.aciklama,
    adet: Number(data.adet),
    birim: data.birim ?? 'adet',
    konum: konumMetni(data.konum_kodu, data.konum_adi),
  };
}

/** QR'dan okunan konumdaki (LSTK:K:<konumId>) parçalar — telefonda hangisini sayacağını seçmek için. */
export async function kameraKonumParcalari(konumId: string): Promise<KameraKonum | KameraHata> {
  const s = (await sozlukAl()).kamera;
  const h = s.hata;
  if (typeof konumId !== 'string' || !UUID.test(konumId)) return { ok: false, hata: h.gecersizQr };
  const { supabase, user } = await kullanici();
  if (!user) return { ok: false, hata: h.oturumYok };

  const { data: konum, error: konumHata } = await supabase
    .from('locations')
    .select('id, kod, ad')
    .eq('id', konumId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (konumHata) return { ok: false, hata: konumHata.message };
  if (!konum) return { ok: false, hata: h.konumYok };

  const { data, error } = await supabase
    .from('envanter')
    .select('stok_id, mpn, aciklama, adet')
    .eq('konum_id', konumId)
    .eq('user_id', user.id)
    .order('mpn')
    .limit(100);
  if (error) return { ok: false, hata: error.message };

  return {
    ok: true,
    konumId: konum.id,
    konumAdi: konumMetni(konum.kod, konum.ad) ?? s.konum,
    parcalar: (data ?? []).map((s) => ({ stokId: s.stok_id, mpn: s.mpn, aciklama: s.aciklama, adet: Number(s.adet) })),
  };
}

export type KameraArama = {
  ok: true;
  parcalar: { stokId: string; mpn: string; aciklama: string | null; adet: number; konum: string | null }[];
};

/** QR etiketi olmayan parçalar için: telefonda ad / MPN / açıklamaya göre arama. */
export async function kameraParcaAra(sorgu: string): Promise<KameraArama | KameraHata> {
  const h = (await sozlukAl()).kamera.hata;
  // PostgREST filtresinde anlamı olan karakterleri at (virgül, parantez, joker karakterler)
  const temiz = typeof sorgu === 'string' ? sorgu.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60) : '';
  if (temiz.length < 2) return { ok: true, parcalar: [] };
  const { supabase, user } = await kullanici();
  if (!user) return { ok: false, hata: h.oturumYok };

  const desen = `%${temiz}%`;
  const { data, error } = await supabase
    .from('envanter')
    .select('stok_id, mpn, aciklama, adet, konum_kodu, konum_adi')
    .eq('user_id', user.id)
    .or(`mpn.ilike.${desen},aciklama.ilike.${desen},uretici.ilike.${desen}`)
    .order('mpn')
    .limit(20);
  if (error) return { ok: false, hata: error.message };

  return {
    ok: true,
    parcalar: (data ?? []).map((s) => ({
      stokId: s.stok_id,
      mpn: s.mpn,
      aciklama: s.aciklama,
      adet: Number(s.adet),
      konum: konumMetni(s.konum_kodu, s.konum_adi),
    })),
  };
}

export type KameraEtiketBilgisi = {
  ok: true;
  /** Bu tedarikçi koduna / MPN'e sahip kendi stok kalemlerin. */
  bulunanlar: { stokId: string; mpn: string; adet: number; konum: string | null }[];
  /** Aynı etiket daha önce işlendiyse ne zaman. */
  dahaOnce: string | null;
};

const ETIKET_IZI = /^[A-Za-z0-9:_-]{4,80}$/;
const izAciklamasi = (iz: string) => `etiket:${iz}`;

/** Tedarikçi poşet etiketi (ör. LCSC QR'ı) okununca: parça depoda var mı, etiket daha önce işlendi mi. */
export async function kameraTedarikciEtiketi(
  tedarikciKodu: string,
  mpn: string,
  iz: string,
): Promise<KameraEtiketBilgisi | KameraHata> {
  const h = (await sozlukAl()).kamera.hata;
  const kod = typeof tedarikciKodu === 'string' ? tedarikciKodu.replace(/[^A-Za-z0-9-]/g, '').slice(0, 40) : '';
  const mpnTemiz = typeof mpn === 'string' ? mpn.replace(/[,()%*\\]/g, '').trim().slice(0, 80) : '';
  if (!kod && !mpnTemiz) return { ok: false, hata: h.etikettePKoduYok };
  if (typeof iz !== 'string' || !ETIKET_IZI.test(iz)) return { ok: false, hata: h.gecersizEtiket };
  const { supabase, user } = await kullanici();
  if (!user) return { ok: false, hata: h.oturumYok };

  const kosullar = [kod && `tedarikci_kodu.ilike.${kod}`, mpnTemiz && `mpn.ilike.${mpnTemiz}`].filter(Boolean).join(',');
  const { data, error } = await supabase
    .from('envanter')
    .select('stok_id, mpn, adet, konum_kodu, konum_adi')
    .eq('user_id', user.id)
    .or(kosullar)
    .limit(10);
  if (error) return { ok: false, hata: error.message };

  const { data: once } = await supabase
    .from('stock_movements')
    .select('created_at')
    .eq('user_id', user.id)
    .ilike('aciklama', `%${izAciklamasi(iz)}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ok: true,
    bulunanlar: (data ?? []).map((s) => ({
      stokId: s.stok_id,
      mpn: s.mpn,
      adet: Number(s.adet),
      konum: konumMetni(s.konum_kodu, s.konum_adi),
    })),
    dahaOnce: once?.created_at ?? null,
  };
}

export type KameraGirisSonucu = { ok: true; mpn: string; eski: number; yeni: number };

/** Tedarikçi etiketindeki adedi stoğa EKLER ("Giriş" hareketi). Etiketin izi açıklamaya yazılır;
 * aynı etiket ikinci kez gelirse `zorla` verilmedikçe eklenmez (iki kez okutma stoğu şişirmesin). */
export async function kameraStokGiris(
  stokId: string,
  adet: number,
  iz: string,
  kaynak: string,
  zorla = false,
): Promise<KameraGirisSonucu | KameraHata> {
  const h = (await sozlukAl()).kamera.hata;
  if (typeof stokId !== 'string' || !UUID.test(stokId)) return { ok: false, hata: h.gecersizParca };
  if (!Number.isInteger(adet) || adet <= 0 || adet > MAKS_ADET) return { ok: false, hata: h.gecersizAdet };
  if (typeof iz !== 'string' || !ETIKET_IZI.test(iz)) return { ok: false, hata: h.gecersizEtiket };
  const kaynakTemiz = typeof kaynak === 'string' ? kaynak.replace(/[^\p{L}\p{N} ._×-]/gu, '').slice(0, 60) : '';
  const { supabase, user } = await kullanici();
  if (!user) return { ok: false, hata: h.oturumYok };

  if (!zorla) {
    const { data: once } = await supabase
      .from('stock_movements')
      .select('created_at')
      .eq('user_id', user.id)
      .ilike('aciklama', `%${izAciklamasi(iz)}%`)
      .limit(1)
      .maybeSingle();
    if (once) return { ok: false, hata: h.etiketIslenmis };
  }

  const { data: kalem, error } = await supabase
    .from('envanter')
    .select('mpn, adet')
    .eq('stok_id', stokId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, hata: error.message };
  if (!kalem) return { ok: false, hata: h.parcaYok };

  const { data: yeni, error: rpcHata } = await supabase.rpc('stok_hareket', {
    p_stok_id: stokId,
    p_delta: adet,
    p_sebep: 'giris',
    p_aciklama: `${kaynakTemiz || 'Tedarikçi etiketi'} · ${izAciklamasi(iz)}`,
  });
  if (rpcHata) return { ok: false, hata: rpcHata.message };

  revalidatePath('/envanter');
  return { ok: true, mpn: kalem.mpn, eski: Number(kalem.adet), yeni: Number(yeni ?? Number(kalem.adet) + adet) };
}

/** Kamera ile sayılan adedi stoğa İŞLER: adedi `sayilan`a ayarlar, farkı "Sayım" hareketi olarak kaydeder.
 * Mutlak değer olduğu için aynı istek iki kez gelse bile ikincisi fark 0 olur, bir şey değişmez. */
export async function kameraSayimUygula(stokId: string, sayilan: number): Promise<KameraSayimSonucu | KameraHata> {
  const h = (await sozlukAl()).kamera.hata;
  if (typeof stokId !== 'string' || !UUID.test(stokId)) return { ok: false, hata: h.gecersizParca };
  if (!Number.isInteger(sayilan) || sayilan < 0 || sayilan > MAKS_ADET) return { ok: false, hata: h.gecersizAdet };
  const { supabase, user } = await kullanici();
  if (!user) return { ok: false, hata: h.oturumYok };

  const { data: kalem, error } = await supabase
    .from('envanter')
    .select('mpn, adet')
    .eq('stok_id', stokId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, hata: error.message };
  if (!kalem) return { ok: false, hata: h.parcaYok };

  const eski = Number(kalem.adet);
  const delta = sayilan - eski;
  // stok_hareket() sıfır farkı reddeder; sayım tuttuysa hareket yazmaya gerek yok
  if (delta === 0) return { ok: true, mpn: kalem.mpn, eski, yeni: eski, degisti: false };

  const { data: yeni, error: rpcHata } = await supabase.rpc('stok_hareket', {
    p_stok_id: stokId,
    p_delta: delta,
    p_sebep: 'sayim',
    p_aciklama: `Kamera sayımı: ${sayilan} adet`,
  });
  if (rpcHata) return { ok: false, hata: rpcHata.message };

  revalidatePath('/envanter');
  return { ok: true, mpn: kalem.mpn, eski, yeni: Number(yeni ?? sayilan), degisti: true };
}
