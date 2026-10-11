// Çevrimdışı mod veritabanı: bu bilgisayardaki tek bir SQLite dosyası
// (<veri klasörü>/labstock.db). Şema, Supabase'deki tabloların (supabase/
// migrations) birebir karşılığı — tek fark, RLS yerine tek kullanıcı olması.
// Node'un kendi SQLite'ı (node:sqlite) kullanılır: Electron'un Node'unda hazır
// geliyor, yerel derleme gerektiren bir paket yok.

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { veriDizini } from './mod';

const SURUM = 1;

const SEMA = `
create table if not exists profiles (
  id text primary key,
  ad text, telefon text, sirket_adi text, sirket_adresi text, resim_url text,
  davet_kodu text unique, gozlemci_of text, gozlemci_baglandi text, son_gorulme text,
  gemini_api_key text,
  haftalik_yedek_aktif integer not null default 0,
  yedek_eposta_adresi text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists parts (
  id text primary key,
  mpn text not null, uretici text, aciklama text, kategori text, kilif text,
  datasheet_url text,
  parametreler text not null default '{}',
  rohs integer, resim_url text, olusturan text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create unique index if not exists parts_mpn_uretici_key on parts (lower(mpn), coalesce(lower(uretici), ''));

create table if not exists locations (
  id text primary key,
  user_id text not null,
  parent_id text references locations (id) on delete cascade,
  ad text not null, kod text, tip text, aciklama text,
  sira integer not null default 0,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create unique index if not exists locations_user_kod_key on locations (user_id, lower(kod)) where kod is not null;

create table if not exists projects (
  id text primary key,
  user_id text not null,
  ad text not null, aciklama text,
  durum text not null default 'aktif',
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists stock_items (
  id text primary key,
  user_id text not null,
  part_id text not null references parts (id) on delete restrict,
  location_id text references locations (id) on delete set null,
  adet real not null default 0,
  min_adet real not null default 0,
  birim text not null default 'adet',
  alis_fiyati real,
  para_birimi text not null default 'TRY',
  tedarikci text, tedarikci_kodu text, notlar text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- Postgres'teki "nulls not distinct": konumsuz satır da parça başına tek olsun.
create unique index if not exists stock_items_uniq on stock_items (user_id, part_id, coalesce(location_id, ''));

create table if not exists stock_movements (
  id integer primary key autoincrement,
  user_id text not null,
  stock_item_id text not null references stock_items (id) on delete cascade,
  delta real not null,
  sonraki_adet real not null,
  sebep text not null default 'manuel',
  proje_id text references projects (id) on delete set null,
  aciklama text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists stock_movements_item_idx on stock_movements (stock_item_id, created_at);

create table if not exists project_bom (
  id text primary key,
  user_id text not null,
  proje_id text not null references projects (id) on delete cascade,
  part_id text not null references parts (id) on delete restrict,
  adet real not null default 1,
  referans text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  unique (proje_id, part_id)
);

create table if not exists part_suppliers (
  id text primary key,
  part_id text not null references parts (id) on delete cascade,
  tedarikci text not null, tedarikci_kodu text, fiyat real,
  para_birimi text not null default 'TRY',
  olusturan text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists tags (
  id text primary key,
  user_id text not null,
  ad text not null,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create unique index if not exists tags_user_ad_uniq on tags (user_id, lower(ad));

create table if not exists stock_item_tags (
  stock_item_id text not null references stock_items (id) on delete cascade,
  tag_id text not null references tags (id) on delete cascade,
  primary key (stock_item_id, tag_id)
);

create table if not exists feedback (
  id text primary key,
  user_id text not null,
  mesaj text not null, surum text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists alinacaklar (
  id text primary key,
  user_id text not null,
  malzeme_adi text not null,
  adet real not null default 1,
  not_metni text, link text,
  durum text not null default 'bekliyor',
  olusturan text,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists ai_anahtarlari (
  id text primary key,
  user_id text not null,
  saglayici text not null, ad text,
  anahtar text not null,
  sira integer not null default 0,
  model text, gunluk_limit integer,
  created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists ai_kullanim (
  anahtar_id text not null references ai_anahtarlari (id) on delete cascade,
  user_id text not null,
  gun text not null,
  istek integer not null default 0,
  token integer not null default 0,
  kota_doldu integer not null default 0,
  guncellendi text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  primary key (anahtar_id, gun)
);

-- Liste ekranının kaynağı; Supabase'deki "envanter" görünümüyle aynı sütunlar.
create view if not exists envanter as
select
  si.id as stok_id, si.user_id, si.adet, si.min_adet, si.birim, si.tedarikci, si.tedarikci_kodu,
  si.alis_fiyati, si.para_birimi, si.updated_at,
  p.id as part_id, p.mpn, p.uretici, p.aciklama, p.kategori, p.kilif, p.datasheet_url,
  p.parametreler, p.rohs, p.resim_url,
  l.id as konum_id, l.kod as konum_kodu, l.ad as konum_adi,
  case
    when si.adet <= 0 then 'yok'
    when si.min_adet > 0 and si.adet < si.min_adet then 'kritik'
    when si.min_adet > 0 and si.adet < si.min_adet * 1.5 then 'az'
    else 'yeterli'
  end as durum
from stock_items si
join parts p on p.id = si.part_id
left join locations l on l.id = si.location_id;
`;

/** Postgres ILIKE karşılığı: % ve _ joker, büyük/küçük harf duyarsız (Türkçe
 * İ/ı dahil). SQLite'ın LIKE'ı sadece ASCII harflerde duyarsız. */
function ilike(deger: unknown, desen: unknown): number {
  if (deger == null || desen == null) return 0;
  const kucuk = (s: string) => s.toLocaleLowerCase('tr').replace(/i̇/g, 'i');
  let re = '';
  for (const c of kucuk(String(desen))) {
    if (c === '%') re += '.*';
    else if (c === '_') re += '.';
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 's').test(kucuk(String(deger))) ? 1 : 0;
}

export function veritabaniYolu() {
  return path.join(veriDizini(), 'labstock.db');
}

const g = globalThis as unknown as { __labstockYerelDb?: DatabaseSync; __labstockYerelDbYol?: string };

export function yerelVeritabani(): DatabaseSync {
  const yol = veritabaniYolu();
  if (g.__labstockYerelDb && g.__labstockYerelDbYol === yol) return g.__labstockYerelDb;

  fs.mkdirSync(path.dirname(yol), { recursive: true });
  const db = new DatabaseSync(yol);
  db.exec('pragma journal_mode = wal; pragma foreign_keys = on; pragma busy_timeout = 5000;');
  db.function('ilike', { deterministic: true }, ilike);
  const { user_version } = db.prepare('pragma user_version').get() as { user_version: number };
  if (user_version < SURUM) {
    db.exec('begin');
    db.exec(SEMA);
    db.exec(`pragma user_version = ${SURUM}`);
    db.exec('commit');
  }
  g.__labstockYerelDb = db;
  g.__labstockYerelDbYol = yol;
  return db;
}

export function yerelVeritabaniniKapat() {
  g.__labstockYerelDb?.close();
  g.__labstockYerelDb = undefined;
}

/** Sütun tipleri: SQLite'ta boolean 0/1, jsonb metin olarak durur; uygulamaya
 * Supabase'in döndürdüğü biçimde (true/false, nesne) verilir. */
export const BOOLEAN_SUTUNLAR = new Set(['rohs', 'haftalik_yedek_aktif', 'kota_doldu']);
export const JSON_SUTUNLAR = new Set(['parametreler']);

/** Kimliği uuid olan tablolar (eklerken kimlik verilmezse üretilir). */
export const UUID_KIMLIKLI = new Set([
  'profiles', 'parts', 'locations', 'projects', 'stock_items', 'project_bom', 'part_suppliers',
  'tags', 'feedback', 'alinacaklar', 'ai_anahtarlari',
]);

/** Postgres'te "default auth.uid()" olan sütunlar. */
export const KULLANICI_VARSAYILANI: Record<string, string[]> = {
  locations: ['user_id'], projects: ['user_id'], stock_items: ['user_id'], stock_movements: ['user_id'],
  project_bom: ['user_id'], tags: ['user_id'], feedback: ['user_id'], alinacaklar: ['user_id', 'olusturan'],
};

export const TABLOLAR = [
  'profiles', 'parts', 'locations', 'projects', 'stock_items', 'stock_movements', 'project_bom',
  'part_suppliers', 'tags', 'stock_item_tags', 'feedback', 'alinacaklar', 'ai_anahtarlari', 'ai_kullanim',
] as const;
