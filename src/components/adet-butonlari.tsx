'use client';

import { useState, useTransition } from 'react';
import { stokHareket } from '@/app/envanter/actions';
import { useSozluk } from '@/lib/i18n/istemci';

export function AdetButonlari({
  stokId,
  adet,
  saltOkunur,
}: {
  stokId: string;
  adet: number;
  saltOkunur?: boolean;
}) {
  const s = useSozluk().envanter.satir;
  const [bekliyor, basla] = useTransition();
  const [hata, setHata] = useState<string | null>(null);
  const [bildirim, setBildirim] = useState<{ id: number; delta: number } | null>(null);

  function calistir(delta: number) {
    setHata(null);
    basla(async () => {
      const sonuc = await stokHareket(stokId, delta);
      if (sonuc.hata) {
        setHata(sonuc.hata);
      } else {
        setBildirim({ id: Date.now(), delta });
      }
    });
  }

  const kutu: React.CSSProperties = {
    width: 22,
    height: 22,
    border: '1px solid var(--line)',
    borderRadius: 'var(--r-sm)',
    background: 'var(--surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--muted)',
    padding: 0,
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        gap: 4,
        justifyContent: 'flex-end',
        opacity: saltOkunur ? 0.4 : 1,
      }}
      title={hata ?? undefined}
    >
      {bildirim && (
        <span
          key={bildirim.id}
          className={`stok-bildirim ${bildirim.delta > 0 ? 'stok-bildirim-artis' : 'stok-bildirim-azalis'}`}
          style={{ top: -6, right: 0 }}
          onAnimationEnd={() => setBildirim(null)}
        >
          {bildirim.delta > 0 ? `+${bildirim.delta}` : bildirim.delta}
        </span>
      )}
      <button
        type="button"
        style={{ ...kutu, borderColor: hata ? 'var(--crit)' : 'var(--line)' }}
        disabled={saltOkunur || bekliyor || adet <= 0}
        onClick={() => calistir(-1)}
        aria-label={s.birAdetDus}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <button
        type="button"
        style={kutu}
        disabled={saltOkunur || bekliyor}
        onClick={() => calistir(1)}
        aria-label={s.birAdetEkle}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
