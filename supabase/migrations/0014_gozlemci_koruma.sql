-- GÜVENLİK: profiles.gozlemci_of istemciden doğrudan yazılamasın.
--
-- profiles_self politikası satırı sınırlıyor ama sütunu sınırlamıyordu: giriş
-- yapan herkes kendi profilinde gozlemci_of'u başka bir kullanıcının kimliğine
-- çevirip davet kodu olmadan onun envanterini okuyabiliyor, alınacaklar
-- listesini değiştirebiliyordu (*_gozlemci_read ve alinacaklar_gozlemci_yazar
-- politikaları gozlemci_of'a güveniyor). Bildiren: Viktor (GuardLayer),
-- 2026-10-22.
--
-- Kural: gozlemci_of'u bir hesaba BAĞLAMAK yalnızca SECURITY DEFINER
-- fonksiyonlardan (gozlemci_baglan, handle_new_user) olur; bunların içinde
-- current_user fonksiyon sahibidir. İstemci (authenticated / anon) yalnızca
-- null yapabilir (gözlemcilikten çıkmak).
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

create or replace function public.gozlemci_of_koru()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.gozlemci_of is not null
     and (tg_op = 'INSERT' or new.gozlemci_of is distinct from old.gozlemci_of) then
    raise exception 'gozlemci_of yalnızca davet koduyla (gozlemci_baglan) ayarlanabilir'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.gozlemci_of_koru() from public, anon, authenticated;

drop trigger if exists profiles_gozlemci_of_koru on public.profiles;
create trigger profiles_gozlemci_of_koru
  before insert or update of gozlemci_of on public.profiles
  for each row execute function public.gozlemci_of_koru();

-- Kontrol (çalıştırdıktan sonra): mevcut gözlemci bağlantıları. Tanımadığın bir
-- bağlantı varsa gözlemci hesabın gozlemci_of'unu null yap.
--   select g.email as gozlemci, s.email as sahip, p.gozlemci_baglandi
--   from public.profiles p
--   join auth.users g on g.id = p.id
--   join auth.users s on s.id = p.gozlemci_of
--   order by p.gozlemci_baglandi desc;
