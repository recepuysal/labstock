'use client';

import { useRouter } from 'next/navigation';

export function GeriButonu({ yedekHref }: { yedekHref: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(yedekHref);
      }}
      className="btn mn"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Geri
    </button>
  );
}
