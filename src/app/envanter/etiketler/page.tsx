import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { konumKodu, IZGARA_QR_OLCU } from '@/lib/etiket';
import { qrGorseli, etiketAyarlariniAl } from '@/lib/etiket-sunucu';
import { YazdirButonu } from '@/components/yazdir-butonu';
import type { Konum } from '@/lib/types';

export const dynamic = 'force-dynamic';

function yolOlustur(konum: Konum, harita: Map<string, Konum>): string {
  const parcalar: string[] = [konum.ad];
  let simdiki = konum.parent_id ? harita.get(konum.parent_id) : undefined;
  while (simdiki) {
    parcalar.unshift(simdiki.ad);
    simdiki = simdiki.parent_id ? harita.get(simdiki.parent_id) : undefined;
  }
  return parcalar.join(' › ');
}

export default async function KonumEtiketleriSayfasi() {
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');

  const supabase = await createClient();
  const { data: konumVerisi } = await supabase
    .from('locations')
    .select('id, parent_id, ad, kod, tip, aciklama, sira')
    .eq('user_id', aktif.kullaniciId)
    .order('sira', { ascending: true });

  const konumlar = (konumVerisi ?? []) as Konum[];
  const harita = new Map(konumlar.map((k) => [k.id, k]));

  const etiketler = await Promise.all(
    konumlar.map(async (k) => ({
      konum: k,
      yol: yolOlustur(k, harita),
      qr: await qrGorseli(konumKodu(k.id)),
    })),
  );

  const ayarlar = await etiketAyarlariniAl();
  const qrOlcu = IZGARA_QR_OLCU[ayarlar.boyut];
  const yuvarlak = ayarlar.sekil === 'yuvarlak';

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div
        className="yazdirma-disi"
        style={{
          maxWidth: 900,
          margin: '0 auto 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link href="/envanter" className="mn" style={{ fontSize: 12, color: 'var(--muted)' }}>
          ← Envantere dön
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/ayarlar" className="mn" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            Etiket görünümünü ayarla
          </Link>
          {etiketler.length > 0 && <YazdirButonu />}
        </div>
      </div>

      <div className="yazdirma-disi" style={{ maxWidth: 900, margin: '0 auto 20px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 600, letterSpacing: '-0.4px' }}>
          Konum etiketleri
        </h1>
        <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          Yazdır, kes, çekmecelere/raflara yapıştır. Bir barkod okuyucuyla taradığında (ya da
          arama kutusuna elle yapıştırdığında) doğrudan o konumdaki parçalar açılır.
        </p>
      </div>

      {etiketler.length === 0 ? (
        <div className="kart" style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Henüz bir konum yok.</p>
        </div>
      ) : (
        <div
          className="etiket-izgara"
          style={{
            maxWidth: 900,
            margin: '0 auto',
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, minmax(${yuvarlak ? qrOlcu + 60 : 240}px, 1fr))`,
            gap: 12,
          }}
        >
          {etiketler.map(({ konum, yol, qr }) =>
            yuvarlak ? (
              <div
                key={konum.id}
                className="etiket-karti"
                style={{
                  padding: 12,
                  aspectRatio: '1 / 1',
                  borderRadius: '50%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  textAlign: 'center',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR" width={qrOlcu} height={qrOlcu} style={{ flexShrink: 0 }} />
                <div className="mn" style={{ fontWeight: 700, fontSize: 11 }}>
                  {konum.kod ?? konum.ad}
                </div>
                {ayarlar.marka && (
                  <div style={{ fontSize: 7.5, color: 'var(--muted-2)', fontWeight: 600 }}>LabStock</div>
                )}
              </div>
            ) : (
              <div
                key={konum.id}
                className="etiket-karti"
                style={{
                  padding: 14,
                  display: 'flex',
                  gap: 10,
                  alignItems: 'center',
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--r)',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr}
                  alt="QR"
                  width={qrOlcu}
                  height={qrOlcu}
                  style={{ flexShrink: 0, borderRadius: 4, border: '1px solid var(--line-soft)' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="mn" style={{ fontWeight: 700, fontSize: 13 }}>
                    {konum.kod ?? konum.ad}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{yol}</div>
                  {ayarlar.marka && (
                    <div style={{ fontSize: 8.5, color: 'var(--muted-2)', marginTop: 6, fontWeight: 600 }}>
                      LabStock
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </main>
  );
}
