'use client';

import { useActionState } from 'react';
import { linktenCek } from '@/app/envanter/actions';
import type { EylemDurum } from '@/app/envanter/actions';

export function ModulCekFormu({
  stokId,
  partId,
  saltOkunur,
}: {
  stokId: string;
  partId: string;
  saltOkunur?: boolean;
}) {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(linktenCek, {});

  return (
    <form action={gonder} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="hidden" name="stok_id" value={stokId} />
      <input type="hidden" name="part_id" value={partId} />
      <input
        className="alan mn"
        style={{ height: 34, width: 260 }}
        name="urun_url"
        placeholder="Direnç.net / Robotistan ürün linki"
        disabled={saltOkunur}
        required
      />
      <button className="btn btn-birincil" type="submit" disabled={saltOkunur || bekliyor}>
        {bekliyor ? 'Çekiliyor…' : 'Çek'}
      </button>
      {durum.hata && <span style={{ fontSize: 11.5, color: 'var(--crit)' }}>{durum.hata}</span>}
      {durum.bilgi && <span style={{ fontSize: 11.5, color: 'var(--ok)' }}>{durum.bilgi}</span>}
    </form>
  );
}
