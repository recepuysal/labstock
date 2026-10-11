'use server';

// Ayarlar → Veri depolama: bulut (Supabase) ve çevrimdışı (bu bilgisayardaki
// SQLite) modları arasında geçiş. Bkz. src/lib/yerel.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createBulutClient } from '@/lib/supabase/server';
import { ayarOku, ayarYaz, yerelModDestekleniyor } from '@/lib/yerel/mod';
import { buluttanYerele, yerelVeriVarMi, yereldenBuluta } from '@/lib/yerel/aktarim';
import { yerelKullaniciId } from '@/lib/yerel/istemci';
import { sozlukAl } from '@/lib/i18n/sunucu';
import type { EylemDurum } from '@/app/envanter/actions';

async function metin() {
  return (await sozlukAl()).ayarlar.depolama;
}

/** Buluttan çevrimdışına: hesabın verisini bu bilgisayara kopyalar. */
export async function cevrimdisiModaGec(): Promise<EylemDurum> {
  const m = await metin();
  if (!yerelModDestekleniyor()) return { hata: m.hata('—') };
  const bulut = await createBulutClient();
  const {
    data: { user },
  } = await bulut.auth.getUser();
  if (!user) return { hata: m.oturumGerekli };

  try {
    await buluttanYerele(bulut, user.id);
  } catch (e) {
    console.error('[depolama] buluttan yerele:', e);
    return { hata: m.hata((e as Error).message) };
  }
  ayarYaz({ mod: 'yerel', kullaniciId: user.id });
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

/** Çevrimdışından buluta: giriş yaptıktan sonra yerel verileri yükleyip
 * yüklemeyeceği sorulur (yerel veri varsa). */
export async function bulutaDon(): Promise<void> {
  const ayar = ayarOku();
  ayarYaz({ ...ayar, mod: 'bulut', yuklemeBekliyor: yerelVeriVarMi() });
  revalidatePath('/', 'layout');
  redirect('/giris');
}

/** "Yerel verileri hesabıma yükle" — buluttaki veriler yerel verilerle değiştirilir. */
export async function yerelVerileriYukle(): Promise<EylemDurum> {
  const m = await metin();
  const bulut = await createBulutClient();
  const {
    data: { user },
  } = await bulut.auth.getUser();
  if (!user) return { hata: m.oturumGerekli };

  const ayar = ayarOku();
  try {
    const yedek = await yereldenBuluta(bulut, user.id, ayar.kullaniciId ?? user.id);
    ayarYaz({ ...ayarOku(), yuklemeBekliyor: false, kullaniciId: user.id });
    revalidatePath('/', 'layout');
    return { bilgi: m.yuklendi(yedek) };
  } catch (e) {
    console.error('[depolama] yerelden buluta:', e);
    return { hata: m.hata((e as Error).message) };
  }
}

export async function yuklemeyiAtla(): Promise<EylemDurum> {
  ayarYaz({ ...ayarOku(), yuklemeBekliyor: false });
  revalidatePath('/', 'layout');
  return { bilgi: (await metin()).atlandi };
}
