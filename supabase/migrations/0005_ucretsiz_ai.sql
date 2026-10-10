-- Ücretsiz yapay zeka sağlayıcıları (Groq, Cerebras, OpenRouter) ve günlük
-- kullanım takibi.
--
-- 1) ai_anahtarlari: yeni sağlayıcılara izin verilir; her anahtar için
--    eklenirken seçilen model ve (biliniyorsa) sağlayıcının günlük ücretsiz
--    istek limiti saklanır.
-- 2) ai_kullanim: anahtar başına günlük istek/token sayısı ve "kota doldu"
--    işareti. Ayarlar'daki "Ücretsiz kullanım" barı bunu gösterir; kotası
--    dolan anahtar o gün boyunca atlanır (bkz. src/lib/ai.ts).
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

-- 1) ai_anahtarlari --------------------------------------------------------
do $$
declare
  kisit text;
begin
  for kisit in
    select conname from pg_constraint
    where conrelid = 'public.ai_anahtarlari'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%saglayici%'
  loop
    execute format('alter table public.ai_anahtarlari drop constraint %I', kisit);
  end loop;
end $$;

alter table public.ai_anahtarlari
  add constraint ai_anahtarlari_saglayici_check
  check (saglayici in ('gemini', 'claude', 'groq', 'cerebras', 'openrouter'));

alter table public.ai_anahtarlari add column if not exists model text;
alter table public.ai_anahtarlari add column if not exists gunluk_limit integer;

-- 2) ai_kullanim -------------------------------------------------------------
create table if not exists public.ai_kullanim (
  anahtar_id  uuid not null references public.ai_anahtarlari (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  gun         date not null default (now() at time zone 'utc')::date,
  istek       integer not null default 0,
  token       integer not null default 0,
  kota_doldu  boolean not null default false,
  guncellendi timestamptz not null default now(),
  primary key (anahtar_id, gun)
);

create index if not exists ai_kullanim_user_gun_idx on public.ai_kullanim (user_id, gun);

alter table public.ai_kullanim enable row level security;

drop policy if exists ai_kullanim_self on public.ai_kullanim;
create policy ai_kullanim_self on public.ai_kullanim
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Bir isteğin sonucunu bugünün satırına işler (yoksa oluşturur). Kota dolduysa
-- işaretler; sağlayıcı yanıtından günlük limit öğrenildiyse anahtara yazar.
-- security invoker: RLS geçerli, kullanıcı sadece kendi anahtarına yazabilir.
create or replace function public.ai_kullanim_kaydet(
  p_anahtar_id uuid,
  p_istek integer default 1,
  p_token integer default 0,
  p_kota_doldu boolean default false,
  p_gunluk_limit integer default null
) returns void
language plpgsql
security invoker
as $$
declare
  bugun date := (now() at time zone 'utc')::date;
begin
  insert into public.ai_kullanim (anahtar_id, user_id, gun, istek, token, kota_doldu)
  values (p_anahtar_id, auth.uid(), bugun, greatest(p_istek, 0), greatest(p_token, 0), p_kota_doldu)
  on conflict (anahtar_id, gun) do update
    set istek = public.ai_kullanim.istek + greatest(excluded.istek, 0),
        token = public.ai_kullanim.token + greatest(excluded.token, 0),
        kota_doldu = public.ai_kullanim.kota_doldu or excluded.kota_doldu,
        guncellendi = now();

  if p_gunluk_limit is not null and p_gunluk_limit > 0 then
    update public.ai_anahtarlari set gunluk_limit = p_gunluk_limit
    where id = p_anahtar_id and user_id = auth.uid();
  end if;
end $$;
