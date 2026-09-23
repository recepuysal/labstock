// Kullanıcının kendi Claude (Anthropic) API anahtarıyla aynı işleri yapar:
// linkten ürün çekme, LCSC açıklama çevirisi, sohbet asistanı — Gemini'nin
// (lib/gemini.ts) bire bir muadili. lib/ai.ts, kullanıcının eklediği tüm
// anahtarları (Gemini ve/veya Claude, birden fazla hesap) sırayla dener;
// buradaki fonksiyonlar tek bir Claude anahtarıyla çalışır.
//
// API: Anthropic Messages API. Yapılandırılmış (structured) JSON çıktı için
// Gemini'deki responseSchema'nın muadili olarak zorunlu tool-use kullanılır
// (tool_choice: {type: "tool", ...}) — model her zaman tek bir aracı,
// verdiğimiz JSON Schema'ya uygun girdiyle çağırmak zorunda kalır.
// https://docs.claude.com/en/docs/build-with-claude/tool-use

import type { ModulVerisi } from './direnc';
import type { SohbetMesaji } from './gemini';

const CLAUDE_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_SURUM = '2023-06-01';
// Bu kısa çıkarma/çeviri/sohbet işleri için hız ve maliyet açısından en uygun
// model — büyük bir akıl yürütme gerekmiyor, sayfadan alan çıkarmak yeterli.
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const AZAMI_YUKLENME_DENEMESI = 3;
const DENEME_GECIKMESI_MS = [2000, 5000, 9000];
const AZAMI_SAYFA_METNI = 30000;
const AZAMI_TOKEN = 1024;

function gecikme(ms: number): Promise<void> {
  return new Promise((cozul) => setTimeout(cozul, ms));
}

// JSON Schema — Gemini'nin URUN_SEMASI'nın (lib/gemini.ts) Claude tool-use
// karşılığı; aynı alanlar, aynı gerekçelerle (parametreler açık uçlu obje
// yerine {etiket, deger} dizisi).
const URUN_ARACI = {
  name: 'urun_bilgisi_kaydet',
  description: 'Sayfadan çıkarılan ürün bilgisini verilen şemaya göre kaydeder.',
  input_schema: {
    type: 'object' as const,
    properties: {
      isim: { type: 'string', description: 'Ürünün tam adı/başlığı.' },
      uretici: { type: 'string', description: 'Üretici/marka adı; bulunamazsa boş metin.' },
      aciklama: {
        type: 'string',
        description:
          'Ürünle ilgili kısa, tek cümlelik Türkçe bir özet (teknik özellikleri tekrar etme, onlar ayrı alanda).',
      },
      parametreler: {
        type: 'array',
        description: 'Teknik özellikler. Bulunamazsa boş dizi ([]).',
        items: {
          type: 'object',
          properties: {
            etiket: { type: 'string', description: 'Ör. "Çalışma Gerilimi", "Boyut".' },
            deger: { type: 'string', description: 'Ör. "5V", "43mm x 21mm".' },
          },
          required: ['etiket', 'deger'],
        },
      },
      fiyat: { type: 'number', description: 'Sayısal fiyat (ondalık nokta ile); bulunamazsa 0.' },
      paraBirimi: { type: 'string', description: 'Fiyatın para birimi kodu: TRY, USD ya da EUR. Bulunamazsa TRY.' },
    },
    required: ['isim', 'aciklama', 'parametreler', 'paraBirimi'],
  },
};

/** <meta property="..." content="..."> içeriğini bulur (bkz. lib/gemini.ts — aynı mantık). */
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

type ClaudeIstek = {
  model: string;
  max_tokens: number;
  system?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  tools?: (typeof URUN_ARACI)[];
  tool_choice?: { type: 'tool'; name: string };
};

async function claudeCagir(apiKey: string, govde: ClaudeIstek): Promise<Response> {
  return fetch(CLAUDE_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_SURUM,
      'content-type': 'application/json',
    },
    body: JSON.stringify(govde),
  });
}

async function claudeHataMesaji(yanit: Response): Promise<string> {
  const govde = await yanit.text();
  try {
    const ayristirilmis = JSON.parse(govde);
    if (typeof ayristirilmis?.error?.message === 'string') return ayristirilmis.error.message;
  } catch {
    // düz metin/boş gövde olabilir, aşağıdaki genel mesaj kullanılır
  }
  return `Yapay zeka isteği başarısız (HTTP ${yanit.status}).`;
}

type ClaudeSonuc = { basarili: true; govde: unknown } | { basarili: false; hata: string };

/** 529 (Anthropic tarafı o an aşırı yüklü) ya da 429 (kota) durumunda kısa
 * aralıklarla birkaç kez daha dener; kalıcı bir hatada (ör. geçersiz anahtar,
 * 401/403) hemen döner — çağıran taraf (lib/ai.ts) sıradaki anahtara geçer. */
async function claudeCagirYenidenDeneyerek(apiKey: string, govde: ClaudeIstek): Promise<ClaudeSonuc> {
  let sonHata = 'Yapay zeka isteğine yanıt alınamadı.';
  for (let deneme = 0; ; deneme++) {
    const yanit = await claudeCagir(apiKey, govde);
    if (yanit.ok) return { basarili: true, govde: await yanit.json() };

    sonHata = await claudeHataMesaji(yanit);
    if ((yanit.status === 529 || yanit.status === 429) && deneme < AZAMI_YUKLENME_DENEMESI) {
      await gecikme(DENEME_GECIKMESI_MS[deneme]);
      continue;
    }
    return { basarili: false, hata: sonHata };
  }
}

/** messages.create yanıtından metni ya da (tool-use varsa) aracın girdisini çıkarır. */
function metinBlogunuCikar(govde: unknown): string {
  type SanalGovde = { content?: { type?: string; text?: unknown }[] };
  const bloklar = (govde as SanalGovde).content ?? [];
  const metinBlogu = bloklar.find((b) => b.type === 'text');
  if (typeof metinBlogu?.text === 'string') return metinBlogu.text;
  throw new Error(`Yapay zekadan beklenmeyen bir yanıt geldi: ${JSON.stringify(govde).slice(0, 400)}`);
}

function araçGirdisiniCikar(govde: unknown): Record<string, unknown> {
  type SanalGovde = { content?: { type?: string; input?: unknown }[] };
  const bloklar = (govde as SanalGovde).content ?? [];
  const aracBlogu = bloklar.find((b) => b.type === 'tool_use');
  if (aracBlogu?.input && typeof aracBlogu.input === 'object') return aracBlogu.input as Record<string, unknown>;
  throw new Error(`Yapay zekadan beklenmeyen bir yanıt geldi: ${JSON.stringify(govde).slice(0, 400)}`);
}

/** Ayarlar'da "Kaydet" denince anahtarın gerçekten çalışıp çalışmadığını
 * küçük, ucuz bir istekle doğrular (bkz. lib/gemini.ts — aynı amaç). */
export async function claudeApiAnahtariniDogrula(apiKey: string): Promise<boolean> {
  try {
    const sonuc = await claudeCagirYenidenDeneyerek(apiKey, {
      model: CLAUDE_MODEL,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Sadece "tamam" yaz.' }],
    });
    return sonuc.basarili;
  } catch {
    return false;
  }
}

export async function claudeIleUrunCek(apiKey: string, sayfaUrl: string, html: string): Promise<ModulVerisi> {
  const metin = htmlMetneDonustur(html);
  if (!metin) throw new Error('Sayfadan okunabilir bir metin çıkarılamadı.');

  const yonerge =
    `Aşağıda bir e-ticaret sitesindeki ürün sayfasının (${sayfaUrl}) metni var. ` +
    'Bu genelde bir elektronik/hobi/robotik malzemesi (sensör, geliştirme kartı, modül, komponent vb.). ' +
    'Sayfadan ürün bilgilerini çıkarıp urun_bilgisi_kaydet aracını çağır. ' +
    "Emin olmadığın ya da sayfada bulunmayan alanları boş bırak, asla uydurma.\n\n" +
    `SAYFA METNİ:\n${metin}`;

  const sonuc = await claudeCagirYenidenDeneyerek(apiKey, {
    model: CLAUDE_MODEL,
    max_tokens: AZAMI_TOKEN,
    messages: [{ role: 'user', content: yonerge }],
    tools: [URUN_ARACI],
    tool_choice: { type: 'tool', name: URUN_ARACI.name },
  });
  if (!sonuc.basarili) throw new Error(sonuc.hata);

  const ayristirilmis = araçGirdisiniCikar(sonuc.govde);

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

/** LCSC gibi tedarikçi sitelerinden gelen ham açıklamayı kısa ve doğal bir
 * Türkçe açıklamaya çevirir/düzenler (bkz. lib/gemini.ts — aynı amaç). */
export async function claudeIleAciklamaCevir(apiKey: string, hamAciklama: string, baglam?: string): Promise<string> {
  const yonerge =
    'Aşağıda bir elektronik parçanın tedarikçi sitesinden alınmış ham açıklaması var ' +
    '(genelde İngilizce/Çince karışık, kötü yazılmış ya da makine çevirisi kalitesinde). ' +
    (baglam ? `Parça: ${baglam}. ` : '') +
    'Bunu kısa (1-2 cümle), doğal ve teknik olarak doğru bir TÜRKÇE açıklamaya çevir/düzenle. ' +
    'Sadece açıklama metnini yaz - tırnak işareti, "Açıklama:" gibi bir etiket ya da başka hiçbir ek metin kullanma.\n\n' +
    `HAM AÇIKLAMA:\n${hamAciklama}`;

  const sonuc = await claudeCagirYenidenDeneyerek(apiKey, {
    model: CLAUDE_MODEL,
    max_tokens: AZAMI_TOKEN,
    messages: [{ role: 'user', content: yonerge }],
  });
  if (!sonuc.basarili) throw new Error(sonuc.hata);
  return metinBlogunuCikar(sonuc.govde).trim();
}

/** Envanter asistanı sohbeti (bkz. lib/gemini.ts geminiSohbetCevapla — aynı amaç). */
export async function claudeSohbetCevapla(
  apiKey: string,
  sistemYonergesi: string,
  mesajlar: SohbetMesaji[],
): Promise<string> {
  const sonuc = await claudeCagirYenidenDeneyerek(apiKey, {
    model: CLAUDE_MODEL,
    max_tokens: AZAMI_TOKEN,
    system: sistemYonergesi,
    messages: mesajlar.map((m) => ({
      role: m.rol === 'kullanici' ? 'user' : 'assistant',
      content: m.icerik,
    })),
  });
  if (!sonuc.basarili) throw new Error(sonuc.hata);
  return metinBlogunuCikar(sonuc.govde).trim();
}
