import { Suspense } from 'react';
import Link from 'next/link';
import { Marka } from './marka';
import { AramaKutusu } from './arama-kutusu';
import { GorunumSecici } from './gorunum-secici';

export function UstBar({
  bas,
  resimUrl,
  saltOkunur,
  gozlemciOf,
  izlenenAdi,
}: {
  bas?: string;
  resimUrl?: string | null;
  saltOkunur?: boolean;
  gozlemciOf?: string | null;
  izlenenAdi?: string | null;
}) {
  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 20px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <Link href="/envanter" style={{ color: 'inherit', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Marka />
      </Link>

      <Suspense fallback={<div style={{ flex: 1, maxWidth: 520, height: 34 }} />}>
        <AramaKutusu />
      </Suspense>

      <div style={{ flex: 1 }} />

      {gozlemciOf && (
        <GorunumSecici izleniyor={Boolean(saltOkunur)} izlenenAdi={izlenenAdi || 'bağlı hesap'} />
      )}

      {(() => {
        const iceAktarIkon = (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2v5a1 1 0 0 0 1 1h5" />
            <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" />
            <path d="M12 11v6" />
            <path d="M9.5 14.5 12 17l2.5-2.5" />
          </svg>
        );
        const ekleIkon = (
          <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        );
        return saltOkunur ? (
          <>
            <span className="btn" aria-disabled="true" style={{ opacity: 0.45, cursor: 'default' }}>
              {iceAktarIkon}
              Excel içe aktar
            </span>
            <span className="btn btn-birincil" aria-disabled="true" style={{ opacity: 0.45, cursor: 'default' }}>
              {ekleIkon}
              Parça ekle
            </span>
          </>
        ) : (
          <>
            <Link href="/envanter/ice-aktar" className="btn">
              {iceAktarIkon}
              Excel içe aktar
            </Link>
            <Link href="/envanter/yeni" className="btn btn-birincil">
              {ekleIkon}
              Parça ekle
            </Link>
          </>
        );
      })()}

      <Link
        href="/ayarlar"
        title="Ayarlar"
        aria-label="Ayarlar"
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 99,
          border: '1px solid var(--line)',
          color: 'var(--muted)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </Link>

      <Link
        href="/ayarlar/profil"
        title={saltOkunur ? `${izlenenAdi} — izlediğin depo` : bas ? `${bas} — profil` : 'Profil'}
        aria-label="Profil"
        className="mn"
        style={{
          width: 32,
          height: 32,
          flexShrink: 0,
          borderRadius: 99,
          background: resimUrl ? undefined : 'var(--ink)',
          color: 'var(--bg)',
          fontSize: 11,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: saltOkunur ? '0 0 0 2px var(--copper)' : undefined,
        }}
      >
        {resimUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resimUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          (bas ?? '··')
        )}
      </Link>
    </header>
  );
}
