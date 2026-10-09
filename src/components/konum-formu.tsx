'use client';

import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { konumEkle, konumGuncelle, type EylemDurum } from '@/app/envanter/actions';
import { KONUM_TIPLERI, konumTipiGoster } from '@/lib/types';
import { useDil, useSozluk } from '@/lib/i18n/istemci';

export type KonumBaslangic = {
  id: string;
  ad: string;
  kod: string | null;
  tip: string | null;
  aciklama: string | null;
  parent_id: string | null;
};

type Props = {
  ustler: { id: string; etiket: string }[];
  mod?: 'ekle' | 'duzenle';
  baslangic?: KonumBaslangic;
};

export function KonumFormu({ ustler, mod = 'ekle', baslangic }: Props) {
  const dil = useDil();
  const sozlukler = useSozluk();
  const s = sozlukler.envanter.konumFormu;
  const duzenle = mod === 'duzenle';
  const eylem = duzenle ? konumGuncelle : konumEkle;
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(eylem, {});
  const router = useRouter();

  useEffect(() => {
    if (durum.bilgi) {
      router.push('/envanter');
      router.refresh();
    }
  }, [durum.bilgi, router]);

  return (
    <form action={gonder} className="kart" style={{ padding: 22 }}>
      {durum.hata && (
        <div className="hata" style={{ marginBottom: 16 }}>
          {durum.hata}
        </div>
      )}

      {duzenle && <input type="hidden" name="konum_id" value={baslangic!.id} />}

      <div style={{ marginBottom: 16 }}>
        <label className="etiket" htmlFor="ad">
          {s.ad}
        </label>
        <input
          className="alan"
          id="ad"
          name="ad"
          required
          autoFocus
          defaultValue={baslangic?.ad}
          placeholder={s.adOrnek}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div>
          <label className="etiket" htmlFor="kod">
            {s.kod}
          </label>
          <input className="alan mn" id="kod" name="kod" defaultValue={baslangic?.kod ?? undefined} placeholder="A" />
        </div>
        <div>
          <label className="etiket" htmlFor="tip">
            {s.tip}
          </label>
          <select className="alan" id="tip" name="tip" defaultValue={baslangic?.tip ?? ''}>
            <option value="">{s.secilmedi}</option>
            {KONUM_TIPLERI.map((t) => (
              <option key={t} value={t}>
                {konumTipiGoster(t, dil)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="etiket" htmlFor="parent_id">
          {s.ustKonum}
        </label>
        <select className="alan" id="parent_id" name="parent_id" defaultValue={baslangic?.parent_id ?? ''}>
          <option value="">{s.ustYok}</option>
          {ustler.map((u) => (
            <option key={u.id} value={u.id}>
              {u.etiket}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label className="etiket" htmlFor="aciklama">
          {s.aciklama}
        </label>
        <input
          className="alan"
          id="aciklama"
          name="aciklama"
          defaultValue={baslangic?.aciklama ?? undefined}
          placeholder={s.aciklamaOrnek}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
          {bekliyor ? sozlukler.ortak.buton.kaydediliyor : duzenle ? s.guncelle : sozlukler.ortak.buton.kaydet}
        </button>
        <Link href="/envanter" className="btn">
          {sozlukler.envanter.vazgec}
        </Link>
      </div>
    </form>
  );
}
