-- Ücretsiz (kişisel / eğitim) planda stok kalemi sınırı.
--
-- Bir hesap en fazla public.kalem_siniri() kadar stok satırı (stock_items)
-- tutabilir. Sınır yalnızca YENİ satır eklemeyi durdurur: mevcut satırlar,
-- adet değişiklikleri ve silme etkilenmez. Sınırı aşmış eski hesaplar
-- verilerini kaybetmez, sadece yeni kalem ekleyemez.
--
-- Muaf hesaplar: private.yoneticiler ve private.sinirsiz_hesaplar (ticari
-- lisans verilenler). Ticari lisans vermek (SQL Editor'de):
--   insert into private.sinirsiz_hesaplar (user_id, aciklama)
--   values ('<kullanıcı uuid>', '<firma adı, lisans bitişi>');
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

create table if not exists private.sinirsiz_hesaplar (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  aciklama   text,
  created_at timestamptz not null default now()
);
alter table private.sinirsiz_hesaplar enable row level security;
revoke all on private.sinirsiz_hesaplar from public, anon, authenticated;

-- Sınırı değiştirmek için yalnızca buradaki sayıyı değiştirip yeniden çalıştır.
create or replace function public.kalem_siniri()
returns integer
language sql
immutable
as $$ select 300 $$;

create or replace function public.sinirsiz_mi(p_kullanici uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.yoneticiler where user_id = p_kullanici)
      or exists (select 1 from private.sinirsiz_hesaplar where user_id = p_kullanici);
$$;
revoke execute on function public.sinirsiz_mi(uuid) from public, anon, authenticated;

-- Ayarlar'daki kullanım göstergesi: { kullanilan, sinir } (sınırsızsa sinir null)
create or replace function public.kalem_kullanimi()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'kullanilan', (select count(*) from public.stock_items where user_id = auth.uid()),
    'sinir', case when public.sinirsiz_mi(auth.uid()) then null else public.kalem_siniri() end
  );
$$;
revoke execute on function public.kalem_kullanimi() from public, anon;
grant execute on function public.kalem_kullanimi() to authenticated;

create or replace function public.kalem_siniri_denetle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sayi integer;
begin
  if public.sinirsiz_mi(new.user_id) then
    return new;
  end if;
  -- Aynı hesaptan eşzamanlı eklemeler (içe aktarma) sınırı birlikte aşmasın
  perform pg_advisory_xact_lock(hashtext('kalem_siniri:' || new.user_id::text));
  select count(*) into sayi from public.stock_items where user_id = new.user_id;
  if sayi >= public.kalem_siniri() then
    -- Uygulama 'kalem_siniri' önekini tanıyıp kullanıcının dilinde mesaj gösterir
    raise exception 'kalem_siniri: % stok kalemi sınırına ulaşıldı', public.kalem_siniri()
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.kalem_siniri_denetle() from public, anon, authenticated;

drop trigger if exists stock_items_kalem_siniri on public.stock_items;
create trigger stock_items_kalem_siniri
  before insert on public.stock_items
  for each row execute function public.kalem_siniri_denetle();
