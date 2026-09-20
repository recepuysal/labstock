'use server';

import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { geminiSohbetCevapla, type SohbetMesaji } from '@/lib/gemini';

export type { SohbetMesaji };
export type SohbetSonucu = { hata?: string; cevap?: string };

const AZAMI_PARCA_SAYISI = 3000;

type EnvanterSatiriHam = {
  mpn: string;
  uretici: string | null;
  aciklama: string | null;
  kategori: string | null;
  kilif: string | null;
  adet: number;
  birim: string;
  konum_adi: string | null;
  parametreler: Record<string, string> | null;
};

/** Her parçayı modelin okuyabileceği tek satırlık kompakt bir metne çevirir —
 * ayrı bir vektör veritabanı yok, kişisel ölçekli bir envanter için tüm
 * listeyi doğrudan bağlama (context) veriyoruz. */
function envanterMetniOlustur(satirlar: EnvanterSatiriHam[]): string {
  return satirlar
    .map((s) => {
      const parcalar = [s.mpn];
      if (s.uretici) parcalar.push(s.uretici);
      if (s.kategori) parcalar.push(s.kategori);
      if (s.kilif) parcalar.push(s.kilif);
      parcalar.push(`${s.adet} ${s.birim}`);
      if (s.konum_adi) parcalar.push(`konum: ${s.konum_adi}`);
      if (s.aciklama) parcalar.push(s.aciklama);
      const ozellikler = Object.entries(s.parametreler ?? {})
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      if (ozellikler) parcalar.push(ozellikler);
      return `- ${parcalar.join(' | ')}`;
    })
    .join('\n');
}

function sistemYonergesiOlustur(envanterMetni: string, parcaSayisi: number, kirpildiMi: boolean): string {
  return [
    'Sen LabStock adlı elektronik parça envanteri uygulamasının içindeki bir asistansın.',
    'Kullanıcının depo/parça sorularını SADECE aşağıda verilen gerçek envanter listesine dayanarak yanıtla.',
    'Kurallar:',
    '- İstenen parça listede yoksa açıkça "yok" de; ama işlevsel olarak yerini tutabilecek başka bir parça listedeyse onu öner ve neden uygun olabileceğini kısaca açıkla.',
    '- Envanterde olmayan bir bilgiyi asla uydurma.',
    '- Adet/konum sorulursa listedeki değerleri birebir kullan.',
    '- Kısa, net ve Türkçe cevap ver; gereksiz uzatma, madde madde yazman gerekmiyorsa düz cümle kullan.',
    '',
    `ENVANTER (${parcaSayisi} kalem${kirpildiMi ? ', çok büyük olduğu için ilk ' + AZAMI_PARCA_SAYISI + ' tanesi gösteriliyor' : ''}) — format: parça | üretici | kategori | kılıf | adet birim | konum | açıklama | özellikler`,
    envanterMetni || '(envanter şu an boş)',
  ].join('\n');
}

export async function sohbetSor(mesajlar: SohbetMesaji[]): Promise<SohbetSonucu> {
  if (mesajlar.length === 0) return { hata: 'Boş mesaj.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: 'Oturum bulunamadı.' };

  const { data: profil } = await supabase
    .from('profiles')
    .select('gemini_api_key')
    .eq('id', user.id)
    .maybeSingle();
  const apiAnahtari = profil?.gemini_api_key as string | null | undefined;
  if (!apiAnahtari) {
    return {
      hata: 'Sohbet için önce Ayarlar sayfasından ücretsiz bir Gemini API anahtarı ekle.',
    };
  }

  const aktif = await aktifGorunumAl();
  if (!aktif) return { hata: 'Oturum bulunamadı.' };

  const { data: envanterVerisi, error: envanterHatasi } = await supabase
    .from('envanter')
    .select('mpn, uretici, aciklama, kategori, kilif, adet, birim, konum_adi, parametreler')
    .eq('user_id', aktif.kullaniciId)
    .order('mpn', { ascending: true })
    .limit(AZAMI_PARCA_SAYISI + 1);

  if (envanterHatasi) return { hata: envanterHatasi.message };

  const tumSatirlar = (envanterVerisi ?? []) as EnvanterSatiriHam[];
  const kirpildiMi = tumSatirlar.length > AZAMI_PARCA_SAYISI;
  const satirlar = kirpildiMi ? tumSatirlar.slice(0, AZAMI_PARCA_SAYISI) : tumSatirlar;

  const sistemYonergesi = sistemYonergesiOlustur(envanterMetniOlustur(satirlar), satirlar.length, kirpildiMi);

  try {
    const cevap = await geminiSohbetCevapla(apiAnahtari, sistemYonergesi, mesajlar);
    return { cevap };
  } catch (err) {
    console.error('sohbetSor:', err);
    return { hata: err instanceof Error ? err.message : 'Cevap alınamadı.' };
  }
}
