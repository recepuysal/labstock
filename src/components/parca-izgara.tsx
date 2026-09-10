import Link from 'next/link';
import { AdetButonlari } from './adet-butonlari';
import { SatirMenu } from './satir-menu';
import { DURUM_ETIKET, sayi, type EnvanterSatiri } from '@/lib/types';

export function ParcaIzgara({
  satirlar,
  saltOkunur,
}: {
  satirlar: EnvanterSatiri[];
  saltOkunur?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(228px, 1fr))',
        gap: 12,
      }}
    >
      {satirlar.map((s) => (
        <div
          key={s.stok_id}
          className="kart"
          style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <Link
                href={`/envanter/${s.stok_id}`}
                className="mn parca-link"
                style={{
                  display: 'block',
                  fontSize: 12.5,
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.mpn}
              </Link>
              {(s.aciklama || s.uretici) && (
                <div
                  style={{
                    fontSize: 10.5,
                    color: 'var(--muted)',
                    marginTop: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {[s.aciklama, s.uretici].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            <SatirMenu stokId={s.stok_id} mpn={s.mpn} saltOkunur={saltOkunur} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {s.kategori && (
              <span
                style={{
                  fontSize: 10.5,
                  color: 'var(--ink-2)',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                {s.kategori}
              </span>
            )}
            {s.kilif && (
              <span
                className="mn"
                style={{
                  fontSize: 10.5,
                  color: 'var(--ink-2)',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                {s.kilif}
              </span>
            )}
            {(s.konum_kodu || s.konum_adi) && (
              <span
                className="mn"
                style={{
                  fontSize: 10.5,
                  color: 'var(--ink-2)',
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                {s.konum_kodu ?? s.konum_adi}
              </span>
            )}
            {s.rohs === true && (
              <span
                style={{
                  fontSize: 10.5,
                  color: 'var(--ok)',
                  background: 'var(--ok-bg)',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                RoHS
              </span>
            )}
            {s.rohs === false && (
              <span
                style={{
                  fontSize: 10.5,
                  color: 'var(--crit)',
                  background: 'var(--crit-bg)',
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                RoHS değil
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mn" style={{ fontSize: 15, fontWeight: 600 }}>
                {sayi.format(s.adet)}
              </span>
              <span className={`pill pill-${s.durum}`}>
                <span className="dot" />
                {DURUM_ETIKET[s.durum]}
              </span>
            </div>
            <AdetButonlari stokId={s.stok_id} adet={s.adet} saltOkunur={saltOkunur} />
          </div>
        </div>
      ))}
    </div>
  );
}
