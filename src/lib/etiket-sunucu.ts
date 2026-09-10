import { cookies } from 'next/headers';
import QRCode from 'qrcode';
import { ETIKET_AYAR_COOKIE, VARSAYILAN_ETIKET_AYARLARI, type EtiketAyarlari } from './etiket';

/** Tamamen çevrimdışı, sunucu tarafında üretilen QR — hiçbir üçüncü taraf servise istek atmaz. */
export async function qrGorseli(metin: string): Promise<string> {
  return QRCode.toDataURL(metin, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 8,
    color: { dark: '#1f1b16', light: '#ffffff' },
  });
}

/** Cookie'de saklanan etiket görünüm tercihini okur — bozuksa/yoksa varsayılana döner. */
export async function etiketAyarlariniAl(): Promise<EtiketAyarlari> {
  const cookieDeposu = await cookies();
  const ham = cookieDeposu.get(ETIKET_AYAR_COOKIE)?.value;
  if (!ham) return VARSAYILAN_ETIKET_AYARLARI;
  try {
    const ayristirilmis = JSON.parse(ham);
    return {
      sekil: ayristirilmis.sekil === 'yuvarlak' ? 'yuvarlak' : 'kare',
      boyut: ['kucuk', 'orta', 'buyuk'].includes(ayristirilmis.boyut) ? ayristirilmis.boyut : 'orta',
      marka: typeof ayristirilmis.marka === 'boolean' ? ayristirilmis.marka : true,
    };
  } catch {
    return VARSAYILAN_ETIKET_AYARLARI;
  }
}
