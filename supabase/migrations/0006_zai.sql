-- Ücretsiz sağlayıcılara Z.ai (Zhipu GLM) eklenir. Cerebras'ın ücretsiz katmanı
-- kart istediği için uygulamadan çıkarıldı; daha önce eklenmiş bir Cerebras
-- anahtarı varsa satır bozulmasın diye kısıtta bırakılır.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

alter table public.ai_anahtarlari drop constraint if exists ai_anahtarlari_saglayici_check;

alter table public.ai_anahtarlari
  add constraint ai_anahtarlari_saglayici_check
  check (saglayici in ('gemini', 'claude', 'groq', 'zai', 'openrouter', 'cerebras'));
