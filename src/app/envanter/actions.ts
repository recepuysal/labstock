'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { metinToParametreler } from '@/lib/types';
import { lcscKoduGetir } from '@/lib/lcsc';
import { direncUrldenCek } from '@/lib/direnc';
import { robotistanUrldenCek } from '@/lib/robotistan';
import { motorobitUrldenCek } from '@/lib/motorobit';
import type { ModulVerisi } from '@/lib/direnc';
import { geminiIleUrunCek, geminiIleAciklamaCevir } from '@/lib/gemini';
import { TARAYICI_USER_AGENT } from '@/lib/urun-ld-json';
import { GORUNUM_COOKIE } from '@/lib/gozlemci';

export type EylemDurum = { hata?: string; bilgi?: string };

/** Kendi deponla izlediğin (varsa) depo arasında geçiş yapar. */
export async function gorunumuDegistir(hedef: 'kendi' | 'gozlemci'): Promise<void> {
  const cookieDeposu = await cookies();

  if (hedef === 'kendi') {
    cookieDeposu.delete(GORUNUM_COOKIE);
    return;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profil } = await supabase.from('profiles').select('gozlemci_of').eq('id', user.id).maybeSingle();
  if (!profil?.gozlemci_of) return;

  cookieDeposu.set(GORUNUM_COOKIE, profil.gozlemci_of, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

const IZINLI_RESIM_TURLERI = ['image/png', 'image/jpeg', 'image/webp'];
const AZAMI_RESIM_BOYUTU = 2 * 1024 * 1024; // 2 MB

/** Formdan gelen (varsa) parça görselini doğrular; geçersizse hata döner, yoksa null döner. */
function parcaResmiDogrula(ham: FormDataEntryValue | null): { dosya: File | null; hata?: string } {
  if (!(ham instanceof File) || ham.size === 0) return { dosya: null };
  if (!IZINLI_RESIM_TURLERI.includes(ham.type)) {
    return { dosya: null, hata: 'Görsel sadece PNG, JPEG ya da WEBP olabilir.' };
  }
  if (ham.size > AZAMI_RESIM_BOYUTU) {
    return { dosya: null, hata: 'Görsel en fazla 2 MB olabilir.' };
  }
  return { dosya: ham };
}

/** Parça görselini Storage'a yükler ve genel-erişimli URL'ini döner. */
async function parcaResminiYukle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  partId: string,
  dosya: File,
): Promise<{ url?: string; hata?: string }> {
  const uzanti = dosya.type.split('/')[1];
  const yol = `${userId}/${partId}.${uzanti}`;

  const { error: yuklemeHatasi } = await supabase.storage
    .from('parca-resimleri')
    .upload(yol, dosya, { upsert: true, contentType: dosya.type });
  if (yuklemeHatasi) return { hata: `Görsel yüklenemedi: ${yuklemeHatasi.message}` };

  const {
    data: { publicUrl },
  } = supabase.storage.from('parca-resimleri').getPublicUrl(yol);

  return { url: `${publicUrl}?t=${Date.now()}` };
}

function rohsDegerinden(ham: FormDataEntryValue | null): boolean | null {
  const deger = String(ham ?? '');
  if (deger === 'evet') return true;
  if (deger === 'hayir') return false;
  return null;
}

/** Hızlı +/- : stok_hareket() RPC'si adet güncellemesi ile hareket kaydını birlikte yapar. */
export async function stokHareket(stokId: string, delta: number): Promise<EylemDurum> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('stok_hareket', {
    p_stok_id: stokId,
    p_delta: delta,
    p_sebep: 'manuel',
  });

  if (error) return { hata: error.message };

  revalidatePath('/envanter');
  return {};
}

/** Stok kalemini siler (parça, ortak katalogda diğer kullanıcılar için kalır). */
export async function stokSil(stokId: string): Promise<EylemDurum> {
  const supabase = await createClient();
  const { error } = await supabase.from('stock_items').delete().eq('id', stokId);
  if (error) return { hata: error.message };

  revalidatePath('/envanter');
  return {};
}

export async function konumEkle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const ad = String(formData.get('ad') ?? '').trim();
  if (!ad) return { hata: 'Ad zorunlu.' };

  const kod = String(formData.get('kod') ?? '').trim() || null;
  const tip = String(formData.get('tip') ?? '').trim() || null;
  const aciklama = String(formData.get('aciklama') ?? '').trim() || null;
  const parentId = String(formData.get('parent_id') ?? '') || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  const { error } = await supabase.from('locations').insert({
    user_id: user.id,
    ad,
    kod,
    tip,
    aciklama,
    parent_id: parentId,
  });

  if (error) return { hata: error.message };

  revalidatePath('/envanter');
  redirect('/envanter');
}

export async function konumGuncelle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const konumId = String(formData.get('konum_id') ?? '');
  if (!konumId) return { hata: 'Geçersiz konum.' };

  const ad = String(formData.get('ad') ?? '').trim();
  if (!ad) return { hata: 'Ad zorunlu.' };

  const kod = String(formData.get('kod') ?? '').trim() || null;
  const tip = String(formData.get('tip') ?? '').trim() || null;
  const aciklama = String(formData.get('aciklama') ?? '').trim() || null;
  const parentId = String(formData.get('parent_id') ?? '') || null;

  if (parentId === konumId) return { hata: 'Bir konum kendi üst konumu olamaz.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('locations')
    .update({ ad, kod, tip, aciklama, parent_id: parentId })
    .eq('id', konumId);

  if (error) return { hata: error.message };

  revalidatePath('/envanter');
  return { bilgi: 'Güncellendi.' };
}

/** Konumu siler — alt konumları da (parent_id on delete cascade) birlikte silinir. */
export async function konumSil(konumId: string): Promise<EylemDurum> {
  const supabase = await createClient();
  const { error } = await supabase.from('locations').delete().eq('id', konumId);
  if (error) return { hata: error.message };

  revalidatePath('/envanter');
  return {};
}

export async function parcaEkle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const mpn = String(formData.get('mpn') ?? '').trim();
  if (!mpn) return { hata: 'MPN (parça numarası) zorunlu.' };

  const uretici = String(formData.get('uretici') ?? '').trim() || null;
  const aciklama = String(formData.get('aciklama') ?? '').trim() || null;
  const kategori = String(formData.get('kategori') ?? '').trim() || null;
  const kilif = String(formData.get('kilif') ?? '').trim() || null;
  const konumId = String(formData.get('konum_id') ?? '') || null;
  const adet = Number(formData.get('adet') ?? 0);
  const minAdet = Number(formData.get('min_adet') ?? 0);
  const tedarikci = String(formData.get('tedarikci') ?? '').trim() || null;
  const tedarikciKodu = String(formData.get('tedarikci_kodu') ?? '').trim() || null;
  const alisFiyatiHam = String(formData.get('alis_fiyati') ?? '').trim();
  const alisFiyati = alisFiyatiHam ? Number(alisFiyatiHam) : null;
  const paraBirimi = String(formData.get('para_birimi') ?? 'TRY').trim() || 'TRY';
  const datasheetUrl = String(formData.get('datasheet_url') ?? '').trim() || null;
  const parametreler = metinToParametreler(String(formData.get('parametreler') ?? ''));
  const otomatikResimUrl = String(formData.get('otomatik_resim_url') ?? '').trim() || null;
  const { dosya: resimDosyasi, hata: resimHatasi } = parcaResmiDogrula(formData.get('resim'));
  if (resimHatasi) return { hata: resimHatasi };

  if (!Number.isFinite(adet) || adet < 0) return { hata: 'Adet geçersiz.' };
  if (!Number.isFinite(minAdet) || minAdet < 0) return { hata: 'Minimum seviye geçersiz.' };
  if (alisFiyati !== null && (!Number.isFinite(alisFiyati) || alisFiyati < 0)) {
    return { hata: 'Alım fiyatı geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  // 1) Ortak katalogda parça var mı? (mpn, üretici) çifti unique index'teki
  // gibi eşleşiyor olmalı — yoksa üretici farklı bir "XL6009" ile aynı
  // parça sanılıp yanlış eşleşir.
  let aramaSorgu = supabase.from('parts').select('id').ilike('mpn', mpn);
  aramaSorgu = uretici ? aramaSorgu.ilike('uretici', uretici) : aramaSorgu.is('uretici', null);
  const { data: mevcut, error: aramaHatasi } = await aramaSorgu.limit(1).maybeSingle();

  if (aramaHatasi) return { hata: aramaHatasi.message };

  let partId = mevcut?.id as string | undefined;

  if (!partId) {
    const { data: yeni, error: ekleHatasi } = await supabase
      .from('parts')
      .insert({
        mpn,
        uretici,
        aciklama,
        kategori,
        kilif,
        datasheet_url: datasheetUrl,
        parametreler,
        resim_url: otomatikResimUrl,
        olusturan: user.id,
      })
      .select('id')
      .single();

    if (ekleHatasi) {
      if (ekleHatasi.code === '23505') {
        return { hata: `"${mpn}"${uretici ? ` / ${uretici}` : ''} zaten katalogda kayıtlı.` };
      }
      return { hata: ekleHatasi.message };
    }
    partId = yeni.id;
  }

  if (!partId) return { hata: 'Parça oluşturulamadı.' };

  if (resimDosyasi) {
    const { url, hata } = await parcaResminiYukle(supabase, user.id, partId, resimDosyasi);
    if (hata) return { hata };
    await supabase.from('parts').update({ resim_url: url }).eq('id', partId);
  } else if (otomatikResimUrl && mevcut?.id) {
    // Parça zaten vardı — yukarıdaki insert bu durumda çalışmadığı için resmi ayrıca yaz.
    await supabase.from('parts').update({ resim_url: otomatikResimUrl }).eq('id', partId);
  }

  // 2) Bu parça bu konumda zaten var mı? (kendi stoğunla sınırlı — izlediğin
  // bir depo varsa oradaki aynı parça/konum kombinasyonuyla karışmasın diye)
  let sorgu = supabase
    .from('stock_items')
    .select('id, adet')
    .eq('part_id', partId)
    .eq('user_id', user.id)
    .limit(1);
  sorgu = konumId ? sorgu.eq('location_id', konumId) : sorgu.is('location_id', null);

  const { data: stok, error: stokHatasi } = await sorgu.maybeSingle();
  if (stokHatasi) return { hata: stokHatasi.message };

  if (stok) {
    if (adet > 0) {
      const { error } = await supabase.rpc('stok_hareket', {
        p_stok_id: stok.id,
        p_delta: adet,
        p_sebep: 'giris',
        p_aciklama: 'elle giriş',
      });
      if (error) return { hata: error.message };
    }
  } else {
    const { data: yeniStok, error } = await supabase
      .from('stock_items')
      .insert({
        part_id: partId,
        location_id: konumId,
        adet: 0,
        min_adet: minAdet,
        tedarikci,
        tedarikci_kodu: tedarikciKodu,
        alis_fiyati: alisFiyati,
        para_birimi: paraBirimi,
        user_id: user.id,
      })
      .select('id')
      .single();

    if (error) return { hata: error.message };

    if (adet > 0) {
      const { error: hareketHatasi } = await supabase.rpc('stok_hareket', {
        p_stok_id: yeniStok.id,
        p_delta: adet,
        p_sebep: 'giris',
        p_aciklama: 'ilk giriş',
      });
      if (hareketHatasi) return { hata: hareketHatasi.message };
    }
  }

  revalidatePath('/envanter');
  return { bilgi: 'Eklendi.' };
}

export async function parcaGuncelle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const stokId = String(formData.get('stok_id') ?? '');
  const partId = String(formData.get('part_id') ?? '');
  if (!stokId || !partId) return { hata: 'Geçersiz kayıt.' };

  const mpn = String(formData.get('mpn') ?? '').trim();
  if (!mpn) return { hata: 'MPN (parça numarası) zorunlu.' };

  const uretici = String(formData.get('uretici') ?? '').trim() || null;
  const aciklama = String(formData.get('aciklama') ?? '').trim() || null;
  const kategori = String(formData.get('kategori') ?? '').trim() || null;
  const kilif = String(formData.get('kilif') ?? '').trim() || null;
  const konumId = String(formData.get('konum_id') ?? '') || null;
  const minAdet = Number(formData.get('min_adet') ?? 0);
  const tedarikci = String(formData.get('tedarikci') ?? '').trim() || null;
  const tedarikciKodu = String(formData.get('tedarikci_kodu') ?? '').trim() || null;
  const alisFiyatiHam = String(formData.get('alis_fiyati') ?? '').trim();
  const alisFiyati = alisFiyatiHam ? Number(alisFiyatiHam) : null;
  const paraBirimi = String(formData.get('para_birimi') ?? 'TRY').trim() || 'TRY';
  const datasheetUrl = String(formData.get('datasheet_url') ?? '').trim() || null;
  const parametreler = metinToParametreler(String(formData.get('parametreler') ?? ''));
  const otomatikResimUrl = String(formData.get('otomatik_resim_url') ?? '').trim() || null;
  const { dosya: resimDosyasi, hata: resimHatasi } = parcaResmiDogrula(formData.get('resim'));
  if (resimHatasi) return { hata: resimHatasi };

  if (!Number.isFinite(minAdet) || minAdet < 0) return { hata: 'Minimum seviye geçersiz.' };
  if (alisFiyati !== null && (!Number.isFinite(alisFiyati) || alisFiyati < 0)) {
    return { hata: 'Alım fiyatı geçersiz.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  let resimUrl: string | undefined;
  if (resimDosyasi) {
    const sonuc = await parcaResminiYukle(supabase, user.id, partId, resimDosyasi);
    if (sonuc.hata) return { hata: sonuc.hata };
    resimUrl = sonuc.url;
  } else if (otomatikResimUrl) {
    resimUrl = otomatikResimUrl;
  }

  // Katalog alanları (mpn/üretici/açıklama/kategori/kılıf/datasheet/parametreler/resim) sadece
  // parçayı ekleyen kullanıcı tarafından güncellenebilir (parts_update_own RLS politikası)
  // — bu ortak bir katalog satırı olduğu için. Başkasının eklediği bir parçaysa bu
  // güncelleme RLS tarafından sessizce hiçbir satırı etkilemeden geçer; stok
  // tarafındaki (konum/min. seviye) güncelleme yine de uygulanır.
  const parcaGuncelleme: Record<string, unknown> = {
    mpn,
    uretici,
    aciklama,
    kategori,
    kilif,
    datasheet_url: datasheetUrl,
    parametreler,
  };
  if (resimUrl) parcaGuncelleme.resim_url = resimUrl;

  const { error: parcaHatasi } = await supabase.from('parts').update(parcaGuncelleme).eq('id', partId);

  if (parcaHatasi) {
    if (parcaHatasi.code === '23505') {
      return { hata: `"${mpn}"${uretici ? ` / ${uretici}` : ''} zaten katalogda başka bir parça olarak kayıtlı.` };
    }
    return { hata: parcaHatasi.message };
  }

  const { error: stokHatasi } = await supabase
    .from('stock_items')
    .update({
      location_id: konumId,
      min_adet: minAdet,
      tedarikci,
      tedarikci_kodu: tedarikciKodu,
      alis_fiyati: alisFiyati,
      para_birimi: paraBirimi,
    })
    .eq('id', stokId);

  if (stokHatasi) return { hata: stokHatasi.message };

  const donus = String(formData.get('donus') ?? '') || '/envanter';
  revalidatePath('/envanter');
  revalidatePath(donus);
  return { bilgi: 'Güncellendi.' };
}

/** Parçayı bir projenin BOM'una ekler/günceller; proje yeni ise önce oluşturur. */
export async function projeyeEkle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const partId = String(formData.get('part_id') ?? '');
  if (!partId) return { hata: 'Geçersiz parça.' };

  const projeId = String(formData.get('proje_id') ?? '') || null;
  const yeniProjeAdi = String(formData.get('yeni_proje_adi') ?? '').trim();
  const adet = Number(formData.get('adet') ?? 1);
  const referans = String(formData.get('referans') ?? '').trim() || null;
  const donus = String(formData.get('donus') ?? '') || '/envanter';

  if (!projeId && !yeniProjeAdi) return { hata: 'Bir proje seç ya da yeni proje adı gir.' };
  if (!Number.isFinite(adet) || adet <= 0) return { hata: 'Adet geçersiz.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  let hedefProjeId = projeId;

  if (!hedefProjeId) {
    const { data: yeniProje, error } = await supabase
      .from('projects')
      .insert({ ad: yeniProjeAdi, user_id: user.id })
      .select('id')
      .single();
    if (error) return { hata: error.message };
    hedefProjeId = yeniProje.id;
  }

  const { error } = await supabase
    .from('project_bom')
    .upsert(
      { proje_id: hedefProjeId, part_id: partId, adet, referans, user_id: user.id },
      { onConflict: 'proje_id,part_id' },
    );

  if (error) return { hata: error.message };

  revalidatePath(donus);
  return {};
}

/** Bir BOM satırını (parça-proje ilişkisini) kaldırır. */
export async function projedenCikar(bomId: string, donus: string): Promise<EylemDurum> {
  const supabase = await createClient();
  const { error } = await supabase.from('project_bom').delete().eq('id', bomId);
  if (error) return { hata: error.message };

  revalidatePath(donus);
  return {};
}

/** LCSC ürün sayfasından üretici/açıklama/kategori/kılıf/datasheet/resim/parametreleri/RoHS bilgisini çekip kaydeder. */
export async function lcscdenCek(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const stokId = String(formData.get('stok_id') ?? '');
  const partId = String(formData.get('part_id') ?? '');
  const kod = String(formData.get('lcsc_kodu') ?? '').trim();
  if (!stokId || !partId) return { hata: 'Geçersiz kayıt.' };
  if (!kod) return { hata: 'LCSC kodu gerekli (ör. C25804).' };

  let veri;
  try {
    veri = await lcscKoduGetir(kod);
  } catch (err) {
    return { hata: err instanceof Error ? err.message : 'LCSC verisi alınamadı.' };
  }

  const supabase = await createClient();

  // LCSC'nin açıklaması genelde İngilizce/Çince karışık ve kötü yazılmış -
  // kullanıcının bir Gemini API anahtarı varsa daha kısa, doğal bir Türkçe
  // açıklamayla değiştir. Çeviri başarısız olursa (anahtar geçersiz, kota
  // dolu vb.) ham LCSC açıklamasıyla devam edilir; bu adım engelleyici değil.
  if (veri.aciklama) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data: profil } = await supabase
        .from('profiles')
        .select('gemini_api_key')
        .eq('id', user.id)
        .maybeSingle();
      const apiAnahtari = profil?.gemini_api_key as string | null | undefined;
      if (apiAnahtari) {
        try {
          veri.aciklama = await geminiIleAciklamaCevir(apiAnahtari, veri.aciklama, kod);
        } catch (err) {
          console.error('lcscdenCek: aciklama cevirisi basarisiz:', err);
        }
      }
    }
  }

  const partGuncelleme: Record<string, unknown> = {};
  if (veri.uretici) partGuncelleme.uretici = veri.uretici;
  if (veri.aciklama) partGuncelleme.aciklama = veri.aciklama;
  if (veri.kategori) partGuncelleme.kategori = veri.kategori;
  if (veri.kilif) partGuncelleme.kilif = veri.kilif;
  if (veri.datasheetUrl) partGuncelleme.datasheet_url = veri.datasheetUrl;
  if (veri.resimUrl) partGuncelleme.resim_url = veri.resimUrl;
  if (Object.keys(veri.parametreler).length > 0) partGuncelleme.parametreler = veri.parametreler;
  if (veri.rohs !== null) partGuncelleme.rohs = veri.rohs;

  if (Object.keys(partGuncelleme).length > 0) {
    const { error } = await supabase.from('parts').update(partGuncelleme).eq('id', partId);
    if (error) {
      if (error.code === '23505') {
        return {
          hata: `LCSC'den gelen üretici ("${veri.uretici}") bu MPN için katalogda başka bir parçada zaten kayıtlı. O parçayla birleştirmek için önce onu düzenleyip kaydı temizlemen gerekiyor.`,
        };
      }
      return { hata: error.message };
    }
  }

  const stokGuncelleme: Record<string, unknown> = { tedarikci: 'LCSC', tedarikci_kodu: kod };
  if (veri.fiyat != null) {
    stokGuncelleme.alis_fiyati = veri.fiyat;
    stokGuncelleme.para_birimi = veri.paraBirimi;
  }
  const { error: stokHatasi } = await supabase.from('stock_items').update(stokGuncelleme).eq('id', stokId);
  if (stokHatasi) return { hata: stokHatasi.message };

  revalidatePath(`/envanter/${stokId}`);
  return {};
}

/** Bir ürün linkinin hangi tedarikçiye ait olduğunu host adına göre belirler. */
/** Bilinen (JSON-LD tabanlı, ücretsiz ve hızlı) site tedarikçileri. */
function bilinenTedarikciTespitEt(url: string): { ad: string; getir: (url: string) => Promise<ModulVerisi> } | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (host === 'direnc.net' || host === 'www.direnc.net') return { ad: 'Direnç.net', getir: direncUrldenCek };
  if (host === 'robotistan.com' || host === 'www.robotistan.com') return { ad: 'Robotistan', getir: robotistanUrldenCek };
  if (host === 'motorobit.com' || host === 'www.motorobit.com') return { ad: 'Motorobit', getir: motorobitUrldenCek };
  return null;
}

const OZEL_AG_DESENI = /^(localhost|127\.|0\.0\.0\.0|169\.254\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|\[?::1\]?)/i;

/** Yapay zeka yolunda (bilinmeyen siteler) sunucunun kendi ağına/localhost'a
 * istek atmasını önlemek için basit bir güvenlik kontrolü. */
function guvenliDisUrlMi(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return !OZEL_AG_DESENI.test(url.hostname);
}

export type LinkOnizilemesi = { hata?: string; veri?: ModulVerisi; tedarikciAdi?: string };

/** Malzeme formunda "Linkten çek" butonu için: önce bilinen sitelerin
 * (Direnç.net/Robotistan/Motorobit) hızlı JSON-LD okuyucusunu dener; site
 * tanınmıyorsa ve kullanıcı Ayarlar'dan bir Gemini API anahtarı eklemişse
 * sayfayı yapay zekaya okutup aynı şekilde doldurur. Kaydetmez — formu
 * doldurup kullanıcıya gözden geçirme fırsatı vermek içindir (bkz. ParcaFormu). */
export async function linkOnizle(url: string): Promise<LinkOnizilemesi> {
  const temizUrl = url.trim();
  if (!temizUrl) return { hata: 'Bağlantı gerekli.' };

  const bilinen = bilinenTedarikciTespitEt(temizUrl);
  if (bilinen) {
    try {
      const veri = await bilinen.getir(temizUrl);
      return { veri, tedarikciAdi: bilinen.ad };
    } catch (err) {
      console.error('linkOnizle:', err);
      return { hata: err instanceof Error ? err.message : 'Çekilemedi.' };
    }
  }

  let ayrikUrl: URL;
  try {
    ayrikUrl = new URL(temizUrl);
  } catch {
    return { hata: 'Geçersiz bağlantı.' };
  }
  if (!guvenliDisUrlMi(ayrikUrl)) return { hata: 'Geçersiz bağlantı.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  const { data: profil } = await supabase
    .from('profiles')
    .select('gemini_api_key')
    .eq('id', user.id)
    .maybeSingle();
  const apiAnahtari = profil?.gemini_api_key as string | null | undefined;

  if (!apiAnahtari) {
    return {
      hata:
        'Bu site için hazır destek yok. Ayarlar sayfasından ücretsiz bir Gemini API anahtarı eklersen artık her siteden çekebilirsin.',
    };
  }

  try {
    const sayfaYaniti = await fetch(ayrikUrl.toString(), { headers: { 'User-Agent': TARAYICI_USER_AGENT } });
    if (!sayfaYaniti.ok) return { hata: `Sayfa alınamadı (HTTP ${sayfaYaniti.status}).` };
    const html = await sayfaYaniti.text();

    const veri = await geminiIleUrunCek(apiAnahtari, ayrikUrl.toString(), html);
    return { veri, tedarikciAdi: ayrikUrl.hostname.replace(/^www\./, '') };
  } catch (err) {
    console.error('linkOnizle (yapay zeka):', err);
    return { hata: err instanceof Error ? err.message : 'Çekilemedi.' };
  }
}

/** Bir stok kalemine etiket ekler; etiket kullanıcıda yoksa önce oluşturur. */
export async function etiketEkle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const stokId = String(formData.get('stok_id') ?? '');
  const ad = String(formData.get('etiket_adi') ?? '').trim();
  if (!stokId || !ad) return { hata: 'Etiket adı gerekli.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  const { data: mevcutEtiket, error: aramaHatasi } = await supabase
    .from('tags')
    .select('id')
    .eq('user_id', user.id)
    .ilike('ad', ad)
    .limit(1)
    .maybeSingle();
  if (aramaHatasi) return { hata: aramaHatasi.message };

  let etiketId = mevcutEtiket?.id as string | undefined;
  if (!etiketId) {
    const { data: yeniEtiket, error: ekleHatasi } = await supabase
      .from('tags')
      .insert({ user_id: user.id, ad })
      .select('id')
      .single();
    if (ekleHatasi) return { hata: ekleHatasi.message };
    etiketId = yeniEtiket.id;
  }

  const { error } = await supabase
    .from('stock_item_tags')
    .upsert({ stock_item_id: stokId, tag_id: etiketId }, { onConflict: 'stock_item_id,tag_id' });
  if (error) return { hata: error.message };

  revalidatePath(`/envanter/${stokId}`);
  return {};
}

/** Bir stok kaleminden etiketi kaldırır (etiketin kendisi silinmez, listede kalır). */
export async function etiketSil(stokId: string, tagId: string): Promise<EylemDurum> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('stock_item_tags')
    .delete()
    .eq('stock_item_id', stokId)
    .eq('tag_id', tagId);
  if (error) return { hata: error.message };

  revalidatePath(`/envanter/${stokId}`);
  return {};
}
