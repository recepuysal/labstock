-- Parça resimleri ortak kopyası (src/lib/resim-kopya.ts).
--
-- Satıcı sitelerinden gelen resimler parca-resimleri kovasında "ortak/"
-- klasörüne, resim adresinin sha1'iyle tek kopya olarak saklanır. Giriş yapmış
-- kullanıcılar buraya yalnızca YENİ dosya ekleyebilir; var olanı değiştiremez
-- ya da silemez (başkasının parçasındaki resmi bozamasın).
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.

drop policy if exists "parca resmi ortak ekler" on storage.objects;
create policy "parca resmi ortak ekler" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'parca-resimleri' and (storage.foldername(name))[1] = 'ortak');
