import Link from 'next/link';
import { AdetButonlari } from './adet-butonlari';
import { SatirMenu } from './satir-menu';
import { DURUM_ETIKET, sayi, type EnvanterSatiri } from '@/lib/types';

const SUTUNLAR = '30px minmax(0,1fr) 122px 88px 96px 82px 150px 60px 30px';

export function ParcaTablosu({
  satirlar,
  saltOkunur,
}: {
  satirlar: EnvanterSatiri[];
  saltOkunur?: boolean;
}) {
  return (
    <div className="kart" style={{ overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: SUTUNLAR,
          columnGap: 10,
          alignItems: 'center',
          height: 34,
          padding: '0 12px',
          background: 'var(--bg)',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--muted-2)',
        }}
      >
        <div />
        <div>Parça</div>
        <div>Kategori</div>
        <div>Kılıf</div>
        <div>Konum</div>
        <div style={{ textAlign: 'right' }}>Adet</div>
        <div>Min/Durum</div>
        <div />
        <div />
      </div>

      {satirlar.map((s) => (
        <div
          key={s.stok_id}
          style={{
            display: 'grid',
            gridTemplateColumns: SUTUNLAR,
            columnGap: 10,
            alignItems: 'center',
            minHeight: 46,
            padding: '0 12px',
            borderTop: '1px solid var(--line-soft)',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              border: '1.5px solid #d2c7b1',
              borderRadius: 3,
            }}
          />

          <div style={{ minWidth: 0 }}>
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

          <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{s.kategori ?? '—'}</div>
          <div className="mn" style={{ fontSize: 11.5, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5 }}>
            {s.kilif ?? '—'}
            {s.rohs === true && (
              <span title="RoHS uyumlu" style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--ok-dot)', flexShrink: 0 }} />
            )}
            {s.rohs === false && (
              <span title="RoHS değil" style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--crit-dot)', flexShrink: 0 }} />
            )}
          </div>

          <div>
            {s.konum_kodu || s.konum_adi ? (
              <span
                className="mn"
                style={{
                  fontSize: 11,
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                  borderRadius: 4,
                  padding: '2px 6px',
                  color: 'var(--ink-2)',
                }}
              >
                {s.konum_kodu ?? s.konum_adi}
              </span>
            ) : (
              <span style={{ fontSize: 11.5, color: 'var(--muted-2)' }}>konumsuz</span>
            )}
          </div>

          <div className="mn" style={{ fontSize: 13, textAlign: 'right' }}>
            {sayi.format(s.adet)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mn" style={{ fontSize: 11, color: 'var(--muted-2)', minWidth: 26, textAlign: 'right' }}>
              {s.min_adet > 0 ? sayi.format(s.min_adet) : '—'}
            </span>
            <span className={`pill pill-${s.durum}`}>
              <span className="dot" />
              {DURUM_ETIKET[s.durum]}
            </span>
          </div>

          <AdetButonlari stokId={s.stok_id} adet={s.adet} saltOkunur={saltOkunur} />
          <SatirMenu stokId={s.stok_id} mpn={s.mpn} saltOkunur={saltOkunur} />
        </div>
      ))}
    </div>
  );
}
