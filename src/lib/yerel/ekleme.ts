// Çevrimdışıyken kaydedilen verilerin bulut hesabına eklenmesi — hem Ayarlar'daki
// "Hesabıma ekle" düğmesi hem de "Buluta dön ve verilerimi ekle" seçildikten
// sonraki girişte otomatik olarak buradan yapılır.

import type { SupabaseClient } from '@supabase/supabase-js';
import { ayarOku, ayarYaz } from './mod';
import { bulutaBirlestir, bulutYedegiAl, sonYerelHareketId, yerelVeriKumesi, type BirlesimOzeti } from './aktarim';

export async function yerelVeriyiHesabaEkle(bulut: SupabaseClient, kullaniciId: string): Promise<BirlesimOzeti> {
  const ayar = ayarOku();
  await bulutYedegiAl(bulut, kullaniciId);
  const ozet = await bulutaBirlestir(bulut, kullaniciId, yerelVeriKumesi(), {
    eskiSahip: ayar.kullaniciId ?? kullaniciId,
    hareketEsigi: ayar.hareketEsigi ?? 0,
    alanlariGuncelle: true,
  });
  // Aynı hareketler ikinci kez işlenmesin.
  ayarYaz({
    ...ayarOku(),
    yuklemeBekliyor: false,
    otomatikEkle: false,
    kullaniciId,
    hareketEsigi: sonYerelHareketId(),
  });
  return ozet;
}

/** Girişten hemen sonra: kullanıcı "Buluta dön ve verilerimi ekle" demişse ekler.
 * Hata olursa girişi engellemez; Ayarlar'da elle ekleme seçeneği kalır. */
export async function girisSonrasiEkle(bulut: SupabaseClient, kullaniciId: string) {
  const ayar = ayarOku();
  if (!ayar.otomatikEkle || !ayar.yuklemeBekliyor) return;
  try {
    await yerelVeriyiHesabaEkle(bulut, kullaniciId);
  } catch (e) {
    console.error('[depolama] giriş sonrası ekleme:', e);
    ayarYaz({ ...ayarOku(), otomatikEkle: false });
  }
}
