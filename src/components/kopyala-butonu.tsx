'use client';

import { useState } from 'react';

export function KopyalaButonu({
  metin,
  baslik = 'Kopyala',
  boyut = 13,
}: {
  metin: string;
  baslik?: string;
  boyut?: number;
}) {
  const [kopyalandi, setKopyalandi] = useState(false);

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(metin);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 1500);
    } catch {
      // pano erişimi yoksa sessizce geç
    }
  }

  return (
    <button
      type="button"
      onClick={kopyala}
      title={kopyalandi ? 'Kopyalandı' : baslik}
      style={{
        border: 'none',
        background: 'none',
        padding: 2,
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        color: kopyalandi ? 'var(--ok)' : 'var(--muted-2)',
        cursor: 'pointer',
      }}
    >
      {kopyalandi ? (
        <svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg width={boyut} height={boyut} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}
