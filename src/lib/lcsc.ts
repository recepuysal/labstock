// LCSC ürün sayfasındaki schema.org JSON-LD bloğunu okuyup parça bilgilerine
// çeviriyor. Resmi API değil, ama normal bir sayfa isteği — LCSC sayfasında
// arama motorları için zaten yayınladığı yapılandırılmış veriyi okuyoruz.

// LCSC'nin kendi katalog kategorilerine yakın bir eşleme — sırası önemli,
// ilk eşleşen kazanır; bu yüzden dar/özel anahtarlar geniş olanlardan önce durur.
const KATEGORI_ANAHTAR: [string, string][] = [
  // pasif
  ['potentiometer', 'Potansiyometre'],
  ['trimmer', 'Potansiyometre'],
  ['rheostat', 'Potansiyometre'],
  ['resistor', 'Direnç'],
  ['capacitor', 'Kondansatör'],
  ['choke', 'Bobin'],
  ['ferrite bead', 'Bobin'],
  ['inductor', 'Bobin'],
  ['transformer', 'Transformatör'],

  // ayrık yarı iletken
  ['rectifier', 'Diyot'],
  ['diode', 'Diyot'],
  ['mosfet', 'Transistör'],
  ['igbt', 'Transistör'],
  ['thyristor', 'Transistör'],
  ['triac', 'Transistör'],
  ['transistor', 'Transistör'],

  // entegreler — özel olanlar genel "ic"/"circuit"tan önce
  ['microcontroller', 'Mikrodenetleyici / İşlemci'],
  ['microprocessor', 'Mikrodenetleyici / İşlemci'],
  ['fpga', 'Mikrodenetleyici / İşlemci'],
  ['cpld', 'Mikrodenetleyici / İşlemci'],
  ['mcu', 'Mikrodenetleyici / İşlemci'],
  ['eeprom', 'Bellek'],
  ['sram', 'Bellek'],
  ['dram', 'Bellek'],
  ['flash memory', 'Bellek'],
  ['memory', 'Bellek'],
  ['dc-dc', 'Güç Yönetimi IC'],
  ['dc/dc', 'Güç Yönetimi IC'],
  ['battery management', 'Güç Yönetimi IC'],
  ['power management', 'Güç Yönetimi IC'],
  ['charger', 'Güç Yönetimi IC'],
  ['pmic', 'Güç Yönetimi IC'],
  ['regulator', 'Regülatör'],
  ['ldo', 'Regülatör'],
  ['transceiver', 'Arayüz IC'],
  ['rs485', 'Arayüz IC'],
  ['rs232', 'Arayüz IC'],
  ['can bus', 'Arayüz IC'],
  ['interface', 'Arayüz IC'],
  ['real-time clock', 'Saat / Zamanlama'],
  ['rtc', 'Saat / Zamanlama'],
  ['clock', 'Saat / Zamanlama'],
  ['timing', 'Saat / Zamanlama'],
  ['isolator', 'İzolatör'],
  ['optocoupler', 'İzolatör'],
  ['bluetooth', 'RF / Kablosuz'],
  ['zigbee', 'RF / Kablosuz'],
  ['wifi', 'RF / Kablosuz'],
  ['lora', 'RF / Kablosuz'],
  ['wireless', 'RF / Kablosuz'],
  ['antenna', 'RF / Kablosuz'],
  ['amplifier', 'Entegre'],
  ['logic', 'Entegre'],
  ['circuit', 'Entegre'],
  ['ic ', 'Entegre'],

  // opto/görsel
  ['led', 'Optoelektronik'],
  ['display', 'Optoelektronik'],
  ['photo', 'Optoelektronik'],
  ['opto', 'Optoelektronik'],

  // sensör
  ['thermistor', 'Sensör'],
  ['accelerometer', 'Sensör'],
  ['gyroscope', 'Sensör'],
  ['humidity', 'Sensör'],
  ['sensor', 'Sensör'],

  // elektromekanik
  ['relay', 'Röle'],
  ['tact', 'Anahtar'],
  ['switch', 'Anahtar'],

  // bağlantı
  ['terminal block', 'Kablo / Terminal'],
  ['cable', 'Kablo / Terminal'],
  ['wire', 'Kablo / Terminal'],
  ['connector', 'Konnektör'],
  ['header', 'Konnektör'],

  // zamanlayıcı parçalar
  ['crystal', 'Kristal / Osilatör'],
  ['oscillator', 'Kristal / Osilatör'],
  ['resonator', 'Kristal / Osilatör'],

  ['filter', 'Filtre'],

  ['varistor', 'Koruma'],
  ['fuse', 'Koruma'],
  ['tvs', 'Koruma'],
  ['esd', 'Koruma'],
  ['protection', 'Koruma'],

  ['actuator', 'Motor / Fan / Aktüatör'],
  ['buzzer', 'Motor / Fan / Aktüatör'],
  ['speaker', 'Motor / Fan / Aktüatör'],
  ['motor', 'Motor / Fan / Aktüatör'],
  ['fan', 'Motor / Fan / Aktüatör'],

  ['development board', 'Modül'],
  ['module', 'Modül'],

  ['screw', 'Mekanik'],
  ['standoff', 'Mekanik'],
  ['enclosure', 'Mekanik'],
  ['heat sink', 'Mekanik'],
  ['heatsink', 'Mekanik'],
];

function kategoriTahminEt(metin: string): string {
  const kucuk = metin.toLowerCase();
  for (const [anahtar, kategori] of KATEGORI_ANAHTAR) {
    if (kucuk.includes(anahtar)) return kategori;
  }
  return 'Diğer';
}

export type LcscVerisi = {
  uretici: string | null;
  aciklama: string | null;
  kategori: string | null;
  kilif: string | null;
  datasheetUrl: string | null;
  resimUrl: string | null;
  parametreler: Record<string, string>;
  fiyat: number | null;
  paraBirimi: string;
};

type LdProduct = {
  '@type'?: string;
  brand?: { name?: string };
  description?: string;
  category?: string;
  image?: string | string[];
  additionalProperty?: { name?: string; value?: string | number }[];
  subjectOf?: { url?: string };
  offers?: { price?: number; priceCurrency?: string };
};

export async function lcscKoduGetir(kod: string): Promise<LcscVerisi> {
  const temizKod = kod.trim().toUpperCase();
  const url = `https://www.lcsc.com/product-detail/_${encodeURIComponent(temizKod)}.html`;

  const yanit = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  });
  if (!yanit.ok) throw new Error(`LCSC sayfası alınamadı (HTTP ${yanit.status}).`);
  const html = await yanit.text();

  let urun: LdProduct | null = null;
  for (const esleme of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const veri = JSON.parse(esleme[1]);
      if (veri['@type'] === 'Product') {
        urun = veri;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!urun) throw new Error(`"${temizKod}" için LCSC'de ürün bilgisi bulunamadı.`);

  const parametreler: Record<string, string> = {};
  for (const ozellik of urun.additionalProperty ?? []) {
    if (ozellik?.name && ozellik?.value != null) parametreler[ozellik.name] = String(ozellik.value);
  }

  const kategoriMetni = [urun.category, urun.description].filter(Boolean).join(' ');
  const resimler = Array.isArray(urun.image) ? urun.image : urun.image ? [urun.image] : [];

  return {
    uretici: urun.brand?.name ?? null,
    aciklama: urun.description ?? null,
    kategori: kategoriMetni ? kategoriTahminEt(kategoriMetni) : null,
    kilif: parametreler['Package'] ?? parametreler['Package/Case'] ?? null,
    datasheetUrl: urun.subjectOf?.url ?? null,
    resimUrl: resimler[0] ?? null,
    parametreler,
    fiyat: typeof urun.offers?.price === 'number' ? urun.offers.price : null,
    paraBirimi: urun.offers?.priceCurrency ?? 'USD',
  };
}
