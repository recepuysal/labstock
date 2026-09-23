// Kullanıcının Ayarlar'dan eklediği tüm yapay zeka anahtarlarını (Gemini
// ve/veya Claude, birden fazla hesaptan) tek bir öncelik sırasıyla dener:
// bir anahtar/sağlayıcı çalışmazsa (kota dolu, anahtar geçersiz, geçici
// yoğunluk vb.) otomatik olarak sıradakine geçilir. "Linkten çek", LCSC
// açıklama çevirisi ve sohbet asistanı hepsi bu tek giriş noktasını kullanır
// — hangi sağlayıcının çağrılacağını tek tek bilmeleri gerekmez.

import type { ModulVerisi } from './direnc';
import { geminiIleUrunCek, geminiIleAciklamaCevir, geminiSohbetCevapla, type SohbetMesaji } from './gemini';
import { claudeIleUrunCek, claudeIleAciklamaCevir, claudeSohbetCevapla } from './claude';
import type { AiAnahtar } from './ai-anahtarlari';

export type { SohbetMesaji };

/** Anahtar listesindeki her girdiyi sırayla dener; biri hata verirse (son
 * hatayı saklayıp) bir sonrakine geçer. Liste boşsa ya da hepsi başarısız
 * olursa son hatayı (ya da "anahtar yok" mesajını) fırlatır. */
async function siraylaDene<T>(anahtarlar: AiAnahtar[], cagir: (a: AiAnahtar) => Promise<T>): Promise<T> {
  if (anahtarlar.length === 0) {
    throw new Error(
      'Ayarlar sayfasından ücretsiz bir Gemini ya da Claude API anahtarı eklersen bu özellik çalışır.',
    );
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

  throw sonHata instanceof Error ? sonHata : new Error('Yapay zeka isteği başarısız.');
}

export async function aiIleUrunCek(anahtarlar: AiAnahtar[], sayfaUrl: string, html: string): Promise<ModulVerisi> {
  return siraylaDene(anahtarlar, (a) =>
    a.saglayici === 'gemini' ? geminiIleUrunCek(a.anahtar, sayfaUrl, html) : claudeIleUrunCek(a.anahtar, sayfaUrl, html),
  );
}

export async function aiIleAciklamaCevir(anahtarlar: AiAnahtar[], hamAciklama: string, baglam?: string): Promise<string> {
  return siraylaDene(anahtarlar, (a) =>
    a.saglayici === 'gemini'
      ? geminiIleAciklamaCevir(a.anahtar, hamAciklama, baglam)
      : claudeIleAciklamaCevir(a.anahtar, hamAciklama, baglam),
  );
}

export async function aiSohbetCevapla(
  anahtarlar: AiAnahtar[],
  sistemYonergesi: string,
  mesajlar: SohbetMesaji[],
): Promise<string> {
  return siraylaDene(anahtarlar, (a) =>
    a.saglayici === 'gemini'
      ? geminiSohbetCevapla(a.anahtar, sistemYonergesi, mesajlar)
      : claudeSohbetCevapla(a.anahtar, sistemYonergesi, mesajlar),
  );
}
