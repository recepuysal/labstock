// Uygulamanın her yerinde geçen ortak metinler: üst bar, genel butonlar,
// stok durumları, kategori adları, dil seçici.
import type { Sekil } from '../index';

const tr = {
  uygulamaAciklama: 'Elektronik komponent stok ve depo takibi.',
  uygulamaBaslik: 'LabStock — elektronik komponent deposu',
  ustBar: {
    sohbet: 'Sohbet',
    alinacaklar: 'Alınacaklar',
    parcaEkle: 'Parça ekle',
    ayarlar: 'Ayarlar',
    profil: 'Profil',
    bagliHesap: 'bağlı hesap',
    izledigin: 'izlediğin depo',
  },
  buton: {
    kaydet: 'Kaydet',
    iptal: 'İptal',
    sil: 'Sil',
    duzenle: 'Düzenle',
    kapat: 'Kapat',
    geri: 'Geri',
    envantereDon: 'Envantere dön',
    kopyala: 'Kopyala',
    kopyalandi: 'Kopyalandı',
    yazdir: 'Yazdır',
    gonder: 'Gönder',
    ekle: 'Ekle',
    tamam: 'Tamam',
    yukleniyor: 'Yükleniyor…',
    kaydediliyor: 'Kaydediliyor…',
  },
  durum: {
    yeterli: 'Yeterli',
    az: 'Az kaldı',
    kritik: 'Kritik',
    yok: 'Tükendi',
  },
  sebep: {
    manuel: 'Manuel',
    giris: 'Giriş',
    ice_aktarma: 'İçe aktarma',
    sayim: 'Sayım',
  },
  dil: {
    baslik: 'Dil',
    aciklama: 'Uygulamanın arayüz dili.',
    tr: 'Türkçe',
    en: 'English',
  },
  hata: {
    genel: 'Bir şeyler ters gitti. Lütfen tekrar dene.',
    oturumYok: 'Oturum bulunamadı. Lütfen tekrar giriş yap.',
    saltOkunur: 'İzleme modunda değişiklik yapılamaz.',
  },
};

const en: Sekil<typeof tr> = {
  uygulamaAciklama: 'Inventory and storage tracking for electronic components.',
  uygulamaBaslik: 'LabStock — electronic component inventory',
  ustBar: {
    sohbet: 'Chat',
    alinacaklar: 'To buy',
    parcaEkle: 'Add part',
    ayarlar: 'Settings',
    profil: 'Profile',
    bagliHesap: 'linked account',
    izledigin: 'depot you are viewing',
  },
  buton: {
    kaydet: 'Save',
    iptal: 'Cancel',
    sil: 'Delete',
    duzenle: 'Edit',
    kapat: 'Close',
    geri: 'Back',
    envantereDon: 'Back to inventory',
    kopyala: 'Copy',
    kopyalandi: 'Copied',
    yazdir: 'Print',
    gonder: 'Send',
    ekle: 'Add',
    tamam: 'OK',
    yukleniyor: 'Loading…',
    kaydediliyor: 'Saving…',
  },
  durum: {
    yeterli: 'In stock',
    az: 'Low',
    kritik: 'Critical',
    yok: 'Out of stock',
  },
  sebep: {
    manuel: 'Manual',
    giris: 'Stock in',
    ice_aktarma: 'Import',
    sayim: 'Count',
  },
  dil: {
    baslik: 'Language',
    aciklama: 'The language of the app interface.',
    tr: 'Türkçe',
    en: 'English',
  },
  hata: {
    genel: 'Something went wrong. Please try again.',
    oturumYok: 'Session not found. Please sign in again.',
    saltOkunur: 'Changes are not allowed in viewer mode.',
  },
};

export default { tr, en };
