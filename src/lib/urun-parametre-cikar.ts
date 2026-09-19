// Direnc.net/Robotistan gibi sitelerin JSON-LD "description" alanı, sayfadaki
// tüm tanıtım metni + teknik özellik tablosunun düz metne çevrilmiş hali —
// satır sonları kayboluyor, "Etiket: Değer" dizisi tek bir metin akışında
// birleşiyor. Bu, o akıştan LCSC'deki additionalProperty'ye benzer bir
// parametreler tablosu çıkarır; açıklama olarak da uzun tanıtım metni değil,
// ürünle ilgili kısa tek cümlelik bir özet döner.

export type AciklamaAyristirma = {
  aciklama: string;
  parametreler: Record<string, string>;
};

const AZAMI_DEGER_UZUNLUGU = 60;
const AZAMI_ACIKLAMA_UZUNLUGU = 220;

/** Metnin ilk cümlesini döner (ilk ". "/"! "/"? " ya da metin sonu) — ondalık
 * sayılardaki nokta ("3.5V") bir boşlukla takip edilmediği için bölünmez. Çok
 * uzunsa kelime sınırında kısaltıp "…" ekler. */
function ilkCumle(metin: string): string {
  const esleme = metin.match(/^(.*?[.!?])(?=\s|$)/s);
  let cumle = (esleme ? esleme[1] : metin).trim();
  if (cumle.length > AZAMI_ACIKLAMA_UZUNLUGU) {
    cumle = `${cumle.slice(0, AZAMI_ACIKLAMA_UZUNLUGU).replace(/\s+\S*$/, '')}…`;
  }
  return cumle;
}

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
  const onTam = baslangic >= 0 ? metin.slice(0, baslangic).trim() : metin.trim();
  const aciklama = ilkCumle(onTam);
  if (baslangic < 0) return { aciklama, parametreler: {} };

  let blok = metin.slice(baslangic + ozellikBasligi.length);
  for (const kuyruk of kuyrukBasliklari) {
    const kuyrukIndex = blok.indexOf(kuyruk);
    if (kuyrukIndex >= 0) blok = blok.slice(0, kuyrukIndex);
  }

  return { aciklama, parametreler: etiketDegerCikar(blok) };
}
