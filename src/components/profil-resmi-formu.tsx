'use client';

import { useActionState, useRef, useState } from 'react';
import { profilResmiYukle } from '@/app/ayarlar/actions';
import type { EylemDurum } from '@/app/envanter/actions';
import { useSozluk } from '@/lib/i18n/istemci';

export function ProfilResmiFormu({ mevcutResim, bas }: { mevcutResim: string | null; bas: string }) {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(profilResmiYukle, {});
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const girdi = useRef<HTMLInputElement>(null);
  const so = useSozluk();
  const s = so.ayarlar.profil;

  function dosyaSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setOnizleme(URL.createObjectURL(dosya));
  }

  const gosterilecekResim = onizleme ?? mevcutResim;

  return (
    <form action={gonder} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div
        style={{
          width: 64,
          height: 64,
          flexShrink: 0,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'var(--ink)',
          color: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
        }}
        className="mn"
      >
        {gosterilecekResim ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={gosterilecekResim} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          bas
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <input
          ref={girdi}
          type="file"
          name="resim"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={dosyaSecildi}
          style={{ display: 'none' }}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={() => girdi.current?.click()}>
            {s.gorselSec}
          </button>
          <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
            {bekliyor ? so.ortak.buton.yukleniyor : s.yukle}
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted-2)' }}>
          {s.resimIpucu}
        </p>
        {durum.hata && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--crit)' }}>{durum.hata}</p>}
        {durum.bilgi && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--ok)' }}>{durum.bilgi}</p>}
      </div>
    </form>
  );
}
