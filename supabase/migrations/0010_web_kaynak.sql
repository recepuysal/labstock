-- Web sürümü (app.labstock.com.tr) istatistikleri (Ayarlar → İstatistikler).
--
-- 1) Tanıtım sitesi sayacı yeni butonları da sayar: Tarayıcıda aç (web),
--    Üye ol (kayit), Giriş yap (giris).
-- 2) Kayıt kaynağı: kayıtta user metadata'ya "kaynak" (web / masaustu) yazılır.
-- 3) Giriş kaynağı: her girişte kullanıcının son giriş kaynağı ve zamanı tutulur
--    (son 7 günde web'den / masaüstünden giriş yapan sayısı için).
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

create or replace function public.site_indirme(p_tur text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.site_indirmeleri as s (gun, tur, adet)
  values (
    (now() at time zone 'Europe/Istanbul')::date,
    case when p_tur in ('windows', 'appimage', 'deb', 'web', 'kayit', 'giris') then p_tur else 'diger' end,
    1
  )
  on conflict (gun, tur) do update set adet = s.adet + 1;
$$;

create table if not exists private.giris_kaynaklari (
  user_id uuid primary key references auth.users (id) on delete cascade,
  kaynak text not null,
  son_giris timestamptz not null default now()
);
alter table private.giris_kaynaklari enable row level security;
revoke all on private.giris_kaynaklari from public, anon, authenticated;

-- Giriş yapan kullanıcı yalnızca kendi satırını yazar.
create or replace function public.giris_kaynagi_kaydet(p_kaynak text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.giris_kaynaklari (user_id, kaynak)
  select auth.uid(), case when p_kaynak in ('web', 'masaustu') then p_kaynak else 'diger' end
  where auth.uid() is not null
  on conflict (user_id) do update set kaynak = excluded.kaynak, son_giris = now();
$$;
revoke all on function public.giris_kaynagi_kaydet(text) from public, anon;
grant execute on function public.giris_kaynagi_kaydet(text) to authenticated;

create or replace function public.kaynak_istatistikleri()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.yonetici_mi() then
    raise exception 'yetkisiz';
  end if;
  return jsonb_build_object(
    'kayit_web', (select count(*) from auth.users where raw_user_meta_data->>'kaynak' = 'web'),
    'kayit_masaustu', (select count(*) from auth.users where raw_user_meta_data->>'kaynak' = 'masaustu'),
    'kayit_eski', (select count(*) from auth.users where coalesce(raw_user_meta_data->>'kaynak', '') not in ('web', 'masaustu')),
    'kayit_web_7', (select count(*) from auth.users where raw_user_meta_data->>'kaynak' = 'web' and created_at > now() - interval '7 days'),
    'giris_web_7', (select count(*) from private.giris_kaynaklari where kaynak = 'web' and son_giris > now() - interval '7 days'),
    'giris_masaustu_7', (select count(*) from private.giris_kaynaklari where kaynak = 'masaustu' and son_giris > now() - interval '7 days')
  );
end $$;
revoke all on function public.kaynak_istatistikleri() from public, anon;
grant execute on function public.kaynak_istatistikleri() to authenticated;
