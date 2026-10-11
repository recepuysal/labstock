// Veri depolama modu: 'bulut' (Supabase, varsayılan) ya da 'yerel' (çevrimdışı,
// bu bilgisayardaki SQLite dosyası). Tercih çerezde değil, veri klasöründeki
// ayar dosyasında tutulur: masaüstü uygulaması kapanırken oturum çerezlerini
// siliyor (bkz. electron-app/main.js) ve mod, oturumdan bağımsız kalmalı.
//
// Sadece sunucu tarafında (Next sunucusu, proxy) kullanılır. Next sunucusu
// masaüstünde kullanıcının kendi bilgisayarında çalışır; Electron veri klasörünü
// LABSTOCK_VERI_DIZINI ile bildirir.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type DepolamaModu = 'bulut' | 'yerel';

export type YerelAyar = {
  mod: DepolamaModu;
  /** Yerel verilerin sahibi sayılan kimlik. Buluttan kopyalanınca o hesabın
   * kimliği kullanılır ki geri yüklerken satırlar aynı kişiye ait kalsın. */
  kullaniciId?: string;
  /** Çevrimdışıyken veri değişti ve buluta dönüldü: kullanıcıya "yerel verileri
   * hesabıma yükle" sorulacak. */
  yuklemeBekliyor?: boolean;
  /** Yerel veriler en son ne zaman değişti (geri dönüşte gösterilir). */
  sonDegisiklik?: string;
  /** Buluttan kopyalandığı (ya da buluta eklendiği) andaki en büyük yerel hareket
   * kimliği; bundan sonraki hareketler buluta +/− olarak işlenir. */
  hareketEsigi?: number;
  /** "Buluta dön ve verilerimi ekle" seçildi ama oturum kapalıydı: girişten
   * hemen sonra eklenir. */
  otomatikEkle?: boolean;
};

const AYAR_DOSYASI = 'depolama.json';

export function veriDizini(): string {
  return process.env.LABSTOCK_VERI_DIZINI || path.join(os.homedir(), '.labstock-gelistirme');
}

/** Çevrimdışı mod yalnızca masaüstü uygulamasında (ve yerel geliştirmede)
 * anlamlı: veri dosyası Next sunucusunun çalıştığı bilgisayara yazılır. */
export function yerelModDestekleniyor(): boolean {
  return Boolean(process.env.LABSTOCK_VERI_DIZINI) || process.env.NODE_ENV !== 'production';
}

export function ayarOku(): YerelAyar {
  try {
    const ham = JSON.parse(fs.readFileSync(path.join(veriDizini(), AYAR_DOSYASI), 'utf8'));
    return { ...ham, mod: ham.mod === 'yerel' ? 'yerel' : 'bulut' };
  } catch {
    return { mod: 'bulut' };
  }
}

export function ayarYaz(ayar: YerelAyar) {
  fs.mkdirSync(veriDizini(), { recursive: true });
  const hedef = path.join(veriDizini(), AYAR_DOSYASI);
  // Yarım yazılmış dosya kalmasın: önce geçici dosyaya, sonra yerine taşı.
  fs.writeFileSync(hedef + '.tmp', JSON.stringify(ayar, null, 2));
  fs.renameSync(hedef + '.tmp', hedef);
}

export function yerelModda(): boolean {
  return yerelModDestekleniyor() && ayarOku().mod === 'yerel';
}
