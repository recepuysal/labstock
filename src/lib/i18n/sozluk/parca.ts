// Bu alanın metinleri. `en`, `tr` ile aynı şekle sahip olmalı.
// Parça detay/ekle/düzenle/etiket sayfaları, parça formu, sohbet asistanı ve
// tedarikçi/yapay zeka yardımcılarının (lib/*) kullanıcıya dönen hataları.
import type { Sekil } from '../index';

const tr = {
  vazgec: 'Vazgeç',
  rohsUyumlu: 'RoHS uyumlu',
  rohsDegil: 'RoHS değil',

  detay: {
    envanter: 'Envanter',
    mpnKopyala: 'Malzeme adını kopyala',
    etiketYazdir: 'Etiket yazdır',
    datasheet: 'Datasheet',
    lcscdeGor: "LCSC'de gör",
    toplamAdet: 'TOPLAM ADET',
    projelereAyrilan: 'PROJELERE AYRILAN',
    kullanilabilir: 'KULLANILABİLİR',
    minSeviye: (n: string) => `MİN. SEVİYE · ${n}`,
    parametreler: 'PARAMETRELER',
    hareketGecmisi: 'HAREKET GEÇMİŞİ',
    tumunuGor: (n: number) => `tümünü gör (${n})`,
    hareketYok: 'Henüz hareket yok.',
    tablo: {
      tarih: 'TARIH',
      islem: 'İŞLEM',
      adet: 'ADET',
      sebepProje: 'SEBEP / PROJE',
      sonra: 'SONRA',
    },
    giris: 'Giriş',
    dusuldu: 'Düşüldü',
    tedarik: 'TEDARİK',
    sonAlimFiyati: 'Son alım fiyatı:',
    kullanildigiProjeler: 'KULLANILDIĞI PROJELER',
    proje: 'Proje',
    kartBasina: '/ kart',
    projedeKullanilmiyor: 'Henüz bir projede kullanılmıyor.',
  },

  duzenle: {
    baslik: 'Parçayı düzenle',
    aciklama: (mpn: string) => `${mpn} — katalog ve stok bilgilerini güncelle.`,
  },

  yeni: {
    baslik: 'Parça ekle',
    aciklama:
      'MPN ortak katalogda varsa ona bağlanır, yoksa katalog için yeni bir kayıt açılır. Adet girersen bu bir stok hareketi olarak da kaydedilir.',
    lcscEtiketi: 'Telefonla okutulan LCSC etiketi:',
    adet: (n: number) => ` · ${n} adet`,
    lcscDolduruldu: ". Bilgiler LCSC'den dolduruldu; konumu seçip kaydet.",
    lcscAlinamadi: 'LCSC bilgisi alınamadı',
  },

  etiketSayfasi: {
    parcayaDon: 'Parçaya dön',
    gorunumAyarla: 'Etiket görünümünü ayarla',
    aciklama:
      'Yazdırıp parçanın kutusuna/çekmecesine yapıştır. Bir barkod okuyucuyla (ya da uygulamadaki arama kutusuna elle yapıştırarak) taradığında doğrudan bu parçanın sayfası açılır.',
  },

  form: {
    parcaGorseli: 'Parça görseli',
    gorselSec: 'Görsel seç',
    gorselBilgi: 'PNG, JPEG ya da WEBP — en fazla 2 MB.',
    urunLinki: 'Ürün linki / Datasheet',
    linkPlaceholder: 'https://www.direnc.net/... , robotistan.com/... ya da motorobit.com/...',
    cekiliyor: 'Çekiliyor…',
    linktenCek: 'Linkten çek',
    cekilemedi: 'Çekilemedi.',
    cekildi: 'Çekildi — aşağıdaki alanları kontrol edip kaydedebilirsin.',
    linkBilgi:
      'Direnç.net / Robotistan / Motorobit ürün linki yapıştırıp "Linkten çek" ile aşağıdaki alanları otomatik doldurabilirsin. Ayarlar\'dan ücretsiz bir Gemini API anahtarı eklersen bu, herhangi bir satıcının ürün linkinde de çalışır.',
    mpn: 'MPN — parça numarası *',
    uretici: 'Üretici',
    kilif: 'Kılıf',
    aciklama: 'Açıklama',
    aciklamaPlaceholder: 'Direnç 10 kΩ ±1% 1/8 W',
    kategori: 'Kategori',
    secilmedi: 'seçilmedi',
    konum: 'Konum',
    konumsuz: 'konumsuz',
    uyumluluk: 'Uyumluluk',
    bilinmiyor: 'Bilinmiyor',
    adet: 'Adet',
    adetDegismez: 'Adet burada değişmez — listedeki +/− ile ayarlanır.',
    minSeviye: 'Minimum seviye',
    tedarikci: 'Tedarikçi',
    tedarikciKodu: 'Tedarikçi kodu',
    sonAlimFiyati: 'Son alım fiyatı',
    birim: 'Birim',
    parametreler: 'Parametreler',
    parametrelerPlaceholder: 'Çekirdek: ARM Cortex-M3\nFrekans: 72 MHz\nFlash: 64 KB',
    parametrelerBilgi: 'Her satıra bir tane: "Anahtar: Değer".',
    guncelle: 'Güncelle',
  },

  lcsc: {
    lcscdenCek: "LCSC'den çek",
    cekiliyor: 'Çekiliyor…',
    cek: 'Çek',
  },

  proje: {
    projeyeEkle: '+ Projeye ekle',
    yeniProje: '+ Yeni proje…',
    projeAdi: 'Proje adı',
    adet: 'Adet',
    referans: 'Referans (R12, C4…)',
    ekleniyor: 'Ekleniyor…',
  },

  etiketler: {
    baslik: 'ETİKETLER',
    kaldir: (ad: string) => `${ad} etiketini kaldır`,
    yok: 'Henüz etiket yok.',
    ekle: '+ etiket ekle',
  },

  sohbet: {
    izledigin: (ad: string) => `İzlediğin depo: ${ad}`,
    asistan: 'LabStock Asistanı',
    giris:
      'Depon hakkında soru sor — stokta ne var, nerede, ya da bir şey yoksa yerine ne kullanabileceğini öğren.',
    ornekler: ["12V'u 5V'a düşüren bir şeyim var mı?", 'Kaç tane ESP32 modülüm var, nerede?', 'Elimde röle sürmek için ne var?'],
    yeniSohbet: 'Yeni sohbet',
    yeniSohbetOnay: 'Bu konuşma silinsin ve yeni bir sohbet başlasın mı?',
    placeholder: 'Depon hakkında bir şey sor…',
    cevapAlinamadi: 'Cevap alınamadı.',
    bosMesaj: 'Boş mesaj.',
    oturumYok: 'Oturum bulunamadı.',
    anahtarYok: 'Sohbet için önce Ayarlar sayfasından ücretsiz bir Gemini ya da Claude API anahtarı ekle.',
  },

  // lib/ai.ts, lib/gemini.ts, lib/claude.ts
  ai: {
    anahtarYok: 'Ayarlar sayfasından ücretsiz bir Gemini ya da Claude API anahtarı eklersen bu özellik çalışır.',
    istekBasarisiz: 'Yapay zeka isteği başarısız.',
    istekBasarisizHttp: (durum: number) => `Yapay zeka isteği başarısız (HTTP ${durum}).`,
    yanitAlinamadi: 'Yapay zeka isteğine yanıt alınamadı.',
    beklenmeyenYanit: (ham: string) => `Yapay zekadan beklenmeyen bir yanıt geldi: ${ham}`,
    yanitOkunamadi: 'Yapay zeka yanıtı okunamadı.',
    metinYok: 'Sayfadan okunabilir bir metin çıkarılamadı.',
    urunYok: 'Sayfadan ürün bilgisi çıkarılamadı.',
    bilinmeyenHata: 'bilinmeyen hata',
    claudeAboneTokeni:
      `Bu bir Claude abonelik (Claude Code) token'ı, API anahtarı değil. console.anthropic.com → API Keys'ten "sk-ant-api03-" ile başlayan bir anahtar oluştur.`,
    claudeYoneticiAnahtari:
      `Bu bir yönetici (Admin) anahtarı; mesaj göndermek için kullanılamaz. console.anthropic.com → API Keys'ten "sk-ant-api03-" ile başlayan normal bir anahtar oluştur.`,
    claudeBicimHatali: `Bu bir Claude API anahtarına benzemiyor — "sk-ant-api03-" ile başlamalı. Anahtarı eksiksiz kopyaladığından emin ol.`,
    claudeGecersizAnahtar:
      `Anthropic bu anahtarı tanımadı (silinmiş, iptal edilmiş ya da eksik kopyalanmış olabilir). console.anthropic.com → API Keys'te anahtarın etkin olduğunu kontrol et ya da yeni bir anahtar oluşturup tamamını kopyala.`,
  },

  // lib/lcsc.ts, lib/direnc.ts, lib/robotistan.ts, lib/motorobit.ts, lib/urun-ld-json.ts
  tedarikci: {
    gecersizBaglanti: 'Geçersiz bağlantı.',
    sadeceSite: (site: string) => `Sadece ${site} ürün bağlantıları kabul edilir.`,
    urunBulunamadi: 'Bu sayfada ürün bilgisi bulunamadı.',
    sayfaAlinamadi: (durum: number) => `Sayfa alınamadı (HTTP ${durum}).`,
    lcscSayfaAlinamadi: (durum: number) => `LCSC sayfası alınamadı (HTTP ${durum}).`,
    lcscUrunYok: (kod: string) => `"${kod}" için LCSC'de ürün bilgisi bulunamadı.`,
  },
};

const en: Sekil<typeof tr> = {
  vazgec: 'Cancel',
  rohsUyumlu: 'RoHS compliant',
  rohsDegil: 'Not RoHS',

  detay: {
    envanter: 'Inventory',
    mpnKopyala: 'Copy part name',
    etiketYazdir: 'Print label',
    datasheet: 'Datasheet',
    lcscdeGor: 'View on LCSC',
    toplamAdet: 'TOTAL QTY',
    projelereAyrilan: 'RESERVED FOR PROJECTS',
    kullanilabilir: 'AVAILABLE',
    minSeviye: (n: string) => `MIN. LEVEL · ${n}`,
    parametreler: 'PARAMETERS',
    hareketGecmisi: 'MOVEMENT HISTORY',
    tumunuGor: (n: number) => `see all (${n})`,
    hareketYok: 'No movements yet.',
    tablo: {
      tarih: 'DATE',
      islem: 'ACTION',
      adet: 'QTY',
      sebepProje: 'REASON / PROJECT',
      sonra: 'AFTER',
    },
    giris: 'In',
    dusuldu: 'Out',
    tedarik: 'SUPPLY',
    sonAlimFiyati: 'Last purchase price:',
    kullanildigiProjeler: 'USED IN PROJECTS',
    proje: 'Project',
    kartBasina: '/ board',
    projedeKullanilmiyor: 'Not used in any project yet.',
  },

  duzenle: {
    baslik: 'Edit part',
    aciklama: (mpn: string) => `${mpn} — update catalog and stock details.`,
  },

  yeni: {
    baslik: 'Add part',
    aciklama:
      'If the MPN is already in the shared catalog, the part is linked to it; otherwise a new catalog entry is created. If you enter a quantity, it is also recorded as a stock movement.',
    lcscEtiketi: 'LCSC label scanned by phone:',
    adet: (n: number) => ` · ${n} pcs`,
    lcscDolduruldu: '. Details were filled in from LCSC; pick a location and save.',
    lcscAlinamadi: 'Could not fetch LCSC details',
  },

  etiketSayfasi: {
    parcayaDon: 'Back to part',
    gorunumAyarla: 'Adjust label appearance',
    aciklama:
      "Print it and stick it on the part's box or drawer. Scanning it with a barcode reader (or pasting it into the app's search box) opens this part's page directly.",
  },

  form: {
    parcaGorseli: 'Part image',
    gorselSec: 'Choose image',
    gorselBilgi: 'PNG, JPEG or WEBP — max 2 MB.',
    urunLinki: 'Product link / Datasheet',
    linkPlaceholder: 'https://www.direnc.net/... , robotistan.com/... or motorobit.com/...',
    cekiliyor: 'Fetching…',
    linktenCek: 'Fetch from link',
    cekilemedi: 'Could not fetch.',
    cekildi: 'Fetched — review the fields below and save.',
    linkBilgi:
      'Paste a Direnç.net / Robotistan / Motorobit product link and use "Fetch from link" to fill in the fields below automatically. If you add a free Gemini API key in Settings, this works with any seller\'s product link too.',
    mpn: 'MPN — part number *',
    uretici: 'Manufacturer',
    kilif: 'Package',
    aciklama: 'Description',
    aciklamaPlaceholder: 'Resistor 10 kΩ ±1% 1/8 W',
    kategori: 'Category',
    secilmedi: 'not selected',
    konum: 'Location',
    konumsuz: 'no location',
    uyumluluk: 'Compliance',
    bilinmiyor: 'Unknown',
    adet: 'Quantity',
    adetDegismez: 'Quantity is not changed here — use +/− in the list.',
    minSeviye: 'Minimum level',
    tedarikci: 'Supplier',
    tedarikciKodu: 'Supplier code',
    sonAlimFiyati: 'Last purchase price',
    birim: 'Currency',
    parametreler: 'Parameters',
    parametrelerPlaceholder: 'Core: ARM Cortex-M3\nFrequency: 72 MHz\nFlash: 64 KB',
    parametrelerBilgi: 'One per line: "Key: Value".',
    guncelle: 'Update',
  },

  lcsc: {
    lcscdenCek: 'Fetch from LCSC',
    cekiliyor: 'Fetching…',
    cek: 'Fetch',
  },

  proje: {
    projeyeEkle: '+ Add to project',
    yeniProje: '+ New project…',
    projeAdi: 'Project name',
    adet: 'Qty',
    referans: 'Reference (R12, C4…)',
    ekleniyor: 'Adding…',
  },

  etiketler: {
    baslik: 'TAGS',
    kaldir: (ad: string) => `Remove tag ${ad}`,
    yok: 'No tags yet.',
    ekle: '+ add tag',
  },

  sohbet: {
    izledigin: (ad: string) => `Depot you are viewing: ${ad}`,
    asistan: 'LabStock Assistant',
    giris:
      "Ask about your inventory — what's in stock, where it is, or what you could use instead if something is missing.",
    ornekler: [
      'Do I have anything to step 12V down to 5V?',
      'How many ESP32 modules do I have, and where?',
      'What do I have for driving a relay?',
    ],
    yeniSohbet: 'New chat',
    yeniSohbetOnay: 'Delete this conversation and start a new chat?',
    placeholder: 'Ask something about your inventory…',
    cevapAlinamadi: 'Could not get a response.',
    bosMesaj: 'Empty message.',
    oturumYok: 'Session not found.',
    anahtarYok: 'To use chat, first add a free Gemini or Claude API key on the Settings page.',
  },

  ai: {
    anahtarYok: 'Add a free Gemini or Claude API key on the Settings page to use this feature.',
    istekBasarisiz: 'AI request failed.',
    istekBasarisizHttp: (durum: number) => `AI request failed (HTTP ${durum}).`,
    yanitAlinamadi: 'No response from the AI request.',
    beklenmeyenYanit: (ham: string) => `Unexpected response from the AI: ${ham}`,
    yanitOkunamadi: 'Could not read the AI response.',
    metinYok: 'Could not extract readable text from the page.',
    urunYok: 'Could not extract product details from the page.',
    bilinmeyenHata: 'unknown error',
    claudeAboneTokeni:
      `This is a Claude subscription (Claude Code) token, not an API key. Create a key starting with "sk-ant-api03-" at console.anthropic.com → API Keys.`,
    claudeYoneticiAnahtari:
      `This is an Admin key and cannot send messages. Create a regular key starting with "sk-ant-api03-" at console.anthropic.com → API Keys.`,
    claudeBicimHatali: `This doesn't look like a Claude API key — it should start with "sk-ant-api03-". Make sure you copied the whole key.`,
    claudeGecersizAnahtar:
      `Anthropic didn't recognize this key (it may have been deleted, revoked or copied incompletely). Check that the key is active at console.anthropic.com → API Keys, or create a new one and copy all of it.`,
  },

  tedarikci: {
    gecersizBaglanti: 'Invalid link.',
    sadeceSite: (site: string) => `Only ${site} product links are accepted.`,
    urunBulunamadi: 'No product details found on this page.',
    sayfaAlinamadi: (durum: number) => `Could not fetch the page (HTTP ${durum}).`,
    lcscSayfaAlinamadi: (durum: number) => `Could not fetch the LCSC page (HTTP ${durum}).`,
    lcscUrunYok: (kod: string) => `No product details found on LCSC for "${kod}".`,
  },
};

export default { tr, en };
