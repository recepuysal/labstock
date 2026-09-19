// Direnc.net ürün sayfasındaki JSON-LD verisinden modül bilgisi çıkarır.
// LCSC'nin aksine burada bir "kod" değil, kullanıcının siteden kopyaladığı
// ürün bağlantısı girdi olarak alınır (bkz. lib/urun-ld-json.ts).

import { ldJsonUrunGetir } from './urun-ld-json';
import { urunAciklamasiniAyristir } from './urun-parametre-cikar';

export type ModulVerisi = {
  isim: string | null;
  uretici: string | null;
  aciklama: string | null;
  kategori: string | null;
  resimUrl: string | null;
  fiyat: number | null;
  paraBirimi: string;
  tedarikciKodu: string | null;
  parametreler: Record<string, string>;
};

const IZINLI_HOSTLAR = new Set(['direnc.net', 'www.direnc.net']);

function direncUrlDogrula(url: string): string {
  let ayrik: URL;
  try {
    ayrik = new URL(url);
  } catch {
    throw new Error('Geçersiz bağlantı.');
  }
  if (!IZINLI_HOSTLAR.has(ayrik.hostname)) {
    throw new Error('Sadece direnc.net ürün bağlantıları kabul edilir.');
  }
  return ayrik.toString();
}

export async function direncUrldenCek(url: string): Promise<ModulVerisi> {
  const guvenliUrl = direncUrlDogrula(url);
  const urun = await ldJsonUrunGetir(guvenliUrl);
  if (!urun) throw new Error('Bu sayfada ürün bilgisi bulunamadı.');

  const resimler = Array.isArray(urun.image) ? urun.image : urun.image ? [urun.image] : [];
  const fiyatSayi = urun.offers?.price != null ? Number(urun.offers.price) : null;
  const { aciklama, parametreler } = urun.description
    ? urunAciklamasiniAyristir(urun.description, 'Teknik Özellikleri', ['Faydalı Linkler'])
    : { aciklama: null, parametreler: {} };

  return {
    isim: urun.name ?? null,
    uretici: urun.brand?.name ?? null,
    aciklama,
    kategori: 'Modül',
    resimUrl: resimler[0] ?? null,
    fiyat: fiyatSayi != null && Number.isFinite(fiyatSayi) ? fiyatSayi : null,
    paraBirimi: urun.offers?.priceCurrency ?? 'TRY',
    tedarikciKodu: urun.sku ?? null,
    parametreler,
  };
}
