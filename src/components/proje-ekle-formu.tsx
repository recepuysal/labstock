'use client';

import { useActionState, useState } from 'react';
import { projeyeEkle } from '@/app/envanter/actions';
import type { EylemDurum } from '@/app/envanter/actions';
import { useSozluk } from '@/lib/i18n/istemci';

const YENI_PROJE = '__yeni__';

export function ProjeEkleFormu({
  partId,
  projeler,
  donus,
  saltOkunur,
}: {
  partId: string;
  projeler: { id: string; ad: string }[];
  donus: string;
  saltOkunur?: boolean;
}) {
  const [acik, setAcik] = useState(false);
  const [secim, setSecim] = useState(projeler.length ? projeler[0].id : YENI_PROJE);
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(projeyeEkle, {});
  const sz = useSozluk();
  const s = sz.parca.proje;

  if (!acik) {
    return (
      <button
        type="button"
        disabled={saltOkunur}
        onClick={() => setAcik(true)}
        style={{
          fontSize: 11.5,
          color: saltOkunur ? 'var(--muted-2)' : 'var(--copper)',
          background: 'none',
          border: 'none',
          cursor: saltOkunur ? 'default' : 'pointer',
          padding: 0,
        }}
      >
        {s.projeyeEkle}
      </button>
    );
  }

  return (
    <form action={gonder} style={{ marginTop: 4 }}>
      <input type="hidden" name="part_id" value={partId} />
      <input type="hidden" name="donus" value={donus} />

      {durum.hata && (
        <div className="hata" style={{ marginBottom: 8, fontSize: 11.5, padding: '6px 9px' }}>
          {durum.hata}
        </div>
      )}

      <select
        className="alan"
        style={{ height: 32, fontSize: 12, marginBottom: 8 }}
        value={secim}
        onChange={(e) => setSecim(e.target.value)}
      >
        {projeler.map((p) => (
          <option key={p.id} value={p.id}>
            {p.ad}
          </option>
        ))}
        <option value={YENI_PROJE}>{s.yeniProje}</option>
      </select>
      <input type="hidden" name="proje_id" value={secim === YENI_PROJE ? '' : secim} />

      {secim === YENI_PROJE && (
        <input
          className="alan"
          style={{ height: 32, fontSize: 12, marginBottom: 8 }}
          name="yeni_proje_adi"
          placeholder={s.projeAdi}
          required
        />
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <input
          className="alan mn"
          style={{ height: 32, fontSize: 12 }}
          name="adet"
          type="number"
          min={0.001}
          step="any"
          defaultValue={1}
          placeholder={s.adet}
        />
        <input
          className="alan"
          style={{ height: 32, fontSize: 12 }}
          name="referans"
          placeholder={s.referans}
        />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-birincil" style={{ height: 30, fontSize: 12 }} type="submit" disabled={bekliyor}>
          {bekliyor ? s.ekleniyor : sz.ortak.buton.ekle}
        </button>
        <button
          type="button"
          className="btn"
          style={{ height: 30, fontSize: 12 }}
          onClick={() => setAcik(false)}
        >
          {sz.parca.vazgec}
        </button>
      </div>
    </form>
  );
}
