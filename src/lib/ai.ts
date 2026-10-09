// Kullanıcının Ayarlar'dan eklediği tüm yapay zeka anahtarlarını (Gemini
// ve/veya Claude, birden fazla hesaptan) tek bir öncelik sırasıyla dener:
// bir anahtar/sağlayıcı çalışmazsa (kota dolu, anahtar geçersiz, geçici
// yoğunluk vb.) otomatik olarak sıradakine geçilir. "Linkten çek", LCSC
// açıklama çevirisi ve sohbet asistanı hepsi bu tek giriş noktasını kullanır
// — hangi sağlayıcının çağrılacağını tek tek bilmeleri gerekmez.
//
// `dil` verilmezse arayüz dili istekten (çerez/Accept-Language) okunur;
// kullanıcıya dönen hatalar ve modelin ürettiği okunabilir metinler o dilde olur.

import type { ModulVerisi } from './direnc';
import { geminiIleUrunCek, geminiIleAciklamaCevir, geminiSohbetCevapla, type SohbetMesaji } from './gemini';
import { claudeIleUrunCek, claudeIleAciklamaCevir, claudeSohbetCevapla } from './claude';
import type { AiAnahtar } from './ai-anahtarlari';
import { sozluk, type Dil } from './i18n';
import { dilAl } from './i18n/sunucu';

export type { SohbetMesaji };

/** Anahtar listesindeki her girdiyi sırayla dener; biri hata verirse (son
 * hatayı saklayıp) bir sonrakine geçer. Liste boşsa ya da hepsi başarısız
 * olursa son hatayı (ya da "anahtar yok" mesajını) fırlatır. */
async function siraylaDene<T>(anahtarlar: AiAnahtar[], dil: Dil, cagir: (a: AiAnahtar) => Promise<T>): Promise<T> {
  const s = sozluk(dil).parca.ai;
  if (anahtarlar.length === 0) {
    throw new Error(s.anahtarYok);
  }

  let sonHata: unknown;
  for (const anahtar of anahtarlar) {
    try {
      return await cagir(anahtar);
    } catch (err) {
      sonHata = err;
      console.error(`lib/ai.ts: ${anahtar.saglayici} anahtarı (${anahtar.ad ?? anahtar.id}) başarısız:`, err);
    }
  }

  throw sonHata instanceof Error ? sonHata : new Error(s.istekBasarisiz);
}

export async function aiIleUrunCek(
  anahtarlar: AiAnahtar[],
  sayfaUrl: string,
  html: string,
  dil?: Dil,
): Promise<ModulVerisi> {
  const d = dil ?? (await dilAl());
  return siraylaDene(anahtarlar, d, (a) =>
    a.saglayici === 'gemini'
      ? geminiIleUrunCek(a.anahtar, sayfaUrl, html, d)
      : claudeIleUrunCek(a.anahtar, sayfaUrl, html, d),
  );
}

/** Tedarikçi (LCSC) açıklamasını Türkçeye çevirir. LCSC metni zaten İngilizce
 * olduğu için arayüz dili Türkçe değilse çeviri yapılmaz, ham açıklama aynen döner. */
export async function aiIleAciklamaCevir(
  anahtarlar: AiAnahtar[],
  hamAciklama: string,
  baglam?: string,
  dil?: Dil,
): Promise<string> {
  const d = dil ?? (await dilAl());
  if (d !== 'tr') return hamAciklama;
  return siraylaDene(anahtarlar, d, (a) =>
    a.saglayici === 'gemini'
      ? geminiIleAciklamaCevir(a.anahtar, hamAciklama, baglam, d)
      : claudeIleAciklamaCevir(a.anahtar, hamAciklama, baglam, d),
  );
}

export async function aiSohbetCevapla(
  anahtarlar: AiAnahtar[],
  sistemYonergesi: string,
  mesajlar: SohbetMesaji[],
  dil?: Dil,
): Promise<string> {
  const d = dil ?? (await dilAl());
  return siraylaDene(anahtarlar, d, (a) =>
    a.saglayici === 'gemini'
      ? geminiSohbetCevapla(a.anahtar, sistemYonergesi, mesajlar, d)
      : claudeSohbetCevapla(a.anahtar, sistemYonergesi, mesajlar, d),
  );
}
