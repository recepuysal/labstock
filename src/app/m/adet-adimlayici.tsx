'use client';

import { useOptimistic, useState, useTransition } from 'react';
import { stokHareket } from '@/app/envanter/actions';
import { titresim } from './dokunma';

/** Telefonda başparmakla kullanılacak büyük −/+ düğmeleri. Sayı anında
 *  değişir (iyimser), sunucu stok_hareket() ile kaydeder; hata olursa geri döner. */
export function AdetAdimlayici({
  stokId,
  adet,
  saltOkunur,
  buyuk,
  hizliDugmeler,
}: {
  stokId: string;
  adet: number;
  saltOkunur?: boolean;
  buyuk?: boolean;
  hizliDugmeler?: boolean;
}) {
  const [gorunen, iyimserEkle] = useOptimistic(adet, (mevcut: number, delta: number) => Math.max(0, mevcut + delta));
  const [, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);

  function uygula(delta: number) {
    if (saltOkunur) return;
    if (delta < 0 && gorunen + delta < 0) delta = -gorunen;
    if (delta === 0) return;
    setHata(null);
    titresim();
    basla(async () => {
      iyimserEkle(delta);
      const sonuc = await stokHareket(stokId, delta);
      if (sonuc.hata) setHata(sonuc.hata);
    });
  }

  return (
    <>
      <div className={`m-adim${buyuk ? ' buyuk' : ''}${hata ? ' hata' : ''}`} title={hata ?? undefined}>
        <button
          type="button"
          className="m-dokun"
          onClick={() => uygula(-1)}
          disabled={saltOkunur || gorunen <= 0}
          aria-label="Bir adet düş"
        >
          −
        </button>
        <span className="m-deger" aria-live="polite" key={gorunen}>
          {gorunen}
        </span>
        <button type="button" className="m-dokun" onClick={() => uygula(1)} disabled={saltOkunur} aria-label="Bir adet ekle">
          +
        </button>
      </div>
      {hizliDugmeler && (
        <div className="m-hizli">
          <button type="button" className="m-dokun" onClick={() => uygula(-10)} disabled={saltOkunur || gorunen <= 0}>
            −10
          </button>
          <button type="button" className="m-dokun" onClick={() => uygula(10)} disabled={saltOkunur}>
            +10
          </button>
          <button type="button" className="m-dokun" onClick={() => uygula(100)} disabled={saltOkunur}>
            +100
          </button>
        </div>
      )}
      {hata && buyuk && <div className="m-hata">Kaydedilemedi: {hata}</div>}
    </>
  );
}
