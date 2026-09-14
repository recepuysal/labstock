'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export function AlinacakSatirMenu({
  malzemeAdi,
  onDuzenle,
  onSil,
}: {
  malzemeAdi: string;
  onDuzenle: () => void;
  onSil: () => void;
}) {
  const [acik, setAcik] = useState(false);
  const dugmeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [konum, setKonum] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!acik || !dugmeRef.current) return;
    const dikdortgen = dugmeRef.current.getBoundingClientRect();
    setKonum({ top: dikdortgen.bottom + 4, left: dikdortgen.left - 100 });
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
    if (!window.confirm(`"${malzemeAdi}" listeden silinsin mi?`)) return;
    onSil();
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
        aria-label="Satır işlemleri"
        aria-haspopup="menu"
        aria-expanded={acik}
        style={{
          width: 22,
          height: 22,
          flexShrink: 0,
          border: 'none',
          background: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--muted-2)',
          padding: 0,
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
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAcik(false);
                onDuzenle();
              }}
              style={{ ...menuOge, color: 'var(--ink-2)' }}
            >
              Düzenle
            </button>
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
