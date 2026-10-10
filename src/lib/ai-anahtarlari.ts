// Kullanıcının birden fazla yapay zeka API anahtarını (Gemini, Claude ve
// ücretsiz katmanlı Groq / Z.ai (GLM) / OpenRouter; birden fazla hesaptan) tek
// bir öncelik sırasıyla okumak için ortak yardımcı — "Linkten çek", LCSC
// açıklama çevirisi ve sohbet asistanı hepsi bu listeyi kullanır (bkz.
// lib/ai.ts, ai_anahtarlari ve ai_kullanim tabloları: supabase/migrations/0003, 0005).

import { createClient } from './supabase/server';

export type AiSaglayici = 'gemini' | 'claude' | 'groq' | 'zai' | 'openrouter';

/** Ücretli sağlayıcılar kullanım barındaki ücretsiz toplama katılmaz. */
export const UCRETLI_SAGLAYICILAR: AiSaglayici[] = ['claude'];

/** Sağlayıcı yanıtından öğrenilemezse gösterilen yaklaşık günlük ücretsiz istek sayısı. */
export const VARSAYILAN_GUNLUK_LIMIT: Record<AiSaglayici, number | null> = {
  gemini: 250,
  claude: null,
  groq: 1000,
  zai: 1000,
  openrouter: 50,
};

export type AiAnahtar = {
  id: string;
  saglayici: AiSaglayici;
  ad: string | null;
  anahtar: string;
  sira: number;
  /** 0005 öncesi veritabanında yok — o durumda undefined. */
  model?: string | null;
  gunluk_limit?: number | null;
};

export type AiGunlukKullanim = { istek: number; token: number; kota_doldu: boolean };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Oturum açmış kullanıcının tüm AI anahtarlarını deneme sırasına (sira) göre döner. */
export async function aiAnahtarlariGetir(supabase: Supabase, userId: string): Promise<AiAnahtar[]> {
  // select('*'): 0005 göçü (model, gunluk_limit) henüz çalıştırılmamış veritabanında da çalışsın.
  const { data } = await supabase
    .from('ai_anahtarlari')
    .select('*')
    .eq('user_id', userId)
    .order('sira', { ascending: true });

  return (data ?? []) as AiAnahtar[];
}

export function bugunUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Bugünkü (UTC) kullanım, anahtar id'sine göre. ai_kullanim tablosu yoksa boş döner. */
export async function bugunkuKullanimGetir(supabase: Supabase, userId: string): Promise<Map<string, AiGunlukKullanim>> {
  const harita = new Map<string, AiGunlukKullanim>();
  const { data, error } = await supabase
    .from('ai_kullanim')
    .select('anahtar_id, istek, token, kota_doldu')
    .eq('user_id', userId)
    .eq('gun', bugunUtc());
  if (error || !data) return harita;
  for (const satir of data as { anahtar_id: string; istek: number; token: number; kota_doldu: boolean }[]) {
    harita.set(satir.anahtar_id, { istek: satir.istek, token: satir.token, kota_doldu: satir.kota_doldu });
  }
  return harita;
}

/** Bir anahtarın günlük ücretsiz istek limiti: sağlayıcıdan öğrenilen ya da varsayılan. Ücretliyse null. */
export function gunlukLimit(a: Pick<AiAnahtar, 'saglayici' | 'gunluk_limit'>): number | null {
  if (UCRETLI_SAGLAYICILAR.includes(a.saglayici)) return null;
  return a.gunluk_limit ?? VARSAYILAN_GUNLUK_LIMIT[a.saglayici];
}

/** ai_kullanim tablosu var mı (0005 göçü çalıştırılmış mı)? */
export async function kullanimTakibiAktif(supabase: Supabase): Promise<boolean> {
  const { error } = await supabase.from('ai_kullanim').select('anahtar_id').limit(1);
  return !error;
}
