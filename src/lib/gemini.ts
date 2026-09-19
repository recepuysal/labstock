// Kullanıcının kendi Gemini API anahtarıyla, önceden tanımadığımız bir
// sitedeki ürün sayfasından modül bilgisi çıkarır. Direnc.net/Robotistan/
// Motorobit'in aksine burada belirli bir site şablonu (JSON-LD) aranmaz —
// sayfanın metni doğrudan modele "şu şemaya göre çıkar" diye veriliyor, bu
// yüzden prensipte herhangi bir satıcı sitesiyle çalışabilir.
//
// API: klasik "generateContent" uç noktası + generationConfig.responseSchema
// ile yapılandırılmış (structured) JSON çıktısı. Google'ın çok daha yeni
// "Interactions" uç noktasını (v1beta/interactions) değil bunu kullanıyoruz —
// yanıt şekli daha uzun süredir sabit ve iyi belgelenmiş.
// https://ai.google.dev/gemini-api/docs/structured-output

import type { ModulVerisi } from './direnc';

const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
// Sırayla denenir: biri kalıcı olmayan bir hatadan (bkz. yenidenDenenebilirMi)
// dönerse bir sonrakine geçilir. gemini-3.8-flash ücretsiz kotası günde
// sadece 20 istekle sınırlı ve zaten yoğun çıktı (429/503) - listeden
// çıkarıldı. Google'ın kendi hata mesajının önerdiği gemini-3.6-flash tek
// model; 503'te (geçici yoğunluk) aynı model kısa aralıklarla tekrar denenir.
const GEMINI_MODELLER = ['gemini-3.6-flash'];
const AZAMI_503_DENEME = 3;
const DENEME_GECIKMESI_MS = [2000, 5000, 9000];
const AZAMI_SAYFA_METNI = 30000;

function gecikme(ms: number): Promise<void> {
  return new Promise((cozul) => setTimeout(cozul, ms));
}

// Gemini'nin structured-output şeması OpenAPI'nin bir alt kümesi — tip adları
// büyük harfle (STRING/OBJECT/ARRAY) yazılır. "parametreler"i açık uçlu bir
// obje (rastgele anahtar adları) yerine {etiket, deger} dizisi olarak
// istiyoruz; rastgele anahtarlı objeler her şema varyantında güvenilir
// desteklenmiyor, dizi + sabit alanlar her yerde çalışır.
const URUN_SEMASI = {
  type: 'OBJECT',
  properties: {
    isim: { type: 'STRING', description: 'Ürünün tam adı/başlığı.' },
    uretici: { type: 'STRING', description: 'Üretici/marka adı; bulunamazsa boş metin.' },
    aciklama: {
      type: 'STRING',
      description: 'Ürünle ilgili kısa, tek cümlelik Türkçe bir özet (teknik özellikleri tekrar etme, onlar ayrı alanda).',
    },
    parametreler: {
      type: 'ARRAY',
      description: 'Teknik özellikler. Bulunamazsa boş dizi ([]).',
      items: {
        type: 'OBJECT',
        properties: {
          etiket: { type: 'STRING', description: 'Ör. "Çalışma Gerilimi", "Boyut".' },
          deger: { type: 'STRING', description: 'Ör. "5V", "43mm x 21mm".' },
        },
        required: ['etiket', 'deger'],
      },
    },
    fiyat: { type: 'NUMBER', description: 'Sayısal fiyat (ondalık nokta ile); bulunamazsa 0.' },
    paraBirimi: { type: 'STRING', description: 'Fiyatın para birimi kodu: TRY, USD ya da EUR. Bulunamazsa TRY.' },
  },
  required: ['isim', 'aciklama', 'parametreler', 'paraBirimi'],
};
// resimUrl şemada yok — htmlMetneDonustur() tüm etiketleri sildiği için model
// zaten hiçbir <img>/meta URL'sini göremiyor, tahmin ettirmenin anlamı yok.
// Onun yerine ürün fotoğrafı aşağıda ogGoruntusuBul() ile ham HTML'den
// (og:image/twitter:image meta etiketi — hemen hemen her e-ticaret
// sitesinde sosyal paylaşım önizlemesi için zaten var) doğrudan okunuyor.

/** <meta property="..." content="..."> (öznitelik sırası fark etmeksizin)
 * içeriğini bulur. */
function metaIcerikBul(html: string, ozellikAdi: string, ozellikDegeri: string): string | null {
  const ozellikDeseni = new RegExp(`${ozellikAdi}\\s*=\\s*["']${ozellikDegeri}["']`, 'i');
  for (const esleme of html.matchAll(/<meta\b[^>]*>/gi)) {
    const etiket = esleme[0];
    if (!ozellikDeseni.test(etiket)) continue;
    const icerik = etiket.match(/content\s*=\s*["']([^"']*)["']/i);
    if (icerik?.[1]) return icerik[1];
  }
  return null;
}

function ogGoruntusuBul(html: string): string | null {
  return (
    metaIcerikBul(html, 'property', 'og:image') ??
    metaIcerikBul(html, 'name', 'og:image') ??
    metaIcerikBul(html, 'name', 'twitter:image') ??
    metaIcerikBul(html, 'property', 'twitter:image')
  );
}

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

function gemininiIstekGovdesi(input: string, semaIsteniyor: boolean) {
  return {
    contents: [{ parts: [{ text: input }] }],
    ...(semaIsteniyor
      ? { generationConfig: { responseMimeType: 'application/json', responseSchema: URUN_SEMASI } }
      : {}),
  };
}

async function gemininiCagir(apiKey: string, model: string, govde: unknown): Promise<Response> {
  return fetch(GEMINI_ENDPOINT(model), {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(govde),
  });
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

/** 503 (model o an aşırı yüklü/yoğun), 429 (kota) ya da 404/mesajında "artık
 * kullanılamıyor/bulunamadı" geçen bir model hatası — bir sonraki modeli
 * denemeye değer, kalıcı olmayan durumlar. */
function yenidenDenenebilirMi(durum: number, mesaj: string): boolean {
  if (durum === 503 || durum === 429 || durum === 404) return true;
  return /no longer available|not found|is not supported|deprecated|not enabled/i.test(mesaj);
}

type GeminiSonuc = { basarili: true; govde: unknown } | { basarili: false; hata: string };

/** GEMINI_MODELLER listesini sırayla dener; 503'te (geçici yoğunluk) aynı
 * modeli kısa aralıklarla birkaç kez daha dener, başka bir
 * yenidenDenenebilirMi() hatasında listede varsa bir sonraki modele geçer,
 * kalıcı bir hatada (ör. geçersiz anahtar) hemen döner. */
async function gemininiModelSirasiylaCagir(apiKey: string, input: string, semaIsteniyor: boolean): Promise<GeminiSonuc> {
  let sonHata = 'Yapay zeka isteğine yanıt alınamadı.';
  for (const model of GEMINI_MODELLER) {
    for (let deneme = 0; ; deneme++) {
      const yanit = await gemininiCagir(apiKey, model, gemininiIstekGovdesi(input, semaIsteniyor));
      if (yanit.ok) return { basarili: true, govde: await yanit.json() };

      const mesaj = await gemininiHataMesaji(yanit);
      sonHata = mesaj;

      if (yanit.status === 503 && deneme < AZAMI_503_DENEME) {
        await gecikme(DENEME_GECIKMESI_MS[deneme]);
        continue;
      }
      if (!yenidenDenenebilirMi(yanit.status, mesaj)) return { basarili: false, hata: mesaj };
      break;
    }
  }
  return { basarili: false, hata: sonHata };
}

/** generateContent yanıtından üretilen metni çıkarır — asıl beklenen yol
 * candidates[0].content.parts[0].text; olası varyantlar için birkaç yedek
 * yol daha denenir, hiçbiri tutmazsa ham gövdenin bir kısmı hataya eklenir
 * (teşhis için). */
function outputMetniCikar(govde: unknown): string {
  type SanalGovde = {
    candidates?: { content?: { parts?: { text?: unknown }[] } }[];
    interaction?: { outputText?: unknown };
    output_text?: unknown;
    outputText?: unknown;
    text?: unknown;
  };
  const g = govde as SanalGovde;

  const yollar: unknown[] = [
    g.candidates?.[0]?.content?.parts?.[0]?.text,
    g.interaction?.outputText,
    g.output_text,
    g.outputText,
    g.text,
  ];
  for (const aday of yollar) {
    if (typeof aday === 'string') return aday;
  }

  throw new Error(`Yapay zekadan beklenmeyen bir yanıt geldi: ${JSON.stringify(govde).slice(0, 400)}`);
}

/** Ayarlar'da "Kaydet" denince anahtarın gerçekten çalışıp çalışmadığını
 * küçük, ucuz bir istekle doğrular. */
export async function geminiApiAnahtariniDogrula(apiKey: string): Promise<boolean> {
  try {
    const sonuc = await gemininiModelSirasiylaCagir(apiKey, 'Sadece "tamam" yaz.', false);
    return sonuc.basarili;
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
    "Emin olmadığın ya da sayfada bulunmayan alanları boş bırak, asla uydurma.\n\n" +
    `SAYFA METNİ:\n${metin}`;

  const sonuc = await gemininiModelSirasiylaCagir(apiKey, yonerge, true);
  if (!sonuc.basarili) throw new Error(sonuc.hata);

  const ham = outputMetniCikar(sonuc.govde);
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
  if (Array.isArray(hamParametreler)) {
    for (const satir of hamParametreler as Record<string, unknown>[]) {
      const etiket = typeof satir?.etiket === 'string' ? satir.etiket.trim() : '';
      const deger = typeof satir?.deger === 'string' ? satir.deger.trim() : '';
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

  const fiyat = typeof ayristirilmis.fiyat === 'number' && ayristirilmis.fiyat > 0 ? ayristirilmis.fiyat : null;

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
