import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Marka } from '@/components/marka';
import { AltMenu } from './alt-menu';
import { Dokunma } from './dokunma';
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

/** Telefon görünümü: sade başlık + alt sekme çubuğu. */
export default function MobilLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="m-kabuk">
      <header className="m-ust m-kenar">
        <Link href="/m" className="m-marka" aria-label="LabStock ana sayfa">
          <Marka boyut={24} />
        </Link>
      </header>
      {children}
      <Suspense fallback={null}>
        <AltMenu />
      </Suspense>
      <Dokunma />
    </div>
  );
}
