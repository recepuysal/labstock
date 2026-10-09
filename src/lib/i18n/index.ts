// Dil desteği (Türkçe / İngilizce) — sunucu ve istemcide ortak kısım.
//
// Dil URL'de değil, `labstock-dil` çerezinde tutulur (masaüstü uygulamasında
// adres çubuğu yok). Çerez yoksa tarayıcının/Electron'un Accept-Language
// başlığına bakılır: Türkçe ise 'tr', değilse 'en'.
//
// Metinler alan alan `sozluk/*.ts` dosyalarında durur. Her dosya bir `tr`
// nesnesi ve aynı şekle sahip bir `en` nesnesi dışa aktarır; `Sekil<typeof tr>`
// sayesinde İngilizcede eksik ya da fazla anahtar derleme hatası verir.

import ortak from './sozluk/ortak';
import envanter from './sozluk/envanter';
import parca from './sozluk/parca';
import ayarlar from './sozluk/ayarlar';
import kamera from './sozluk/kamera';

export type Dil = 'tr' | 'en';
export const DILLER: Dil[] = ['tr', 'en'];
export const DIL_COOKIE = 'labstock-dil';

/** Bir sözlük nesnesinin "şekli": metinler string, fonksiyonlar aynı imza, iç içe nesneler aynı yapı. */
export type Sekil<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends (...a: infer A) => string
      ? (...a: A) => string
      : T[K] extends readonly string[]
        ? string[]
        : Sekil<T[K]>;
};

const SOZLUKLER = {
  tr: { ortak: ortak.tr, envanter: envanter.tr, parca: parca.tr, ayarlar: ayarlar.tr, kamera: kamera.tr },
  en: { ortak: ortak.en, envanter: envanter.en, parca: parca.en, ayarlar: ayarlar.en, kamera: kamera.en },
};

export type Sozluk = (typeof SOZLUKLER)['tr'];

export function sozluk(dil: Dil): Sozluk {
  return SOZLUKLER[dil] as Sozluk;
}

export function gecerliDil(deger: string | null | undefined): Dil | null {
  return deger === 'tr' || deger === 'en' ? deger : null;
}

/** Accept-Language başlığından dil: ilk tercih Türkçe ise 'tr', değilse 'en'. */
export function basliktanDil(acceptLanguage: string | null | undefined): Dil {
  const ilk = (acceptLanguage ?? '').split(',')[0]?.trim().toLowerCase() ?? '';
  return ilk.startsWith('tr') ? 'tr' : 'en';
}

/** Sayı/tarih biçimlendirme için yerel ayar (toLocaleString vb.). */
export function yerel(dil: Dil): string {
  return dil === 'tr' ? 'tr-TR' : 'en-US';
}

/** "{ad} eklendi" gibi metinlerdeki {anahtar} yerlerini doldurur. */
export function doldur(metin: string, degerler: Record<string, string | number>): string {
  return metin.replace(/\{(\w+)\}/g, (_, k: string) => (k in degerler ? String(degerler[k]) : `{${k}}`));
}
