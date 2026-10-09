// Robotistan.com ürün sayfasındaki JSON-LD verisinden modül bilgisi çıkarır.
// bkz. lib/direnc.ts — aynı yöntem, farklı site.

import { ldJsonUrunGetir } from './urun-ld-json';
import { urunAciklamasiniAyristir } from './urun-parametre-cikar';
import type { ModulVerisi } from './direnc';
import { sozluk, type Dil } from './i18n';
import { dilAl } from './i18n/sunucu';

export type { ModulVerisi };

const IZINLI_HOSTLAR = new Set(['robotistan.com', 'www.robotistan.com']);

function robotistanUrlDogrula(url: string, dil: Dil): string {
  const s = sozluk(dil).parca.tedarikci;
  let ayrik: URL;
  try {
    ayrik = new URL(url);
  } catch {
    throw new Error(s.gecersizBaglanti);
  }
  if (!IZINLI_HOSTLAR.has(ayrik.hostname)) {
    throw new Error(s.sadeceSite('robotistan.com'));
  }
  return ayrik.toString();
}

export async function robotistanUrldenCek(url: string, dil?: Dil): Promise<ModulVerisi> {
  const d = dil ?? (await dilAl());
  const guvenliUrl = robotistanUrlDogrula(url, d);
  const urun = await ldJsonUrunGetir(guvenliUrl, d);
  if (!urun) throw new Error(sozluk(d).parca.tedarikci.urunBulunamadi);

  const resimler = Array.isArray(urun.image) ? urun.image : urun.image ? [urun.image] : [];
  const fiyatSayi = urun.offers?.price != null ? Number(urun.offers.price) : null;
  const { aciklama, parametreler } = urun.description
    ? urunAciklamasiniAyristir(urun.description, ['Features:', 'Specifications:', 'Technical Specifications:'])
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
