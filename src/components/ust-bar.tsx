import { Suspense } from 'react';
import Link from 'next/link';
import { Marka } from './marka';
import { AramaKutusu } from './arama-kutusu';
import { GorunumSecici } from './gorunum-secici';
import { sozlukAl } from '@/lib/i18n/sunucu';

export async function UstBar({
  bas,
  resimUrl,
  saltOkunur,
  gozlemciOf,
  izlenenAdi,
  cevrimdisi,
}: {
  bas?: string;
  resimUrl?: string | null;
  saltOkunur?: boolean;
  gozlemciOf?: string | null;
  izlenenAdi?: string | null;
  /** Çevrimdışı moddaysa ayarlara giden küçük bir rozet gösterilir. */
  cevrimdisi?: boolean;
}) {
  const so = await sozlukAl();
  const s = so.ortak;
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
        <GorunumSecici izleniyor={Boolean(saltOkunur)} izlenenAdi={izlenenAdi || s.ustBar.bagliHesap} />
      )}

      <Link href="/envanter/sohbet" className="btn" title={s.ustBar.sohbet}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {s.ustBar.sohbet}
      </Link>

      <Link href="/envanter/alinacaklar" className="btn" title={s.ustBar.alinacaklar}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
        {s.ustBar.alinacaklar}
      </Link>

      {saltOkunur ? (
        <span className="btn btn-birincil" aria-disabled="true" style={{ opacity: 0.45, cursor: 'default' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {s.ustBar.parcaEkle}
        </span>
      ) : (
        <Link href="/envanter/yeni" className="btn btn-birincil">
          <svg width="15" height="15" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {s.ustBar.parcaEkle}
        </Link>
      )}

      <Link
        href="/ayarlar"
        title={s.ustBar.ayarlar}
        aria-label={s.ustBar.ayarlar}
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

      {cevrimdisi && (
        <Link
          href="/ayarlar#depolama"
          title={so.ayarlar.depolama.cevrimdisiAciklama}
          className="mn"
          style={{
            flexShrink: 0,
            fontSize: 10.5,
            fontWeight: 600,
            letterSpacing: '0.04em',
            padding: '3px 8px',
            borderRadius: 99,
            border: '1px solid var(--line)',
            color: 'var(--muted)',
            textDecoration: 'none',
          }}
        >
          {so.ayarlar.depolama.rozet}
        </Link>
      )}

      <Link
        href="/ayarlar/profil"
        title={saltOkunur ? `${izlenenAdi} — ${s.ustBar.izledigin}` : bas ? `${bas} — ${s.ustBar.profil}` : s.ustBar.profil}
        aria-label={s.ustBar.profil}
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
