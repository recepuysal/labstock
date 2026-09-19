-- Kullanıcının kendi Gemini API anahtarı — desteklenmeyen sitelerden "Linkten
-- çek" için (bkz. src/lib/gemini.ts). profiles zaten "kendi satırın" RLS
-- politikasıyla korunuyor (profiles_self, 0001_init.sql), bu yüzden ek bir
-- politika gerekmiyor; gözlemciler için profiles'ta ayrı bir okuma politikası
-- da yok, yani bu anahtar hesap sahibinden başka kimseye görünmez.
alter table public.profiles add column if not exists gemini_api_key text;
