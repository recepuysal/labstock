'use client';

import { useActionState, useState } from 'react';
import { lcscdenCek } from '@/app/envanter/actions';
import type { EylemDurum } from '@/app/envanter/actions';

export function LcscCekFormu({
  stokId,
  partId,
  mevcutKod,
  saltOkunur,
}: {
  stokId: string;
  partId: string;
  mevcutKod: string | null;
  saltOkunur?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(lcscdenCek, {});

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className="btn" disabled={saltOkunur} onClick={() => setAcik((a) => !a)}>
        LCSC&apos;den çek
      </button>

      {acik && (
        <form
          action={gonder}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: 10,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
            whiteSpace: 'nowrap',
          }}
        >
          <input type="hidden" name="stok_id" value={stokId} />
          <input type="hidden" name="part_id" value={partId} />
          <input
            className="alan mn"
            style={{ height: 34, width: 110 }}
            name="lcsc_kodu"
            placeholder="C25804"
            defaultValue={mevcutKod ?? ''}
            required
            autoFocus
          />
          <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
            {bekliyor ? 'Çekiliyor…' : 'Çek'}
          </button>
          <button type="button" className="btn" onClick={() => setAcik(false)} disabled={bekliyor}>
            Vazgeç
          </button>
          {durum.hata && <span style={{ fontSize: 11.5, color: 'var(--crit)' }}>{durum.hata}</span>}
        </form>
      )}
    </div>
  );
}
