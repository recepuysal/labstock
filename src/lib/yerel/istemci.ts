// Çevrimdışı mod istemcisi: Supabase istemcisinin uygulamada kullanılan kısmını
// (from().select/insert/update/upsert/delete + filtreler, rpc, auth.getUser,
// storage) yerel SQLite üzerinde taklit eder. Böylece sayfalar ve server
// action'lar hangi modda olduklarını bilmeden aynı kodla çalışır; bulut modu
// hiç değişmez. Desteklenmeyen bir kullanım sessizce yanlış sonuç vermesin diye
// açık bir hata döndürür.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import {
  BOOLEAN_SUTUNLAR,
  JSON_SUTUNLAR,
  KULLANICI_VARSAYILANI,
  UUID_KIMLIKLI,
  yerelVeritabani,
} from './veritabani';
import { ayarOku, ayarYaz, veriDizini } from './mod';

type Hata = { message: string; code?: string; details?: string | null; hint?: string | null };
type Satir = Record<string, unknown>;
type Sonuc = { data: unknown; error: Hata | null; count: number | null; status: number; statusText: string };

const CEVRIMDISI = 'Bu özellik çevrimdışı modda kullanılamaz.';

function hataSonucu(message: string, code?: string): Sonuc {
  return { data: null, error: { message, code, details: null, hint: null }, count: null, status: 400, statusText: '' };
}

/** SQLite hata metnini Postgres hata koduna çevirir — uygulama 23505'e bakıyor. */
function sqliteHatasi(e: unknown): Hata {
  const message = e instanceof Error ? e.message : String(e);
  const code = /UNIQUE constraint failed/i.test(message)
    ? '23505'
    : /FOREIGN KEY constraint failed/i.test(message)
      ? '23503'
      : /NOT NULL constraint failed/i.test(message)
        ? '23502'
        : 'YEREL';
  return { message, code, details: null, hint: null };
}

function ad(sutun: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(sutun)) throw new Error(`Geçersiz sütun adı: ${sutun}`);
  return `"${sutun}"`;
}

function yaz(sutun: string, deger: unknown): SQLInputValue {
  if (deger === undefined || deger === null) return null;
  if (typeof deger === 'boolean') return deger ? 1 : 0;
  if (JSON_SUTUNLAR.has(sutun) || (typeof deger === 'object' && !(deger instanceof Uint8Array))) {
    return JSON.stringify(deger);
  }
  return deger as SQLInputValue;
}

function oku(satir: Satir): Satir {
  const sonuc: Satir = {};
  for (const [k, v] of Object.entries(satir)) {
    if (BOOLEAN_SUTUNLAR.has(k)) sonuc[k] = v === null ? null : Boolean(v);
    else if (JSON_SUTUNLAR.has(k) && typeof v === 'string') {
      try {
        sonuc[k] = JSON.parse(v);
      } catch {
        sonuc[k] = v;
      }
    } else if (typeof v === 'bigint') sonuc[k] = Number(v);
    else sonuc[k] = v;
  }
  return sonuc;
}

// Gömülü seçimlerde (select('x, tags(ad)')) hangi yabancı anahtar kullanılır.
const ILISKILER: Record<string, Record<string, { sutun: string; tablo: string }>> = {
  stock_item_tags: { tags: { sutun: 'tag_id', tablo: 'tags' } },
};

type Gomulu = { ad: string; tablo: string; sutun: string; ic: boolean; sutunlar: string[] };

function secimiAyristir(tablo: string, secim: string): { sutunlar: string[]; gomululer: Gomulu[] } {
  const parcalar: string[] = [];
  let derinlik = 0;
  let parca = '';
  for (const c of secim) {
    if (c === '(') derinlik++;
    if (c === ')') derinlik--;
    if (c === ',' && derinlik === 0) {
      parcalar.push(parca.trim());
      parca = '';
    } else parca += c;
  }
  if (parca.trim()) parcalar.push(parca.trim());

  const sutunlar: string[] = [];
  const gomululer: Gomulu[] = [];
  for (const p of parcalar) {
    const m = p.match(/^([a-z_]+)(!inner)?\((.*)\)$/i);
    if (m) {
      const iliski = ILISKILER[tablo]?.[m[1]];
      if (!iliski) throw new Error(`Çevrimdışı modda desteklenmeyen ilişki: ${tablo}.${m[1]}`);
      gomululer.push({
        ad: m[1],
        tablo: iliski.tablo,
        sutun: iliski.sutun,
        ic: Boolean(m[2]),
        sutunlar: m[3].split(',').map((s) => s.trim()).filter(Boolean),
      });
    } else sutunlar.push(p);
  }
  return { sutunlar, gomululer };
}

function sec(satir: Satir, sutunlar: string[]): Satir {
  if (sutunlar.length === 0 || sutunlar.includes('*')) return { ...satir };
  const sonuc: Satir = {};
  for (const s of sutunlar) sonuc[s] = satir[s] ?? null;
  return sonuc;
}

/** PostgREST "or" sözdizimi: `a.ilike.%x%,b.eq.5` (değer çift tırnak içinde
 * virgül içerebilir). */
function orAyristir(ifade: string): { sql: string; degerler: SQLInputValue[] } {
  const parcalar: string[] = [];
  let tirnak = false;
  let parca = '';
  for (const c of ifade) {
    if (c === '"') tirnak = !tirnak;
    if (c === ',' && !tirnak) {
      parcalar.push(parca);
      parca = '';
    } else parca += c;
  }
  if (parca) parcalar.push(parca);

  const sqller: string[] = [];
  const degerler: SQLInputValue[] = [];
  for (const p of parcalar) {
    const m = p.trim().match(/^([a-z_]+)\.([a-z]+)\.(.*)$/i);
    if (!m) throw new Error(`Çevrimdışı modda desteklenmeyen filtre: ${p}`);
    const [, sutun, op] = m;
    let deger: string = m[3];
    if (deger.startsWith('"') && deger.endsWith('"')) deger = deger.slice(1, -1);
    const k = kosul(sutun, op, op === 'is' ? (deger === 'null' ? null : deger === 'true') : deger);
    sqller.push(k.sql);
    degerler.push(...k.degerler);
  }
  return { sql: `(${sqller.join(' or ')})`, degerler };
}

function kosul(sutun: string, op: string, deger: unknown): { sql: string; degerler: SQLInputValue[] } {
  const s = ad(sutun);
  switch (op) {
    case 'eq':
      return { sql: `${s} = ?`, degerler: [yaz(sutun, deger)] };
    case 'neq':
      return { sql: `${s} <> ?`, degerler: [yaz(sutun, deger)] };
    case 'gt':
      return { sql: `${s} > ?`, degerler: [yaz(sutun, deger)] };
    case 'gte':
      return { sql: `${s} >= ?`, degerler: [yaz(sutun, deger)] };
    case 'lt':
      return { sql: `${s} < ?`, degerler: [yaz(sutun, deger)] };
    case 'lte':
      return { sql: `${s} <= ?`, degerler: [yaz(sutun, deger)] };
    case 'ilike':
      return { sql: `ilike(${s}, ?)`, degerler: [String(deger)] };
    case 'like':
      return { sql: `${s} glob ?`, degerler: [String(deger).replace(/%/g, '*').replace(/_/g, '?')] };
    case 'is':
      if (deger === null) return { sql: `${s} is null`, degerler: [] };
      return { sql: `${s} = ?`, degerler: [deger ? 1 : 0] };
    case 'in': {
      const liste = Array.isArray(deger) ? deger : [];
      if (liste.length === 0) return { sql: '0', degerler: [] };
      return { sql: `${s} in (${liste.map(() => '?').join(', ')})`, degerler: liste.map((v) => yaz(sutun, v)) };
    }
    default:
      throw new Error(`Çevrimdışı modda desteklenmeyen filtre: ${op}`);
  }
}

class YerelSorgu implements PromiseLike<Sonuc> {
  private islem: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private secim = '*';
  private donusIstendi = false;
  private kosullar: { sql: string; degerler: SQLInputValue[] }[] = [];
  private gomuluKosullar: { tablo: string; sutun: string; deger: unknown }[] = [];
  private siralama: { sutun: string; artan: boolean }[] = [];
  private sinir?: number;
  private atla = 0;
  private tekil?: 'single' | 'maybe';
  private sayim = false;
  private sadeceSayim = false;
  private yuk: Satir[] = [];
  private cakisma = 'id';
  private hata?: string;

  constructor(
    private db: DatabaseSync,
    private tablo: string,
    private kullaniciId: string,
  ) {
    try {
      ad(tablo);
    } catch {
      this.hata = `Geçersiz tablo: ${tablo}`;
    }
  }

  select(secim = '*', secenek?: { count?: string; head?: boolean }) {
    this.secim = secim;
    if (this.islem === 'select') {
      if (secenek?.count) this.sayim = true;
      if (secenek?.head) this.sadeceSayim = true;
    } else this.donusIstendi = true;
    return this;
  }
  insert(deger: Satir | Satir[]) {
    this.islem = 'insert';
    this.yuk = Array.isArray(deger) ? deger : [deger];
    return this;
  }
  upsert(deger: Satir | Satir[], secenek?: { onConflict?: string }) {
    this.islem = 'upsert';
    this.yuk = Array.isArray(deger) ? deger : [deger];
    if (secenek?.onConflict) this.cakisma = secenek.onConflict;
    return this;
  }
  update(deger: Satir) {
    this.islem = 'update';
    this.yuk = [deger];
    return this;
  }
  delete() {
    this.islem = 'delete';
    return this;
  }

  private filtre(sutun: string, op: string, deger: unknown) {
    if (this.hata) return this;
    try {
      if (sutun.includes('.')) {
        if (op !== 'eq') throw new Error(`Çevrimdışı modda desteklenmeyen filtre: ${sutun} ${op}`);
        const [tablo, s] = sutun.split('.');
        this.gomuluKosullar.push({ tablo, sutun: s, deger });
      } else this.kosullar.push(kosul(sutun, op, deger));
    } catch (e) {
      this.hata = (e as Error).message;
    }
    return this;
  }
  eq(s: string, v: unknown) { return this.filtre(s, 'eq', v); }
  neq(s: string, v: unknown) { return this.filtre(s, 'neq', v); }
  gt(s: string, v: unknown) { return this.filtre(s, 'gt', v); }
  gte(s: string, v: unknown) { return this.filtre(s, 'gte', v); }
  lt(s: string, v: unknown) { return this.filtre(s, 'lt', v); }
  lte(s: string, v: unknown) { return this.filtre(s, 'lte', v); }
  ilike(s: string, v: string) { return this.filtre(s, 'ilike', v); }
  like(s: string, v: string) { return this.filtre(s, 'like', v); }
  is(s: string, v: unknown) { return this.filtre(s, 'is', v); }
  in(s: string, v: unknown[]) { return this.filtre(s, 'in', v); }
  filter(s: string, op: string, v: unknown) { return this.filtre(s, op, v); }
  match(nesne: Satir) {
    for (const [k, v] of Object.entries(nesne)) this.filtre(k, 'eq', v);
    return this;
  }
  or(ifade: string) {
    if (this.hata) return this;
    try {
      this.kosullar.push(orAyristir(ifade));
    } catch (e) {
      this.hata = (e as Error).message;
    }
    return this;
  }
  order(sutun: string, secenek?: { ascending?: boolean }) {
    this.siralama.push({ sutun, artan: secenek?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.sinir = n;
    return this;
  }
  range(bas: number, son: number) {
    this.atla = bas;
    this.sinir = son - bas + 1;
    return this;
  }
  single() {
    this.tekil = 'single';
    return this;
  }
  maybeSingle() {
    this.tekil = 'maybe';
    return this;
  }
  abortSignal() {
    return this;
  }

  then<A = Sonuc, B = never>(
    tamam?: ((s: Sonuc) => A | PromiseLike<A>) | null,
    red?: ((e: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.calistir())
      .then(tamam, red);
  }

  private where(): { sql: string; degerler: SQLInputValue[] } {
    if (this.kosullar.length === 0) return { sql: '', degerler: [] };
    return {
      sql: ' where ' + this.kosullar.map((k) => k.sql).join(' and '),
      degerler: this.kosullar.flatMap((k) => k.degerler),
    };
  }

  private calistir(): Sonuc {
    if (this.hata) return hataSonucu(this.hata);
    try {
      const satirlar = this.islem === 'select' ? this.oku() : this.degistir();
      if (satirlar === null) return { data: null, error: null, count: null, status: 204, statusText: '' };
      if ('error' in satirlar) return satirlar;
      return this.tekillestir(satirlar.data, satirlar.count);
    } catch (e) {
      return { data: null, error: sqliteHatasi(e), count: null, status: 400, statusText: '' };
    }
  }

  private tekillestir(satirlar: Satir[], count: number | null): Sonuc {
    if (this.tekil === 'single') {
      if (satirlar.length !== 1) {
        return hataSonucu(
          satirlar.length === 0 ? 'Kayıt bulunamadı' : 'Birden fazla kayıt döndü',
          'PGRST116',
        );
      }
      return { data: satirlar[0], error: null, count, status: 200, statusText: '' };
    }
    if (this.tekil === 'maybe') {
      if (satirlar.length > 1) return hataSonucu('Birden fazla kayıt döndü', 'PGRST116');
      return { data: satirlar[0] ?? null, error: null, count, status: 200, statusText: '' };
    }
    return { data: satirlar, error: null, count, status: 200, statusText: '' };
  }

  private oku(): { data: Satir[]; count: number | null } {
    const { sutunlar, gomululer } = secimiAyristir(this.tablo, this.secim);
    const w = this.where();
    let count: number | null = null;
    if (this.sayim) {
      const r = this.db.prepare(`select count(*) as n from ${ad(this.tablo)}${w.sql}`).get(...w.degerler) as { n: number };
      count = Number(r.n);
      if (this.sadeceSayim) return { data: [], count };
    }

    let sql = `select * from ${ad(this.tablo)}${w.sql}`;
    if (this.siralama.length) {
      // Postgres'te artan sıralamada null'lar sona, azalanda başa gelir.
      sql +=
        ' order by ' +
        this.siralama.map((o) => `(${ad(o.sutun)} is null) ${o.artan ? 'asc' : 'desc'}, ${ad(o.sutun)} ${o.artan ? 'asc' : 'desc'}`).join(', ');
    }
    const sonraFiltre = this.gomuluKosullar.length > 0;
    if (!sonraFiltre && this.sinir !== undefined) sql += ` limit ${Number(this.sinir)} offset ${Number(this.atla)}`;

    let satirlar = (this.db.prepare(sql).all(...w.degerler) as Satir[]).map(oku);

    if (gomululer.length) {
      const onbellek = new Map<string, Satir | null>();
      const sonuc: Satir[] = [];
      for (const satir of satirlar) {
        let gecerli = true;
        const ek: Satir = {};
        for (const gm of gomululer) {
          const id = satir[gm.sutun] as string | null;
          const anahtar = `${gm.tablo}:${id}`;
          if (!onbellek.has(anahtar)) {
            const ilgili = id ? (this.db.prepare(`select * from ${ad(gm.tablo)} where id = ?`).get(id) as Satir | undefined) : undefined;
            onbellek.set(anahtar, ilgili ? oku(ilgili) : null);
          }
          let ilgili = onbellek.get(anahtar) ?? null;
          for (const k of this.gomuluKosullar.filter((k) => k.tablo === gm.ad)) {
            if (!ilgili || ilgili[k.sutun] !== k.deger) ilgili = null;
          }
          if (!ilgili && (gm.ic || this.gomuluKosullar.some((k) => k.tablo === gm.ad))) gecerli = false;
          ek[gm.ad] = ilgili ? sec(ilgili, gm.sutunlar) : null;
        }
        if (gecerli) sonuc.push({ ...sec(satir, sutunlar), ...ek });
      }
      satirlar = sonuc;
      if (sonraFiltre && this.sinir !== undefined) satirlar = satirlar.slice(this.atla, this.atla + this.sinir);
      return { data: satirlar, count };
    }
    return { data: satirlar.map((s) => sec(s, sutunlar)), count };
  }

  private varsayilanlar(satir: Satir): Satir {
    const s = { ...satir };
    if (UUID_KIMLIKLI.has(this.tablo) && (s.id === undefined || s.id === null)) s.id = randomUUID();
    for (const k of KULLANICI_VARSAYILANI[this.tablo] ?? []) if (s[k] === undefined) s[k] = this.kullaniciId;
    for (const k of Object.keys(s)) if (s[k] === undefined) delete s[k];
    return s;
  }

  private degistir(): { data: Satir[]; count: null } | Sonuc | null {
    const t = ad(this.tablo);
    const donenler: Satir[] = [];
    this.db.exec('savepoint yerel_sorgu');
    try {
      if (this.islem === 'insert' || this.islem === 'upsert') {
        const cakisma = this.cakisma.split(',').map((c) => c.trim());
        for (const ham of this.yuk) {
          const satir = this.varsayilanlar(ham);
          const sutunlar = Object.keys(satir);
          let sql = `insert into ${t} (${sutunlar.map(ad).join(', ')}) values (${sutunlar.map(() => '?').join(', ')})`;
          if (this.islem === 'upsert') {
            const guncellenecek = sutunlar.filter((c) => !cakisma.includes(c));
            sql += ` on conflict (${cakisma.map(ad).join(', ')}) do ${
              guncellenecek.length ? `update set ${guncellenecek.map((c) => `${ad(c)} = excluded.${ad(c)}`).join(', ')}` : 'nothing'
            }`;
          }
          sql += ' returning *';
          const r = this.db.prepare(sql).get(...sutunlar.map((c) => yaz(c, satir[c]))) as Satir | undefined;
          if (r) donenler.push(oku(r));
        }
      } else if (this.islem === 'update') {
        const deger = Object.fromEntries(Object.entries(this.yuk[0]).filter(([, v]) => v !== undefined));
        const sutunlar = Object.keys(deger);
        if (sutunlar.length === 0) {
          this.db.exec('release yerel_sorgu');
          return null;
        }
        const w = this.where();
        const r = this.db
          .prepare(`update ${t} set ${sutunlar.map((c) => `${ad(c)} = ?`).join(', ')}${w.sql} returning *`)
          .all(...sutunlar.map((c) => yaz(c, deger[c])), ...w.degerler) as Satir[];
        donenler.push(...r.map(oku));
      } else if (this.islem === 'delete') {
        const w = this.where();
        const r = this.db.prepare(`delete from ${t}${w.sql} returning *`).all(...w.degerler) as Satir[];
        donenler.push(...r.map(oku));
      }
      this.db.exec('release yerel_sorgu');
    } catch (e) {
      this.db.exec('rollback to yerel_sorgu');
      this.db.exec('release yerel_sorgu');
      throw e;
    }
    degisiklikIsaretle();
    if (!this.donusIstendi) return this.tekil ? this.tekillestir([], null) : null;
    const { sutunlar } = secimiAyristir(this.tablo, this.secim);
    return { data: donenler.map((s) => sec(s, sutunlar)), count: null };
  }
}

let sonIsaret = 0;
/** Geri dönüşte "yerel verileri yükle" sorusu için değişiklik zamanını not eder
 * (en fazla dakikada bir dosyaya yazar). */
function degisiklikIsaretle() {
  const simdi = Date.now();
  if (simdi - sonIsaret < 60_000) return;
  sonIsaret = simdi;
  try {
    ayarYaz({ ...ayarOku(), sonDegisiklik: new Date(simdi).toISOString() });
  } catch {}
}

// ------------------------------------------------------------------ RPC'ler

function rpcCalistir(db: DatabaseSync, kullaniciId: string, ad: string, p: Record<string, unknown>): Sonuc {
  const tamam = (data: unknown): Sonuc => ({ data, error: null, count: null, status: 200, statusText: '' });
  try {
    switch (ad) {
      case 'stok_hareket': {
        const delta = Number(p.p_delta);
        if (!delta) return hataSonucu('Hareket miktarı sıfır olamaz');
        db.exec('savepoint stok_hareket');
        try {
          const r = db
            .prepare(
              `update stock_items set adet = adet + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
               where id = ? and user_id = ? returning adet`,
            )
            .get(delta, String(p.p_stok_id), kullaniciId) as { adet: number } | undefined;
          if (!r) throw new Error('Stok kalemi bulunamadı veya erişim yok');
          if (r.adet < 0) throw new Error(`Stok negatife düşemez (mevcut: ${r.adet - delta}, istenen: ${delta})`);
          db.prepare(
            `insert into stock_movements (user_id, stock_item_id, delta, sonraki_adet, sebep, aciklama, proje_id)
             values (?, ?, ?, ?, ?, ?, ?)`,
          ).run(kullaniciId, String(p.p_stok_id), delta, r.adet, String(p.p_sebep ?? 'manuel'), (p.p_aciklama as string) ?? null, (p.p_proje_id as string) ?? null);
          db.exec('release stok_hareket');
          degisiklikIsaretle();
          return tamam(r.adet);
        } catch (e) {
          db.exec('rollback to stok_hareket');
          db.exec('release stok_hareket');
          return hataSonucu((e as Error).message);
        }
      }
      case 'ai_kullanim_kaydet': {
        const gun = new Date().toISOString().slice(0, 10);
        db.prepare(
          `insert into ai_kullanim (anahtar_id, user_id, gun, istek, token, kota_doldu) values (?, ?, ?, ?, ?, ?)
           on conflict (anahtar_id, gun) do update set
             istek = istek + excluded.istek, token = token + excluded.token,
             kota_doldu = max(kota_doldu, excluded.kota_doldu),
             guncellendi = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
        ).run(String(p.p_anahtar_id), kullaniciId, gun, Math.max(Number(p.p_istek ?? 1), 0), Math.max(Number(p.p_token ?? 0), 0), p.p_kota_doldu ? 1 : 0);
        const limit = Number(p.p_gunluk_limit);
        if (limit > 0) db.prepare('update ai_anahtarlari set gunluk_limit = ? where id = ? and user_id = ?').run(limit, String(p.p_anahtar_id), kullaniciId);
        return tamam(null);
      }
      // Gözlemci ve yönetici paneli bulut hesabına bağlı — çevrimdışı modda yok.
      case 'gozlemcilerimi_listele':
        return tamam([]);
      case 'gozlemci_hedef_bilgisi':
        return tamam(null);
      case 'yonetici_mi':
        return tamam(false);
      case 'gozlemci_baglan':
      case 'gozlemciyi_cikar':
      case 'yonetici_istatistikleri':
        return hataSonucu(CEVRIMDISI);
      default:
        return hataSonucu(`Çevrimdışı modda desteklenmeyen işlem: ${ad}`);
    }
  } catch (e) {
    return { data: null, error: sqliteHatasi(e), count: null, status: 400, statusText: '' };
  }
}

// ---------------------------------------------------------------- dosyalar

export function yerelDosyaDizini() {
  return path.join(veriDizini(), 'dosyalar');
}

function guvenliYol(kova: string, yol: string): string {
  const kok = path.join(yerelDosyaDizini(), kova);
  const hedef = path.resolve(kok, yol);
  if (!hedef.startsWith(path.resolve(kok) + path.sep)) throw new Error('Geçersiz dosya yolu');
  return hedef;
}

function depolama(kova: string) {
  return {
    async upload(yol: string, dosya: Blob | ArrayBuffer | Uint8Array) {
      try {
        const hedef = guvenliYol(kova, yol);
        fs.mkdirSync(path.dirname(hedef), { recursive: true });
        const veri =
          dosya instanceof Blob ? new Uint8Array(await dosya.arrayBuffer()) : dosya instanceof ArrayBuffer ? new Uint8Array(dosya) : dosya;
        fs.writeFileSync(hedef, veri);
        return { data: { path: yol }, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
    getPublicUrl(yol: string) {
      return { data: { publicUrl: `/yerel-dosya/${kova}/${yol.split('/').map(encodeURIComponent).join('/')}` } };
    },
    async remove(yollar: string[]) {
      for (const y of yollar) fs.rmSync(guvenliYol(kova, y), { force: true });
      return { data: [], error: null };
    },
  };
}

// ------------------------------------------------------------------ istemci

/** Yerel verilerin sahibi: buluttan kopyalandıysa o hesabın kimliği, değilse
 * ilk açılışta üretilen sabit bir kimlik. */
export function yerelKullaniciId(): string {
  const ayar = ayarOku();
  if (ayar.kullaniciId) return ayar.kullaniciId;
  const id = randomUUID();
  ayarYaz({ ...ayar, kullaniciId: id });
  return id;
}

export function yerelIstemci() {
  const db = yerelVeritabani();
  const kullaniciId = yerelKullaniciId();
  db.prepare('insert into profiles (id) values (?) on conflict (id) do nothing').run(kullaniciId);

  const kullanici = {
    id: kullaniciId,
    email: undefined as string | undefined,
    aud: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  };
  const desteklenmiyor = async () => ({ data: { user: null, session: null }, error: { message: CEVRIMDISI, code: 'cevrimdisi' } });

  return {
    from: (tablo: string) => new YerelSorgu(db, tablo, kullaniciId),
    rpc: async (ad: string, parametreler: Record<string, unknown> = {}) => rpcCalistir(db, kullaniciId, ad, parametreler),
    storage: { from: depolama },
    auth: {
      getUser: async () => ({ data: { user: kullanici }, error: null }),
      getSession: async () => ({ data: { session: { user: kullanici } }, error: null }),
      signOut: async () => ({ error: null }),
      signInWithPassword: desteklenmiyor,
      signUp: desteklenmiyor,
      verifyOtp: desteklenmiyor,
      resend: desteklenmiyor,
    },
    channel: () => {
      const kanal = { on: () => kanal, subscribe: () => kanal, unsubscribe: async () => 'ok' };
      return kanal;
    },
    removeChannel: async () => 'ok',
  };
}
