-- Envanter sayfasındaki kategori / kılıf filtre listeleri için tekil değerler.
-- Eskiden sayfa her açılışta tüm `parts` kataloğunu 1000'erlik sayfalarla
-- çekip tekilleştirmeyi uygulamada yapıyordu; bu fonksiyon işi veritabanında
-- yapar ve sadece iki kısa dizi döndürür.
-- security invoker: parts_read RLS kuralı aynen geçerli.
-- Uygulama bu fonksiyon yoksa eski yönteme düşer (src/lib/katalog-filtreleri.ts),
-- yani kod bu migration'dan önce de canlıya çıkabilir.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

create or replace function public.katalog_filtreleri()
returns table (kategoriler text[], kiliflar text[])
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(array_agg(distinct kategori) filter (where kategori is not null and kategori <> ''), '{}'),
    coalesce(array_agg(distinct kilif)    filter (where kilif    is not null and kilif    <> ''), '{}')
  from public.parts;
$$;

grant execute on function public.katalog_filtreleri() to authenticated;
