import { sozluk, yerel, type Dil } from './i18n';

export type Durum = 'yeterli' | 'az' | 'kritik' | 'yok';

/** Bir isim/e-posta'dan avatar baş harflerini üretir (ör. "Recep Uysal" -> "RU"). */
export function basHarfleri(kaynak: string, dil: Dil = 'tr'): string {
  const parcalar = kaynak.trim().split(/[\s.@_-]+/).filter(Boolean);
  const harfler = parcalar.slice(0, 2).map((p) => p[0]);
  return harfler.join('').toLocaleUpperCase(yerel(dil)) || '··';
}

export type EnvanterSatiri = {
  stok_id: string;
  adet: number;
  min_adet: number;
  birim: string;
  tedarikci: string | null;
  tedarikci_kodu: string | null;
  alis_fiyati: number | null;
  para_birimi: string;
  updated_at: string;
  part_id: string;
  mpn: string;
  uretici: string | null;
  aciklama: string | null;
  kategori: string | null;
  kilif: string | null;
  datasheet_url: string | null;
  parametreler: Record<string, string>;
  rohs: boolean | null;
  resim_url: string | null;
  konum_id: string | null;
  konum_kodu: string | null;
  konum_adi: string | null;
  durum: Durum;
};

export type Konum = {
  id: string;
  parent_id: string | null;
  ad: string;
  kod: string | null;
  tip: string | null;
  aciklama: string | null;
  sira: number;
};

export const KONUM_TIPLERI = ['Oda', 'Dolap', 'Çekmece', 'Raf', 'Kutu', 'Bölme'] as const;

/** Konum tipi -> rozet rengi (globals.css'teki .rozet-* sınıflarıyla eşleşir). */
/** Kayıtlı (Türkçe) konum tipini arayüz dilinde gösterir; `adet` verilirse
 * sayıya uygun (İngilizcede çoğul) biçim döner. Bilinmeyen tipler olduğu gibi kalır. */
export function konumTipiGoster(tip: string, dil: Dil = 'tr', adet?: number): string {
  const s = sozluk(dil).envanter;
  const tablo: Record<string, string> = adet !== undefined && adet !== 1 ? s.konumTipiCogul : s.konumTipi;
  return tablo[tip] ?? tip;
}

export const KONUM_TIP_RENK: Record<string, string> = {
  Oda: 'mavi',
  Dolap: 'turuncu',
  Çekmece: 'mor',
  Raf: 'yesil',
  Kutu: 'pembe',
  Bölme: 'lacivert',
};

export type KonumDugumu = Konum & { cocuklar: KonumDugumu[] };

export const DURUM_ETIKET: Record<Durum, string> = {
  yeterli: 'Yeterli',
  az: 'Az kaldı',
  kritik: 'Kritik',
  yok: 'Tükendi',
};

/** Stok durumu etiketi arayüz dilinde (DURUM_ETIKET'in dil destekli hali). */
export function durumEtiketi(durum: Durum, dil: Dil = 'tr'): string {
  return sozluk(dil).envanter.durum[durum] ?? durum;
}

export const ALINACAK_DURUMLAR = ['bekliyor', 'siparis_verildi', 'alindi'] as const;
export type AlinacakDurumu = (typeof ALINACAK_DURUMLAR)[number];

export const ALINACAK_DURUM_ETIKET: Record<AlinacakDurumu, string> = {
  bekliyor: 'Bekliyor',
  siparis_verildi: 'Sipariş verildi',
  alindi: 'Alındı',
};

/** Alınacak durumu etiketi arayüz dilinde (ALINACAK_DURUM_ETIKET'in dil destekli hali). */
export function alinacakDurumEtiketi(durum: AlinacakDurumu, dil: Dil = 'tr'): string {
  return sozluk(dil).envanter.alinacakDurum[durum] ?? durum;
}

export const ALINACAK_DURUM_ROZET: Record<AlinacakDurumu, string> = {
  bekliyor: 'rozet-notr',
  siparis_verildi: 'rozet-mavi',
  alindi: 'rozet-yesil',
};

export function agacKur(konumlar: Konum[]): KonumDugumu[] {
  const harita = new Map<string, KonumDugumu>();
  for (const k of konumlar) harita.set(k.id, { ...k, cocuklar: [] });

  const kokler: KonumDugumu[] = [];
  for (const k of harita.values()) {
    const ebeveyn = k.parent_id ? harita.get(k.parent_id) : null;
    if (ebeveyn) ebeveyn.cocuklar.push(k);
    else kokler.push(k);
  }

  const sirala = (liste: KonumDugumu[]) => {
    liste.sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, 'tr'));
    liste.forEach((d) => sirala(d.cocuklar));
  };
  sirala(kokler);

  return kokler;
}

/** Bir konumun ve altındaki tüm konumların id'leri. */
export function altAgacIdleri(kokId: string, konumlar: Konum[]): string[] {
  const cocukHarita = new Map<string, string[]>();
  for (const k of konumlar) {
    if (!k.parent_id) continue;
    const liste = cocukHarita.get(k.parent_id) ?? [];
    liste.push(k.id);
    cocukHarita.set(k.parent_id, liste);
  }

  const sonuc: string[] = [];
  const yigin = [kokId];
  while (yigin.length) {
    const id = yigin.pop()!;
    sonuc.push(id);
    yigin.push(...(cocukHarita.get(id) ?? []));
  }
  return sonuc;
}

export const sayi = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 });

const SAYI_BICIMLERI: Record<Dil, Intl.NumberFormat> = {
  tr: sayi,
  en: new Intl.NumberFormat(yerel('en'), { maximumFractionDigits: 3 }),
};

/** Arayüz diline göre sayı biçimlendirici (`sayi`nın dil destekli hali). */
export function sayiBicimi(dil: Dil = 'tr'): Intl.NumberFormat {
  return SAYI_BICIMLERI[dil];
}

const PARA_SEMBOL: Record<string, string> = { TRY: '₺', USD: '$', EUR: '€' };

export function paraFormatla(tutar: number, birim: string, dil: Dil = 'tr'): string {
  const sembol = PARA_SEMBOL[birim] ?? `${birim} `;
  return `${sembol}${sayiBicimi(dil).format(Math.round(tutar * 100) / 100)}`;
}

/** parts.parametreler (jsonb) <-> "Anahtar: Değer" satırlarından oluşan düzenlenebilir metin. */
export function parametrelerToMetin(p: Record<string, string> | null | undefined): string {
  if (!p) return '';
  return Object.entries(p)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
}

export function metinToParametreler(metin: string): Record<string, string> {
  const sonuc: Record<string, string> = {};
  for (const satir of metin.split('\n')) {
    const i = satir.indexOf(':');
    if (i < 0) continue;
    const anahtar = satir.slice(0, i).trim();
    const deger = satir.slice(i + 1).trim();
    if (anahtar && deger) sonuc[anahtar] = deger;
  }
  return sonuc;
}

/** "3 dk önce", "2 gün önce" gibi göreli zaman; bir aydan eskiyse tarih gösterir. */
export function zamanOnce(iso: string, dil: Dil = 'tr'): string {
  const z = sozluk(dil).envanter.zaman;
  const fark = Date.now() - new Date(iso).getTime();
  const dk = Math.floor(fark / 60000);
  if (dk < 1) return z.azOnce;
  if (dk < 60) return z.dkOnce(dk);
  const saat = Math.floor(dk / 60);
  if (saat < 24) return z.saOnce(saat);
  const gun = Math.floor(saat / 24);
  if (gun < 30) return z.gunOnce(gun);
  return new Date(iso).toLocaleDateString(yerel(dil));
}

/** "14:32" gibi saat:dakika; bugünden eskiyse tarih de ekler. */
export function saatFormatla(iso: string, dil: Dil = 'tr'): string {
  const tarih = new Date(iso);
  const saat = tarih.toLocaleTimeString(yerel(dil), { hour: '2-digit', minute: '2-digit' });
  const bugun = new Date().toDateString() === tarih.toDateString();
  return bugun ? saat : `${tarih.toLocaleDateString(yerel(dil))} ${saat}`;
}

/** stock_movements.sebep -> okunabilir etiket. */
export const SEBEP_ETIKET: Record<string, string> = {
  manuel: 'Manuel',
  giris: 'Giriş',
  ice_aktarma: 'İçe aktarma',
  sayim: 'Sayım',
};

/** stock_movements.sebep -> arayüz dilinde etiket (bilinmeyen sebep olduğu gibi kalır). */
export function sebepEtiketi(sebep: string, dil: Dil = 'tr'): string {
  const tablo: Record<string, string> = sozluk(dil).ortak.sebep;
  return tablo[sebep] ?? sebep;
}

/** stock_movements.aciklama veritabanına Türkçe yazılır (ör. "ilk giriş",
 * "Kamera sayımı: 17 adet"). Bilinen sabit kalıpları arayüz dilinde gösterir;
 * kullanıcının yazdığı ya da tanınmayan metin olduğu gibi kalır. */
export function hareketAciklamasi(aciklama: string, dil: Dil = 'tr'): string {
  if (dil === 'tr') return aciklama;
  const kaynak = sozluk('tr').envanter.hareket;
  const hedef = sozluk(dil).envanter.hareket;
  if (aciklama === kaynak.elleGiris) return hedef.elleGiris;
  if (aciklama === kaynak.ilkGiris) return hedef.ilkGiris;
  if (aciklama === kaynak.iceAktarma) return hedef.iceAktarma;
  const sayim = aciklama.match(/^Kamera sayımı: (.+) adet$/);
  if (sayim) return hedef.kameraSayimi(sayim[1]);
  if (aciklama.startsWith(`${kaynak.tedarikciEtiketi} · `)) {
    return hedef.tedarikciEtiketi + aciklama.slice(kaynak.tedarikciEtiketi.length);
  }
  return aciklama;
}

/** Her konumun kendisi + tüm alt ağacındaki stok kalemi sayısı (doğrudan
 * sayılardan aşağıdan yukarıya toplanarak). */
export function konumToplamSayilari(
  agac: KonumDugumu[],
  dogrudanSayilar: Map<string, number>,
): Map<string, number> {
  const toplamlar = new Map<string, number>();

  function gez(dugum: KonumDugumu): number {
    let toplam = dogrudanSayilar.get(dugum.id) ?? 0;
    for (const cocuk of dugum.cocuklar) {
      toplam += gez(cocuk);
    }
    toplamlar.set(dugum.id, toplam);
    return toplam;
  }

  agac.forEach(gez);
  return toplamlar;
}

/** "4 Dolap, 1 Raf, 312 Bölme" gibi bir konum tipi özeti üretir. */
export function konumTipOzeti(konumlar: Konum[], dil: Dil = 'tr'): string {
  return konumTipSayimlari(konumlar)
    .map(({ tip, adet }) => `${adet} ${konumTipiGoster(tip, dil, adet)}`)
    .join(', ');
}

/** Konum tipi başına sayım (rozet listesi gibi ayrık göstermek için). */
export function konumTipSayimlari(konumlar: Konum[]): { tip: string; adet: number }[] {
  const sayilar = new Map<string, number>();
  for (const k of konumlar) {
    if (!k.tip) continue;
    sayilar.set(k.tip, (sayilar.get(k.tip) ?? 0) + 1);
  }
  return Array.from(sayilar.entries()).map(([tip, adet]) => ({ tip, adet }));
}

/** Konum ağacını düz bir listeye çevirir; select için girintili etiket üretir. */
export function konumSecenekleri(
  dugumler: KonumDugumu[],
  derinlik = 0,
): { id: string; etiket: string }[] {
  return dugumler.flatMap((d) => [
    { id: d.id, etiket: `${'— '.repeat(derinlik)}${d.ad}${d.kod ? ` (${d.kod})` : ''}` },
    ...konumSecenekleri(d.cocuklar, derinlik + 1),
  ]);
}
