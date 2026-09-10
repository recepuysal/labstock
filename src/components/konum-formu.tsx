'use client';

import { useActionState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { konumEkle, konumGuncelle, type EylemDurum } from '@/app/envanter/actions';
import { KONUM_TIPLERI } from '@/lib/types';

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
          Ad *
        </label>
        <input
          className="alan"
          id="ad"
          name="ad"
          required
          autoFocus
          defaultValue={baslangic?.ad}
          placeholder="Dolap A"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div>
          <label className="etiket" htmlFor="kod">
            Kod
          </label>
          <input className="alan mn" id="kod" name="kod" defaultValue={baslangic?.kod ?? undefined} placeholder="A" />
        </div>
        <div>
          <label className="etiket" htmlFor="tip">
            Tip
          </label>
          <select className="alan" id="tip" name="tip" defaultValue={baslangic?.tip ?? ''}>
            <option value="">seçilmedi</option>
            {KONUM_TIPLERI.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="etiket" htmlFor="parent_id">
          Üst konum
        </label>
        <select className="alan" id="parent_id" name="parent_id" defaultValue={baslangic?.parent_id ?? ''}>
          <option value="">yok (en üst seviye)</option>
          {ustler.map((u) => (
            <option key={u.id} value={u.id}>
              {u.etiket}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label className="etiket" htmlFor="aciklama">
          Açıklama
        </label>
        <input
          className="alan"
          id="aciklama"
          name="aciklama"
          defaultValue={baslangic?.aciklama ?? undefined}
          placeholder="SMD pasif"
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : duzenle ? 'Güncelle' : 'Kaydet'}
        </button>
        <Link href="/envanter" className="btn">
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
