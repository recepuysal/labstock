import * as XLSX from 'xlsx';

export type IceAktarSatir = {
  mpn: string;
  uretici: string | null;
  aciklama: string | null;
  kategori: string | null;
  kilif: string | null;
  adet: number;
  min_adet: number;
  tedarikci: string | null;
  tedarikci_kodu: string | null;
  konum_metni: string | null;
  alis_fiyati: number | null;
  para_birimi: string | null;
};

type AlanAdi = Exclude<keyof IceAktarSatir, 'para_birimi'>;

/** Başlık eşleştirme sözlüğü — Türkçe/İngilizce yaygın varyasyonlar, en spesifikten
 * en genele doğru sıralı (örn. "tedarikci_kodu" "tedarikci"den önce denenir, yoksa
 * "Tedarikçi Kodu" başlığı yanlışlıkla "Tedarikçi" alanına da eşleşir). */
const ALAN_ANAHTARLARI: { alan: AlanAdi; anahtarlar: string[] }[] = [
  { alan: 'tedarikci_kodu', anahtarlar: ['tedarikci kodu', 'tedarikçi kodu', 'supplier code', 'supplier part', 'supplier part#', 'supplier part number', 'lcsc part#', 'lcsc part number', 'lcsc', 'mouser part#', 'digikey part#', 'distributor part#'] },
  { alan: 'mpn', anahtarlar: ['mpn', 'parça no', 'parca no', 'parça numarası', 'parca numarasi', 'part number', 'part no', 'part#', 'partno', 'manufacturer part number', 'manufacture part number', 'mfr part #', 'mfr part number'] },
  { alan: 'uretici', anahtarlar: ['üretici', 'uretici', 'manufacturer', 'marka', 'brand', 'mfr'] },
  { alan: 'aciklama', anahtarlar: ['açıklama', 'aciklama', 'description', 'desc', 'tanım', 'tanim'] },
  { alan: 'kategori', anahtarlar: ['kategori', 'category', 'tip', 'type'] },
  { alan: 'kilif', anahtarlar: ['kılıf', 'kilif', 'package', 'footprint', 'case'] },
  { alan: 'tedarikci', anahtarlar: ['tedarikçi', 'tedarikci', 'supplier', 'vendor'] },
  { alan: 'konum_metni', anahtarlar: ['konum', 'location', 'yer', 'raf', 'çekmece', 'cekmece', 'shelf', 'drawer'] },
  // Birim fiyat (LCSC: "Unit Price($)"). Toplam fiyat ("Order Price", "Ext. Price") alınmaz.
  { alan: 'alis_fiyati', anahtarlar: ['unit price', 'birim fiyat', 'alış fiyatı', 'alis fiyati', 'alış fiyatı (birim)'] },
  { alan: 'min_adet', anahtarlar: ['min adet', 'min. adet', 'min seviye', 'minimum', 'min stok', 'min qty', 'min quantity', 'min stock', 'reorder point', 'reorder', 'min'] },
  { alan: 'adet', anahtarlar: ['adet', 'miktar', 'quantity', 'qty', 'stok', 'stock'] },
];

/** Başlığı karşılaştırmaya hazırlar. İngilizce başlıklar için 'en-US' ile de
 * denenir — Türkçe küçük harfe çevirmede "LOCATION" -> "locatıon" olur. */
function normallestir(s: string, yerelAyar = 'tr-TR'): string {
  return s.toLocaleLowerCase(yerelAyar).replace(/[._-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Sipariş dosyalarında "en az sipariş adedi" sütunu (LCSC: "Min\Mult Order Qty.")
 * min. stok seviyesi değildir; hiçbir alana eşlenmez. */
const YOKSAYILAN = ['mult', 'moq', 'min order', 'minimum order', 'order price', 'ext price', 'extended price'];

function basliklariEslestir(basliklar: string[]): Partial<Record<AlanAdi, number>> {
  const normlar = basliklar.map((b) => [normallestir(b), normallestir(b, 'en-US')]);
  const eslesme: Partial<Record<AlanAdi, number>> = {};
  const kullanilanIndeksler = new Set<number>(
    normlar.flatMap((b, i) => (b.some((n) => YOKSAYILAN.some((y) => n.includes(y))) ? [i] : [])),
  );

  // 1. geçiş: tam eşleşme (en güvenilir)
  for (const { alan, anahtarlar } of ALAN_ANAHTARLARI) {
    const idx = normlar.findIndex(
      (b, i) => !kullanilanIndeksler.has(i) && b.some((n) => anahtarlar.includes(n)),
    );
    if (idx !== -1) {
      eslesme[alan] = idx;
      kullanilanIndeksler.add(idx);
    }
  }

  // 2. geçiş: içerik eşleşmesi — sadece 1. geçişte eşleşmemiş alanlar, henüz
  // kullanılmamış sütunlarda (aynı sütunun iki alana birden atanmasını önler).
  for (const { alan, anahtarlar } of ALAN_ANAHTARLARI) {
    if (eslesme[alan] !== undefined) continue;
    const idx = normlar.findIndex(
      (b, i) => !kullanilanIndeksler.has(i) && b.some((n) => anahtarlar.some((a) => n.includes(a))),
    );
    if (idx !== -1) {
      eslesme[alan] = idx;
      kullanilanIndeksler.add(idx);
    }
  }

  return eslesme;
}

function sayiyaCevir(metin: string): number {
  if (!metin) return 0;
  const n = Number(metin.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Fiyat sütun başlığından para birimi: "Unit Price($)" → USD. */
function paraBirimiBul(baslik: string): string | null {
  if (/\$|\busd\b/i.test(baslik)) return 'USD';
  if (/€|\beur\b/i.test(baslik)) return 'EUR';
  if (/₺|\btl\b|\btry\b/i.test(baslik)) return 'TRY';
  return null;
}

type Ayristirma = { satirlar: IceAktarSatir[]; mpnBulunamadi: boolean; toplamSatir: number };

/** "$0.0123", "1.234,56 TL" gibi metinlerden birim fiyat; okunamazsa null. */
function fiyataCevir(metin: string): number | null {
  const temiz = metin.replace(/[^0-9.,]/g, '');
  if (!temiz) return null;
  // Hem nokta hem virgül varsa sondaki ondalık ayırıcıdır.
  const ondalik = Math.max(temiz.lastIndexOf('.'), temiz.lastIndexOf(','));
  const sayi = ondalik === -1 ? temiz : temiz.slice(0, ondalik).replace(/[.,]/g, '') + '.' + temiz.slice(ondalik + 1);
  const n = Number(sayi);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Excel/CSV dosyasını ayrıştırır. mpn sütunu bulunamazsa satirlar boş döner. */
export function dosyayiAyristir(buffer: ArrayBuffer): Ayristirma {
  // codepage: 65001 (UTF-8) zorlanıyor - aksi halde SheetJS, BOM'suz CSV
  // dosyalarında Türkçe karakterleri (ç/ı/ş/ğ/ö/ü) yanlış kodlamayla okuyup
  // bozuyor. .xlsx dosyaları zaten Unicode XML içerdiği için bundan etkilenmez.
  return kitabiAyristir(XLSX.read(buffer, { type: 'array', codepage: 65001 }));
}

/** Yapıştırılan tablo: sipariş sayfasından ya da Excel'den kopyalanan satırlar
 * (sekmeyle ayrılmış) ya da CSV metni. İlk satır başlık olmalı. */
export function metniAyristir(metin: string): Ayristirma {
  return kitabiAyristir(XLSX.read(metin.trim(), { type: 'string', raw: true }));
}

function kitabiAyristir(kitap: XLSX.WorkBook): Ayristirma {
  const sayfa = kitap.Sheets[kitap.SheetNames[0]];
  const hamSatirlar = XLSX.utils.sheet_to_json<string[]>(sayfa, {
    header: 1,
    raw: false,
    defval: '',
  });

  if (hamSatirlar.length === 0) {
    return { satirlar: [], mpnBulunamadi: true, toplamSatir: 0 };
  }

  const basliklar = hamSatirlar[0].map((h) => String(h ?? ''));
  const eslesme = basliklariEslestir(basliklar);

  if (eslesme.mpn === undefined) {
    return { satirlar: [], mpnBulunamadi: true, toplamSatir: 0 };
  }

  // LCSC sipariş dosyası: tedarikçi sütunu yoksa tedarikçi "LCSC" sayılır.
  const lcscDosyasi =
    eslesme.tedarikci_kodu !== undefined && /lcsc/i.test(basliklar[eslesme.tedarikci_kodu] ?? '');
  const paraBirimi = eslesme.alis_fiyati === undefined ? null : paraBirimiBul(basliklar[eslesme.alis_fiyati] ?? '');

  const satirlar: IceAktarSatir[] = [];
  for (let i = 1; i < hamSatirlar.length; i++) {
    const satir = hamSatirlar[i];
    if (!satir || satir.every((h) => String(h ?? '').trim() === '')) continue;

    const al = (idx: number | undefined): string => (idx === undefined ? '' : String(satir[idx] ?? '').trim());
    const mpn = al(eslesme.mpn);
    if (!mpn) continue;

    satirlar.push({
      mpn,
      uretici: al(eslesme.uretici) || null,
      aciklama: al(eslesme.aciklama) || null,
      kategori: al(eslesme.kategori) || null,
      kilif: al(eslesme.kilif) || null,
      adet: sayiyaCevir(al(eslesme.adet)),
      min_adet: sayiyaCevir(al(eslesme.min_adet)),
      tedarikci: al(eslesme.tedarikci) || (lcscDosyasi ? 'LCSC' : null),
      tedarikci_kodu: al(eslesme.tedarikci_kodu) || null,
      konum_metni: al(eslesme.konum_metni) || null,
      alis_fiyati: fiyataCevir(al(eslesme.alis_fiyati)),
      para_birimi: paraBirimi,
    });
  }

  return { satirlar, mpnBulunamadi: false, toplamSatir: hamSatirlar.length - 1 };
}
