'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { ALINACAK_DURUMLAR, type AlinacakDurumu } from '@/lib/types';
import type { EylemDurum } from '@/app/envanter/actions';

function alanlariOku(
  formData: FormData,
): { malzemeAdi: string; adet: number; notMetni: string | null; link: string | null } | { hata: string } {
  const malzemeAdi = String(formData.get('malzeme_adi') ?? '').trim();
  if (!malzemeAdi) return { hata: 'Malzeme adı gerekli.' };

  const adetHam = String(formData.get('adet') ?? '').trim();
  const adet = adetHam ? Number(adetHam) : 1;
  if (!Number.isFinite(adet) || adet <= 0) return { hata: 'Adet geçersiz.' };

  const notMetni = String(formData.get('not_metni') ?? '').trim() || null;
  const link = String(formData.get('link') ?? '').trim() || null;

  return { malzemeAdi, adet, notMetni, link };
}

function durumOku(formData: FormData): AlinacakDurumu {
  const durum = String(formData.get('durum') ?? '');
  return (ALINACAK_DURUMLAR as readonly string[]).includes(durum) ? (durum as AlinacakDurumu) : 'bekliyor';
}

export async function alinacakEkle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const alanlar = alanlariOku(formData);
  if ('hata' in alanlar) return alanlar;

  // user_id'yi açıkça hedefe yazıyoruz — bir gözlemci izlediği depoya
  // eklerken varsayılan auth.uid() kendi hesabına düşer, kayıt yanlışlıkla
  // gözlemcinin kendi listesine gider.
  const aktif = await aktifGorunumAl();
  if (!aktif) return { hata: 'Oturum bulunamadı.' };

  const supabase = await createClient();
  const { error } = await supabase.from('alinacaklar').insert({
    user_id: aktif.kullaniciId,
    malzeme_adi: alanlar.malzemeAdi,
    adet: alanlar.adet,
    not_metni: alanlar.notMetni,
    link: alanlar.link,
  });
  if (error) return { hata: error.message };

  revalidatePath('/envanter/alinacaklar');
  return { bilgi: 'Eklendi.' };
}

export async function alinacakGuncelle(_onceki: EylemDurum, formData: FormData): Promise<EylemDurum> {
  const id = String(formData.get('id') ?? '');
  if (!id) return { hata: 'Geçersiz kayıt.' };

  const alanlar = alanlariOku(formData);
  if ('hata' in alanlar) return alanlar;

  const supabase = await createClient();
  const { error } = await supabase
    .from('alinacaklar')
    .update({
      malzeme_adi: alanlar.malzemeAdi,
      adet: alanlar.adet,
      not_metni: alanlar.notMetni,
      link: alanlar.link,
      durum: durumOku(formData),
    })
    .eq('id', id);
  if (error) return { hata: error.message };

  revalidatePath('/envanter/alinacaklar');
  return { bilgi: 'Güncellendi.' };
}

export async function alinacakDurumDegistir(id: string, durum: AlinacakDurumu): Promise<void> {
  const supabase = await createClient();
  await supabase.from('alinacaklar').update({ durum }).eq('id', id);
  revalidatePath('/envanter/alinacaklar');
}

export async function alinacakSil(id: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from('alinacaklar').delete().eq('id', id);
  revalidatePath('/envanter/alinacaklar');
}
