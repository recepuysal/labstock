// Kullanıcının birden fazla yapay zeka API anahtarını (Gemini ve/veya Claude,
// birden fazla hesaptan) tek bir öncelik sırasıyla okumak için ortak yardımcı
// — "Linkten çek", LCSC açıklama çevirisi ve sohbet asistanı hepsi bu listeyi
// kullanır (bkz. lib/ai.ts, ai_anahtarlari tablosu: supabase/migrations/0003).

import { createClient } from './supabase/server';

export type AiSaglayici = 'gemini' | 'claude';

export type AiAnahtar = {
  id: string;
  saglayici: AiSaglayici;
  ad: string | null;
  anahtar: string;
  sira: number;
};

/** Oturum açmış kullanıcının tüm AI anahtarlarını deneme sırasına (sira) göre döner. */
export async function aiAnahtarlariGetir(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<AiAnahtar[]> {
  const { data } = await supabase
    .from('ai_anahtarlari')
    .select('id, saglayici, ad, anahtar, sira')
    .eq('user_id', userId)
    .order('sira', { ascending: true });

  return (data ?? []) as AiAnahtar[];
}
