'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { dosyayiAyristir } from '@/lib/ice-aktar';
import { sozlukAl } from '@/lib/i18n/sunucu';

export type IceAktarSonuc = {
  hata?: string;
  ozet?: {
    toplam: number;
    yeniParca: number;
    yeniStok: number;
    guncellenenStok: number;
    atlanan: number;
    hatalar: string[];
  };
};

export async function excelIceAktar(
  _onceki: IceAktarSonuc,
  formData: FormData,
): Promise<IceAktarSonuc> {
  const s = (await sozlukAl()).envanter.hata;
  const dosya = formData.get('dosya');
  if (!(dosya instanceof File) || dosya.size === 0) {
    return { hata: s.dosyaSec };
  }

  let ayristirma;
  try {
    ayristirma = dosyayiAyristir(await dosya.arrayBuffer());
  } catch {
    return { hata: s.dosyaOkunamadi };
  }

  if (ayristirma.mpnBulunamadi) {
    return { hata: s.mpnSutunuYok };
  }
  if (ayristirma.satirlar.length === 0) {
    return { hata: s.satirYok };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hata: s.oturumYok };

  const { data: konumVerisi } = await supabase.from('locations').select('id, ad, kod').eq('user_id', user.id);
  const konumlar = konumVerisi ?? [];

  let yeniParca = 0;
  let yeniStok = 0;
  let guncellenenStok = 0;
  let atlanan = 0;
  const hatalar: string[] = [];

  for (const satir of ayristirma.satirlar) {
    try {
      const { data: mevcutParca, error: aramaHatasi } = await supabase
        .from('parts')
        .select('id')
        .ilike('mpn', satir.mpn)
        .limit(1)
        .maybeSingle();
      if (aramaHatasi) throw new Error(aramaHatasi.message);

      let partId = mevcutParca?.id as string | undefined;

      if (!partId) {
        const { data: yeni, error } = await supabase
          .from('parts')
          .insert({
            mpn: satir.mpn,
            uretici: satir.uretici,
            aciklama: satir.aciklama,
            kategori: satir.kategori,
            kilif: satir.kilif,
            olusturan: user.id,
          })
          .select('id')
          .single();
        if (error) throw new Error(error.message);
        partId = yeni.id;
        yeniParca++;
      }

      // Konum metni varsa kod ya da ada göre eşleştir (büyük/küçük harf duyarsız).
      let konumId: string | null = null;
      if (satir.konum_metni) {
        const hedef = satir.konum_metni.toLocaleLowerCase('tr-TR');
        const bulunan = konumlar.find(
          (k) =>
            k.kod?.toLocaleLowerCase('tr-TR') === hedef || k.ad.toLocaleLowerCase('tr-TR') === hedef,
        );
        konumId = bulunan?.id ?? null;
      }

      let stokSorgu = supabase
        .from('stock_items')
        .select('id')
        .eq('part_id', partId)
        .eq('user_id', user.id)
        .limit(1);
      stokSorgu = konumId ? stokSorgu.eq('location_id', konumId) : stokSorgu.is('location_id', null);
      const { data: stok, error: stokAramaHatasi } = await stokSorgu.maybeSingle();
      if (stokAramaHatasi) throw new Error(stokAramaHatasi.message);

      if (stok) {
        guncellenenStok++;
        if (satir.adet > 0) {
          const { error } = await supabase.rpc('stok_hareket', {
            p_stok_id: stok.id,
            p_delta: satir.adet,
            p_sebep: 'ice_aktarma',
            p_aciklama: 'Excel/CSV içe aktarma',
          });
          if (error) throw new Error(error.message);
        }
      } else {
        yeniStok++;
        const { data: yeniStokKaydi, error } = await supabase
          .from('stock_items')
          .insert({
            part_id: partId,
            location_id: konumId,
            adet: 0,
            min_adet: satir.min_adet,
            tedarikci: satir.tedarikci,
            tedarikci_kodu: satir.tedarikci_kodu,
            user_id: user.id,
          })
          .select('id')
          .single();
        if (error) throw new Error(error.message);

        if (satir.adet > 0) {
          const { error: hareketHatasi } = await supabase.rpc('stok_hareket', {
            p_stok_id: yeniStokKaydi.id,
            p_delta: satir.adet,
            p_sebep: 'ice_aktarma',
            p_aciklama: 'Excel/CSV içe aktarma',
          });
          if (hareketHatasi) throw new Error(hareketHatasi.message);
        }
      }
    } catch (e) {
      atlanan++;
      const mesaj = e instanceof Error ? e.message : s.bilinmeyen;
      if (hatalar.length < 10) hatalar.push(`${satir.mpn}: ${mesaj}`);
    }
  }

  revalidatePath('/envanter');

  return {
    ozet: {
      toplam: ayristirma.satirlar.length,
      yeniParca,
      yeniStok,
      guncellenenStok,
      atlanan,
      hatalar,
    },
  };
}
