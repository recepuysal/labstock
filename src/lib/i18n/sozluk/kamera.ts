// Telefon kamerası istasyonu (kamera-istasyonu.tsx) ve kamera sunucu eylemlerinin
// (envanter/kamera-actions.ts) metinleri. `en`, `tr` ile aynı şekle sahip olmalı.
//
// Not: Telefon sayfası (electron-app/kamera/telefon.html) ve Electron ana süreci bu
// dosyayı içe aktaramaz; kendi küçük tr/en tablolarını tutarlar.
import type { Sekil } from '../index';

const tr = {
  istasyon: {
    dugme: {
      kapali: 'Telefon kamerası',
      bekleniyor: 'Telefon bekleniyor',
      bagliSayim: 'Telefon bağlı · Sayım',
      bagli: 'Telefon bağlı',
      ipucu: 'Telefon kamerasıyla QR okuma ve parça sayımı',
    },
    baslik: 'Telefon kamerası',
    kapat: 'Kapat',
    aciklama:
      "Telefonun kamerasıyla QR etiketi okut, masaya döktüğün parçaları say ve tek dokunuşla stoğa işle. Telefon ve bilgisayar aynı Wi-Fi'da olmalı.",
    ac: 'Aç',
    aciliyor: 'Açılıyor…',
    baslatilamadi: 'Başlatılamadı',
    qrAlt: 'Telefon için eşleşme QR kodu',
    adim1: 'Telefonun kamerasıyla bu QR kodu okut.',
    adim2On: '"Bu bağlantı gizli değil" uyarısında: ',
    adim2Vurgu: 'Ayrıntılar → bu web sitesini ziyaret et',
    adim2Son: '.',
    adim3On: "İstersen Safari'de ",
    adim3Vurgu: 'Paylaş → Ana Ekrana Ekle',
    adim3Son: ' de; sonraki seferler ana ekrandan açarsın.',
    guvenlikDuvari: "Windows güvenlik duvarı sorarsa LabStock'a özel ağlarda izin ver. Adres: {adres}",
    onizlemeAlt: 'Telefon kamerası önizleme',
    yayiniBaslat: 'Telefonda yayını başlat',
    adet: '{adet} adet',
    sayimModu: "Sayım modu: telefondan QR okut ya da parça ara, sabitle, LabStock'a yaz.",
    kameraModu: 'Kamera modu. Telefonda “Sayım”a geç.',
    eslesmeyiSifirla: 'Eşleşmeyi sıfırla',
    eslesmeSifirlansinMi: 'Eşleşme sıfırlansın mı? Bağlı telefonlar QR kodu yeniden okutmak zorunda kalacak.',
    bildirimiKapat: 'Bildirimi kapat',
  },
  // Telefona gönderilen mesajlar
  telefon: {
    nesneYok: 'Dokunduğun yerde bir nesne bulunamadı; tekrar dene',
    olcekAlindi: 'Ölçek alındı: {ad} ({pxMm} piksel/mm)',
    ogretildiOlceksiz: 'Öğretildi (ölçek olmadığı için sadece bu sayımda geçerli)',
    onceOlcek: 'Önce ölçek ayarla',
    referans: 'Referans',
    // public/kamera/sayim.js'in Türkçe uyarısı; telefona seçili dilde gider
    parcalarDegiyor: 'Parçalar birbirine değiyor ya da üst üste: biraz dağıt',
  },
  toast: {
    etikettenGiris: 'ETİKETTEN GİRİŞ',
    etikettenGirisHata: 'ETİKETTEN GİRİŞ YAPILAMADI',
    kameraSayimi: 'KAMERA SAYIMI',
    kameraSayimiHata: 'KAMERA SAYIMI YAZILAMADI',
    degismedi: '{mpn}: {yeni} (değişmedi)',
  },
  hata: {
    gecersizQr: 'Geçersiz QR kodu',
    oturumYok: "LabStock'ta oturum açık değil",
    parcaYok: 'Bu parça senin deponda yok',
    konumYok: 'Bu konum senin deponda yok',
    etikettePKoduYok: 'Etikette parça kodu yok',
    gecersizEtiket: 'Geçersiz etiket',
    gecersizParca: 'Geçersiz parça',
    gecersizAdet: 'Geçersiz adet',
    etiketIslenmis: 'Bu etiket daha önce işlenmiş',
  },
  konum: 'Konum',
};

const en: Sekil<typeof tr> = {
  istasyon: {
    dugme: {
      kapali: 'Phone camera',
      bekleniyor: 'Waiting for phone',
      bagliSayim: 'Phone connected · Count',
      bagli: 'Phone connected',
      ipucu: 'Scan QR codes and count parts with your phone camera',
    },
    baslik: 'Phone camera',
    kapat: 'Close',
    aciklama:
      'Scan QR labels with your phone camera, count parts spread on the table and update stock with one tap. The phone and computer must be on the same Wi-Fi.',
    ac: 'Open',
    aciliyor: 'Opening…',
    baslatilamadi: 'Could not start',
    qrAlt: 'Pairing QR code for the phone',
    adim1: "Scan this QR code with your phone's camera.",
    adim2On: 'At the "This connection is not private" warning: ',
    adim2Vurgu: 'Show Details → visit this website',
    adim2Son: '.',
    adim3On: 'Optionally, in Safari tap ',
    adim3Vurgu: 'Share → Add to Home Screen',
    adim3Son: ' to open it from your home screen next time.',
    guvenlikDuvari: 'If Windows Firewall asks, allow LabStock on private networks. Address: {adres}',
    onizlemeAlt: 'Phone camera preview',
    yayiniBaslat: 'Start the stream on the phone',
    adet: '{adet} pcs',
    sayimModu: 'Count mode: scan a QR or search for a part on the phone, lock, save to LabStock.',
    kameraModu: 'Camera mode. Switch to “Count” on the phone.',
    eslesmeyiSifirla: 'Reset pairing',
    eslesmeSifirlansinMi: 'Reset pairing? Connected phones will have to scan the QR code again.',
    bildirimiKapat: 'Close notification',
  },
  telefon: {
    nesneYok: 'No object found where you tapped; try again',
    olcekAlindi: 'Scale set: {ad} ({pxMm} pixels/mm)',
    ogretildiOlceksiz: 'Learned (no scale set, so valid for this count only)',
    onceOlcek: 'Set a scale first',
    referans: 'Reference',
    parcalarDegiyor: 'Parts are touching or overlapping: spread them out a bit',
  },
  toast: {
    etikettenGiris: 'STOCK IN FROM LABEL',
    etikettenGirisHata: 'STOCK IN FROM LABEL FAILED',
    kameraSayimi: 'CAMERA COUNT',
    kameraSayimiHata: 'CAMERA COUNT NOT SAVED',
    degismedi: '{mpn}: {yeni} (unchanged)',
  },
  hata: {
    gecersizQr: 'Invalid QR code',
    oturumYok: 'Not signed in to LabStock',
    parcaYok: 'This part is not in your inventory',
    konumYok: 'This location is not in your inventory',
    etikettePKoduYok: 'The label has no part number',
    gecersizEtiket: 'Invalid label',
    gecersizParca: 'Invalid part',
    gecersizAdet: 'Invalid quantity',
    etiketIslenmis: 'This label has already been processed',
  },
  konum: 'Location',
};

export default { tr, en };
