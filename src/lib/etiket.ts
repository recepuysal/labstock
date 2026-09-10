/** Barkod/QR okuyucu (ya da telefon kamerası) tarafından okunacak kısa kod biçimi. */
export function stokKodu(stokId: string): string {
  return `LSTK:P:${stokId}`;
}
export function konumKodu(konumId: string): string {
  return `LSTK:K:${konumId}`;
}

/** Arama kutusuna bir USB barkod/QR okuyucuyla "yazılan" kodu tanımak için. */
export const LSTK_DESENI = /^LSTK:(P|K):([0-9a-fA-F-]{8,})$/;

// --------------------------------------------------------- etiket ayarları

export type EtiketSekli = 'kare' | 'yuvarlak';
export type EtiketBoyutu = 'kucuk' | 'orta' | 'buyuk';
export type YaziBoyutu = 'kucuk' | 'orta' | 'buyuk' | 'cok-buyuk';

export type EtiketAyarlari = {
  sekil: EtiketSekli;
  boyut: EtiketBoyutu;
  yaziBoyutu: YaziBoyutu;
  marka: boolean;
};

export const VARSAYILAN_ETIKET_AYARLARI: EtiketAyarlari = {
  sekil: 'kare',
  boyut: 'orta',
  yaziBoyutu: 'orta',
  marka: true,
};

export const ETIKET_AYAR_COOKIE = 'labstock_etiket_ayar';

/** Tek parça etiketi için boyuta göre QR/kart ölçüleri (yazı boyutu artık ayrı bir ayar). */
export const ETIKET_OLCU: Record<EtiketBoyutu, { qr: number; kartPadding: number; kartGenislik: number }> = {
  kucuk: { qr: 84, kartPadding: 14, kartGenislik: 260 },
  orta: { qr: 112, kartPadding: 20, kartGenislik: 340 },
  buyuk: { qr: 152, kartPadding: 26, kartGenislik: 440 },
};

/** Toplu konum etiketleri (ızgara) için boyuta göre QR ölçüsü. */
export const IZGARA_QR_OLCU: Record<EtiketBoyutu, number> = {
  kucuk: 56,
  orta: 72,
  buyuk: 96,
};

/** Yazı boyutu — QR/kart boyutundan bağımsız; boş kalan alanı doldurmak için büyütülebilir. */
export const YAZI_OLCU: Record<YaziBoyutu, { mpn: number; alt: number }> = {
  kucuk: { mpn: 13, alt: 9.5 },
  orta: { mpn: 17, alt: 11.5 },
  buyuk: { mpn: 23, alt: 14.5 },
  'cok-buyuk': { mpn: 30, alt: 18 },
};
