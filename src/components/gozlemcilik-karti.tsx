'use client';

import { useActionState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { davetKoduIleBaglan, gozlemcilikKaldir } from '@/app/ayarlar/actions';
import type { EylemDurum } from '@/app/envanter/actions';
import { useSozluk } from '@/lib/i18n/istemci';

export function GozlemcilikKarti({ hedefAdi }: { hedefAdi: string | null }) {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(davetKoduIleBaglan, {});
  const [kaldiriliyor, basla] = useTransition();
  const router = useRouter();
  const s = useSozluk().ayarlar.gozlemcilik;

  useEffect(() => {
    if (durum.bilgi) router.refresh();
  }, [durum.bilgi, router]);

  function kaldir() {
    basla(async () => {
      await gozlemcilikKaldir();
      router.refresh();
    });
  }

  return (
    <div className="kart" style={{ padding: 20, marginTop: 16 }}>
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}
      >
        {s.baslik}
      </div>

      {hedefAdi ? (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            {s.izliyorsunOnce}
            <strong>{hedefAdi}</strong>
            {s.izliyorsunSonra}
          </p>
          <button
            type="button"
            className="btn"
            style={{ height: 32, fontSize: 12.5 }}
            onClick={kaldir}
            disabled={kaldiriliyor}
          >
            {kaldiriliyor ? '…' : s.baglantiyiKaldir}
          </button>
        </>
      ) : (
        <>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            {s.aciklama}
          </p>
          <form action={gonder} style={{ display: 'flex', gap: 8 }}>
            <input
              className="alan mn"
              style={{ height: 34 }}
              name="kod"
              placeholder={s.davetKodu}
              autoComplete="off"
              required
            />
            <button className="btn btn-birincil" style={{ height: 34, flexShrink: 0 }} type="submit" disabled={bekliyor}>
              {bekliyor ? '…' : s.baglan}
            </button>
          </form>
          {durum.hata && (
            <div className="hata" style={{ marginTop: 10 }}>
              {durum.hata}
            </div>
          )}
        </>
      )}
    </div>
  );
}
