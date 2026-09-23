-- Kullanıcının birden fazla yapay zeka API anahtarı (Gemini ve/veya Claude,
-- birden fazla hesaptan) ekleyip sırayla denenmesini sağlar: "Linkten çek",
-- LCSC açıklama çevirisi ve sohbet asistanı artık tek bir sabit anahtar
-- yerine bu listeyi sira'ya göre sırayla dener, biri çalışmazsa (kota, geçersiz
-- anahtar vb.) bir sonrakine geçer (bkz. src/lib/ai.ts).
--
-- Önceki tek-anahtar sütunu (0002_gemini_api_key.sql) buraya taşınır ve
-- kaldırılır.

create table if not exists public.ai_anahtarlari (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  saglayici   text not null check (saglayici in ('gemini', 'claude')),
  ad          text,
  anahtar     text not null,
  sira        integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists ai_anahtarlari_user_sira_idx on public.ai_anahtarlari (user_id, sira);

alter table public.ai_anahtarlari enable row level security;

-- Sadece sahibi görebilir/değiştirebilir — gözlemciler için ayrı bir okuma
-- politikası yok, yani bu anahtarlar hesap sahibinden başka kimseye görünmez
-- (profiles_self ile aynı yaklaşım, bkz. 0001_init.sql / 0002_gemini_api_key.sql).
create policy ai_anahtarlari_self on public.ai_anahtarlari
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Var olan tek Gemini anahtarını (varsa) yeni tabloya taşı.
insert into public.ai_anahtarlari (user_id, saglayici, anahtar, sira)
select id, 'gemini', gemini_api_key, 0
from public.profiles
where gemini_api_key is not null and length(trim(gemini_api_key)) > 0;

alter table public.profiles drop column if exists gemini_api_key;
