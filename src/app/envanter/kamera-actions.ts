'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/* Kamera sayımı (telefon kamerası + bilgisayardaki görüntü işleme servisi) için sunucu eylemleri.
 * Köprü bileşeni (kamera-sayim-koprusu.tsx) servisten gelen istekleri bunlarla yanıtlar.
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
  if (typeof stokId !== 'string' || !UUID.test(stokId)) return { ok: false, hata: 'Geçersiz QR kodu' };
  const { supabase, user } = await kullanici();
  if (!user) return { ok: false, hata: 'LabStock\'ta oturum açık değil' };

  const { data, error } = await supabase
    .from('envanter')
    .select('stok_id, mpn, aciklama, adet, birim, konum_kodu, konum_adi')
    .eq('stok_id', stokId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, hata: error.message };
  if (!data) return { ok: false, hata: 'Bu parça senin deponda yok' };

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
  if (typeof konumId !== 'string' || !UUID.test(konumId)) return { ok: false, hata: 'Geçersiz QR kodu' };
  const { supabase, user } = await kullanici();
  if (!user) return { ok: false, hata: 'LabStock\'ta oturum açık değil' };

  const { data: konum, error: konumHata } = await supabase
    .from('locations')
    .select('id, kod, ad')
    .eq('id', konumId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (konumHata) return { ok: false, hata: konumHata.message };
  if (!konum) return { ok: false, hata: 'Bu konum senin deponda yok' };

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
    konumAdi: konumMetni(konum.kod, konum.ad) ?? 'Konum',
    parcalar: (data ?? []).map((s) => ({ stokId: s.stok_id, mpn: s.mpn, aciklama: s.aciklama, adet: Number(s.adet) })),
  };
}

export type KameraArama = {
  ok: true;
  parcalar: { stokId: string; mpn: string; aciklama: string | null; adet: number; konum: string | null }[];
};

/** QR etiketi olmayan parçalar için: telefonda ad / MPN / açıklamaya göre arama. */
export async function kameraParcaAra(sorgu: string): Promise<KameraArama | KameraHata> {
  // PostgREST filtresinde anlamı olan karakterleri at (virgül, parantez, joker karakterler)
  const temiz = typeof sorgu === 'string' ? sorgu.replace(/[,()%*\\]/g, ' ').trim().slice(0, 60) : '';
  if (temiz.length < 2) return { ok: true, parcalar: [] };
  const { supabase, user } = await kullanici();
  if (!user) return { ok: false, hata: 'LabStock\'ta oturum açık değil' };

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

/** Kamera ile sayılan adedi stoğa İŞLER: adedi `sayilan`a ayarlar, farkı "Sayım" hareketi olarak kaydeder.
 * Mutlak değer olduğu için aynı istek iki kez gelse bile ikincisi fark 0 olur, bir şey değişmez. */
export async function kameraSayimUygula(stokId: string, sayilan: number): Promise<KameraSayimSonucu | KameraHata> {
  if (typeof stokId !== 'string' || !UUID.test(stokId)) return { ok: false, hata: 'Geçersiz parça' };
  if (!Number.isInteger(sayilan) || sayilan < 0 || sayilan > MAKS_ADET) return { ok: false, hata: 'Geçersiz adet' };
  const { supabase, user } = await kullanici();
  if (!user) return { ok: false, hata: 'LabStock\'ta oturum açık değil' };

  const { data: kalem, error } = await supabase
    .from('envanter')
    .select('mpn, adet')
    .eq('stok_id', stokId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) return { ok: false, hata: error.message };
  if (!kalem) return { ok: false, hata: 'Bu parça senin deponda yok' };

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
