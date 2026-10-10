-- Yönetici istatistik paneli (Ayarlar → İstatistikler).
--
-- private.yoneticiler'deki hesaplar, tüm kullanıcılara ait TOPLU sayıları
-- (üye sayısı, aktif kullanıcı, haftalık kayıt/kullanım, stok ve yapay zeka
-- kullanımı) görebilir. Fonksiyon kişisel bilgi (e-posta, ad vb.) döndürmez;
-- sadece sayılar. Yönetici olmayan bir hesap çağırırsa hata alır.
--
-- Yönetici eklemek (bu dosyanın dışında, SQL Editor'de bir kez):
--   insert into private.yoneticiler (user_id) values ('<kullanıcı uuid>');
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

create table if not exists private.yoneticiler (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table private.yoneticiler enable row level security;
revoke all on private.yoneticiler from public, anon, authenticated;

create or replace function public.yonetici_mi()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.yoneticiler where user_id = auth.uid());
$$;

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
      'toplam', (select count(*) from auth.users),
      'dogrulanmis', (select count(*) from auth.users where email_confirmed_at is not null),
      'son7_yeni', (select count(*) from auth.users where created_at > now() - interval '7 days'),
      'son30_yeni', (select count(*) from auth.users where created_at > now() - interval '30 days'),
      'son7_giris', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
      'son30_giris', (select count(*) from auth.users where last_sign_in_at > now() - interval '30 days'),
      'ilk_kayit', (select min(created_at) from auth.users)
    ),
    'kullanim', jsonb_build_object(
      'parca_ekleyen', (select count(distinct user_id) from public.stock_items),
      'stok_kalemi', (select count(*) from public.stock_items),
      'katalog_parca', (select count(*) from public.parts),
      'hareket', (select count(*) from public.stock_movements),
      'son7_hareket', (select count(*) from public.stock_movements where created_at > now() - interval '7 days'),
      'son7_hareket_yapan', (select count(distinct user_id) from public.stock_movements where created_at > now() - interval '7 days'),
      'gozlemci', (select count(*) from public.profiles where gozlemci_of is not null),
      'ai_anahtari_ekleyen', (select count(distinct user_id) from public.ai_anahtarlari),
      'ai_istek_bugun', (select coalesce(sum(istek), 0) from public.ai_kullanim where gun = bugun)
    ),
    -- Son 12 hafta (pazartesiden başlayan haftalar): yeni üye ve stok hareketi yapan kullanıcı sayısı.
    'haftalik', (
      select coalesce(jsonb_agg(jsonb_build_object('hafta', h.hafta, 'yeni_uye', h.yeni_uye, 'aktif', h.aktif) order by h.hafta), '[]'::jsonb)
      from (
        select
          w::date as hafta,
          (select count(*) from auth.users u where u.created_at >= w and u.created_at < w + interval '7 days') as yeni_uye,
          (select count(distinct m.user_id) from public.stock_movements m where m.created_at >= w and m.created_at < w + interval '7 days') as aktif
        from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') as w
      ) h
    )
  ) into sonuc;

  return sonuc;
end $$;

revoke all on function public.yonetici_istatistikleri() from public, anon;
grant execute on function public.yonetici_istatistikleri() to authenticated;
grant execute on function public.yonetici_mi() to authenticated;
