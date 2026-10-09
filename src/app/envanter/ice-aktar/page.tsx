import { redirect } from 'next/navigation';
import { ExcelIceAktarFormu } from '@/components/excel-ice-aktar-formu';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { sozlukAl } from '@/lib/i18n/sunucu';

export const dynamic = 'force-dynamic';

export default async function ExcelIceAktarSayfasi() {
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');
  if (aktif.saltOkunur) redirect('/envanter');
  const s = (await sozlukAl()).envanter.iceAktar;
  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
          {s.baslik}
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          {s.aciklama}
        </p>
        <ExcelIceAktarFormu />
      </div>
    </main>
  );
}
