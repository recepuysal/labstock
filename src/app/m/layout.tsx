import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Marka } from '@/components/marka';
import { AltMenu } from './alt-menu';
import './mobil.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'LabStock',
  appleWebApp: { capable: true, title: 'LabStock', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2ede3' },
    { media: '(prefers-color-scheme: dark)', color: '#17140f' },
  ],
};

/** Telefon görünümü: masaüstü üst barı yerine sade başlık + alt sekme çubuğu. */
export default function MobilLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-kabuk">
      <header className="m-ust m-kenar">
        <div className="m-ust-satir">
          <Link href="/m" style={{ color: 'var(--ink)' }} aria-label="LabStock ana sayfa">
            <Marka boyut={26} />
          </Link>
          <a className="m-masaustu" href="/envanter?masaustu=1">
            Masaüstü
          </a>
        </div>
      </header>
      {children}
      <Suspense fallback={null}>
        <AltMenu />
      </Suspense>
    </div>
  );
}
