// Envanter alanının metinleri: ana liste, filtreler, konum ağacı/formları,
// alınacaklar, aktiviteler, etiketler, Excel içe/dışa aktarma ve bunların
// server action hata mesajları. `en`, `tr` ile aynı şekle sahip olmalı.
import type { Sekil } from '../index';

const tr = {
  vazgec: 'Vazgeç',

  /** Stok durumu rozetleri (envanter görünümü). */
  durum: {
    yeterli: 'Yeterli',
    az: 'Az kaldı',
    kritik: 'Kritik',
    yok: 'Tükendi',
  },

  alinacakDurum: {
    bekliyor: 'Bekliyor',
    siparis_verildi: 'Sipariş verildi',
    alindi: 'Alındı',
  },

  /** Konum tipleri veritabanında Türkçe saklanır; anahtarlar kayıtlı değerdir. */
  konumTipi: {
    Oda: 'Oda',
    Dolap: 'Dolap',
    Çekmece: 'Çekmece',
    Raf: 'Raf',
    Kutu: 'Kutu',
    Bölme: 'Bölme',
  },
  /** Sayıdan sonra (Türkçede tekil kalır). */
  konumTipiCogul: {
    Oda: 'Oda',
    Dolap: 'Dolap',
    Çekmece: 'Çekmece',
    Raf: 'Raf',
    Kutu: 'Kutu',
    Bölme: 'Bölme',
  },
  konumGenel: 'konum',
  konumGenelCogul: 'konum',

  zaman: {
    azOnce: 'az önce',
    dkOnce: (n: number) => `${n} dk önce`,
    saOnce: (n: number) => `${n} sa önce`,
    gunOnce: (n: number) => `${n} gün önce`,
  },

  /** stock_movements.aciklama'ya yazılan sabit metinler (gösterirken çevrilir). */
  hareket: {
    elleGiris: 'elle giriş',
    ilkGiris: 'ilk giriş',
    iceAktarma: 'Excel/CSV içe aktarma',
    kameraSayimi: (adet: string) => `Kamera sayımı: ${adet} adet`,
    tedarikciEtiketi: 'Tedarikçi etiketi',
  },

  liste: {
    depo: 'Depo',
    tumEnvanter: 'Tüm envanter',
    kayitAdet: (kayit: number, adet: string) => `${kayit} kayıt · ${adet} adet`,
    ilk: (n: number) => ` (ilk ${n})`,
    yuklenemedi: 'Liste yüklenemedi:',
    bosBaslik: 'Depon henüz boş',
    bosIzleyen: 'İzlediğin depo henüz boş.',
    bosAciklama:
      'Önce bir konum oluştur (oda, dolap, çekmece — ne istersen) ya da doğrudan ilk parçanı ekleyebilirsin.',
    konumEkle: 'Konum ekle',
    parcaEkle: 'Parça ekle',
    filtreBos: 'Bu filtreye uyan parça yok.',
    depoBosIzleyen: 'Bu depoda henüz parça yok.',
    depoBos: 'Bu depoda henüz parça yok — sağ üstten ekleyebilirsin.',
    cesitAdet: (cesit: number, adet: string) => `${cesit} çeşit · ${adet} adet`,
    kritik: (n: number) => `${n} kritik`,
    azKaldi: (n: number) => `${n} az kaldı`,
    depoDegeri: 'Toplam depo değeri',
    sonIslem: 'Son işlem',
  },

  filtre: {
    tumKategoriler: 'Tüm kategoriler',
    tumKiliflar: 'Tüm kılıflar',
    tumDurumlar: 'Tüm durumlar',
    tumEtiketler: 'Tüm etiketler',
    temizle: 'Filtreleri temizle ✕',
    listeGorunumu: 'Liste görünümü',
    izgaraGorunumu: 'Izgara görünümü',
    sira: {
      yeni: 'En son güncellenen',
      eski: 'En eski güncellenen',
      ad: 'Ada göre (A-Z)',
      adetAzalan: 'Adet (çoktan aza)',
      adetArtan: 'Adet (azdan çoka)',
    },
  },

  tablo: {
    parca: 'Parça',
    kategori: 'Kategori',
    kilif: 'Kılıf',
    konum: 'Konum',
    adet: 'Adet',
    minDurum: 'Min/Durum',
    konumsuz: 'konumsuz',
    rohsDegil: 'RoHS değil',
    rohsUyumlu: 'RoHS uyumlu',
  },

  satir: {
    birAdetDus: 'Bir adet düş',
    birAdetEkle: 'Bir adet ekle',
    islemler: 'İşlemler',
    silOnay: (mpn: string) => `"${mpn}" stoktan tamamen silinsin mi? Bu işlem geri alınamaz.`,
  },

  hareketHizli: {
    stokDus: '− Stok düş',
    stokEkle: '+ Stok ekle',
    eklemeyiOnayla: 'Eklemeyi onayla',
    dususuOnayla: 'Düşüşü onayla',
    gecersizMiktar: 'Geçerli bir miktar gir.',
  },

  agac: {
    depo: 'DEPO',
    daralt: 'Daralt',
    genislet: 'Genişlet',
    konumYok: 'Henüz konum yok.',
    konumEkle: '+ Konum ekle',
    etiketleriYazdir: 'Etiketleri yazdır',
    konumIslemleri: 'Konum işlemleri',
    konumSilOnay: (ad: string) =>
      `"${ad}" konumu silinsin mi? İçindeki alt konumlar da (varsa) birlikte silinir. Bu konumdaki stok kalemleri silinmez, sadece konumsuz kalır.`,
  },

  konumFormu: {
    ad: 'Ad *',
    adOrnek: 'Dolap A',
    kod: 'Kod',
    tip: 'Tip',
    secilmedi: 'seçilmedi',
    ustKonum: 'Üst konum',
    ustYok: 'yok (en üst seviye)',
    aciklama: 'Açıklama',
    aciklamaOrnek: 'SMD pasif',
    guncelle: 'Güncelle',
    ekleBaslik: 'Konum ekle',
    ekleAciklama:
      'Oda, dolap, çekmece, bölme — istediğin ismi ve derinliği sen belirlersin. Üst konum seçmezsen en üst seviyede (ör. bir oda/atölye) oluşur.',
    duzenleBaslik: 'Konumu düzenle',
    duzenleAciklama: (ad: string) => `${ad} — konum bilgilerini güncelle.`,
  },

  konumDegistir: {
    buton: 'Konum değiştir',
    konumsuz: 'konumsuz',
  },

  konumHaritasi: {
    baslik: 'KONUM',
    atanmamis: 'Bu stok kalemi bir konuma atanmamış.',
    ozet: (ebeveyn: string, sayi: number, tip: string, dolu: number) =>
      `${ebeveyn} · ${sayi} ${tip} · ${dolu} dolu`,
  },

  aktivite: {
    envanter: 'Envanter',
    baslik: 'Son Aktiviteler',
    aciklama: 'Depondaki tüm stok hareketleri, en yeniden eskiye.',
    sonN: (n: number) => ` Son ${n} hareket gösteriliyor.`,
    bos: 'Henüz bir hareket yok.',
    tarih: 'TARİH',
    parca: 'PARÇA',
    islem: 'İŞLEM',
    adet: 'ADET',
    sebepProje: 'SEBEP / PROJE',
    konum: 'KONUM',
    sonra: 'SONRA',
    giris: 'Giriş',
    dusuldu: 'Düşüldü',
  },

  alinacaklar: {
    baslik: 'Alınacaklar',
    aciklama:
      'Envanterden bağımsız, hızlı bir alışveriş notu — malzeme adı, adet, not ve varsa tedarikçi linki.',
    izledigin: (ad: string) => `İzlediğin depo: ${ad}`,
    kendiDepon: 'Kendi depon',
    bos: 'Henüz bir şey eklenmemiş.',
    malzemeDurum: 'Malzeme / Durum',
    adet: 'Adet',
    not: 'Not',
    link: 'Link',
    durum: 'Durum',
    malzemeAdi: 'Malzeme adı *',
    malzemeOrnek: 'Örn. 100nF kondansatör',
    notOrnek: "Örn. Mouser'dan al",
    ekle: '+ Ekle',
    sonrakiDurum: 'Sonraki duruma geçir',
    malzemeKopyala: 'Malzeme adını kopyala',
    baglantiKopyala: 'Bağlantıyı kopyala',
    satirIslemleri: 'Satır işlemleri',
    silOnay: (ad: string) => `"${ad}" listeden silinsin mi?`,
    bildirimBaslik: 'ALINACAKLARA EKLENDİ',
    bildirimKapat: 'Bildirimi kapat',
    birIzleyicin: 'Bir izleyicin',
  },

  etiketler: {
    ayarla: 'Etiket görünümünü ayarla',
    baslik: 'Konum etiketleri',
    aciklama:
      'Yazdır, kes, çekmecelere/raflara yapıştır. Bir barkod okuyucuyla taradığında (ya da arama kutusuna elle yapıştırdığında) doğrudan o konumdaki parçalar açılır.',
    bos: 'Henüz bir konum yok.',
  },

  iceAktar: {
    baslik: "Excel'den içe aktar",
    aciklama:
      'İlk satırı başlık olan bir Excel/CSV dosyası yükle — sütunları otomatik tanır (MPN, Üretici, Açıklama, Kategori, Kılıf, Adet, Min. seviye, Tedarikçi, Tedarikçi kodu, Konum). MPN katalogda varsa parça ona bağlanır, yoksa yeni katalog kaydı açılır.',
    dosya: 'Excel (.xlsx) veya CSV dosyası *',
    isleniyor: 'İşleniyor…',
    iceAktar: 'İçe aktar',
    sonuc: 'Sonuç',
    toplam: 'Toplam satır:',
    yeniParca: 'Yeni katalog parçası:',
    yeniStok: 'Yeni stok kalemi oluşturuldu:',
    guncellenen: 'Mevcut stoğa eklendi:',
    atlanan: 'Atlanan (hata):',
    hataOrnekleri: 'Hata örnekleri',
  },

  disaAktar: {
    baslik: 'DIŞA AKTARMA',
    aciklama: 'Tüm envanteri (parça, stok, konum ve etiket bilgileriyle) Excel dosyası olarak indir.',
    hazirlaniyor: 'Hazırlanıyor…',
    indir: 'Excel olarak indir',
    hata: 'Dışa aktarılamadı.',
  },

  gorunum: {
    baslik: 'Görüntülenen depo',
    benimDepom: 'Benim Depom',
  },

  arama: {
    yerTutucu: 'Parça, MPN, açıklama ara…',
  },

  bilgi: {
    eklendi: 'Eklendi.',
    guncellendi: 'Güncellendi.',
    konumGuncellendi: 'Konum güncellendi.',
  },

  hata: {
    oturumYok: 'Oturum bulunamadı.',
    gecersizKayit: 'Geçersiz kayıt.',
    gecersizKonum: 'Geçersiz konum.',
    gecersizParca: 'Geçersiz parça.',
    malzemeAdiGerekli: 'Malzeme adı gerekli.',
    adetGecersiz: 'Adet geçersiz.',
    adZorunlu: 'Ad zorunlu.',
    kendiUstu: 'Bir konum kendi üst konumu olamaz.',
    mpnZorunlu: 'MPN (parça numarası) zorunlu.',
    minGecersiz: 'Minimum seviye geçersiz.',
    fiyatGecersiz: 'Alım fiyatı geçersiz.',
    gorselTur: 'Görsel sadece PNG, JPEG ya da WEBP olabilir.',
    gorselBoyut: 'Görsel en fazla 2 MB olabilir.',
    gorselYuklenemedi: (mesaj: string) => `Görsel yüklenemedi: ${mesaj}`,
    katalogdaVar: (parca: string) => `${parca} zaten katalogda kayıtlı.`,
    katalogdaBaska: (parca: string) => `${parca} zaten katalogda başka bir parça olarak kayıtlı.`,
    parcaOlusturulamadi: 'Parça oluşturulamadı.',
    ayniKonumda:
      'Bu parça seçtiğin konumda zaten kayıtlı görünüyor — orada bu parçanın başka bir stok satırı var.',
    projeSec: 'Bir proje seç ya da yeni proje adı gir.',
    lcscKoduGerekli: 'LCSC kodu gerekli (ör. C25804).',
    lcscAlinamadi: 'LCSC verisi alınamadı.',
    bilinmeyen: 'bilinmeyen hata',
    ceviriUyarisi: (mesaj: string) => `LCSC verileri çekildi, ancak açıklama Türkçeye çevrilemedi: ${mesaj}`,
    lcscUreticiCakisma: (uretici: string) =>
      `LCSC'den gelen üretici ("${uretici}") bu MPN için katalogda başka bir parçada zaten kayıtlı. O parçayla birleştirmek için önce onu düzenleyip kaydı temizlemen gerekiyor.`,
    baglantiGerekli: 'Bağlantı gerekli.',
    cekilemedi: 'Çekilemedi.',
    gecersizBaglanti: 'Geçersiz bağlantı.',
    siteDesteklenmiyor:
      'Bu site için hazır destek yok. Ayarlar sayfasından ücretsiz bir Gemini ya da Claude API anahtarı eklersen artık her siteden çekebilirsin.',
    sayfaAlinamadi: (durum: number) => `Sayfa alınamadı (HTTP ${durum}).`,
    etiketAdiGerekli: 'Etiket adı gerekli.',
    dosyaSec: 'Bir dosya seç.',
    dosyaOkunamadi: 'Dosya okunamadı — geçerli bir Excel (.xlsx) ya da CSV dosyası olmalı.',
    mpnSutunuYok:
      'MPN / Parça No sütunu bulunamadı. İlk satır başlık olmalı ve bir sütun parça numarasını içermeli.',
    satirYok: 'İçe aktarılacak (parça numarası dolu) satır bulunamadı.',
  },
};

const en: Sekil<typeof tr> = {
  vazgec: 'Cancel',

  durum: {
    yeterli: 'In stock',
    az: 'Low',
    kritik: 'Critical',
    yok: 'Out of stock',
  },

  alinacakDurum: {
    bekliyor: 'Pending',
    siparis_verildi: 'Ordered',
    alindi: 'Received',
  },

  konumTipi: {
    Oda: 'Room',
    Dolap: 'Cabinet',
    Çekmece: 'Drawer',
    Raf: 'Shelf',
    Kutu: 'Box',
    Bölme: 'Bin',
  },
  konumTipiCogul: {
    Oda: 'Rooms',
    Dolap: 'Cabinets',
    Çekmece: 'Drawers',
    Raf: 'Shelves',
    Kutu: 'Boxes',
    Bölme: 'Bins',
  },
  konumGenel: 'location',
  konumGenelCogul: 'locations',

  zaman: {
    azOnce: 'just now',
    dkOnce: (n: number) => `${n} min ago`,
    saOnce: (n: number) => `${n} h ago`,
    gunOnce: (n: number) => (n === 1 ? '1 day ago' : `${n} days ago`),
  },

  hareket: {
    elleGiris: 'manual entry',
    ilkGiris: 'initial stock',
    iceAktarma: 'Excel/CSV import',
    kameraSayimi: (adet: string) => `Camera count: ${adet} pcs`,
    tedarikciEtiketi: 'Supplier label',
  },

  liste: {
    depo: 'Inventory',
    tumEnvanter: 'All inventory',
    kayitAdet: (kayit: number, adet: string) =>
      `${kayit} ${kayit === 1 ? 'record' : 'records'} · ${adet} pcs`,
    ilk: (n: number) => ` (first ${n})`,
    yuklenemedi: 'Could not load the list:',
    bosBaslik: 'Your inventory is empty',
    bosIzleyen: 'The inventory you are viewing is empty.',
    bosAciklama:
      'Create a location first (room, cabinet, drawer — whatever you like) or add your first part directly.',
    konumEkle: 'Add location',
    parcaEkle: 'Add part',
    filtreBos: 'No parts match this filter.',
    depoBosIzleyen: 'No parts in this inventory yet.',
    depoBos: 'No parts in this inventory yet — add one from the top right.',
    cesitAdet: (cesit: number, adet: string) => `${cesit} ${cesit === 1 ? 'item' : 'items'} · ${adet} pcs`,
    kritik: (n: number) => `${n} critical`,
    azKaldi: (n: number) => `${n} low`,
    depoDegeri: 'Total inventory value',
    sonIslem: 'Last activity',
  },

  filtre: {
    tumKategoriler: 'All categories',
    tumKiliflar: 'All packages',
    tumDurumlar: 'All statuses',
    tumEtiketler: 'All tags',
    temizle: 'Clear filters ✕',
    listeGorunumu: 'List view',
    izgaraGorunumu: 'Grid view',
    sira: {
      yeni: 'Recently updated',
      eski: 'Oldest updated',
      ad: 'Name (A-Z)',
      adetAzalan: 'Quantity (high to low)',
      adetArtan: 'Quantity (low to high)',
    },
  },

  tablo: {
    parca: 'Part',
    kategori: 'Category',
    kilif: 'Package',
    konum: 'Location',
    adet: 'Qty',
    minDurum: 'Min/Status',
    konumsuz: 'no location',
    rohsDegil: 'Not RoHS',
    rohsUyumlu: 'RoHS compliant',
  },

  satir: {
    birAdetDus: 'Remove one',
    birAdetEkle: 'Add one',
    islemler: 'Actions',
    silOnay: (mpn: string) => `Delete "${mpn}" from stock completely? This cannot be undone.`,
  },

  hareketHizli: {
    stokDus: '− Remove stock',
    stokEkle: '+ Add stock',
    eklemeyiOnayla: 'Confirm add',
    dususuOnayla: 'Confirm removal',
    gecersizMiktar: 'Enter a valid quantity.',
  },

  agac: {
    depo: 'INVENTORY',
    daralt: 'Collapse',
    genislet: 'Expand',
    konumYok: 'No locations yet.',
    konumEkle: '+ Add location',
    etiketleriYazdir: 'Print labels',
    konumIslemleri: 'Location actions',
    konumSilOnay: (ad: string) =>
      `Delete location "${ad}"? Its sub-locations (if any) are deleted too. Stock items here are not deleted; they just become unassigned.`,
  },

  konumFormu: {
    ad: 'Name *',
    adOrnek: 'Cabinet A',
    kod: 'Code',
    tip: 'Type',
    secilmedi: 'not set',
    ustKonum: 'Parent location',
    ustYok: 'none (top level)',
    aciklama: 'Description',
    aciklamaOrnek: 'SMD passives',
    guncelle: 'Update',
    ekleBaslik: 'Add location',
    ekleAciklama:
      'Room, cabinet, drawer, bin — you choose the names and how deep it goes. Without a parent it is created at the top level (e.g. a room/workshop).',
    duzenleBaslik: 'Edit location',
    duzenleAciklama: (ad: string) => `${ad} — update the location details.`,
  },

  konumDegistir: {
    buton: 'Change location',
    konumsuz: 'no location',
  },

  konumHaritasi: {
    baslik: 'LOCATION',
    atanmamis: 'This stock item is not assigned to a location.',
    ozet: (ebeveyn: string, sayi: number, tip: string, dolu: number) =>
      `${ebeveyn} · ${sayi} ${tip} · ${dolu} occupied`,
  },

  aktivite: {
    envanter: 'Inventory',
    baslik: 'Recent Activity',
    aciklama: 'All stock movements in your inventory, newest first.',
    sonN: (n: number) => ` Showing the last ${n} movements.`,
    bos: 'No movements yet.',
    tarih: 'DATE',
    parca: 'PART',
    islem: 'ACTION',
    adet: 'QTY',
    sebepProje: 'REASON / PROJECT',
    konum: 'LOCATION',
    sonra: 'AFTER',
    giris: 'In',
    dusuldu: 'Out',
  },

  alinacaklar: {
    baslik: 'To Buy',
    aciklama:
      'A quick shopping list, separate from the inventory — item name, quantity, note and an optional supplier link.',
    izledigin: (ad: string) => `Viewing inventory: ${ad}`,
    kendiDepon: 'Your own inventory',
    bos: 'Nothing added yet.',
    malzemeDurum: 'Item / Status',
    adet: 'Qty',
    not: 'Note',
    link: 'Link',
    durum: 'Status',
    malzemeAdi: 'Item name *',
    malzemeOrnek: 'e.g. 100nF capacitor',
    notOrnek: 'e.g. Buy from Mouser',
    ekle: '+ Add',
    sonrakiDurum: 'Move to next status',
    malzemeKopyala: 'Copy item name',
    baglantiKopyala: 'Copy link',
    satirIslemleri: 'Row actions',
    silOnay: (ad: string) => `Remove "${ad}" from the list?`,
    bildirimBaslik: 'ADDED TO TO-BUY LIST',
    bildirimKapat: 'Dismiss notification',
    birIzleyicin: 'One of your viewers',
  },

  etiketler: {
    ayarla: 'Adjust label appearance',
    baslik: 'Location labels',
    aciklama:
      'Print, cut and stick them on drawers/shelves. Scanning one with a barcode reader (or pasting it into the search box) opens the parts at that location.',
    bos: 'No locations yet.',
  },

  iceAktar: {
    baslik: 'Import from Excel',
    aciklama:
      'Upload an Excel/CSV file whose first row is the header — columns are detected automatically (MPN, Manufacturer, Description, Category, Package, Quantity, Min. qty, Supplier, Supplier code, Location). If the MPN is already in the catalog the part is linked to it; otherwise a new catalog entry is created.',
    dosya: 'Excel (.xlsx) or CSV file *',
    isleniyor: 'Processing…',
    iceAktar: 'Import',
    sonuc: 'Result',
    toplam: 'Total rows:',
    yeniParca: 'New catalog parts:',
    yeniStok: 'New stock items created:',
    guncellenen: 'Added to existing stock:',
    atlanan: 'Skipped (error):',
    hataOrnekleri: 'Sample errors',
  },

  disaAktar: {
    baslik: 'EXPORT',
    aciklama: 'Download the whole inventory (with part, stock, location and tag details) as an Excel file.',
    hazirlaniyor: 'Preparing…',
    indir: 'Download as Excel',
    hata: 'Export failed.',
  },

  gorunum: {
    baslik: 'Inventory being viewed',
    benimDepom: 'My Inventory',
  },

  arama: {
    yerTutucu: 'Search parts, MPN, description…',
  },

  bilgi: {
    eklendi: 'Added.',
    guncellendi: 'Updated.',
    konumGuncellendi: 'Location updated.',
  },

  hata: {
    oturumYok: 'Session not found.',
    gecersizKayit: 'Invalid record.',
    gecersizKonum: 'Invalid location.',
    gecersizParca: 'Invalid part.',
    malzemeAdiGerekli: 'Item name is required.',
    adetGecersiz: 'Invalid quantity.',
    adZorunlu: 'Name is required.',
    kendiUstu: 'A location cannot be its own parent.',
    mpnZorunlu: 'MPN (part number) is required.',
    minGecersiz: 'Invalid minimum level.',
    fiyatGecersiz: 'Invalid purchase price.',
    gorselTur: 'Image must be PNG, JPEG or WEBP.',
    gorselBoyut: 'Image can be at most 2 MB.',
    gorselYuklenemedi: (mesaj: string) => `Image upload failed: ${mesaj}`,
    katalogdaVar: (parca: string) => `${parca} is already in the catalog.`,
    katalogdaBaska: (parca: string) => `${parca} is already in the catalog as a different part.`,
    parcaOlusturulamadi: 'Could not create the part.',
    ayniKonumda:
      'This part already seems to be stored at the selected location — there is another stock row for it there.',
    projeSec: 'Select a project or enter a new project name.',
    lcscKoduGerekli: 'LCSC code is required (e.g. C25804).',
    lcscAlinamadi: 'Could not fetch LCSC data.',
    bilinmeyen: 'unknown error',
    ceviriUyarisi: (mesaj: string) =>
      `LCSC data was fetched, but the description could not be translated to Turkish: ${mesaj}`,
    lcscUreticiCakisma: (uretici: string) =>
      `The manufacturer from LCSC ("${uretici}") is already registered on another catalog part with this MPN. To merge them, edit that part and clean up the record first.`,
    baglantiGerekli: 'A link is required.',
    cekilemedi: 'Could not fetch.',
    gecersizBaglanti: 'Invalid link.',
    siteDesteklenmiyor:
      'This site is not supported out of the box. Add a free Gemini or Claude API key in Settings to fetch from any site.',
    sayfaAlinamadi: (durum: number) => `Could not load the page (HTTP ${durum}).`,
    etiketAdiGerekli: 'Tag name is required.',
    dosyaSec: 'Choose a file.',
    dosyaOkunamadi: 'Could not read the file — it must be a valid Excel (.xlsx) or CSV file.',
    mpnSutunuYok:
      'No MPN / Part No column found. The first row must be the header and one column must contain the part number.',
    satirYok: 'No rows to import (with a part number) were found.',
  },
};

export default { tr, en };
