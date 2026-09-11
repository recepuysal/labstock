'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import type { EylemDurum } from '@/app/envanter/actions';
import type { EnvanterSatiri } from '@/lib/types';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { ETIKET_AYAR_COOKIE, type EtiketAyarlari } from '@/lib/etiket';

export async function geriBildirimGonder(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const mesaj = String(formData.get('mesaj') ?? '').trim();
  const surum = String(formData.get('surum') ?? '').trim() || null;

  if (!mesaj) return { hata: 'Bir şeyler yaz.' };
  if (mesaj.length > 4000) return { hata: 'Mesaj en fazla 4000 karakter olabilir.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  const { error } = await supabase.from('feedback').insert({ user_id: user.id, mesaj, surum });
  if (error) return { hata: error.message };

  return { bilgi: 'Gönderildi, teşekkürler!' };
}

/** Etiket (QR) görünüm tercihini (şekil/boyut/marka) kaydeder. */
export async function etiketAyarlariniKaydet(ayarlar: EtiketAyarlari): Promise<void> {
  const cookieDeposu = await cookies();
  cookieDeposu.set(ETIKET_AYAR_COOKIE, JSON.stringify(ayarlar), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function profilGuncelle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const ad = String(formData.get('ad') ?? '').trim();
  const telefon = String(formData.get('telefon') ?? '').trim() || null;
  const sirketAdi = String(formData.get('sirket_adi') ?? '').trim() || null;
  const sirketAdresi = String(formData.get('sirket_adresi') ?? '').trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  // update yerine upsert: profiles satırı (tetikleyici çalışmamışsa) hiç
  // olmayabilir — bu durumda update sessizce 0 satır etkiler, upsert ise
  // satırı yoksa oluşturur.
  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      ad: ad || null,
      telefon,
      sirket_adi: sirketAdi,
      sirket_adresi: sirketAdresi,
    },
    { onConflict: 'id' },
  );

  if (error) return { hata: error.message };

  revalidatePath('/', 'layout');
  return { bilgi: 'Kaydedildi.' };
}

const IZINLI_TURLER = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const AZAMI_BOYUT = 2 * 1024 * 1024; // 2 MB

export async function profilResmiYukle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const dosya = formData.get('resim');
  if (!(dosya instanceof File) || dosya.size === 0) return { hata: 'Bir görsel seç.' };
  if (!IZINLI_TURLER.includes(dosya.type)) return { hata: 'Sadece PNG, JPEG, WEBP veya SVG kabul edilir.' };
  if (dosya.size > AZAMI_BOYUT) return { hata: 'Görsel en fazla 2 MB olabilir.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  const uzanti = dosya.type.split('/')[1] === 'svg+xml' ? 'svg' : dosya.type.split('/')[1];
  const yol = `${user.id}/profil.${uzanti}`;

  const { error: yuklemeHatasi } = await supabase.storage
    .from('profil-resimleri')
    .upload(yol, dosya, { upsert: true, contentType: dosya.type });
  if (yuklemeHatasi) {
    console.error('[profil-resmi] yukleme hatasi:', yuklemeHatasi);
    return { hata: `Yükleme hatası: ${yuklemeHatasi.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('profil-resimleri').getPublicUrl(yol);

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, resim_url: `${publicUrl}?t=${Date.now()}` }, { onConflict: 'id' });

  if (error) {
    console.error('[profil-resmi] guncelleme hatasi:', error);
    return { hata: `Kayıt hatası: ${error.message}` };
  }

  revalidatePath('/', 'layout');
  return { bilgi: 'Görsel güncellendi.' };
}

export type DisaAktarSonuc = { hata?: string; xlsxTaban64?: string };

const DURUM_METNI: Record<string, string> = {
  yeterli: 'Yeterli',
  az: 'Az kaldı',
  kritik: 'Kritik',
  yok: 'Yok',
};

/** Tüm envanteri .xlsx dosyası olarak (base64) döndürür — indirme işlemi tarayıcı tarafında yapılır.
 * CSV yerine gerçek bir Excel dosyası üretiyoruz: Türkçe Windows/Excel virgülü ondalık ayracı
 * olarak kullandığından düz virgüllü CSV'yi tek sütun halinde açar (noktalı virgül beklenir). */
export async function envanterDisaAktar(): Promise<DisaAktarSonuc> {
  const supabase = await createClient();
  const aktif = await aktifGorunumAl();
  if (!aktif) return { hata: 'Oturum bulunamadı.' };

  const { data, error } = await supabase
    .from('envanter')
    .select('*')
    .eq('user_id', aktif.kullaniciId)
    .order('mpn', { ascending: true });
  if (error) return { hata: error.message };
  const satirlar = (data ?? []) as EnvanterSatiri[];

  const stokIdleri = satirlar.map((s) => s.stok_id);
  const { data: etiketVerisi } =
    stokIdleri.length > 0
      ? await supabase.from('stock_item_tags').select('stock_item_id, tags(ad)').in('stock_item_id', stokIdleri)
      : { data: [] };
  const etiketHaritasi = new Map<string, string[]>();
  for (const row of etiketVerisi ?? []) {
    const ad = (row.tags as unknown as { ad: string } | null)?.ad;
    if (!ad) continue;
    const liste = etiketHaritasi.get(row.stock_item_id) ?? [];
    liste.push(ad);
    etiketHaritasi.set(row.stock_item_id, liste);
  }

  const basliklar = [
    'MPN',
    'Üretici',
    'Açıklama',
    'Kategori',
    'Kılıf',
    'RoHS',
    'Konum',
    'Adet',
    'Min. Adet',
    'Durum',
    'Tedarikçi',
    'Tedarikçi Kodu',
    'Alış Fiyatı',
    'Para Birimi',
    'Datasheet URL',
    'Etiketler',
    'Son Güncelleme',
  ];

  const veriSatirlari = satirlar.map((s) => [
    s.mpn,
    s.uretici ?? '',
    s.aciklama ?? '',
    s.kategori ?? '',
    s.kilif ?? '',
    s.rohs === true ? 'Evet' : s.rohs === false ? 'Hayır' : '',
    s.konum_adi ?? '',
    s.adet,
    s.min_adet,
    DURUM_METNI[s.durum] ?? s.durum,
    s.tedarikci ?? '',
    s.tedarikci_kodu ?? '',
    s.alis_fiyati ?? '',
    s.para_birimi,
    s.datasheet_url ?? '',
    (etiketHaritasi.get(s.stok_id) ?? []).join('; '),
    s.updated_at ? new Date(s.updated_at).toLocaleString('tr-TR') : '',
  ]);

  const sayfa = XLSX.utils.aoa_to_sheet([basliklar, ...veriSatirlari]);
  sayfa['!cols'] = basliklar.map((b) => ({ wch: Math.max(10, b.length + 2) }));
  const kitap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(kitap, sayfa, 'Envanter');

  const arabellek = XLSX.write(kitap, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return { xlsxTaban64: arabellek.toString('base64') };
}

const KOD_ALFABE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 0/O, 1/I/L gibi karışabilecek karakterler hariç

function rastgeleKod(uzunluk = 8): string {
  let kod = '';
  for (let i = 0; i < uzunluk; i++) kod += KOD_ALFABE[Math.floor(Math.random() * KOD_ALFABE.length)];
  return kod;
}

export type DavetKoduSonuc = { hata?: string; kod?: string };

/** Bu kullanıcı için yeni bir gözlemci davet kodu üretir (varsa öncekinin yerine geçer). */
export async function davetKoduOlustur(): Promise<DavetKoduSonuc> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  for (let deneme = 0; deneme < 5; deneme++) {
    const kod = rastgeleKod();
    const { error } = await supabase.from('profiles').upsert({ id: user.id, davet_kodu: kod }, { onConflict: 'id' });
    if (!error) {
      revalidatePath('/ayarlar');
      return { kod };
    }
    if (error.code !== '23505') return { hata: error.message };
  }
  return { hata: 'Kod oluşturulamadı, tekrar dene.' };
}

/** Girilen davet koduyla, kodun sahibinin gözlemcisi olur (salt-okunur erişim). */
export async function davetKoduIleBaglan(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const kod = String(formData.get('kod') ?? '').trim();
  if (!kod) return { hata: 'Davet kodu gerekli.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('gozlemci_baglan', { p_kod: kod });
  if (error) return { hata: error.message };

  revalidatePath('/', 'layout');
  return { bilgi: 'Bağlantı kuruldu.' };
}

/** Gözlemcilik bağlantısını kaldırır — kendi hesabına dönersin. */
export async function gozlemcilikKaldir(): Promise<EylemDurum> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  const { error } = await supabase.from('profiles').update({ gozlemci_of: null }).eq('id', user.id);
  if (error) return { hata: error.message };

  revalidatePath('/', 'layout');
  return { bilgi: 'Bağlantı kaldırıldı.' };
}

/** Sahibin, seni izleyen belirli bir hesabı tek taraflı çıkarması. */
export async function gozlemciyiCikar(gozlemciId: string): Promise<EylemDurum> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('gozlemciyi_cikar', { p_gozlemci_id: gozlemciId });
  if (error) return { hata: error.message };

  revalidatePath('/ayarlar');
  return { bilgi: 'Çıkarıldı.' };
}
