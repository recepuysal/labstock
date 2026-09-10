'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { KonumDugumu } from '@/lib/types';

function Dugum({
  dugum,
  seciliId,
  derinlik,
  arama,
  sayilar,
}: {
  dugum: KonumDugumu;
  seciliId?: string;
  derinlik: number;
  arama?: string;
  sayilar: Record<string, number>;
}) {
  const [acik, setAcik] = useState(true);
  const secili = seciliId === dugum.id;
  const varCocuk = dugum.cocuklar.length > 0;
  const p = new URLSearchParams();
  p.set('konum', dugum.id);
  if (arama) p.set('q', arama);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 27,
          borderRadius: 'var(--r-sm)',
          background: secili ? 'var(--copper-soft)' : 'transparent',
        }}
      >
        <button
          type="button"
          onClick={() => setAcik((a) => !a)}
          aria-label={acik ? 'Daralt' : 'Genişlet'}
          style={{
            width: 8 + derinlik * 14 + 12,
            flexShrink: 0,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingLeft: derinlik * 14,
            color: 'var(--muted-2)',
            fontSize: 9,
            visibility: varCocuk ? 'visible' : 'hidden',
          }}
        >
          {acik ? '▾' : '▸'}
        </button>

        <Link
          href={`/envanter?${p.toString()}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: '100%',
            flex: 1,
            minWidth: 0,
            paddingRight: 8,
            fontSize: 12.5,
            color: secili ? 'var(--copper)' : 'var(--ink-2)',
            fontWeight: secili ? 600 : 400,
          }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {dugum.ad}
            {dugum.aciklama && (
              <span style={{ color: 'var(--muted-2)', fontWeight: 400 }}> · {dugum.aciklama}</span>
            )}
          </span>
          {dugum.kod && (
            <span className="mn" style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--muted-2)' }}>
              {dugum.kod}
            </span>
          )}
          <span
            className="mn"
            style={{ marginLeft: dugum.kod ? 0 : 'auto', fontSize: 10.5, color: 'var(--muted-2)', minWidth: 16, textAlign: 'right' }}
          >
            {sayilar[dugum.id] ?? 0}
          </span>
        </Link>
      </div>

      {acik &&
        dugum.cocuklar.map((c) => (
          <Dugum key={c.id} dugum={c} seciliId={seciliId} derinlik={derinlik + 1} arama={arama} sayilar={sayilar} />
        ))}
    </div>
  );
}

export function KonumAgaci({
  agac,
  seciliId,
  arama,
  toplam,
  sayilar,
  tipOzeti,
  saltOkunur,
}: {
  agac: KonumDugumu[];
  seciliId?: string;
  arama?: string;
  toplam: number;
  sayilar: Record<string, number>;
  tipOzeti?: string;
  saltOkunur?: boolean;
}) {
  const tumu = new URLSearchParams();
  if (arama) tumu.set('q', arama);

  return (
    <aside
      style={{
        width: 264,
        flexShrink: 0,
        background: 'var(--surface-2)',
        borderRight: '1px solid var(--line)',
        padding: '12px 10px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'var(--muted-2)',
          padding: '0 8px',
          margin: '2px 0 6px',
        }}
      >
        DEPO
      </div>

      <Link
        href={`/envanter${tumu.toString() ? `?${tumu.toString()}` : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 27,
          padding: '0 8px',
          borderRadius: 'var(--r-sm)',
          fontSize: 12.5,
          fontWeight: seciliId ? 400 : 600,
          color: seciliId ? 'var(--ink-2)' : 'var(--copper)',
          background: seciliId ? 'transparent' : 'var(--copper-soft)',
        }}
      >
        Tüm envanter
        <span className="mn" style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--muted-2)' }}>
          {toplam}
        </span>
      </Link>

      {agac.map((d) => (
        <Dugum key={d.id} dugum={d} seciliId={seciliId} derinlik={0} arama={arama} sayilar={sayilar} />
      ))}

      {agac.length === 0 && (
        <p style={{ fontSize: 11.5, color: 'var(--muted-2)', padding: '10px 8px', lineHeight: 1.5 }}>
          Henüz konum yok.
        </p>
      )}

      {saltOkunur ? (
        <span
          aria-disabled="true"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 27,
            padding: '0 8px',
            marginTop: 4,
            borderRadius: 'var(--r-sm)',
            fontSize: 12.5,
            color: 'var(--muted-2)',
            opacity: 0.5,
          }}
        >
          + Konum ekle
        </span>
      ) : (
        <Link
          href="/envanter/konum-ekle"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 27,
            padding: '0 8px',
            marginTop: 4,
            borderRadius: 'var(--r-sm)',
            fontSize: 12.5,
            color: 'var(--muted)',
          }}
        >
          + Konum ekle
        </Link>
      )}

      <Link
        href="/envanter/etiketler"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          height: 27,
          padding: '0 8px',
          borderRadius: 'var(--r-sm)',
          fontSize: 12.5,
          color: 'var(--muted)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="6 9 6 2 18 2 18 9" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" />
        </svg>
        Etiketleri yazdır
      </Link>

      {tipOzeti && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 8px 0',
            borderTop: '1px solid var(--line)',
            fontSize: 10.5,
            color: 'var(--muted-2)',
            lineHeight: 1.6,
          }}
        >
          {tipOzeti}
        </div>
      )}
    </aside>
  );
}
