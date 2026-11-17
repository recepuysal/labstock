'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { ALINACAK_DURUMLAR, type AlinacakDurumu } from '@/lib/types';
import type { EylemDurum } from '@/app/envanter/actions';
import { sozlukAl } from '@/lib/i18n/sunucu';

type Alanlar = {
  malzeme_adi: string;
  adet: number;
  not_metni: string | null;
  link: string | null;
};

type EkAlanlar = {
  tedarikci: string | null;
  birim_fiyat: number | null;
  para_birimi: string;
  siparis_tarihi: string | null;
  alinma_tarihi: string | null;
};

const PARA_BIRIMLERI = ['TRY', 'USD', 'EUR'];

/** Bugünün tarihi (YYYY-MM-DD), Türkiye saatine göre. */
function bugun(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
}

function tarihOku(formData: FormData, ad: string): string | null {
  const deger = String(formData.get(ad) ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(deger) ? deger : null;
}

async function alanlariOku(formData: FormData): Promise<{ alanlar: Alanlar; ek: EkAlanlar } | { hata: string }> {
  const s = (await sozlukAl()).envanter.hata;
  const malzemeAdi = String(formData.get('malzeme_adi') ?? '').trim();
  if (!malzemeAdi) return { hata: s.malzemeAdiGerekli };

  const adetHam = String(formData.get('adet') ?? '').trim();
  const adet = adetHam ? Number(adetHam.replace(',', '.')) : 1;
  if (!Number.isFinite(adet) || adet <= 0) return { hata: s.adetGecersiz };

  const fiyatHam = String(formData.get('birim_fiyat') ?? '').trim();
  const birimFiyat = fiyatHam ? Number(fiyatHam.replace(',', '.')) : null;
  if (birimFiyat !== null && (!Number.isFinite(birimFiyat) || birimFiyat < 0)) return { hata: s.birimFiyatGecersiz };

  const paraHam = String(formData.get('para_birimi') ?? 'TRY');

  return {
    alanlar: {
      malzeme_adi: malzemeAdi,
      adet,
      not_metni: String(formData.get('not_metni') ?? '').trim() || null,
      link: String(formData.get('link') ?? '').trim() || null,
    },
    ek: {
      tedarikci: String(formData.get('tedarikci') ?? '').trim() || null,
      birim_fiyat: birimFiyat,
      para_birimi: PARA_BIRIMLERI.includes(paraHam) ? paraHam : 'TRY',
      siparis_tarihi: tarihOku(formData, 'siparis_tarihi'),
      alinma_tarihi: tarihOku(formData, 'alinma_tarihi'),
    },
  };
}

function durumOku(formData: FormData): AlinacakDurumu {
  const durum = String(formData.get('durum') ?? '');
  return (ALINACAK_DURUMLAR as readonly string[]).includes(durum) ? (durum as AlinacakDurumu) : 'bekliyor';
}

/** Durum ilerleyince ilgili tarih boşsa bugünle doldurulur; geri alınınca
 * sonraki aşamanın tarihi temizlenir (ör. "Alındı" → "Bekliyor"). */
function durumTarihleri(
  durum: AlinacakDurumu,
  mevcut: { siparis_tarihi: string | null; alinma_tarihi: string | null },
): { siparis_tarihi: string | null; alinma_tarihi: string | null } {
  if (durum === 'bekliyor') return { siparis_tarihi: null, alinma_tarihi: null };
  if (durum === 'siparis_verildi') return { siparis_tarihi: mevcut.siparis_tarihi ?? bugun(), alinma_tarihi: null };
  return { siparis_tarihi: mevcut.siparis_tarihi, alinma_tarihi: mevcut.alinma_tarihi ?? bugun() };
}

/** 0005 migration'ı henüz uygulanmamışsa yeni kolonlar yok — PostgREST
 * "kolon bulunamadı" hatası verir. Bu durumda yalnızca temel alanlarla
 * tekrar deneriz ki liste çalışmaya devam etsin. */
function kolonEksik(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === 'PGRST204' || error.code === '42703' || /column/i.test(error.message ?? '');
}

export async function alinacakEkle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const s = (await sozlukAl()).envanter;
  const okunan = await alanlariOku(formData);
  if ('hata' in okunan) return okunan;

  // user_id'yi açıkça hedefe yazıyoruz — bir gözlemci izlediği depoya
  // eklerken varsayılan auth.uid() kendi hesabına düşer, kayıt yanlışlıkla
  // gözlemcinin kendi listesine gider.
  const aktif = await aktifGorunumAl();
  if (!aktif) return { hata: s.hata.oturumYok };

  const supabase = await createClient();
  const temel = { user_id: aktif.kullaniciId, ...okunan.alanlar };
  const { tedarikci, birim_fiyat, para_birimi } = okunan.ek;
  let { error } = await supabase.from('alinacaklar').insert({ ...temel, tedarikci, birim_fiyat, para_birimi });
  if (kolonEksik(error)) ({ error } = await supabase.from('alinacaklar').insert(temel));
  if (error) return { hata: error.message };

  revalidatePath('/envanter/alinacaklar');
  return { bilgi: s.bilgi.eklendi };
}

export async function alinacakGuncelle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const s = (await sozlukAl()).envanter;
  const id = String(formData.get('id') ?? '');
  if (!id) return { hata: s.hata.gecersizKayit };

  const okunan = await alanlariOku(formData);
  if ('hata' in okunan) return okunan;

  const durum = durumOku(formData);
  const supabase = await createClient();
  const temel = { ...okunan.alanlar, durum };
  let { error } = await supabase
    .from('alinacaklar')
    .update({
      ...temel,
      ...okunan.ek,
      // Formda elle girilen tarih öncelikli; boş bırakıldıysa durumdan türet.
      ...durumTarihleri(durum, okunan.ek),
      guncellendi: new Date().toISOString(),
    })
    .eq('id', id);
  if (kolonEksik(error)) ({ error } = await supabase.from('alinacaklar').update(temel).eq('id', id));
  if (error) return { hata: error.message };

  revalidatePath('/envanter/alinacaklar');
  return { bilgi: s.bilgi.guncellendi };
}

export async function alinacakDurumDegistir(id: string, durum: AlinacakDurumu): Promise<void> {
  const supabase = await createClient();
  const { data: mevcut, error: okumaHatasi } = await supabase
    .from('alinacaklar')
    .select('siparis_tarihi, alinma_tarihi')
    .eq('id', id)
    .maybeSingle();

  if (okumaHatasi || !mevcut) {
    await supabase.from('alinacaklar').update({ durum }).eq('id', id);
  } else {
    await supabase
      .from('alinacaklar')
      .update({ durum, ...durumTarihleri(durum, mevcut), guncellendi: new Date().toISOString() })
      .eq('id', id);
  }
  revalidatePath('/envanter/alinacaklar');
}

export async function alinacakSil(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('alinacaklar').delete().eq('id', id);
  revalidatePath('/envanter/alinacaklar');
}
