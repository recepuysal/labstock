/** Masaüstü uygulamasının (electron-app/kamera.js, preload.js) telefon kamerası API'si. */
export type KameraDurumu = {
  acik: boolean;
  ip: string | null;
  port: number;
  /** Telefonun QR'dan açacağı adres (eşleşme anahtarı # sonrasında); kapalıyken null. */
  adres: string | null;
  telefon: boolean;
};

export type KameraOlayi =
  | { tur: 'durum'; veri: KameraDurumu }
  | { tur: 'ikili'; veri: Uint8Array } // telefondan kare: 1 JPEG, 2 foto, 3 H.264
  | { tur: 'metin'; veri: Record<string, unknown> }; // telefondan JSON (olay, istatistik, günlük)

export type KameraAPI = {
  baslat: () => Promise<KameraDurumu & { ok: boolean; hata?: string }>;
  durdur: () => Promise<KameraDurumu & { ok: boolean }>;
  durum: () => Promise<KameraDurumu>;
  anahtariYenile: () => Promise<KameraDurumu>;
  gonder: (veri: Uint8Array | Record<string, unknown>) => void;
  dinle: (callback: (olay: KameraOlayi) => void) => () => void;
};

/** Telefondan gelen ikili mesajın ilk baytı. */
export const TIP_KARE = 1;
export const TIP_FOTO = 2;
export const TIP_H264 = 3;
/** Telefona giden işaretli önizleme resmi (JPEG) ilk baytı. */
export const TIP_RESIM = 0x10;
