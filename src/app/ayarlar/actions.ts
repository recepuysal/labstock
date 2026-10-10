'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/server';
import type { EylemDurum } from '@/app/envanter/actions';
import type { EnvanterSatiri } from '@/lib/types';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { ETIKET_AYAR_COOKIE, type EtiketAyarlari } from '@/lib/etiket';
import { geminiApiAnahtariniDogrula } from '@/lib/gemini';
import { apiAnahtariniTemizle, claudeApiAnahtariniDogrula } from '@/lib/claude';
import { uyumluAnahtariDogrula, uyumluSaglayiciMi } from '@/lib/openai-uyumlu';
import type { AiSaglayici } from '@/lib/ai-anahtarlari';
import { dilAl, sozlukAl } from '@/lib/i18n/sunucu';
import { sozluk, yerel } from '@/lib/i18n';

/** Bu dosyadaki action'ların kullanıcıya döndürdüğü mesajlar (aktif dilde). */
async function mesajlar() {
  return (await sozlukAl()).ayarlar.eylem;
}

export async function geriBildirimGonder(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const mesaj = String(formData.get('mesaj') ?? '').trim();
  const surum = String(formData.get('surum') ?? '').trim() || null;

  if (!mesaj) return { hata: (await mesajlar()).birSeylerYaz };
  if (mesaj.length > 4000) return { hata: (await mesajlar()).mesajUzun };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: (await mesajlar()).oturumYok };

  const { error } = await supabase.from('feedback').insert({ user_id: user.id, mesaj, surum });
  if (error) return { hata: error.message };

  return { bilgi: (await mesajlar()).gonderildi };
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
  if (!user) return { hata: (await mesajlar()).oturumYok };

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
  return { bilgi: (await mesajlar()).kaydedildi };
}

const IZINLI_TURLER = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const AZAMI_BOYUT = 2 * 1024 * 1024; // 2 MB

export async function profilResmiYukle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const dosya = formData.get('resim');
  if (!(dosya instanceof File) || dosya.size === 0) return { hata: (await mesajlar()).gorselSec };
  if (!IZINLI_TURLER.includes(dosya.type)) return { hata: (await mesajlar()).gorselTuru };
  if (dosya.size > AZAMI_BOYUT) return { hata: (await mesajlar()).gorselBoyutu };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: (await mesajlar()).oturumYok };

  const uzanti = dosya.type.split('/')[1] === 'svg+xml' ? 'svg' : dosya.type.split('/')[1];
  const yol = `${user.id}/profil.${uzanti}`;

  const { error: yuklemeHatasi } = await supabase.storage
    .from('profil-resimleri')
    .upload(yol, dosya, { upsert: true, contentType: dosya.type });
  if (yuklemeHatasi) {
    console.error('[profil-resmi] yukleme hatasi:', yuklemeHatasi);
    return { hata: (await mesajlar()).yuklemeHatasi(yuklemeHatasi.message) };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('profil-resimleri').getPublicUrl(yol);

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, resim_url: `${publicUrl}?t=${Date.now()}` }, { onConflict: 'id' });

  if (error) {
    console.error('[profil-resmi] guncelleme hatasi:', error);
    return { hata: (await mesajlar()).kayitHatasi(error.message) };
  }

  revalidatePath('/', 'layout');
  return { bilgi: (await mesajlar()).gorselGuncellendi };
}

export type DisaAktarSonuc = { hata?: string; xlsxTaban64?: string };

/** Tüm envanteri .xlsx dosyası olarak (base64) döndürür — indirme işlemi tarayıcı tarafında yapılır.
 * CSV yerine gerçek bir Excel dosyası üretiyoruz: Türkçe Windows/Excel virgülü ondalık ayracı
 * olarak kullandığından düz virgüllü CSV'yi tek sütun halinde açar (noktalı virgül beklenir). */
export async function envanterDisaAktar(): Promise<DisaAktarSonuc> {
  const supabase = await createClient();
  const aktif = await aktifGorunumAl();
  const dil = await dilAl();
  const metin = sozluk(dil).ayarlar;
  if (!aktif) return { hata: metin.eylem.oturumYok };

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

  const basliklar = metin.disaAktar.basliklar;
  const durumMetni: Record<string, string> = metin.disaAktar.durum;
  const { evet, hayir } = metin.disaAktar;

  const veriSatirlari = satirlar.map((s) => [
    s.mpn,
    s.uretici ?? '',
    s.aciklama ?? '',
    s.kategori ?? '',
    s.kilif ?? '',
    s.rohs === true ? evet : s.rohs === false ? hayir : '',
    s.konum_adi ?? '',
    s.adet,
    s.min_adet,
    durumMetni[s.durum] ?? s.durum,
    s.tedarikci ?? '',
    s.tedarikci_kodu ?? '',
    s.alis_fiyati ?? '',
    s.para_birimi,
    s.datasheet_url ?? '',
    (etiketHaritasi.get(s.stok_id) ?? []).join('; '),
    s.updated_at ? new Date(s.updated_at).toLocaleString(yerel(dil)) : '',
  ]);

  const sayfa = XLSX.utils.aoa_to_sheet([basliklar, ...veriSatirlari]);
  sayfa['!cols'] = basliklar.map((b) => ({ wch: Math.max(10, b.length + 2) }));
  const kitap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(kitap, sayfa, metin.disaAktar.sayfaAdi);

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
  if (!user) return { hata: (await mesajlar()).oturumYok };

  for (let deneme = 0; deneme < 5; deneme++) {
    const kod = rastgeleKod();
    const { error } = await supabase.from('profiles').upsert({ id: user.id, davet_kodu: kod }, { onConflict: 'id' });
    if (!error) {
      revalidatePath('/ayarlar');
      return { kod };
    }
    if (error.code !== '23505') return { hata: error.message };
  }
  return { hata: (await mesajlar()).kodOlusturulamadi };
}

/** Girilen davet koduyla, kodun sahibinin gözlemcisi olur (salt-okunur erişim). */
export async function davetKoduIleBaglan(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const kod = String(formData.get('kod') ?? '').trim();
  if (!kod) return { hata: (await mesajlar()).davetKoduGerekli };

  const supabase = await createClient();
  const { error } = await supabase.rpc('gozlemci_baglan', { p_kod: kod });
  if (error) {
    // gozlemci_baglan() Türkçe exception fırlatıyor (bkz. 0001_init.sql) — bilinenleri çevir.
    const m = await mesajlar();
    const bilinen: Record<string, string> = {
      'Geçersiz davet kodu': m.gecersizDavetKodu,
      'Kendi davet koduna bağlanamazsın': m.kendiKodun,
      'Bu hesabı izleyen kişi sayısı sınırına ulaşıldı (en fazla 8).': m.gozlemciSiniri,
    };
    return { hata: bilinen[error.message] ?? error.message };
  }

  revalidatePath('/', 'layout');
  return { bilgi: (await mesajlar()).baglantiKuruldu };
}

/** Gözlemcilik bağlantısını kaldırır — kendi hesabına dönersin. */
export async function gozlemcilikKaldir(): Promise<EylemDurum> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: (await mesajlar()).oturumYok };

  const { error } = await supabase.from('profiles').update({ gozlemci_of: null }).eq('id', user.id);
  if (error) return { hata: error.message };

  revalidatePath('/', 'layout');
  return { bilgi: (await mesajlar()).baglantiKaldirildi };
}

/** Sahibin, seni izleyen belirli bir hesabı tek taraflı çıkarması. */
export async function gozlemciyiCikar(gozlemciId: string): Promise<EylemDurum> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('gozlemciyi_cikar', { p_gozlemci_id: gozlemciId });
  if (error) return { hata: error.message };

  revalidatePath('/ayarlar');
  return { bilgi: (await mesajlar()).cikarildi };
}

/** Girilen Gemini/Claude API anahtarını küçük bir istekle doğrulayıp listeye
 * ekler (en sona, yeni sira = mevcut en yüksek + 1) — "Linkten çek", LCSC
 * açıklama çevirisi ve sohbet asistanı bu listeyi sırayla dener, biri
 * çalışmazsa (kota, geçersiz anahtar vb.) otomatik sıradakine geçer (bkz.
 * lib/ai.ts). Birden fazla hesaptan anahtar eklenebilir. */
export async function aiAnahtarEkle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const saglayici = String(formData.get('saglayici') ?? '') as AiSaglayici;
  if (saglayici !== 'gemini' && saglayici !== 'claude' && !uyumluSaglayiciMi(saglayici))
    return { hata: (await mesajlar()).gecersizSaglayici };

  const anahtar = apiAnahtariniTemizle(String(formData.get('api_anahtari') ?? ''));
  if (!anahtar) return { hata: (await mesajlar()).anahtarGir };

  const ad = String(formData.get('ad') ?? '').trim() || null;

  const dogrulama: { gecerli: boolean; hata?: string; model?: string; gunlukLimit?: number } = uyumluSaglayiciMi(saglayici)
    ? await uyumluAnahtariDogrula(saglayici, anahtar)
    : saglayici === 'gemini'
      ? await geminiApiAnahtariniDogrula(anahtar)
      : await claudeApiAnahtariniDogrula(anahtar);
  if (!dogrulama.gecerli) {
    return {
      hata: dogrulama.hata
        ? (await mesajlar()).anahtarDogrulanamadi(dogrulama.hata)
        : (await mesajlar()).anahtarDogrulanamadiGenel,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: (await mesajlar()).oturumYok };

  const { data: enSonSira } = await supabase
    .from('ai_anahtarlari')
    .select('sira')
    .eq('user_id', user.id)
    .order('sira', { ascending: false })
    .limit(1)
    .maybeSingle();
  const yeniSira = ((enSonSira?.sira as number | undefined) ?? -1) + 1;

  const satir: Record<string, unknown> = { user_id: user.id, saglayici, ad, anahtar, sira: yeniSira };
  // model/gunluk_limit sütunları 0005 göçüyle geldi; yeni sağlayıcılar zaten o göçü gerektiriyor.
  if (dogrulama.model) satir.model = dogrulama.model;
  if (dogrulama.gunlukLimit) satir.gunluk_limit = dogrulama.gunlukLimit;
  const { error } = await supabase.from('ai_anahtarlari').insert(satir);
  if (error) {
    // 0005 göçü çalıştırılmamış: yeni sağlayıcı check kısıtına takılır ya da sütun yoktur.
    if (/saglayici_check|gunluk_limit|column .*model/i.test(error.message)) return { hata: (await mesajlar()).veritabaniGuncellemesiGerekli };
    return { hata: error.message };
  }

  revalidatePath('/ayarlar');
  return { bilgi: (await mesajlar()).anahtarKaydedildi };
}

/** Kayıtlı bir AI anahtarını kaldırır. */
export async function aiAnahtarSil(id: string): Promise<EylemDurum> {
  const supabase = await createClient();
  const { error } = await supabase.from('ai_anahtarlari').delete().eq('id', id);
  if (error) return { hata: error.message };

  revalidatePath('/ayarlar');
  return { bilgi: (await mesajlar()).kaldirildi };
}

/** Bir anahtarı deneme sırasında bir üste/alta taşır (komşusuyla sira'yı takas eder). */
export async function aiAnahtarSiradaTasi(id: string, yon: 'yukari' | 'asagi'): Promise<EylemDurum> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: (await mesajlar()).oturumYok };

  const { data: liste, error } = await supabase
    .from('ai_anahtarlari')
    .select('id, sira')
    .eq('user_id', user.id)
    .order('sira', { ascending: true });
  if (error) return { hata: error.message };

  const siraliListe = (liste ?? []) as { id: string; sira: number }[];
  const index = siraliListe.findIndex((a) => a.id === id);
  if (index === -1) return { hata: (await mesajlar()).anahtarBulunamadi };

  const komsuIndex = yon === 'yukari' ? index - 1 : index + 1;
  if (komsuIndex < 0 || komsuIndex >= siraliListe.length) return {};

  const buAnahtar = siraliListe[index];
  const komsu = siraliListe[komsuIndex];

  const [{ error: hata1 }, { error: hata2 }] = await Promise.all([
    supabase.from('ai_anahtarlari').update({ sira: komsu.sira }).eq('id', buAnahtar.id),
    supabase.from('ai_anahtarlari').update({ sira: buAnahtar.sira }).eq('id', komsu.id),
  ]);
  if (hata1) return { hata: hata1.message };
  if (hata2) return { hata: hata2.message };

  revalidatePath('/ayarlar');
  return {};
}

/** Haftalık envanter yedeği e-postası tercihini kaydeder — her Pazartesi
 * gönderilen özet + CSV yedeği için (bkz. supabase/migrations/0004,
 * haftalik_envanter_yedegi_gonder() / pg_cron). E-posta adresi boş
 * bırakılırsa hesabın giriş e-postası kullanılır; bazı kurumsal domainlere
 * (Resend'de alan adı doğrulanmadığı sürece) gönderim başarısız olabildiği
 * için burada bir alternatif adres girilebiliyor. */
export async function haftalikYedekAyarlariniKaydet(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const aktif = formData.get('aktif') === 'on';
  const eposta = String(formData.get('eposta') ?? '').trim() || null;
  if (eposta && !eposta.includes('@')) return { hata: (await mesajlar()).gecerliEposta };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: (await mesajlar()).oturumYok };

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: user.id, haftalik_yedek_aktif: aktif, yedek_eposta_adresi: eposta }, { onConflict: 'id' });
  if (error) return { hata: error.message };

  revalidatePath('/ayarlar');
  return { bilgi: (await mesajlar()).kaydedildi };
}
