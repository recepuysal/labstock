-- Ortak katalogda (parts, part_suppliers) "olusturan" sütunu, yani satırı
-- ekleyen kullanıcının kimliği, artık okunamaz. Katalog herkese açık olduğu
-- için bu sütun tüm kullanıcı kimliklerini ortaya döküyordu (0014'teki açıkta
-- hedef bulmayı kolaylaştıran buydu; öneren: GuardLayer).
--
-- Yazma değişmedi: parça eklerken olusturan yine yazılır ve RLS politikaları
-- (yalnızca ekleyen düzenler) onu kullanmaya devam eder; politika ifadeleri
-- sütun yetkisine takılmaz. Uygulama bu sütunu hiç okumaz; select('*') yerine
-- sütunları açıkça yazar (bkz. src/lib/yerel/aktarim.ts).
--
-- Sütun listesi canlı şemadan okunur. Sütun yetkisi sütun başınadır: bu iki
-- tabloya YENİ SÜTUN eklenirse bu dosyayı yeniden çalıştır, yoksa okunamaz.
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

do $$
declare
  tablo text;
  sutunlar text;
begin
  foreach tablo in array array['parts', 'part_suppliers'] loop
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
      into sutunlar
      from information_schema.columns
     where table_schema = 'public' and table_name = tablo and column_name <> 'olusturan';
    execute format('revoke select on public.%I from anon, authenticated', tablo);
    execute format('grant select (%s) on public.%I to anon, authenticated', sutunlar, tablo);
  end loop;
end;
$$;
