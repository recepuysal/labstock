import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { stokKodu, ETIKET_OLCU, YAZI_OLCU } from '@/lib/etiket';
import { qrGorseli, etiketAyarlariniAl } from '@/lib/etiket-sunucu';
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
  const ayarlar = await etiketAyarlariniAl();
  const olcu = ETIKET_OLCU[ayarlar.boyut];
  const yazi = YAZI_OLCU[ayarlar.yaziBoyutu];
  const yuvarlak = ayarlar.sekil === 'yuvarlak';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/ayarlar" className="mn" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            Etiket görünümünü ayarla
          </Link>
          <YazdirButonu />
        </div>
      </div>

      <p className="yazdirma-disi" style={{ maxWidth: 620, margin: '0 auto 16px', fontSize: 12.5, color: 'var(--muted)' }}>
        Yazdırıp parçanın kutusuna/çekmecesine yapıştır. Bir barkod okuyucuyla (ya da uygulamadaki
        arama kutusuna elle yapıştırarak) taradığında doğrudan bu parçanın sayfası açılır.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        {yuvarlak ? (
          <div
            className="etiket-karti"
            style={{
              width: olcu.qr + olcu.kartPadding * 2,
              aspectRatio: '1 / 1',
              borderRadius: '50%',
              padding: olcu.kartPadding,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              textAlign: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR" width={olcu.qr} height={olcu.qr} style={{ flexShrink: 0 }} />
            <div className="mn" style={{ fontWeight: 700, fontSize: yazi.mpn * 0.85, wordBreak: 'break-word' }}>
              {s.mpn}
            </div>
            {ayarlar.marka && (
              <div style={{ fontSize: yazi.alt * 0.85, color: 'var(--muted-2)', fontWeight: 600 }}>LabStock</div>
            )}
          </div>
        ) : (
          <div
            className="etiket-karti"
            style={{
              width: olcu.kartGenislik,
              padding: olcu.kartPadding,
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
              width={olcu.qr}
              height={olcu.qr}
              style={{ flexShrink: 0, borderRadius: 6, border: '1px solid var(--line-soft)' }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="mn" style={{ fontWeight: 700, fontSize: yazi.mpn, wordBreak: 'break-word', lineHeight: 1.2 }}>
                {s.mpn}
              </div>
              {(s.uretici || s.kilif) && (
                <div style={{ fontSize: yazi.alt, color: 'var(--muted)', marginTop: 4, lineHeight: 1.3 }}>
                  {[s.uretici, s.kilif].filter(Boolean).join(' · ')}
                </div>
              )}
              {(s.konum_kodu || s.konum_adi) && (
                <div className="mn" style={{ fontSize: yazi.alt, color: 'var(--copper)', marginTop: 6, fontWeight: 600 }}>
                  {s.konum_kodu ?? s.konum_adi}
                </div>
              )}
              <div
                className="mn"
                style={{ fontSize: yazi.alt * 0.75, color: 'var(--muted-2)', marginTop: 10, letterSpacing: '0.03em' }}
              >
                {stokKodu(s.stok_id)}
              </div>
              {ayarlar.marka && (
                <div style={{ fontSize: yazi.alt * 0.85, color: 'var(--muted-2)', marginTop: 4, fontWeight: 600 }}>
                  LabStock
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
