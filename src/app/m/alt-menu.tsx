'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const ikon = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

/** Telefon görünümünün alt sekme çubuğu. */
export function AltMenu() {
  const yol = usePathname();
  const parametreler = useSearchParams();
  const ayarlarda = yol.startsWith('/m/ayarlar');
  const eksikte = yol === '/m' && parametreler.get('durum') === 'eksik';
  const stokta = yol.startsWith('/m') && !eksikte && !ayarlarda;

  return (
    <div className="m-alt-menu">
      <nav aria-label="Mobil menü">
        <Link className="m-dokun" href="/m" aria-current={stokta ? 'page' : undefined}>
          <svg {...ikon}>
            <rect x="3" y="4" width="18" height="16" rx="3" />
            <path d="M3 12h18M9 4v16M15 4v16" />
          </svg>
          Stok
        </Link>
        <Link className="m-dokun" href="/m?durum=eksik" aria-current={eksikte ? 'page' : undefined}>
          <svg {...ikon}>
            <path d="M12 3 2 20h20L12 3Z" />
            <path d="M12 10v4M12 17h.01" />
          </svg>
          Eksikler
        </Link>
        <Link className="m-dokun m-ekle" href="/envanter/yeni" aria-label="Parça ekle">
          <span>
            <svg {...ikon} strokeWidth={2.2}>
              <path d="M12 6v12M6 12h12" />
            </svg>
          </span>
          Ekle
        </Link>
        <Link className="m-dokun" href="/m/ayarlar" aria-current={ayarlarda ? 'page' : undefined}>
          <svg {...ikon}>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
          </svg>
          Ayarlar
        </Link>
      </nav>
    </div>
  );
}
