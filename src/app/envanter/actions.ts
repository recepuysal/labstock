'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { metinToParametreler } from '@/lib/types';
import { lcscKoduGetir } from '@/lib/lcsc';
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

  // 1) Ortak katalogda parça var mı? Yoksa ekle.
  const { data: mevcut, error: aramaHatasi } = await supabase
    .from('parts')
    .select('id')
    .ilike('mpn', mpn)
    .limit(1)
    .maybeSingle();

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
        olusturan: user.id,
      })
      .select('id')
      .single();

    if (ekleHatasi) return { hata: ekleHatasi.message };
    partId = yeni.id;
  }

  if (!partId) return { hata: 'Parça oluşturulamadı.' };

  if (resimDosyasi) {
    const { url, hata } = await parcaResminiYukle(supabase, user.id, partId, resimDosyasi);
    if (hata) return { hata };
    await supabase.from('parts').update({ resim_url: url }).eq('id', partId);
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

  if (parcaHatasi) return { hata: parcaHatasi.message };

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

/** LCSC ürün sayfasından üretici/açıklama/kategori/kılıf/datasheet/resim/parametreleri çekip kaydeder. */
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

  const partGuncelleme: Record<string, unknown> = {};
  if (veri.uretici) partGuncelleme.uretici = veri.uretici;
  if (veri.aciklama) partGuncelleme.aciklama = veri.aciklama;
  if (veri.kategori) partGuncelleme.kategori = veri.kategori;
  if (veri.kilif) partGuncelleme.kilif = veri.kilif;
  if (veri.datasheetUrl) partGuncelleme.datasheet_url = veri.datasheetUrl;
  if (veri.resimUrl) partGuncelleme.resim_url = veri.resimUrl;
  if (Object.keys(veri.parametreler).length > 0) partGuncelleme.parametreler = veri.parametreler;

  if (Object.keys(partGuncelleme).length > 0) {
    const { error } = await supabase.from('parts').update(partGuncelleme).eq('id', partId);
    if (error) return { hata: error.message };
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
