// Direnc.net/Robotistan gibi sitelerin JSON-LD "description" alanı, sayfadaki
// teknik özellik tablosunun düz metne çevrilmiş hali — satır sonları kayboluyor,
// "Etiket: Değer" dizisi tek bir metin akışında birleşiyor. Bu, o akıştan
// LCSC'deki additionalProperty'ye benzer bir parametreler tablosu çıkarır ve
// tanıtım/link kuyruğunu (ör. "Faydalı Linkler ...") atar. Güvenilir şekilde
// ayrıştırılamayan (aşırı uzun ya da hiç bulunamayan) durumlarda metni olduğu
// gibi açıklamada bırakır — hiçbir zaman bilgi kaybına yol açmaz.

export type AciklamaAyristirma = {
  aciklama: string;
  parametreler: Record<string, string>;
};

const AZAMI_DEGER_UZUNLUGU = 60;

// Sayı hemen ardından gelen bu birim kelimeleri ("18 Watt", "50 mA") bir
// sonraki etiketin başlangıcıymış gibi yanlış algılanmasın diye dışlanır.
const BIRIM_KELIMELERI =
  'Watt|Volt|Amper|Amp|mm|cm|km|mA|mAh|MHz|GHz|KHz|KB|MB|GB|Kb|Mb|Gb|gram|gr|kg|Ohm|W';

/** "Etiket: Değer Etiket2: Değer2 ..." biçimindeki bitişik metinden çiftleri
 * çıkarır — bir sonraki "Kelime(ler): " kalıbından önceki kısım, önceki
 * etiketin değeri sayılır. Aşırı uzun (muhtemelen yanlış ayrıştırılmış)
 * değerler sessizce atlanır. */
function etiketDegerCikar(metin: string): Record<string, string> {
  const sonuc: Record<string, string> = {};
  const kelime = `(?!(?:${BIRIM_KELIMELERI})\\b)[A-ZÇĞİÖŞÜ][\\wÇĞİÖŞÜçğıöşü/().-]+`;
  const devam = '(?:\\s+[A-ZÇĞİÖŞÜçğıöşüa-z0-9/().-]+){0,5}';
  const etiketDesen = `${kelime}${devam}\\s*[:：]`;
  const desen = new RegExp(`(?:^|\\s)(${etiketDesen})\\s*(.+?)(?=\\s+${etiketDesen}|$)`, 'g');

  for (const e of metin.matchAll(desen)) {
    const etiket = e[1].replace(/[:：]\s*$/, '').trim();
    const deger = e[2].trim();
    if (etiket && deger && deger.length <= AZAMI_DEGER_UZUNLUGU) sonuc[etiket] = deger;
  }
  return sonuc;
}

/**
 * @param metin JSON-LD description alanı (satır sonsuz, düz metin).
 * @param ozellikBasliklari Teknik özellik bölümünün başladığını işaret eden,
 *   sitenin kullanabileceği sabit metinler (ör. "Teknik Özellikleri",
 *   "Features:") — hangisi metinde önce bulunursa o kullanılır.
 * @param kuyrukBasliklari Özellik bölümünden sonra gelen, atılacak tanıtım
 *   metinlerinin başlangıcı (ör. "Faydalı Linkler").
 */
export function urunAciklamasiniAyristir(
  metin: string,
  ozellikBasliklari: string | string[],
  kuyrukBasliklari: string[] = [],
): AciklamaAyristirma {
  let baslangic = -1;
  let ozellikBasligi = '';
  for (const aday of Array.isArray(ozellikBasliklari) ? ozellikBasliklari : [ozellikBasliklari]) {
    const i = metin.indexOf(aday);
    if (i >= 0 && (baslangic < 0 || i < baslangic)) {
      baslangic = i;
      ozellikBasligi = aday;
    }
  }
  if (baslangic < 0) return { aciklama: metin.trim(), parametreler: {} };

  const on = metin.slice(0, baslangic).trim();
  let blok = metin.slice(baslangic + ozellikBasligi.length);

  for (const kuyruk of kuyrukBasliklari) {
    const kuyrukIndex = blok.indexOf(kuyruk);
    if (kuyrukIndex >= 0) blok = blok.slice(0, kuyrukIndex);
  }

  const parametreler = etiketDegerCikar(blok);
  if (Object.keys(parametreler).length === 0) {
    return { aciklama: `${on} ${blok}`.trim(), parametreler: {} };
  }
  return { aciklama: on || metin.trim(), parametreler };
}
