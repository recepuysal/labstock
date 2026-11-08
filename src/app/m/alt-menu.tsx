'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

/** Telefon görünümünün alt sekme çubuğu. */
export function AltMenu() {
  const yol = usePathname();
  const parametreler = useSearchParams();
  const eksikte = yol === '/m' && parametreler.get('durum') === 'eksik';
  const stokta = yol.startsWith('/m') && !eksikte;

  return (
    <div className="m-alt-menu">
      <nav aria-label="Mobil menü">
        <Link href="/m" aria-current={stokta ? 'page' : undefined}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M3 12h18M9 4v16M15 4v16" />
          </svg>
          Stok
        </Link>
        <Link href="/m?durum=eksik" aria-current={eksikte ? 'page' : undefined}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
          Eksikler
        </Link>
        <Link href="/envanter/yeni">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M12 8v8M8 12h8" />
          </svg>
          Parça ekle
        </Link>
      </nav>
    </div>
  );
}
