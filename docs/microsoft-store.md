# Microsoft Store'a yayınlama

Store sürümü MSIX paketi olarak gönderilir; Microsoft paketi kendisi imzalar, bu
yüzden SmartScreen "bilinmeyen yayımcı" uyarısı çıkmaz ve sertifika parası
ödenmez. Güncellemeleri Store yapar (`process.windowsStore` iken uygulamanın
GitHub güncelleyicisi kapalıdır — `electron-app/main.js`).

## 1. Hesap (bir kez — senin yapacağın)

1. https://storedeveloper.microsoft.com → **Get started** → bireysel geliştirici
   hesabı (ücretsiz). Kimlik kartı fotoğrafı + selfie ile doğrulama.
2. Partner Center → **Apps and games → New product → MSIX or PWA app** →
   adı **LabStock** olarak ayırt (rezerve et).
3. **Product identity** sayfasındaki üç değeri `electron-app/package.json` →
   `build.appx` içine yaz (şu an yer tutucu duruyor):

   | Partner Center | package.json |
   | --- | --- |
   | Package/Identity/Name | `identityName` |
   | Package/Identity/Publisher (`CN=...`) | `publisher` |
   | Package/Properties/PublisherDisplayName | `publisherDisplayName` |

## 2. Paketi üretmek

```bash
npm run build:desktop
cd electron-app
npx electron-builder --win appx --publish never   # dist/LabStock-Store.appx
```

Bu paket yerelde imzasızdır, çift tıklayıp kurulamaz — doğrudan Partner
Center'a yüklenir, Microsoft imzalar.

## 3. Gönderim (submission) alanları

- **Kategori:** Productivity (ikincil: Developer tools)
- **Fiyat:** Free
- **Gizlilik politikası URL'i:**
  https://github.com/recepuysal/labstock/blob/master/PRIVACY.md
- **Destek iletişimi:** labstockassistant@gmail.com
- **Web sitesi:** https://github.com/recepuysal/labstock
- **Yaş derecelendirmesi (IARC):** şiddet/cinsellik/kumar yok; kullanıcılar
  arası iletişim yok (gözlemci salt-okunur); kişisel bilgi toplanıyor (e-posta
  hesabı) → genelde "3+ / Everyone" çıkar.
- **Capabilities sorusu:** `runFullTrust` electron-builder tarafından eklenir;
  gerekçe: "Electron desktop app; runs a local server for the UI and a local
  network server for the optional phone-camera feature."
- **Ekran görüntüleri** (en az 1366×768): `docs/screenshots/` içindeki
  `-en` görseller İngilizce listeleme, eki olmayanlar Türkçe listeleme için:
  hero, envanter-izgara, parca-detay, sohbet-asistani, etiket-qr, aktiviteler.
- **Store logosu:** `electron-app/build/appx/` (paketle birlikte gider);
  listeleme için 1:1 görsel istenirse `labstock-a1-logo/png/isaret-1024-krem.png`.

## 4. Listeleme metinleri

### English (en-US)

**Short description**
Free inventory app for electronic components — know which drawer every part is
in. QR labels, LCSC auto-fill, AI assistant and phone-camera counting.

**Description**
Never ask "which drawer was that resistor in?" again.

LabStock maps your electronic components to their physical locations — room,
cabinet, drawer, compartment — so you can find any part in seconds. It's built
for makers, labs, R&D teams and small production workshops.

• Location tree with counts, list and grid views, filters by category, package,
status and tag
• Part pages with parameters, movement history, supplier info and price
• Paste an LCSC code or a shop link and the part form fills itself
• Printable QR labels for parts and locations; scan with a USB barcode reader
• Chat assistant: ask "Do I have something that steps 12 V down to 5 V?" and get
an answer from your real stock
• Count parts with your phone camera — no app to install on the phone
• Excel import and export
• Share your inventory read-only with colleagues or students
• Weekly summary and backup email
• Dark and light themes, English and Turkish interface

Free to use for personal and commercial purposes. No ads, no tracking.

**Features** (her biri ayrı satır)
- Location tree: room › cabinet › drawer › compartment
- Fetch part data from an LCSC code or a shop link
- Printable QR labels for parts and locations
- AI chat assistant that answers from your real stock
- Count parts with your phone camera
- Excel import and export
- Read-only sharing with viewers
- Weekly summary and backup email
- Dark and light theme
- English and Turkish interface

**Keywords** (en fazla 7)
inventory, electronic components, stock, LCSC, QR labels, parts, workshop

### Türkçe (tr-TR)

**Kısa açıklama**
Elektronik komponent deposu için ücretsiz stok takip uygulaması — her parçanın
hangi çekmecede olduğunu bil. QR etiket, LCSC'den çekme, yapay zekâ asistanı ve
telefon kamerasıyla sayım.

**Açıklama**
"O direnç hangi çekmecedeydi?" sorusuna son.

LabStock elektronik komponentlerini fiziksel konumlarıyla — oda, dolap, çekmece,
bölme — eşleştirir; aradığın parçayı saniyeler içinde bulursun. Hobiciler,
laboratuvarlar, ARGE ekipleri ve küçük üretim atölyeleri için.

• Adet rozetli konum ağacı, liste ve ızgara görünümü; kategori, kılıf, durum ve
etikete göre filtreleme
• Parametreler, hareket geçmişi, tedarik bilgisi ve fiyatla parça sayfaları
• LCSC kodunu ya da bir mağaza linkini yapıştır, form kendiliğinden dolsun
• Parça ve konumlar için yazdırılabilir QR etiketler; USB barkod okuyucu desteği
• Sohbet asistanı: "12V'u 5V'a düşüren bir şeyim var mı?" diye sor, gerçek
stoğuna bakarak cevaplasın
• Telefon kamerasıyla parça sayımı — telefona uygulama kurmadan
• Excel ile içe ve dışa aktarma
• Depoyu meslektaşlarınla ya da öğrencilerinle salt-okunur paylaş
• Haftalık özet ve yedek e-postası
• Koyu ve açık tema, Türkçe ve İngilizce arayüz

Kişisel ve ticari kullanım için ücretsiz. Reklam yok, izleme yok.

**Özellikler**
- Konum ağacı: oda › dolap › çekmece › bölme
- LCSC kodundan ya da mağaza linkinden parça bilgisi çekme
- Parça ve konumlar için yazdırılabilir QR etiketler
- Gerçek stoğuna bakarak cevap veren yapay zekâ asistanı
- Telefon kamerasıyla parça sayımı
- Excel ile içe ve dışa aktarma
- Gözlemcilerle salt-okunur paylaşım
- Haftalık özet ve yedek e-postası
- Koyu ve açık tema
- Türkçe ve İngilizce arayüz

**Anahtar kelimeler**
stok takip, envanter, elektronik komponent, LCSC, QR etiket, depo, atölye
