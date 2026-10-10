// Ücretsiz katmanı olan, OpenAI uyumlu "chat/completions" API'si sunan
// sağlayıcılar (Groq, OpenRouter). Gemini (lib/gemini.ts) ve Claude
// (lib/claude.ts) ile aynı üç işi yapar: linkten ürün çekme, LCSC açıklama
// çevirisi, sohbet asistanı. lib/ai.ts bu sağlayıcıları da sıradaki anahtar
// olarak dener.
//
// Model adları sağlayıcılarda sık değiştiği için sabit bir model yazılmaz:
// anahtar eklenirken sağlayıcının o anki model listesinden (GET /models)
// tercih sırasına göre biri seçilip ai_anahtarlari.model'e kaydedilir; kayıtlı
// model kaldırılmışsa çağrı sırasında yeniden seçilir.

import type { ModulVerisi } from './direnc';
import type { SohbetMesaji } from './gemini';
import { htmlMetneDonustur, ogGoruntusuBul } from './claude';
import { sozluk, type Dil } from './i18n';
import { dilAl } from './i18n/sunucu';

export type UyumluSaglayici = 'groq' | 'openrouter';

type SaglayiciTanimi = {
  ad: string;
  tabanUrl: string;
  /** Anahtarın alınacağı sayfa (Ayarlar'da bağlantı olarak gösterilir). */
  anahtarSayfasi: string;
  /** Model listesinde aranacak tercih sırası; hiçbiri yoksa uygunMu ile seçilir. */
  tercihliModeller: string[];
  uygunMu: (modelId: string) => boolean;
  /** Yanıt başlıklarından öğrenilemezse kullanılan yaklaşık günlük ücretsiz istek sayısı. */
  varsayilanGunlukLimit: number;
  /** response_format: json_object destekleniyor mu (OpenRouter'da modele göre değişiyor). */
  jsonModu: boolean;
};

/** Sohbet/metin çıkarma için uygun olmayan modeller (ses, güvenlik filtresi, gömme, kod ajanı...). */
const SOHBET_DISI = /whisper|tts|guard|safety|embed|moderation|compound|code|coder|laguna|vision-only/i;

export const UYUMLU_SAGLAYICILAR: Record<UyumluSaglayici, SaglayiciTanimi> = {
  groq: {
    ad: 'Groq',
    tabanUrl: 'https://api.groq.com/openai/v1',
    anahtarSayfasi: 'https://console.groq.com/keys',
    tercihliModeller: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'qwen/qwen3-32b', 'llama-3.1-8b-instant'],
    uygunMu: (m) => !SOHBET_DISI.test(m),
    varsayilanGunlukLimit: 1000,
    jsonModu: true,
  },
  openrouter: {
    ad: 'OpenRouter',
    tabanUrl: 'https://openrouter.ai/api/v1',
    anahtarSayfasi: 'https://openrouter.ai/settings/keys',
    // openrouter/free: OpenRouter'ın kendi yönlendiricisi, isteği o an çalışan ücretsiz
    // modellerden birine gönderir — tek tek modeller sık kaldırıldığı için ilk tercih.
    tercihliModeller: [
      'openrouter/free',
      'google/gemma-4-31b-it:free',
      'nvidia/nemotron-3-super-120b-a12b:free',
      'google/gemma-4-26b-a4b-it:free',
    ],
    // Sadece ücretsiz (":free") sohbet modelleri — kullanıcının kredisini harcamamak için.
    uygunMu: (m) => m.endsWith(':free') && !SOHBET_DISI.test(m),
    varsayilanGunlukLimit: 50,
    jsonModu: false,
  },
};

export function uyumluSaglayiciMi(saglayici: string): saglayici is UyumluSaglayici {
  return saglayici in UYUMLU_SAGLAYICILAR;
}

/** Günlük kotanın dolduğunu bildiren hata — lib/ai.ts bu anahtarı gün boyu atlar. */
export class AiKotaHatasi extends Error {}

/** Bir çağrının ölçümü: lib/ai.ts kullanım sayacına ve anahtar kaydına yazar. */
export type AiOlcum = { token?: number; gunlukLimit?: number; yeniModel?: string };

const AZAMI_TOKEN = 2048; // gpt-oss gibi akıl yürüten modeller düşünme için de token harcıyor
const ZAMAN_ASIMI_MS = 60_000;

type Mesaj = { role: 'system' | 'user' | 'assistant'; content: string };

async function modelListesi(saglayici: UyumluSaglayici, apiKey: string, dil: Dil): Promise<string[]> {
  const t = UYUMLU_SAGLAYICILAR[saglayici];
  const yanit = await fetch(`${t.tabanUrl}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
  });
  if (!yanit.ok) throw await hataOlustur(saglayici, yanit, dil);
  const govde = (await yanit.json()) as { data?: { id?: unknown }[] };
  return (govde.data ?? []).map((m) => (typeof m.id === 'string' ? m.id : '')).filter(Boolean);
}

/** Sağlayıcının model listesinden tercih sırasına göre bir sohbet modeli seçer. */
export async function modelSec(saglayici: UyumluSaglayici, apiKey: string, dil: Dil = 'tr'): Promise<string | null> {
  const t = UYUMLU_SAGLAYICILAR[saglayici];
  const modeller = await modelListesi(saglayici, apiKey, dil);
  return t.tercihliModeller.find((m) => modeller.includes(m)) ?? modeller.find(t.uygunMu) ?? null;
}

async function hataOlustur(saglayici: UyumluSaglayici, yanit: Response, dil: Dil): Promise<Error> {
  const s = sozluk(dil).parca.ai;
  const ad = UYUMLU_SAGLAYICILAR[saglayici].ad;
  let mesaj = '';
  try {
    const govde = (await yanit.json()) as { error?: { message?: unknown } | string; message?: unknown };
    const e = govde.error;
    mesaj = typeof e === 'string' ? e : typeof e?.message === 'string' ? e.message : typeof govde.message === 'string' ? govde.message : '';
  } catch {
    // gövde JSON değil
  }
  if (yanit.status === 401 || yanit.status === 403) return new Error(s.uyumluGecersizAnahtar(ad));
  if (yanit.status === 429) {
    // Dakikalık sınır geçicidir; günlük kota dolduysa anahtar gün boyu atlanır.
    const kalanGunluk = yanit.headers.get('x-ratelimit-remaining-requests-day') ?? yanit.headers.get('x-ratelimit-remaining-requests');
    const gunluk = kalanGunluk === '0' || /per day|daily|RPD|TPD|quota|free-models-per-day/i.test(mesaj);
    return gunluk ? new AiKotaHatasi(s.uyumluKotaDoldu(ad)) : new Error(s.uyumluYogun(ad));
  }
  return new Error(`${ad}: ${mesaj || s.istekBasarisizHttp(yanit.status)}`);
}

function limitBasligi(yanit: Response): number | undefined {
  const deger = yanit.headers.get('x-ratelimit-limit-requests-day') ?? yanit.headers.get('x-ratelimit-limit-requests');
  const sayi = deger ? Number.parseInt(deger, 10) : NaN;
  // Dakikalık limit (ör. 30) günlük sanılmasın diye küçük değerleri yok say.
  return Number.isFinite(sayi) && sayi >= 100 ? sayi : undefined;
}

async function tamamla(
  saglayici: UyumluSaglayici,
  apiKey: string,
  model: string | null | undefined,
  mesajlar: Mesaj[],
  dil: Dil,
  olcum: AiOlcum | undefined,
  json: boolean,
): Promise<string> {
  const t = UYUMLU_SAGLAYICILAR[saglayici];
  const s = sozluk(dil).parca.ai;
  let kullanilan = model || (await modelSec(saglayici, apiKey, dil));
  if (!kullanilan) throw new Error(s.uyumluModelYok(t.ad));
  if (!model && olcum) olcum.yeniModel = kullanilan;

  for (let deneme = 0; deneme < 2; deneme++) {
    const yanit = await fetch(`${t.tabanUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        ...(saglayici === 'openrouter'
          ? { 'HTTP-Referer': 'https://github.com/recepuysal/labstock', 'X-Title': 'LabStock' }
          : {}),
      },
      body: JSON.stringify({
        model: kullanilan,
        messages: mesajlar,
        max_tokens: AZAMI_TOKEN,
        temperature: 0.2,
        ...(json && t.jsonModu ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
    });

    if (yanit.ok) {
      const govde = (await yanit.json()) as {
        choices?: { message?: { content?: unknown } }[];
        usage?: { total_tokens?: unknown };
      };
      if (olcum) {
        if (typeof govde.usage?.total_tokens === 'number') olcum.token = govde.usage.total_tokens;
        const limit = limitBasligi(yanit);
        if (limit) olcum.gunlukLimit = limit;
      }
      const icerik = govde.choices?.[0]?.message?.content;
      if (typeof icerik === 'string' && icerik.trim()) return icerik.trim();
      throw new Error(s.beklenmeyenYanit(JSON.stringify(govde).slice(0, 400)));
    }

    // Kayıtlı model sağlayıcıdan kaldırılmışsa yenisini seçip bir kez daha dene.
    if ((yanit.status === 404 || yanit.status === 400) && deneme === 0) {
      const metin = await yanit.clone().text();
      if (/model/i.test(metin) && /not.?found|does not exist|decommission|not available|invalid model/i.test(metin)) {
        const yeni = await modelSec(saglayici, apiKey, dil);
        if (yeni && yeni !== kullanilan) {
          kullanilan = yeni;
          if (olcum) olcum.yeniModel = yeni;
          continue;
        }
      }
    }
    throw await hataOlustur(saglayici, yanit, dil);
  }
  throw new Error(s.istekBasarisiz);
}

/** Model yanıtından JSON nesnesini çıkarır (```json bloğu ya da düz metin içinde olabilir). */
function jsonAyikla(metin: string, dil: Dil): Record<string, unknown> {
  const temiz = metin.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  const bas = temiz.indexOf('{');
  const son = temiz.lastIndexOf('}');
  if (bas >= 0 && son > bas) {
    try {
      const nesne = JSON.parse(temiz.slice(bas, son + 1));
      if (nesne && typeof nesne === 'object') return nesne as Record<string, unknown>;
    } catch {
      // aşağıda hata
    }
  }
  throw new Error(sozluk(dil).parca.ai.beklenmeyenYanit(metin.slice(0, 400)));
}

/** Ayarlar'da anahtar eklenirken: model listesini çeker, bir model seçer ve
 * küçük bir istekle anahtarın gerçekten çalıştığını doğrular. */
export async function uyumluAnahtariDogrula(
  saglayici: UyumluSaglayici,
  apiKey: string,
  dil?: Dil,
): Promise<{ gecerli: boolean; model?: string; gunlukLimit?: number; hata?: string }> {
  const d = dil ?? (await dilAl());
  try {
    const model = await modelSec(saglayici, apiKey, d);
    if (!model) return { gecerli: false, hata: sozluk(d).parca.ai.uyumluModelYok(UYUMLU_SAGLAYICILAR[saglayici].ad) };
    const olcum: AiOlcum = {};
    await tamamla(saglayici, apiKey, model, [{ role: 'user', content: 'Reply with: ok' }], d, olcum, false);
    let gunlukLimit = olcum.gunlukLimit;
    if (saglayici === 'openrouter') gunlukLimit = (await openRouterGunlukLimit(apiKey)) ?? gunlukLimit;
    return { gecerli: true, model, gunlukLimit };
  } catch (err) {
    return { gecerli: false, hata: err instanceof Error ? err.message : sozluk(d).parca.ai.bilinmeyenHata };
  }
}

/** OpenRouter'da ücretsiz modellerin günlük limiti hesabın geçmişte kredi alıp
 * almadığına bağlı (50 ya da 1000); anahtar bilgisinden okunur. */
async function openRouterGunlukLimit(apiKey: string): Promise<number | undefined> {
  try {
    const yanit = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(ZAMAN_ASIMI_MS),
    });
    if (!yanit.ok) return undefined;
    const govde = (await yanit.json()) as { data?: { is_free_tier?: unknown } };
    if (typeof govde.data?.is_free_tier === 'boolean') return govde.data.is_free_tier ? 50 : 1000;
  } catch {
    // bilinmiyorsa varsayılan kullanılır
  }
  return undefined;
}

export async function uyumluIleUrunCek(
  saglayici: UyumluSaglayici,
  apiKey: string,
  model: string | null | undefined,
  sayfaUrl: string,
  html: string,
  dil?: Dil,
  olcum?: AiOlcum,
): Promise<ModulVerisi> {
  const d = dil ?? (await dilAl());
  const s = sozluk(d).parca.ai;
  const metin = htmlMetneDonustur(html);
  if (!metin) throw new Error(s.metinYok);

  const yonerge =
    `Aşağıda bir e-ticaret sitesindeki ürün sayfasının (${sayfaUrl}) metni var. ` +
    'Bu genelde bir elektronik/hobi/robotik malzemesi (sensör, geliştirme kartı, modül, komponent vb.). ' +
    'Sayfadan ürün bilgilerini çıkar ve SADECE şu yapıda tek bir JSON nesnesi döndür, başka hiçbir metin yazma:\n' +
    '{"isim": string, "uretici": string, "aciklama": string, "parametreler": [{"etiket": string, "deger": string}], ' +
    '"fiyat": number, "paraBirimi": "TRY" | "USD" | "EUR"}\n' +
    `aciklama: ürünle ilgili kısa, tek cümlelik ${d === 'tr' ? 'Türkçe' : 'İngilizce'} özet (teknik özellikleri tekrar etme). ` +
    (d === 'tr' ? '' : 'Parametre etiketlerini İNGİLİZCE yaz. ') +
    'Bulunamayan metin alanlarını boş metin, fiyatı 0, parametreleri boş dizi bırak; asla uydurma.\n\n' +
    `SAYFA METNİ:\n${metin}`;

  const yanit = await tamamla(saglayici, apiKey, model, [{ role: 'user', content: yonerge }], d, olcum, true);
  const veri = jsonAyikla(yanit, d);

  const isim = typeof veri.isim === 'string' ? veri.isim.trim() : '';
  if (!isim) throw new Error(s.urunYok);

  const parametreler: Record<string, string> = {};
  if (Array.isArray(veri.parametreler)) {
    for (const satir of veri.parametreler as Record<string, unknown>[]) {
      const etiket = typeof satir?.etiket === 'string' ? satir.etiket.trim() : '';
      const deger = typeof satir?.deger === 'string' ? satir.deger.trim() : String(satir?.deger ?? '').trim();
      if (etiket && deger) parametreler[etiket] = deger;
    }
  }

  let resimUrl: string | null = null;
  const ogGoruntu = ogGoruntusuBul(html);
  if (ogGoruntu) {
    try {
      resimUrl = new URL(ogGoruntu, sayfaUrl).toString();
    } catch {
      resimUrl = null;
    }
  }

  const fiyatSayi = typeof veri.fiyat === 'number' ? veri.fiyat : Number.parseFloat(String(veri.fiyat ?? ''));
  const metinAlani = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  return {
    isim,
    uretici: metinAlani(veri.uretici),
    aciklama: metinAlani(veri.aciklama),
    kategori: 'Modül',
    resimUrl,
    fiyat: Number.isFinite(fiyatSayi) && fiyatSayi > 0 ? fiyatSayi : null,
    paraBirimi: metinAlani(veri.paraBirimi)?.toUpperCase() ?? 'TRY',
    tedarikciKodu: null,
    parametreler,
  };
}

export async function uyumluIleAciklamaCevir(
  saglayici: UyumluSaglayici,
  apiKey: string,
  model: string | null | undefined,
  hamAciklama: string,
  baglam?: string,
  dil?: Dil,
  olcum?: AiOlcum,
): Promise<string> {
  const d = dil ?? (await dilAl());
  const yonerge =
    'Aşağıda bir elektronik parçanın tedarikçi sitesinden alınmış ham açıklaması var ' +
    '(genelde İngilizce/Çince karışık, kötü yazılmış ya da makine çevirisi kalitesinde). ' +
    (baglam ? `Parça: ${baglam}. ` : '') +
    'Bunu kısa (1-2 cümle), doğal ve teknik olarak doğru bir TÜRKÇE açıklamaya çevir/düzenle. ' +
    'Sadece açıklama metnini yaz - tırnak işareti, "Açıklama:" gibi bir etiket ya da başka hiçbir ek metin kullanma.\n\n' +
    `HAM AÇIKLAMA:\n${hamAciklama}`;
  return tamamla(saglayici, apiKey, model, [{ role: 'user', content: yonerge }], d, olcum, false);
}

export async function uyumluSohbetCevapla(
  saglayici: UyumluSaglayici,
  apiKey: string,
  model: string | null | undefined,
  sistemYonergesi: string,
  mesajlar: SohbetMesaji[],
  dil?: Dil,
  olcum?: AiOlcum,
): Promise<string> {
  const d = dil ?? (await dilAl());
  return tamamla(
    saglayici,
    apiKey,
    model,
    [
      { role: 'system', content: sistemYonergesi },
      ...mesajlar.map((m): Mesaj => ({ role: m.rol === 'kullanici' ? 'user' : 'assistant', content: m.icerik })),
    ],
    d,
    olcum,
    false,
  );
}
