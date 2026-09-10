'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { stokSil } from '@/app/envanter/actions';

export function SatirMenu({
  stokId,
  mpn,
  saltOkunur,
}: {
  stokId: string;
  mpn: string;
  saltOkunur?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [bekliyor, basla] = useTransition();
  const dugmeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [konum, setKonum] = useState<{ top: number; right: number } | null>(null);

  // Menü, tablo/ızgaranın "overflow: hidden" (yuvarlak köşe) kapsayıcısı
  // yüzünden kırpılmasın diye document.body'e portallanıyor — konumu
  // butonun gerçek ekran koordinatlarından hesaplanır.
  useLayoutEffect(() => {
    if (!acik || !dugmeRef.current) return;
    const dikdortgen = dugmeRef.current.getBoundingClientRect();
    setKonum({ top: dikdortgen.bottom + 4, right: window.innerWidth - dikdortgen.right });
  }, [acik]);

  useEffect(() => {
    if (!acik) return;
    function kapat(e: Event) {
      const hedef = e.target as Node;
      if (dugmeRef.current?.contains(hedef)) return;
      if (menuRef.current?.contains(hedef)) return;
      setAcik(false);
    }
    document.addEventListener('mousedown', kapat);
    document.addEventListener('scroll', kapat, true);
    return () => {
      document.removeEventListener('mousedown', kapat);
      document.removeEventListener('scroll', kapat, true);
    };
  }, [acik]);

  function sil() {
    setAcik(false);
    if (!window.confirm(`"${mpn}" stoktan tamamen silinsin mi? Bu işlem geri alınamaz.`)) return;
    basla(async () => {
      await stokSil(stokId);
    });
  }

  const menuOge: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: 12.5,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={dugmeRef}
        type="button"
        onClick={() => setAcik((a) => !a)}
        disabled={saltOkunur || bekliyor}
        aria-label="İşlemler"
        aria-haspopup="menu"
        aria-expanded={acik}
        style={{
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
          marginLeft: 'auto',
          opacity: saltOkunur ? 0.4 : 1,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2.2" />
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="12" cy="19" r="2.2" />
        </svg>
      </button>

      {acik &&
        konum &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: konum.top,
              right: konum.right,
              zIndex: 1000,
              minWidth: 130,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
              overflow: 'hidden',
            }}
          >
            <Link
              href={`/envanter/${stokId}/duzenle`}
              role="menuitem"
              onClick={() => setAcik(false)}
              style={{ ...menuOge, color: 'var(--ink-2)' }}
            >
              Düzenle
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={sil}
              style={{ ...menuOge, color: 'var(--crit)', borderTop: '1px solid var(--line-soft)' }}
            >
              Sil
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
