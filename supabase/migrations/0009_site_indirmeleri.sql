-- labstock.com.tr indirme butonu sayacı (Ayarlar → İstatistikler).
--
-- Tanıtım sitesindeki indirme butonlarına her tıklamada tür (windows / appimage
-- / deb) ve gün bazında bir sayaç artar. Kimlik, IP, çerez ya da kişi bilgisi
-- tutulmaz; sadece "bugün kaç kez hangi buton tıklandı".
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

create table if not exists private.site_indirmeleri (
  gun date not null,
  tur text not null,
  adet integer not null default 0,
  primary key (gun, tur)
);
alter table private.site_indirmeleri enable row level security;
revoke all on private.site_indirmeleri from public, anon, authenticated;

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
    case when p_tur in ('windows', 'appimage', 'deb') then p_tur else 'diger' end,
    1
  )
  on conflict (gun, tur) do update set adet = s.adet + 1;
$$;
revoke all on function public.site_indirme(text) from public;
grant execute on function public.site_indirme(text) to anon, authenticated;

create or replace function public.site_indirme_istatistikleri()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  bugun date := (now() at time zone 'Europe/Istanbul')::date;
begin
  if not public.yonetici_mi() then
    raise exception 'yetkisiz';
  end if;
  return jsonb_build_object(
    'toplam', (select coalesce(sum(adet), 0) from private.site_indirmeleri),
    'bugun', (select coalesce(sum(adet), 0) from private.site_indirmeleri where gun = bugun),
    'son7', (select coalesce(sum(adet), 0) from private.site_indirmeleri where gun > bugun - 7),
    'tur', coalesce((select jsonb_object_agg(tur, n) from (select tur, sum(adet) n from private.site_indirmeleri group by tur) t), '{}'::jsonb)
  );
end $$;
revoke all on function public.site_indirme_istatistikleri() from public, anon;
grant execute on function public.site_indirme_istatistikleri() to authenticated;
