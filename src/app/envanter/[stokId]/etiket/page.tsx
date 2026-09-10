import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { qrGorseli, stokKodu } from '@/lib/etiket';
import { YazdirButonu } from '@/components/yazdir-butonu';
import type { EnvanterSatiri } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ParcaEtiketSayfasi({ params }: { params: Promise<{ stokId: string }> }) {
  const { stokId } = await params;
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');

  const supabase = await createClient();
  const { data: satir } = await supabase
    .from('envanter')
    .select('*')
    .eq('stok_id', stokId)
    .eq('user_id', aktif.kullaniciId)
    .maybeSingle();

  if (!satir) notFound();
  const s = satir as EnvanterSatiri;
  const qr = await qrGorseli(stokKodu(s.stok_id));

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div
        className="yazdirma-disi"
        style={{
          maxWidth: 620,
          margin: '0 auto 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href={`/envanter/${s.stok_id}`} className="mn" style={{ fontSize: 12, color: 'var(--muted)' }}>
          ← Parçaya dön
        </Link>
        <YazdirButonu />
      </div>

      <p className="yazdirma-disi" style={{ maxWidth: 620, margin: '0 auto 16px', fontSize: 12.5, color: 'var(--muted)' }}>
        Yazdırıp parçanın kutusuna/çekmecesine yapıştır. Bir barkod okuyucuyla (ya da uygulamadaki
        arama kutusuna elle yapıştırarak) taradığında doğrudan bu parçanın sayfası açılır.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div
          className="etiket-karti"
          style={{
            width: 340,
            padding: 20,
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="QR"
            width={112}
            height={112}
            style={{ flexShrink: 0, borderRadius: 6, border: '1px solid var(--line-soft)' }}
          />
          <div style={{ minWidth: 0 }}>
            <div className="mn" style={{ fontWeight: 700, fontSize: 16, wordBreak: 'break-word' }}>
              {s.mpn}
            </div>
            {(s.uretici || s.kilif) && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                {[s.uretici, s.kilif].filter(Boolean).join(' · ')}
              </div>
            )}
            {(s.konum_kodu || s.konum_adi) && (
              <div className="mn" style={{ fontSize: 11, color: 'var(--copper)', marginTop: 6 }}>
                {s.konum_kodu ?? s.konum_adi}
              </div>
            )}
            <div className="mn" style={{ fontSize: 8.5, color: 'var(--muted-2)', marginTop: 10, letterSpacing: '0.03em' }}>
              {stokKodu(s.stok_id)}
            </div>
            <div style={{ fontSize: 9.5, color: 'var(--muted-2)', marginTop: 4, fontWeight: 600 }}>LabStock</div>
          </div>
        </div>
      </div>
    </main>
  );
}
