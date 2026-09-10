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

export type EtiketAyarlari = {
  sekil: EtiketSekli;
  boyut: EtiketBoyutu;
  marka: boolean;
};

export const VARSAYILAN_ETIKET_AYARLARI: EtiketAyarlari = {
  sekil: 'kare',
  boyut: 'orta',
  marka: true,
};

export const ETIKET_AYAR_COOKIE = 'labstock_etiket_ayar';

/** Tek parça etiketi için boyuta göre QR/yazı tipi ölçüleri. */
export const ETIKET_OLCU: Record<EtiketBoyutu, { qr: number; kartPadding: number; mpnBoyut: number; altBoyut: number }> = {
  kucuk: { qr: 84, kartPadding: 14, mpnBoyut: 13, altBoyut: 10 },
  orta: { qr: 112, kartPadding: 20, mpnBoyut: 16, altBoyut: 11 },
  buyuk: { qr: 152, kartPadding: 26, mpnBoyut: 20, altBoyut: 13 },
};

/** Toplu konum etiketleri (ızgara) için boyuta göre QR ölçüsü. */
export const IZGARA_QR_OLCU: Record<EtiketBoyutu, number> = {
  kucuk: 56,
  orta: 72,
  buyuk: 96,
};
