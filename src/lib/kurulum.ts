// Anonim kurulum sayacı: masaüstü uygulaması her açılışta rastgele bir kurulum
// kimliği, sürüm, işletim sistemi ve veri modunu (bulut / çevrimdışı) bildirir.
// Hesap, e-posta ya da envanter verisi gönderilmez; kimlik sadece bu kurulumu
// tekrar saymamak için. Ayarlar → Veri depolama'dan kapatılabilir.
// Supabase tarafı: supabase/migrations/0008_kurulumlar.sql

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ayarOku, veriDizini } from './yerel/mod';

const KIMLIK_DOSYASI = 'kurulum-id';

export function kurulumKimligi(): string {
  const yol = path.join(veriDizini(), KIMLIK_DOSYASI);
  try {
    const kayitli = fs.readFileSync(yol, 'utf8').trim();
    if (/^[0-9a-f-]{36}$/i.test(kayitli)) return kayitli;
  } catch {
    // ilk açılış
  }
  const yeni = randomUUID();
  fs.mkdirSync(veriDizini(), { recursive: true });
  fs.writeFileSync(yol, yeni);
  return yeni;
}

/** Açılışta bir kez çağrılır; hata olursa (internet yok vb.) sessizce geçer. */
export async function kurulumBildir(): Promise<void> {
  try {
    const ayar = ayarOku();
    if (ayar.anonimSayac === false) return;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anahtar = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anahtar) return;
    await fetch(`${url}/rest/v1/rpc/kurulum_bildir`, {
      method: 'POST',
      headers: { apikey: anahtar, Authorization: `Bearer ${anahtar}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_id: kurulumKimligi(),
        p_surum: process.env.LABSTOCK_SURUM ?? '?',
        p_platform: process.platform,
        p_mod: ayar.mod,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // sayaç uygulamanın çalışmasını asla etkilemesin
  }
}
