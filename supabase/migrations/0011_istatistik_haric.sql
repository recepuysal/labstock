-- İstatistiklerden yöneticinin kendi kullanımını çıkarır.
--
-- - private.yoneticiler'deki hesaplar ve private.istatistik_haric'e eklenen
--   hesaplar (ör. test hesapları) üye/giriş/kullanım sayılarına katılmaz.
--     insert into private.istatistik_haric (user_id) values ('<kullanıcı uuid>');
-- - Yöneticinin istatistik sayfasını açtığı masaüstü kurulumu "haric" işaretlenir
--   ve kurulum sayılarına katılmaz.
-- - Site tıklamaları tarayıcı tarafında elenir (labstock.com.tr/#ben).
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

create table if not exists private.istatistik_haric (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table private.istatistik_haric enable row level security;
revoke all on private.istatistik_haric from public, anon, authenticated;

create or replace function private.haric(u uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from private.yoneticiler where user_id = u)
      or exists (select 1 from private.istatistik_haric where user_id = u);
$$;

alter table private.kurulumlar add column if not exists haric boolean not null default false;

-- Yönetici (ya da hariç hesap) kendi kurulumunu sayımdan çıkarır.
create or replace function public.kurulum_haric_isaretle(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update private.kurulumlar set haric = true
  where id = p_id and auth.uid() is not null and private.haric(auth.uid());
$$;
revoke all on function public.kurulum_haric_isaretle(uuid) from public, anon;
grant execute on function public.kurulum_haric_isaretle(uuid) to authenticated;

create or replace function public.yonetici_istatistikleri()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bugun date := (now() at time zone 'utc')::date;
  sonuc jsonb;
begin
  if not public.yonetici_mi() then
    raise exception 'Bu istatistikleri sadece yöneticiler görebilir.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'uye', jsonb_build_object(
      'toplam', (select count(*) from auth.users where not private.haric(id)),
      'dogrulanmis', (select count(*) from auth.users where not private.haric(id) and email_confirmed_at is not null),
      'son7_yeni', (select count(*) from auth.users where not private.haric(id) and created_at > now() - interval '7 days'),
      'son30_yeni', (select count(*) from auth.users where not private.haric(id) and created_at > now() - interval '30 days'),
      'son7_giris', (select count(*) from auth.users where not private.haric(id) and last_sign_in_at > now() - interval '7 days'),
      'son30_giris', (select count(*) from auth.users where not private.haric(id) and last_sign_in_at > now() - interval '30 days'),
      'ilk_kayit', (select min(created_at) from auth.users where not private.haric(id))
    ),
    'kullanim', jsonb_build_object(
      'parca_ekleyen', (select count(distinct user_id) from public.stock_items where not private.haric(user_id)),
      'stok_kalemi', (select count(*) from public.stock_items where not private.haric(user_id)),
      'katalog_parca', (select count(*) from public.parts),
      'hareket', (select count(*) from public.stock_movements where not private.haric(user_id)),
      'son7_hareket', (select count(*) from public.stock_movements where not private.haric(user_id) and created_at > now() - interval '7 days'),
      'son7_hareket_yapan', (select count(distinct user_id) from public.stock_movements where not private.haric(user_id) and created_at > now() - interval '7 days'),
      'gozlemci', (select count(*) from public.profiles where not private.haric(id) and gozlemci_of is not null),
      'ai_anahtari_ekleyen', (select count(distinct user_id) from public.ai_anahtarlari where not private.haric(user_id)),
      'ai_istek_bugun', (select coalesce(sum(istek), 0) from public.ai_kullanim where not private.haric(user_id) and gun = bugun)
    ),
    -- Son 12 hafta (pazartesiden başlayan haftalar): yeni üye ve stok hareketi yapan kullanıcı sayısı.
    'haftalik', (
      select coalesce(jsonb_agg(jsonb_build_object('hafta', h.hafta, 'yeni_uye', h.yeni_uye, 'aktif', h.aktif) order by h.hafta), '[]'::jsonb)
      from (
        select
          w::date as hafta,
          (select count(*) from auth.users u where not private.haric(u.id) and u.created_at >= w and u.created_at < w + interval '7 days') as yeni_uye,
          (select count(distinct m.user_id) from public.stock_movements m where not private.haric(m.user_id) and m.created_at >= w and m.created_at < w + interval '7 days') as aktif
        from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as w
      ) h
    )
  ) into sonuc;

  return sonuc;
end $$;

create or replace function public.kurulum_istatistikleri()
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
    'toplam', (select count(*) from private.kurulumlar where not haric),
    'son24_aktif', (select count(*) from private.kurulumlar where not haric and son_gorulme > now() - interval '24 hours'),
    'son7_aktif', (select count(*) from private.kurulumlar where not haric and son_gorulme > now() - interval '7 days'),
    'son7_yeni', (select count(*) from private.kurulumlar where not haric and ilk_gorulme > now() - interval '7 days'),
    'cevrimdisi', (select count(*) from private.kurulumlar where not haric and mod = 'yerel'),
    'platform', coalesce((select jsonb_object_agg(platform, n) from (select platform, count(*) n from private.kurulumlar where not haric group by platform) p), '{}'::jsonb),
    'surum', coalesce((select jsonb_object_agg(surum, n) from (select surum, count(*) n from private.kurulumlar where not haric and son_gorulme > now() - interval '7 days' group by surum) s), '{}'::jsonb)
  );
end $$;

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
    'kayit_web', (select count(*) from auth.users where not private.haric(id) and raw_user_meta_data->>'kaynak' = 'web'),
    'kayit_masaustu', (select count(*) from auth.users where not private.haric(id) and raw_user_meta_data->>'kaynak' = 'masaustu'),
    'kayit_eski', (select count(*) from auth.users where not private.haric(id) and coalesce(raw_user_meta_data->>'kaynak', '') not in ('web', 'masaustu')),
    'kayit_web_7', (select count(*) from auth.users where not private.haric(id) and raw_user_meta_data->>'kaynak' = 'web' and created_at > now() - interval '7 days'),
    'giris_web_7', (select count(*) from private.giris_kaynaklari where not private.haric(user_id) and kaynak = 'web' and son_giris > now() - interval '7 days'),
    'giris_masaustu_7', (select count(*) from private.giris_kaynaklari where not private.haric(user_id) and kaynak = 'masaustu' and son_giris > now() - interval '7 days')
  );
end $$;
