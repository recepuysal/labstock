-- Alınacaklar listesine satın alma takibi için ek bilgiler: tedarikçi, birim
-- fiyat, sipariş verilme ve teslim alınma tarihleri. Eklenme zamanı zaten
-- created_at'te tutuluyor. Tarihler durum değişince uygulama tarafından
-- (boşsa) bugünün tarihiyle otomatik doldurulur, düzenleme formundan da
-- elle değiştirilebilir. Hepsi isteğe bağlı — var olan satırlar etkilenmez.
-- Çevrimdışı modun SQLite karşılığı: src/lib/yerel/veritabani.ts.
--
-- Supabase → SQL Editor'de bir kez çalıştır. Tekrar çalıştırmak güvenli.
-- (Canlıya uygulandı: 2026-11-17.)

alter table public.alinacaklar add column if not exists tedarikci      text;
alter table public.alinacaklar add column if not exists birim_fiyat    numeric;
alter table public.alinacaklar add column if not exists para_birimi    text not null default 'TRY';
alter table public.alinacaklar add column if not exists siparis_tarihi date;
alter table public.alinacaklar add column if not exists alinma_tarihi  date;
alter table public.alinacaklar add column if not exists guncellendi    timestamptz;
