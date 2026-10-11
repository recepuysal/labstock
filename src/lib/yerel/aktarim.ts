// Bulut (Supabase) ↔ çevrimdışı (SQLite) veri aktarımı.
//
// buluttanYerele: hesabın tüm verisini bu bilgisayara kopyalar (yerel veritabanı
//   sıfırlanır). Bulut tarafına dokunmaz. Bulutta yüklü resimler de indirilir ki
//   çevrimdışıyken görünsün.
// bulutaBirlestir: Ayarlar'da "yerel verileri hesabıma ekle" onaylanınca (ya da
//   bir bulut yedeği geri eklenirken) — veriler buluttakilerin ÜSTÜNE eklenir,
//   buluttaki hiçbir kayıt silinmez. Önce buluttaki verinin JSON yedeği alınır.
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

// ------------------------------------------------------- buluta birleştir

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

/** En büyük yerel hareket kimliği. Buluttan kopyalandığı andaki değeri eşik
 * olarak saklanır: bundan büyük kimlikli hareketler çevrimdışıyken yapılmıştır. */
export function sonYerelHareketId(): number {
  const r = yerelVeritabani().prepare('select coalesce(max(id), 0) as n from stock_movements').get() as { n: number | bigint };
  return Number(r.n);
}

export function yerelVeriKumesi(): BulutVerisi {
  return Object.fromEntries(TABLOLAR.map((t) => [t, yerelTablo(t)])) as BulutVerisi;
}

export type BirlesimOzeti = { yeniKalem: number; islenenHareket: number; yeniKonum: number; diger: number; uyarilar: string[] };

async function ekle(bulut: SupabaseClient, tablo: string, satirlar: Satir[]) {
  for (const grup of parcala(satirlar, 500)) {
    const { error } = await bulut.from(tablo).insert(grup);
    if (error) throw new Error(`${tablo}: ${error.message}`);
  }
}

const kucuk = (v: unknown) => String(v ?? '').toLocaleLowerCase('tr');

/**
 * Bir veri kümesini (yerel veriler ya da bir bulut yedeği) hesabın bulut verisine
 * EKLER — buluttaki hiçbir kayıt silinmez.
 *  - Bulutta zaten olan stok kalemi: `hareketEsigi`nden sonraki hareketler
 *    stok_hareket ile +/− olarak işlenir; başka bir cihazda yapılan
 *    değişiklikler kaybolmaz.
 *  - Bulutta olmayan kayıtlar eklenir; aynı kodlu konum / aynı adlı etiket /
 *    aynı MPN+üreticili parça varsa yenisi açılmaz, olana bağlanır.
 */
export async function bulutaBirlestir(
  bulut: SupabaseClient,
  bulutKullanici: string,
  kume: BulutVerisi,
  secenek: { eskiSahip: string; hareketEsigi: number; alanlariGuncelle: boolean },
): Promise<BirlesimOzeti> {
  const ozet: BirlesimOzeti = { yeniKalem: 0, islenenHareket: 0, yeniKonum: 0, diger: 0, uyarilar: [] };
  const sahip = (v: unknown) => (v === secenek.eskiSahip ? bulutKullanici : v);
  const kendi = (tablo: string) => tumu(() => bulut.from(tablo).select('*').eq('user_id', bulutKullanici));
  const [bLocations, bProjects, bTags, bItems, bAlinacak, bAi, bProfil] = await Promise.all([
    kendi('locations'),
    kendi('projects'),
    kendi('tags'),
    kendi('stock_items'),
    kendi('alinacaklar'),
    kendi('ai_anahtarlari'),
    tumu(() => bulut.from('profiles').select('*').eq('id', bulutKullanici)),
  ]);

  // --- parçalar (ortak katalog)
  const parcaEs = new Map<string, string>();
  const kullanilan = new Set([...kume.stock_items, ...kume.project_bom].map((s) => s.part_id as string));
  for (const p of kume.parts.filter((p) => kullanilan.has(p.id as string))) {
    const { data: ayni } = await bulut.from('parts').select('id').eq('id', p.id as string).maybeSingle();
    if (ayni) {
      parcaEs.set(p.id as string, p.id as string);
      continue;
    }
    const kacis = (v: unknown) => String(v).replace(/[%_\\]/g, '\\$&');
    let ara = bulut.from('parts').select('id').ilike('mpn', kacis(p.mpn));
    ara = p.uretici ? ara.ilike('uretici', kacis(p.uretici)) : ara.is('uretici', null);
    const { data: benzer } = await ara.limit(1).maybeSingle();
    if (benzer) {
      parcaEs.set(p.id as string, (benzer as Satir).id as string);
      continue;
    }
    const yeni = { ...p, olusturan: bulutKullanici, resim_url: await resmiYukle(bulut, p.resim_url, secenek.eskiSahip, bulutKullanici) };
    const { error } = await bulut.from('parts').insert(yeni);
    if (error) throw new Error(`parts: ${error.message}`);
    parcaEs.set(p.id as string, p.id as string);
  }
  const parca = (id: unknown) => parcaEs.get(id as string) ?? (id as string);

  // --- konumlar: aynı kimlik ya da aynı kod → olan; yoksa ekle (üst konum önce)
  const konumEs = new Map<string, string>();
  const bKonumId = new Set(bLocations.map((l) => l.id as string));
  const bKonumKod = new Map(bLocations.filter((l) => l.kod).map((l) => [kucuk(l.kod), l.id as string]));
  let kalan = [...kume.locations];
  while (kalan.length) {
    const hazir = kalan.filter(
      (l) => !l.parent_id || konumEs.has(l.parent_id as string) || !kume.locations.some((x) => x.id === l.parent_id),
    );
    const sira = hazir.length ? hazir : kalan;
    for (const l of sira) {
      const id = l.id as string;
      if (bKonumId.has(id)) konumEs.set(id, id);
      else if (l.kod && bKonumKod.has(kucuk(l.kod))) konumEs.set(id, bKonumKod.get(kucuk(l.kod))!);
      else {
        const ust = l.parent_id ? (konumEs.get(l.parent_id as string) ?? null) : null;
        await ekle(bulut, 'locations', [{ ...l, user_id: bulutKullanici, parent_id: ust }]);
        konumEs.set(id, id);
        ozet.yeniKonum++;
      }
    }
    const bitti = new Set(sira.map((l) => l.id));
    kalan = kalan.filter((l) => !bitti.has(l.id));
  }
  const konum = (id: unknown) => (id ? (konumEs.get(id as string) ?? null) : null);

  // --- projeler ve etiketler
  const bProjeId = new Set(bProjects.map((p) => p.id as string));
  const yeniProjeler = kume.projects.filter((p) => !bProjeId.has(p.id as string));
  await ekle(bulut, 'projects', yeniProjeler.map((p) => ({ ...p, user_id: bulutKullanici })));
  ozet.diger += yeniProjeler.length;
  const projeIdleri = new Set(kume.projects.map((p) => p.id as string));
  const proje = (id: unknown) => (id && projeIdleri.has(id as string) ? (id as string) : null);

  const etiketEs = new Map<string, string>();
  const bEtiketAd = new Map(bTags.map((t) => [kucuk(t.ad), t.id as string]));
  const bEtiketId = new Set(bTags.map((t) => t.id as string));
  const yeniEtiketler: Satir[] = [];
  for (const t of kume.tags) {
    const id = t.id as string;
    if (bEtiketId.has(id)) etiketEs.set(id, id);
    else if (bEtiketAd.has(kucuk(t.ad))) etiketEs.set(id, bEtiketAd.get(kucuk(t.ad))!);
    else {
      yeniEtiketler.push({ ...t, user_id: bulutKullanici });
      etiketEs.set(id, id);
    }
  }
  await ekle(bulut, 'tags', yeniEtiketler);
  ozet.diger += yeniEtiketler.length;

  // --- stok kalemleri ve hareketler
  const kalemEs = new Map<string, string>();
  const bKalemId = new Set(bItems.map((s) => s.id as string));
  const bKalemAnahtar = new Map(bItems.map((s) => [`${s.part_id}|${s.location_id ?? ''}`, s.id as string]));
  const hareketler = new Map<string, Satir[]>();
  for (const h of [...kume.stock_movements].sort((a, b) => Number(a.id) - Number(b.id))) {
    const liste = hareketler.get(h.stock_item_id as string) ?? [];
    liste.push(h);
    hareketler.set(h.stock_item_id as string, liste);
  }
  for (const s of kume.stock_items) {
    const id = s.id as string;
    const anahtar = `${parca(s.part_id)}|${konum(s.location_id) ?? ''}`;
    const mevcut = bKalemId.has(id) ? id : bKalemAnahtar.get(anahtar);
    const kendiHareketleri = hareketler.get(id) ?? [];
    if (mevcut) {
      kalemEs.set(id, mevcut);
      // Bulutta olan kalem: sadece eşikten sonraki (çevrimdışı yapılan) hareketler.
      for (const h of kendiHareketleri.filter((h) => Number(h.id) > secenek.hareketEsigi)) {
        const { error } = await bulut.rpc('stok_hareket', {
          p_stok_id: mevcut,
          p_delta: h.delta,
          p_sebep: h.sebep ?? 'manuel',
          p_aciklama: h.aciklama ?? null,
          p_proje_id: proje(h.proje_id),
        });
        if (error) ozet.uyarilar.push(error.message);
        else ozet.islenenHareket++;
      }
      if (secenek.alanlariGuncelle) {
        const { min_adet, birim, tedarikci, tedarikci_kodu, alis_fiyati, para_birimi, notlar } = s;
        await bulut
          .from('stock_items')
          .update({ min_adet, birim, tedarikci, tedarikci_kodu, alis_fiyati, para_birimi, notlar })
          .eq('id', mevcut);
      }
    } else {
      // Bulutta olmayan kalem: adediyle ve hareket geçmişiyle birlikte eklenir.
      await ekle(bulut, 'stock_items', [
        { ...s, user_id: bulutKullanici, part_id: parca(s.part_id), location_id: konum(s.location_id) },
      ]);
      await ekle(
        bulut,
        'stock_movements',
        kendiHareketleri.map(({ id: _id, ...h }) => ({ ...h, user_id: bulutKullanici, proje_id: proje(h.proje_id) })),
      );
      kalemEs.set(id, id);
      ozet.yeniKalem++;
    }
  }

  // --- bağlantılar (zaten varsa atlanır)
  const etiketBag = kume.stock_item_tags
    .filter((b) => kalemEs.has(b.stock_item_id as string) && etiketEs.has(b.tag_id as string))
    .map((b) => ({ stock_item_id: kalemEs.get(b.stock_item_id as string), tag_id: etiketEs.get(b.tag_id as string) }));
  for (const grup of parcala(etiketBag, 500)) {
    const { error } = await bulut.from('stock_item_tags').upsert(grup, { onConflict: 'stock_item_id,tag_id', ignoreDuplicates: true });
    if (error) throw new Error(`stock_item_tags: ${error.message}`);
  }
  const bom = kume.project_bom
    .filter((b) => proje(b.proje_id))
    .map(({ id: _id, ...b }) => ({ ...b, user_id: bulutKullanici, part_id: parca(b.part_id) }));
  for (const grup of parcala(bom, 500)) {
    const { error } = await bulut.from('project_bom').upsert(grup, { onConflict: 'proje_id,part_id', ignoreDuplicates: true });
    if (error) throw new Error(`project_bom: ${error.message}`);
  }

  // --- alınacaklar ve yapay zekâ anahtarları (aynı kimlik / aynı anahtar varsa atla)
  const bAlinacakId = new Set(bAlinacak.map((a) => a.id as string));
  const yeniAlinacak = kume.alinacaklar
    .filter((a) => !bAlinacakId.has(a.id as string))
    .map((a) => ({ ...a, user_id: bulutKullanici, olusturan: sahip(a.olusturan) ?? bulutKullanici }));
  await ekle(bulut, 'alinacaklar', yeniAlinacak);
  const bAnahtar = new Set(bAi.map((a) => a.anahtar as string));
  const bAiId = new Set(bAi.map((a) => a.id as string));
  const yeniAi = kume.ai_anahtarlari.filter((a) => !bAiId.has(a.id as string) && !bAnahtar.has(a.anahtar as string));
  await ekle(bulut, 'ai_anahtarlari', yeniAi.map((a) => ({ ...a, user_id: bulutKullanici })));
  ozet.diger += yeniAlinacak.length + yeniAi.length;

  // --- profil: sadece buluttakinde boş olan alanlar doldurulur
  const yerelProfil = kume.profiles.find((p) => p.id === secenek.eskiSahip || p.id === bulutKullanici);
  const bulutProfil = bProfil[0] ?? {};
  if (yerelProfil) {
    const guncelle: Satir = {};
    for (const k of ['ad', 'telefon', 'sirket_adi', 'sirket_adresi']) if (!bulutProfil[k] && yerelProfil[k]) guncelle[k] = yerelProfil[k];
    if (!bulutProfil.resim_url && yerelProfil.resim_url) {
      guncelle.resim_url = await resmiYukle(bulut, yerelProfil.resim_url, secenek.eskiSahip, bulutKullanici);
    }
    if (Object.keys(guncelle).length) await bulut.from('profiles').update(guncelle).eq('id', bulutKullanici);
  }
  return ozet;
}

/** Birleştirme öncesi buluttaki verinin JSON yedeği. Dönüş: dosya yolu. */
export async function bulutYedegiAl(bulut: SupabaseClient, kullaniciId: string): Promise<string> {
  const yedek = await bulutVerisiniOku(bulut, kullaniciId);
  const yedekDizini = path.join(veriDizini(), 'yedekler');
  fs.mkdirSync(yedekDizini, { recursive: true });
  const yol = path.join(yedekDizini, `bulut-yedegi-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(yol, JSON.stringify(yedek));
  return yol;
}

export function yedekleriListele(): { ad: string; tarih: string; kalem: number; sahip: string | null }[] {
  const dizin = path.join(veriDizini(), 'yedekler');
  if (!fs.existsSync(dizin)) return [];
  return fs
    .readdirSync(dizin)
    .filter((d) => /^bulut-yedegi-[\w-]+\.json$/.test(d))
    .map((ad) => {
      const yol = path.join(dizin, ad);
      let kalem = 0;
      let sahip: string | null = null;
      try {
        const veri = JSON.parse(fs.readFileSync(yol, 'utf8')) as BulutVerisi;
        kalem = veri.stock_items?.length ?? 0;
        sahip = (veri.profiles?.[0]?.id as string | undefined) ?? null;
      } catch {}
      return { ad, tarih: fs.statSync(yol).mtime.toISOString(), kalem, sahip };
    })
    .sort((a, b) => b.tarih.localeCompare(a.tarih));
}

export function yedekOku(ad: string): BulutVerisi {
  if (!/^bulut-yedegi-[\w-]+\.json$/.test(ad)) throw new Error('Geçersiz yedek adı');
  const ham = JSON.parse(fs.readFileSync(path.join(veriDizini(), 'yedekler', ad), 'utf8')) as Partial<BulutVerisi>;
  return Object.fromEntries(TABLOLAR.map((t) => [t, ham[t] ?? []])) as BulutVerisi;
}
