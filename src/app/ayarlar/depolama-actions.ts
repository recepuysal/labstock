'use server';

// Ayarlar → Veri depolama: bulut (Supabase) ve çevrimdışı (bu bilgisayardaki
// SQLite) modları arasında geçiş. Bkz. src/lib/yerel.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createBulutClient } from '@/lib/supabase/server';
import { ayarOku, ayarYaz, yerelModDestekleniyor } from '@/lib/yerel/mod';
import {
  bulutaBirlestir,
  bulutYedegiAl,
  buluttanYerele,
  sonYerelHareketId,
  yedekOku,
  yerelVeriKumesi,
  yerelVeriVarMi,
} from '@/lib/yerel/aktarim';
import { yerelKullaniciId } from '@/lib/yerel/istemci';
import { sozlukAl } from '@/lib/i18n/sunucu';
import type { EylemDurum } from '@/app/envanter/actions';

async function metin() {
  return (await sozlukAl()).ayarlar.depolama;
}

async function bulutKullanicisi() {
  const bulut = await createBulutClient();
  const {
    data: { user },
  } = await bulut.auth.getUser();
  return { bulut, user };
}

/** Buluttan çevrimdışına: hesabın verisini bu bilgisayara kopyalar. */
export async function cevrimdisiModaGec(): Promise<EylemDurum> {
  const m = await metin();
  if (!yerelModDestekleniyor()) return { hata: m.hata('—') };
  const { bulut, user } = await bulutKullanicisi();
  if (!user) return { hata: m.oturumGerekli };

  try {
    await buluttanYerele(bulut, user.id);
  } catch (e) {
    console.error('[depolama] buluttan yerele:', e);
    return { hata: m.hata((e as Error).message) };
  }
  ayarYaz({ mod: 'yerel', kullaniciId: user.id, hareketEsigi: sonYerelHareketId() });
  revalidatePath('/', 'layout');
  redirect('/envanter');
}

/** Hesap açmadan çevrimdışı başla (giriş ekranındaki bağlantı). */
export async function hesapsizBasla(): Promise<void> {
  if (!yerelModDestekleniyor()) redirect('/giris');
  ayarYaz({ ...ayarOku(), mod: 'yerel', yuklemeBekliyor: false });
  yerelKullaniciId();
  revalidatePath('/', 'layout');
  redirect('/envanter');
}

/** Çevrimdışından buluta: giriş yaptıktan sonra yerel verileri hesaba ekleyip
 * eklemeyeceği sorulur (yerel veri varsa). */
export async function bulutaDon(): Promise<void> {
  const ayar = ayarOku();
  ayarYaz({ ...ayar, mod: 'bulut', yuklemeBekliyor: yerelVeriVarMi() });
  revalidatePath('/', 'layout');
  redirect('/giris');
}

/** "Yerel verileri hesabıma ekle": buluttakilerin üstüne eklenir, hiçbir şey silinmez. */
export async function yerelVerileriYukle(): Promise<EylemDurum> {
  const m = await metin();
  const { bulut, user } = await bulutKullanicisi();
  if (!user) return { hata: m.oturumGerekli };

  const ayar = ayarOku();
  try {
    await bulutYedegiAl(bulut, user.id);
    const ozet = await bulutaBirlestir(bulut, user.id, yerelVeriKumesi(), {
      eskiSahip: ayar.kullaniciId ?? user.id,
      hareketEsigi: ayar.hareketEsigi ?? 0,
      alanlariGuncelle: true,
    });
    // Aynı hareketler ikinci kez işlenmesin.
    ayarYaz({ ...ayarOku(), yuklemeBekliyor: false, kullaniciId: user.id, hareketEsigi: sonYerelHareketId() });
    revalidatePath('/', 'layout');
    return { bilgi: m.eklendi(ozet.yeniKalem, ozet.islenenHareket, ozet.uyarilar.length) };
  } catch (e) {
    console.error('[depolama] buluta birleştir:', e);
    return { hata: m.hata((e as Error).message) };
  }
}

export async function yuklemeyiAtla(): Promise<EylemDurum> {
  ayarYaz({ ...ayarOku(), yuklemeBekliyor: false });
  revalidatePath('/', 'layout');
  return { bilgi: (await metin()).atlandi };
}

/** Bir bulut yedeğindeki kayıtları hesaba geri ekler (buluttakiler silinmez;
 * bulutta zaten olan stok kalemlerinin adedine dokunulmaz). */
export async function yedektenGeriEkle(ad: string): Promise<EylemDurum> {
  const m = await metin();
  const { bulut, user } = await bulutKullanicisi();
  if (!user) return { hata: m.oturumGerekli };
  try {
    const kume = yedekOku(ad);
    const sahip = (kume.profiles[0]?.id as string | undefined) ?? user.id;
    await bulutYedegiAl(bulut, user.id);
    const ozet = await bulutaBirlestir(bulut, user.id, kume, {
      eskiSahip: sahip,
      hareketEsigi: Number.MAX_SAFE_INTEGER,
      alanlariGuncelle: false,
    });
    revalidatePath('/', 'layout');
    return { bilgi: m.yedekEklendi(ozet.yeniKalem) };
  } catch (e) {
    console.error('[depolama] yedekten geri ekle:', e);
    return { hata: m.hata((e as Error).message) };
  }
}
