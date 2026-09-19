// Kullanıcının kendi Gemini API anahtarıyla, önceden tanımadığımız bir
// sitedeki ürün sayfasından modül bilgisi çıkarır. Direnc.net/Robotistan/
// Motorobit'in aksine burada belirli bir site şablonu (JSON-LD) aranmaz —
// sayfanın metni doğrudan modele "şu şemaya göre çıkar" diye veriliyor, bu
// yüzden prensipte herhangi bir satıcı sitesiyle çalışabilir.
//
// API: Gemini "Interactions" uç noktası, response_format.schema ile
// yapılandırılmış (structured) JSON çıktısı istiyoruz.
// https://ai.google.dev/gemini-api/docs/interactions/structured-output

import type { ModulVerisi } from './direnc';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
// Sırayla denenir: ilki yoğunluktan (503) ya da kotadan (429) dönerse
// bir sonrakine geçilir — "gemini-3.8-flash is currently experiencing
// high demand" gibi geçici durumlarda isteği tamamen düşürmemek için.
const GEMINI_MODELLER = ['gemini-3.8-flash', 'gemini-2.5-flash'];
const AZAMI_SAYFA_METNI = 30000;

const URUN_SEMASI = {
  type: 'object',
  properties: {
    isim: { type: 'string', description: 'Ürünün tam adı/başlığı.' },
    uretici: { type: ['string', 'null'], description: 'Üretici/marka adı; bulunamazsa null.' },
    aciklama: {
      type: 'string',
      description: 'Ürünle ilgili kısa, tek cümlelik Türkçe bir özet (teknik özellikleri tekrar etme, onlar ayrı alanda).',
    },
    parametreler: {
      type: 'object',
      description:
        'Teknik özellikler, "Etiket": "Değer" çiftleri (ör. "Çalışma Gerilimi": "5V", "Boyut": "43mm x 21mm"). Bulunamazsa boş obje ({}).',
      additionalProperties: { type: 'string' },
    },
    fiyat: { type: ['number', 'null'], description: 'Sayısal fiyat (ondalık nokta ile); bulunamazsa null.' },
    paraBirimi: { type: 'string', description: 'Fiyatın para birimi kodu: TRY, USD ya da EUR. Bulunamazsa TRY.' },
    resimUrl: {
      type: ['string', 'null'],
      description: 'Ürünün ana fotoğrafının URL\'si (mutlak ya da göreli olabilir); bulunamazsa null.',
    },
  },
  required: ['isim', 'aciklama', 'parametreler', 'paraBirimi'],
};

/** Basit HTML → düz metin: script/style/yorum bloklarını ve etiketleri atar,
 * yaygın HTML varlıklarını çözer, boşlukları sadeleştirir. Mükemmel değil ama
 * modele boşuna token harcatan gürültünün çoğunu temizlemeye yetiyor. */
function htmlMetneDonustur(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, AZAMI_SAYFA_METNI);
}

function gemininiIstekGovdesi(model: string, input: string, semaIsteniyor: boolean) {
  return {
    model,
    input,
    ...(semaIsteniyor
      ? { response_format: { type: 'text', mime_type: 'application/json', schema: URUN_SEMASI } }
      : {}),
  };
}

async function gemininiCagir(apiKey: string, govde: unknown): Promise<Response> {
  return fetch(GEMINI_ENDPOINT, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(govde),
  });
}

/** 503 (model o an aşırı yüklü/yoğun) ya da 429 (kota) — bir sonraki modeli
 * denemeye değer, geçici durumlar. */
function yenidenDenenebilirMi(durum: number): boolean {
  return durum === 503 || durum === 429;
}

/** GEMINI_MODELLER listesini sırayla dener; sadece yenidenDenenebilirMi()
 * true olan hatalarda bir sonrakine geçer, başka türlü hemen döner. */
async function gemininiModelSirasiylaCagir(
  apiKey: string,
  input: string,
  semaIsteniyor: boolean,
): Promise<Response> {
  let sonYanit: Response | null = null;
  for (const model of GEMINI_MODELLER) {
    const yanit = await gemininiCagir(apiKey, gemininiIstekGovdesi(model, input, semaIsteniyor));
    if (yanit.ok || !yenidenDenenebilirMi(yanit.status)) return yanit;
    sonYanit = yanit;
  }
  return sonYanit!;
}

async function gemininiHataMesaji(yanit: Response): Promise<string> {
  const govde = await yanit.text();
  try {
    const ayristirilmis = JSON.parse(govde);
    // Gemini hata gövdesi bazen düz obje ({error:{...}}), bazen tek elemanlı
    // dizi ([{error:{...}}]) olarak dönüyor.
    const hata = Array.isArray(ayristirilmis) ? ayristirilmis[0] : ayristirilmis;
    if (typeof hata?.error?.message === 'string') return hata.error.message;
  } catch {
    // düz metin/boş gövde olabilir, aşağıdaki genel mesaj kullanılır
  }
  return `Yapay zeka isteği başarısız (HTTP ${yanit.status}).`;
}

/** Ayarlar'da "Kaydet" denince anahtarın gerçekten çalışıp çalışmadığını
 * küçük, ucuz bir istekle doğrular. */
export async function geminiApiAnahtariniDogrula(apiKey: string): Promise<boolean> {
  try {
    const yanit = await gemininiModelSirasiylaCagir(apiKey, 'Sadece "tamam" yaz.', false);
    return yanit.ok;
  } catch {
    return false;
  }
}

export async function geminiIleUrunCek(apiKey: string, sayfaUrl: string, html: string): Promise<ModulVerisi> {
  const metin = htmlMetneDonustur(html);
  if (!metin) throw new Error('Sayfadan okunabilir bir metin çıkarılamadı.');

  const yonerge =
    `Aşağıda bir e-ticaret sitesindeki ürün sayfasının (${sayfaUrl}) metni var. ` +
    'Bu genelde bir elektronik/hobi/robotik malzemesi (sensör, geliştirme kartı, modül, komponent vb.). ' +
    'Sayfadan ürün bilgilerini çıkarıp istenen şemaya uygun JSON döndür. ' +
    "Emin olmadığın ya da sayfada bulunmayan alanları null/boş bırak, asla uydurma.\n\n" +
    `SAYFA METNİ:\n${metin}`;

  const yanit = await gemininiModelSirasiylaCagir(apiKey, yonerge, true);
  if (!yanit.ok) throw new Error(await gemininiHataMesaji(yanit));

  const govde = await yanit.json();
  const ham = govde?.interaction?.outputText;
  if (typeof ham !== 'string') throw new Error('Yapay zekadan beklenmeyen bir yanıt geldi.');

  let ayristirilmis: Record<string, unknown>;
  try {
    ayristirilmis = JSON.parse(ham);
  } catch {
    throw new Error('Yapay zeka yanıtı okunamadı.');
  }

  const isim = typeof ayristirilmis.isim === 'string' ? ayristirilmis.isim.trim() : '';
  if (!isim) throw new Error('Sayfadan ürün bilgisi çıkarılamadı.');

  const parametreler: Record<string, string> = {};
  const hamParametreler = ayristirilmis.parametreler;
  if (hamParametreler && typeof hamParametreler === 'object') {
    for (const [anahtar, deger] of Object.entries(hamParametreler as Record<string, unknown>)) {
      if (typeof deger === 'string' && deger.trim()) parametreler[anahtar] = deger.trim();
      else if (typeof deger === 'number') parametreler[anahtar] = String(deger);
    }
  }

  let resimUrl: string | null = null;
  if (typeof ayristirilmis.resimUrl === 'string' && ayristirilmis.resimUrl.trim()) {
    try {
      resimUrl = new URL(ayristirilmis.resimUrl.trim(), sayfaUrl).toString();
    } catch {
      resimUrl = null;
    }
  }

  const fiyat = typeof ayristirilmis.fiyat === 'number' && Number.isFinite(ayristirilmis.fiyat) ? ayristirilmis.fiyat : null;

  return {
    isim,
    uretici: typeof ayristirilmis.uretici === 'string' && ayristirilmis.uretici.trim() ? ayristirilmis.uretici.trim() : null,
    aciklama:
      typeof ayristirilmis.aciklama === 'string' && ayristirilmis.aciklama.trim() ? ayristirilmis.aciklama.trim() : null,
    kategori: 'Modül',
    resimUrl,
    fiyat,
    paraBirimi:
      typeof ayristirilmis.paraBirimi === 'string' && ayristirilmis.paraBirimi.trim()
        ? ayristirilmis.paraBirimi.trim().toUpperCase()
        : 'TRY',
    tedarikciKodu: null,
    parametreler,
  };
}
