-- Anonim kurulum sayacı (Ayarlar → İstatistikler).
--
-- Masaüstü uygulaması her açılışta rastgele bir kurulum kimliği (kullanıcıya
-- ya da hesaba bağlı değil), sürüm, işletim sistemi ve veri modu (bulut /
-- çevrimdışı) bildirir. Böylece hesap açmadan ya da çevrimdışı kullananlar da
-- sayılır. Kişisel bilgi, IP veya envanter verisi tutulmaz.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

create table if not exists private.kurulumlar (
  id uuid primary key,
  ilk_gorulme timestamptz not null default now(),
  son_gorulme timestamptz not null default now(),
  surum text not null,
  platform text not null,
  mod text not null,
  acilis integer not null default 1
);
alter table private.kurulumlar enable row level security;
revoke all on private.kurulumlar from public, anon, authenticated;

-- Uygulama bunu anon anahtarla çağırır; tabloya doğrudan erişim yok.
create or replace function public.kurulum_bildir(p_id uuid, p_surum text, p_platform text, p_mod text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into private.kurulumlar as k (id, surum, platform, mod)
  values (
    p_id,
    left(coalesce(p_surum, '?'), 20),
    case when p_platform in ('win32', 'linux', 'darwin') then p_platform else 'diger' end,
    case when p_mod in ('bulut', 'yerel') then p_mod else 'bulut' end
  )
  on conflict (id) do update set
    son_gorulme = now(),
    surum = excluded.surum,
    platform = excluded.platform,
    mod = excluded.mod,
    acilis = k.acilis + 1;
$$;
revoke all on function public.kurulum_bildir(uuid, text, text, text) from public;
grant execute on function public.kurulum_bildir(uuid, text, text, text) to anon, authenticated;

-- Yalnızca yöneticiler (private.yoneticiler) görebilir; sadece toplu sayılar.
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
    'toplam', (select count(*) from private.kurulumlar),
    'son24_aktif', (select count(*) from private.kurulumlar where son_gorulme > now() - interval '24 hours'),
    'son7_aktif', (select count(*) from private.kurulumlar where son_gorulme > now() - interval '7 days'),
    'son7_yeni', (select count(*) from private.kurulumlar where ilk_gorulme > now() - interval '7 days'),
    'cevrimdisi', (select count(*) from private.kurulumlar where mod = 'yerel'),
    'platform', coalesce((select jsonb_object_agg(platform, n) from (select platform, count(*) n from private.kurulumlar group by platform) p), '{}'::jsonb),
    'surum', coalesce((select jsonb_object_agg(surum, n) from (select surum, count(*) n from private.kurulumlar where son_gorulme > now() - interval '7 days' group by surum) s), '{}'::jsonb)
  );
end $$;
revoke all on function public.kurulum_istatistikleri() from public, anon;
grant execute on function public.kurulum_istatistikleri() to authenticated;
