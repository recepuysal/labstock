'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { konumSil } from '@/app/envanter/actions';

export function KonumSatirMenu({ konumId, ad }: { konumId: string; ad: string }) {
  const [acik, setAcik] = useState(false);
  const [bekliyor, basla] = useTransition();
  const dugmeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [konum, setKonum] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!acik || !dugmeRef.current) return;
    const dikdortgen = dugmeRef.current.getBoundingClientRect();
    setKonum({ top: dikdortgen.bottom + 4, left: dikdortgen.left });
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
    if (
      !window.confirm(
        `"${ad}" konumu silinsin mi? İçindeki alt konumlar da (varsa) birlikte silinir. Bu konumdaki stok kalemleri silinmez, sadece konumsuz kalır.`,
      )
    ) {
      return;
    }
    basla(async () => {
      await konumSil(konumId);
    });
  }

  const menuOge: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '7px 12px',
    fontSize: 12,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
  };

  return (
    <>
      <button
        ref={dugmeRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setAcik((a) => !a);
        }}
        disabled={bekliyor}
        aria-label="Konum işlemleri"
        aria-haspopup="menu"
        aria-expanded={acik}
        style={{
          width: 18,
          height: 18,
          flexShrink: 0,
          border: 'none',
          background: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted-2)',
          padding: 0,
          opacity: bekliyor ? 0.4 : 1,
        }}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
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
              left: konum.left,
              zIndex: 1000,
              minWidth: 120,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.14)',
              overflow: 'hidden',
            }}
          >
            <Link
              href={`/envanter/konum/${konumId}/duzenle`}
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
    </>
  );
}
