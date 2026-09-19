// Robotistan.com ürün sayfasındaki JSON-LD verisinden modül bilgisi çıkarır.
// bkz. lib/direnc.ts — aynı yöntem, farklı site.

import { ldJsonUrunGetir } from './urun-ld-json';
import type { ModulVerisi } from './direnc';

export type { ModulVerisi };

const IZINLI_HOSTLAR = new Set(['robotistan.com', 'www.robotistan.com']);

function robotistanUrlDogrula(url: string): string {
  let ayrik: URL;
  try {
    ayrik = new URL(url);
  } catch {
    throw new Error('Geçersiz bağlantı.');
  }
  if (!IZINLI_HOSTLAR.has(ayrik.hostname)) {
    throw new Error('Sadece robotistan.com ürün bağlantıları kabul edilir.');
  }
  return ayrik.toString();
}

export async function robotistanUrldenCek(url: string): Promise<ModulVerisi> {
  const guvenliUrl = robotistanUrlDogrula(url);
  const urun = await ldJsonUrunGetir(guvenliUrl);
  if (!urun) throw new Error('Bu sayfada ürün bilgisi bulunamadı.');

  const resimler = Array.isArray(urun.image) ? urun.image : urun.image ? [urun.image] : [];
  const fiyatSayi = urun.offers?.price != null ? Number(urun.offers.price) : null;

  return {
    uretici: urun.brand?.name ?? null,
    aciklama: urun.description ?? null,
    kategori: 'Modül',
    resimUrl: resimler[0] ?? null,
    fiyat: fiyatSayi != null && Number.isFinite(fiyatSayi) ? fiyatSayi : null,
    paraBirimi: urun.offers?.priceCurrency ?? 'TRY',
    tedarikciKodu: urun.sku ?? null,
  };
}
