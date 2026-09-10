import QRCode from 'qrcode';

/** Barkod/QR okuyucu (ya da telefon kamerası) tarafından okunacak kısa kod biçimi. */
export function stokKodu(stokId: string): string {
  return `LSTK:P:${stokId}`;
}
export function konumKodu(konumId: string): string {
  return `LSTK:K:${konumId}`;
}

/** Arama kutusuna bir USB barkod/QR okuyucuyla "yazılan" kodu tanımak için. */
export const LSTK_DESENI = /^LSTK:(P|K):([0-9a-fA-F-]{8,})$/;

/** Tamamen çevrimdışı, sunucu tarafında üretilen QR — hiçbir üçüncü taraf servise istek atmaz. */
export async function qrGorseli(metin: string): Promise<string> {
  return QRCode.toDataURL(metin, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: { dark: '#1f1b16', light: '#ffffff' },
  });
}
