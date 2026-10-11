// Bulut (Supabase) ↔ çevrimdışı (SQLite) veri aktarımı.
//
// buluttanYerele: hesabın tüm verisini bu bilgisayara kopyalar (yerel veritabanı
//   sıfırlanır). Bulut tarafına dokunmaz. Bulutta yüklü resimler de indirilir ki
//   çevrimdışıyken görünsün.
// yereldenBuluta: Ayarlar'da "yerel verileri hesabıma yükle" onaylanınca —
//   buluttaki veriler yerel verilerle DEĞİŞTİRİLİR (birleştirme yok). Önce
//   buluttaki verilerin tam bir JSON yedeği veri klasörüne yazılır.
//
// Ortak parça kataloğu (parts) herkesindir: yüklerken buluttaki kayıtlar silinmez,
// yerel parça bulutta varsa (aynı kimlik ya da aynı MPN + üretici) ona bağlanır,
// yoksa eklenir.

import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TABLOLAR, yerelVeritabani } from './veritabani';
import { veriDizini } from './mod';
import { yerelDosyaDizini } from './istemci';

type Satir = Record<string, unknown>;
type BulutVerisi = Record<(typeof TABLOLAR)[number], Satir[]>;

const SAYFA = 1000;
const PARCA = 200;

function parcala<T>(dizi: T[], n: number): T[][] {
  const sonuc: T[][] = [];
  for (let i = 0; i < dizi.length; i += n) sonuc.push(dizi.slice(i, i + n));
  return sonuc;
}

// Supabase bir istekte en fazla 1000 satır döndürür — sayfa sayfa çek.
async function tumu(
  sorgu: () => { range: (a: number, b: number) => PromiseLike<{ data: unknown; error: { message: string } | null }> },
): Promise<Satir[]> {
  const sonuc: Satir[] = [];
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await sorgu().range(bas, bas + SAYFA - 1);
    if (error) throw new Error(error.message);
    const satirlar = (data ?? []) as Satir[];
    sonuc.push(...satirlar);
    if (satirlar.length < SAYFA) return sonuc;
  }
}

async function idIle(bulut: SupabaseClient, tablo: string, sutun: string, idler: string[]): Promise<Satir[]> {
  const sonuc: Satir[] = [];
  for (const grup of parcala([...new Set(idler)], PARCA)) {
    sonuc.push(...(await tumu(() => bulut.from(tablo).select('*').in(sutun, grup))));
  }
  return sonuc;
}

/** Hesabın buluttaki tüm verisi. */
export async function bulutVerisiniOku(bulut: SupabaseClient, kullaniciId: string): Promise<BulutVerisi> {
  const kendi = (tablo: string) => tumu(() => bulut.from(tablo).select('*').eq('user_id', kullaniciId));
  const [profiles, locations, projects, stock_items, stock_movements, project_bom, tags, alinacaklar, ai_anahtarlari, ai_kullanim, feedback] =
    await Promise.all([
      tumu(() => bulut.from('profiles').select('*').eq('id', kullaniciId)),
      kendi('locations'),
      kendi('projects'),
      kendi('stock_items'),
      kendi('stock_movements'),
      kendi('project_bom'),
      kendi('tags'),
      kendi('alinacaklar'),
      kendi('ai_anahtarlari'),
      kendi('ai_kullanim'),
      kendi('feedback'),
    ]);
  const parcaIdleri = [...stock_items, ...project_bom].map((s) => s.part_id as string);
  const [parts, stock_item_tags] = await Promise.all([
    idIle(bulut, 'parts', 'id', parcaIdleri),
    idIle(bulut, 'stock_item_tags', 'stock_item_id', stock_items.map((s) => s.id as string)),
  ]);
  const part_suppliers = await idIle(bulut, 'part_suppliers', 'part_id', parts.map((p) => p.id as string));
  return {
    profiles, parts, locations, projects, stock_items, stock_movements, project_bom, part_suppliers,
    tags, stock_item_tags, feedback, alinacaklar, ai_anahtarlari, ai_kullanim,
  };
}

// ------------------------------------------------------------ resim dosyaları

const BULUT_DOSYA = /\/storage\/v1\/object\/public\/([^/]+)\/([^?#]+)/;
const YEREL_DOSYA = /^\/yerel-dosya\/([^/]+)\/([^?#]+)/;

async function resmiIndir(url: unknown): Promise<unknown> {
  if (typeof url !== 'string') return url;
  const m = url.match(BULUT_DOSYA);
  if (!m) return url; // dış bağlantı (ör. LCSC) — olduğu gibi kalır
  const [, kova, yol] = m;
  try {
    const yanit = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!yanit.ok) return url;
    const hedef = path.join(yerelDosyaDizini(), kova, ...decodeURIComponent(yol).split('/'));
    fs.mkdirSync(path.dirname(hedef), { recursive: true });
    fs.writeFileSync(hedef, new Uint8Array(await yanit.arrayBuffer()));
    return `/yerel-dosya/${kova}/${yol}`;
  } catch {
    return url; // indirilemezse bulut adresi kalsın, internet varken yine görünür
  }
}

async function resmiYukle(bulut: SupabaseClient, url: unknown, eskiSahip: string, yeniSahip: string): Promise<unknown> {
  if (typeof url !== 'string') return url;
  const m = url.match(YEREL_DOSYA);
  if (!m) return url;
  const [, kova, yol] = m;
  const dosya = path.join(yerelDosyaDizini(), kova, ...decodeURIComponent(yol).split('/'));
  if (!fs.existsSync(dosya)) return null;
  // Storage kuralı: ilk klasör yükleyenin kimliği olmalı.
  const parcalar = decodeURIComponent(yol).split('/');
  if (parcalar[0] === eskiSahip) parcalar[0] = yeniSahip;
  const hedefYol = parcalar.join('/');
  const uzanti = path.extname(dosya).slice(1).toLowerCase();
  const tip = uzanti === 'svg' ? 'image/svg+xml' : uzanti === 'jpg' ? 'image/jpeg' : `image/${uzanti}`;
  const { error } = await bulut.storage.from(kova).upload(hedefYol, fs.readFileSync(dosya), { upsert: true, contentType: tip });
  if (error) throw new Error(`Resim yüklenemedi (${hedefYol}): ${error.message}`);
  return `${bulut.storage.from(kova).getPublicUrl(hedefYol).data.publicUrl}?t=${Date.now()}`;
}

// ------------------------------------------------------- buluttan yerele

function sutunlar(tablo: string): Set<string> {
  const db = yerelVeritabani();
  return new Set((db.prepare(`pragma table_info("${tablo}")`).all() as { name: string }[]).map((s) => s.name));
}

function yerelDeger(v: unknown) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') return JSON.stringify(v);
  return v as string | number;
}

export async function buluttanYerele(bulut: SupabaseClient, kullaniciId: string) {
  const veri = await bulutVerisiniOku(bulut, kullaniciId);
  for (const p of veri.parts) p.resim_url = await resmiIndir(p.resim_url);
  for (const p of veri.profiles) p.resim_url = await resmiIndir(p.resim_url);

  const db = yerelVeritabani();
  db.exec('pragma foreign_keys = off');
  db.exec('begin');
  try {
    for (const tablo of TABLOLAR) db.exec(`delete from "${tablo}"`);
    db.exec(`delete from sqlite_sequence where name = 'stock_movements'`);
    for (const tablo of TABLOLAR) {
      const gecerli = sutunlar(tablo);
      for (const satir of veri[tablo]) {
        const anahtarlar = Object.keys(satir).filter((k) => gecerli.has(k));
        db.prepare(`insert into "${tablo}" (${anahtarlar.map((k) => `"${k}"`).join(', ')}) values (${anahtarlar.map(() => '?').join(', ')})`).run(
          ...anahtarlar.map((k) => yerelDeger(satir[k])),
        );
      }
    }
    db.exec('commit');
  } catch (e) {
    db.exec('rollback');
    throw e;
  } finally {
    db.exec('pragma foreign_keys = on');
  }
  return { parca: veri.stock_items.length, hareket: veri.stock_movements.length };
}

// ------------------------------------------------------- yerelden buluta

function yerelTablo(tablo: string): Satir[] {
  const satirlar = yerelVeritabani().prepare(`select * from "${tablo}"`).all() as Satir[];
  return satirlar.map((s) => {
    const o: Satir = {};
    for (const [k, v] of Object.entries(s)) {
      if (k === 'parametreler' && typeof v === 'string') {
        try {
          o[k] = JSON.parse(v);
        } catch {
          o[k] = {};
        }
      } else if (['rohs', 'haftalik_yedek_aktif', 'kota_doldu'].includes(k)) o[k] = v === null ? null : Boolean(v);
      else if (typeof v === 'bigint') o[k] = Number(v);
      else o[k] = v;
    }
    return o;
  });
}

export function yerelVeriVarMi(): boolean {
  const db = yerelVeritabani();
  const r = db.prepare('select (select count(*) from stock_items) + (select count(*) from locations) + (select count(*) from alinacaklar) as n').get() as { n: number };
  return Number(r.n) > 0;
}

async function ekle(bulut: SupabaseClient, tablo: string, satirlar: Satir[]) {
  for (const grup of parcala(satirlar, 500)) {
    const { error } = await bulut.from(tablo).insert(grup);
    if (error) throw new Error(`${tablo}: ${error.message}`);
  }
}

/** Bulut verilerini yerel verilerle değiştirir. Dönüş: alınan yedeğin yolu. */
export async function yereldenBuluta(bulut: SupabaseClient, bulutKullanici: string, yerelSahip: string): Promise<string> {
  // 1) Buluttaki mevcut verinin yedeği — bir şey ters giderse elde dursun.
  const yedek = await bulutVerisiniOku(bulut, bulutKullanici);
  const yedekDizini = path.join(veriDizini(), 'yedekler');
  fs.mkdirSync(yedekDizini, { recursive: true });
  const yedekYolu = path.join(yedekDizini, `bulut-yedegi-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(yedekYolu, JSON.stringify(yedek));

  // 2) Yerel veri; sahip kimliği bulut hesabına çevrilir.
  const sahip = (v: unknown) => (v === yerelSahip ? bulutKullanici : v);
  const oku = (tablo: string) =>
    yerelTablo(tablo).map((s) => {
      for (const k of ['user_id', 'olusturan']) if (k in s) s[k] = sahip(s[k]);
      return s;
    });
  const parts = oku('parts');
  const locations = oku('locations');
  const projects = oku('projects');
  const stock_items = oku('stock_items');
  const stock_movements = oku('stock_movements');
  const project_bom = oku('project_bom');
  const tags = oku('tags');
  const stock_item_tags = oku('stock_item_tags');
  const alinacaklar = oku('alinacaklar');
  const ai_anahtarlari = oku('ai_anahtarlari');
  const ai_kullanim = oku('ai_kullanim');
  const profil = oku('profiles').find((p) => p.id === yerelSahip || p.id === bulutKullanici);

  // 3) Parçalar: bulutta varsa ona bağla, yoksa ekle.
  const parcaEsleme = new Map<string, string>();
  const kullanilan = new Set([...stock_items, ...project_bom].map((s) => s.part_id as string));
  for (const p of parts.filter((p) => kullanilan.has(p.id as string))) {
    const { data: ayni } = await bulut.from('parts').select('id').eq('id', p.id as string).maybeSingle();
    if (ayni) {
      parcaEsleme.set(p.id as string, p.id as string);
      continue;
    }
    let ara = bulut.from('parts').select('id').ilike('mpn', String(p.mpn).replace(/[%_\\]/g, '\\$&'));
    ara = p.uretici ? ara.ilike('uretici', String(p.uretici).replace(/[%_\\]/g, '\\$&')) : ara.is('uretici', null);
    const { data: benzer } = await ara.limit(1).maybeSingle();
    if (benzer) {
      parcaEsleme.set(p.id as string, (benzer as Satir).id as string);
      continue;
    }
    const yeni = { ...p, olusturan: bulutKullanici, resim_url: await resmiYukle(bulut, p.resim_url, yerelSahip, bulutKullanici) };
    const { error } = await bulut.from('parts').insert(yeni);
    if (error) throw new Error(`parts: ${error.message}`);
    parcaEsleme.set(p.id as string, p.id as string);
  }
  const parca = (id: unknown) => parcaEsleme.get(id as string) ?? id;

  // 4) Hesabın bulut verisini sil (stok kalemleriyle hareketleri ve etiket
  //    bağlantıları da gider; yapay zekâ anahtarıyla kullanım kayıtları da).
  for (const tablo of ['stock_items', 'project_bom', 'projects', 'tags', 'locations', 'alinacaklar', 'ai_anahtarlari']) {
    const { error } = await bulut.from(tablo).delete().eq('user_id', bulutKullanici);
    if (error) throw new Error(`${tablo} silinemedi: ${error.message}. Yedek: ${yedekYolu}`);
  }

  // 5) Yerel veriyi yükle. Konumlar üstten alta sıralı (üst konum önce).
  const sirali: Satir[] = [];
  const eklenen = new Set<string>();
  let kalan = [...locations];
  while (kalan.length) {
    const hazir = kalan.filter((l) => !l.parent_id || eklenen.has(l.parent_id as string));
    if (!hazir.length) {
      sirali.push(...kalan.map((l) => ({ ...l, parent_id: null })));
      break;
    }
    hazir.forEach((l) => eklenen.add(l.id as string));
    sirali.push(...hazir);
    kalan = kalan.filter((l) => !eklenen.has(l.id as string));
  }
  try {
    await ekle(bulut, 'locations', sirali);
    await ekle(bulut, 'projects', projects);
    await ekle(bulut, 'tags', tags);
    await ekle(bulut, 'stock_items', stock_items.map((s) => ({ ...s, part_id: parca(s.part_id) })));
    // Bulutta hareket kimliği veritabanınca üretilir.
    await ekle(bulut, 'stock_movements', stock_movements.map(({ id: _id, ...s }) => s));
    await ekle(bulut, 'project_bom', project_bom.map((s) => ({ ...s, part_id: parca(s.part_id) })));
    await ekle(bulut, 'stock_item_tags', stock_item_tags);
    await ekle(bulut, 'alinacaklar', alinacaklar);
    await ekle(bulut, 'ai_anahtarlari', ai_anahtarlari);
    await ekle(bulut, 'ai_kullanim', ai_kullanim);
    if (profil) {
      const { ad, telefon, sirket_adi, sirket_adresi } = profil;
      const resim_url = await resmiYukle(bulut, profil.resim_url, yerelSahip, bulutKullanici);
      const { error } = await bulut.from('profiles').update({ ad, telefon, sirket_adi, sirket_adresi, resim_url }).eq('id', bulutKullanici);
      if (error) throw new Error(`profiles: ${error.message}`);
    }
  } catch (e) {
    throw new Error(`${(e as Error).message}. Buluttaki eski verilerin yedeği: ${yedekYolu}`);
  }
  return yedekYolu;
}
