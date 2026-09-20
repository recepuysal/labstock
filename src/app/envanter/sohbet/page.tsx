import Link from 'next/link';
import { redirect } from 'next/navigation';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { SohbetEkrani } from '@/components/sohbet-ekrani';

export const dynamic = 'force-dynamic';

export default async function SohbetSayfasi() {
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '20px 20px 0' }}>
      <div
        style={{
          maxWidth: 760,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          paddingBottom: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 0 }}>
          <Link
            href="/envanter"
            className="btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: 'var(--copper)',
              borderColor: 'var(--copper-line)',
              fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Envantere dön
          </Link>
          {aktif.saltOkunur && (
            <span className="mn" style={{ fontSize: 11.5, color: 'var(--copper)' }}>
              İzlediğin depo: {aktif.izlenenAdi || 'bağlı hesap'}
            </span>
          )}
        </div>

        <SohbetEkrani />
      </div>
    </main>
  );
}
