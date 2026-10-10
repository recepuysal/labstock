// Kullanıcının Ayarlar'dan eklediği tüm yapay zeka anahtarlarını (Gemini,
// Claude, Groq, OpenRouter; birden fazla hesaptan) tek bir öncelik
// sırasıyla dener: bir anahtar/sağlayıcı çalışmazsa (kota dolu, anahtar
// geçersiz, geçici yoğunluk vb.) otomatik olarak sıradakine geçilir. "Linkten
// çek", LCSC açıklama çevirisi ve sohbet asistanı hepsi bu tek giriş noktasını
// kullanır — hangi sağlayıcının çağrılacağını tek tek bilmeleri gerekmez.
//
// Her denemenin sonucu ai_kullanim tablosuna yazılır (Ayarlar'daki "Ücretsiz
// kullanım" barı). Günlük kotası dolduğu anlaşılan anahtar o gün (UTC) boyunca
// atlanır — hem boşa bekleme olmaz hem de başarısız istekleri de kotadan düşen
// sağlayıcılarda (OpenRouter) kota israf edilmez.
//
// `dil` verilmezse arayüz dili istekten (çerez/Accept-Language) okunur;
// kullanıcıya dönen hatalar ve modelin ürettiği okunabilir metinler o dilde olur.

import type { ModulVerisi } from './direnc';
import { geminiIleUrunCek, geminiIleAciklamaCevir, geminiSohbetCevapla, type SohbetMesaji } from './gemini';
import { claudeIleUrunCek, claudeIleAciklamaCevir, claudeSohbetCevapla } from './claude';
import {
  AiKotaHatasi,
  uyumluIleAciklamaCevir,
  uyumluIleUrunCek,
  uyumluSaglayiciMi,
  uyumluSohbetCevapla,
  type AiOlcum,
} from './openai-uyumlu';
import { bugunkuKullanimGetir, type AiAnahtar } from './ai-anahtarlari';
import { createClient } from './supabase/server';
import { sozluk, type Dil } from './i18n';
import { dilAl } from './i18n/sunucu';

export type { SohbetMesaji };

/** Gemini/Claude kendi hata sınıflarını kullanmıyor; günlük kota hatasını mesajından tanı. */
function kotaHatasiMi(err: unknown): boolean {
  if (err instanceof AiKotaHatasi) return true;
  const mesaj = err instanceof Error ? err.message : String(err);
  return /RESOURCE_EXHAUSTED|exceeded your current quota|per day|daily limit|credit balance is too low/i.test(mesaj);
}

/** Kullanım sayacını günceller; tablo/fonksiyon yoksa (0005 göçü çalıştırılmamış) sessizce geçer. */
async function kullanimKaydet(anahtar: AiAnahtar, olcum: AiOlcum, kotaDoldu: boolean): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc('ai_kullanim_kaydet', {
      p_anahtar_id: anahtar.id,
      p_istek: 1,
      p_token: olcum.token ?? 0,
      p_kota_doldu: kotaDoldu,
      p_gunluk_limit: olcum.gunlukLimit ?? null,
    });
    if (olcum.yeniModel && olcum.yeniModel !== anahtar.model) {
      await supabase.from('ai_anahtarlari').update({ model: olcum.yeniModel }).eq('id', anahtar.id);
    }
  } catch (err) {
    console.error('lib/ai.ts: kullanım kaydedilemedi:', err);
  }
}

/** Anahtar listesindeki her girdiyi sırayla dener; biri hata verirse (son
 * hatayı saklayıp) bir sonrakine geçer. Bugün kotası dolmuş anahtarlar en sona
 * alınır (hepsi doluysa yine de denenir — sağlayıcı kotayı erken sıfırlamış olabilir). */
async function siraylaDene<T>(
  anahtarlar: AiAnahtar[],
  dil: Dil,
  cagir: (a: AiAnahtar, olcum: AiOlcum) => Promise<T>,
): Promise<T> {
  const s = sozluk(dil).parca.ai;
  if (anahtarlar.length === 0) {
    throw new Error(s.anahtarYok);
  }

  let dolular = new Set<string>();
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const kullanim = await bugunkuKullanimGetir(supabase, user.id);
      dolular = new Set([...kullanim].filter(([, k]) => k.kota_doldu).map(([id]) => id));
    }
  } catch {
    // kullanım okunamazsa normal sırayla dene
  }
  const sirali = [...anahtarlar.filter((a) => !dolular.has(a.id)), ...anahtarlar.filter((a) => dolular.has(a.id))];

  let sonHata: unknown;
  for (const anahtar of sirali) {
    const olcum: AiOlcum = {};
    try {
      const sonuc = await cagir(anahtar, olcum);
      await kullanimKaydet(anahtar, olcum, false);
      return sonuc;
    } catch (err) {
      sonHata = err;
      await kullanimKaydet(anahtar, olcum, kotaHatasiMi(err));
      console.error(`lib/ai.ts: ${anahtar.saglayici} anahtarı (${anahtar.ad ?? anahtar.id}) başarısız:`, err);
    }
  }

  throw sonHata instanceof Error ? sonHata : new Error(s.istekBasarisiz);
}

export async function aiIleUrunCek(
  anahtarlar: AiAnahtar[],
  sayfaUrl: string,
  html: string,
  dil?: Dil,
): Promise<ModulVerisi> {
  const d = dil ?? (await dilAl());
  return siraylaDene(anahtarlar, d, (a, olcum) =>
    uyumluSaglayiciMi(a.saglayici)
      ? uyumluIleUrunCek(a.saglayici, a.anahtar, a.model, sayfaUrl, html, d, olcum)
      : a.saglayici === 'gemini'
        ? geminiIleUrunCek(a.anahtar, sayfaUrl, html, d)
        : claudeIleUrunCek(a.anahtar, sayfaUrl, html, d),
  );
}

/** Tedarikçi (LCSC) açıklamasını Türkçeye çevirir. LCSC metni zaten İngilizce
 * olduğu için arayüz dili Türkçe değilse çeviri yapılmaz, ham açıklama aynen döner. */
export async function aiIleAciklamaCevir(
  anahtarlar: AiAnahtar[],
  hamAciklama: string,
  baglam?: string,
  dil?: Dil,
): Promise<string> {
  const d = dil ?? (await dilAl());
  if (d !== 'tr') return hamAciklama;
  return siraylaDene(anahtarlar, d, (a, olcum) =>
    uyumluSaglayiciMi(a.saglayici)
      ? uyumluIleAciklamaCevir(a.saglayici, a.anahtar, a.model, hamAciklama, baglam, d, olcum)
      : a.saglayici === 'gemini'
        ? geminiIleAciklamaCevir(a.anahtar, hamAciklama, baglam, d)
        : claudeIleAciklamaCevir(a.anahtar, hamAciklama, baglam, d),
  );
}

export async function aiSohbetCevapla(
  anahtarlar: AiAnahtar[],
  sistemYonergesi: string,
  mesajlar: SohbetMesaji[],
  dil?: Dil,
): Promise<string> {
  const d = dil ?? (await dilAl());
  return siraylaDene(anahtarlar, d, (a, olcum) =>
    uyumluSaglayiciMi(a.saglayici)
      ? uyumluSohbetCevapla(a.saglayici, a.anahtar, a.model, sistemYonergesi, mesajlar, d, olcum)
      : a.saglayici === 'gemini'
        ? geminiSohbetCevapla(a.anahtar, sistemYonergesi, mesajlar, d)
        : claudeSohbetCevapla(a.anahtar, sistemYonergesi, mesajlar, d),
  );
}
