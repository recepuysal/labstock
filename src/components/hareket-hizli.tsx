'use client';

import { useState, useTransition } from 'react';
import { stokHareket } from '@/app/envanter/actions';

export function HareketHizli({
  stokId,
  adet,
  saltOkunur,
}: {
  stokId: string;
  adet: number;
  saltOkunur?: boolean;
}) {
  const [acikYon, setAcikYon] = useState<1 | -1 | null>(null);
  const [miktar, setMiktar] = useState('1');
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  function kapat() {
    setAcikYon(null);
    setMiktar('1');
    setHata(null);
  }

  function gonder(yon: 1 | -1) {
    const n = Number(miktar);
    if (!Number.isFinite(n) || n <= 0) {
      setHata('Geçerli bir miktar gir.');
      return;
    }
    setHata(null);
    basla(async () => {
      const sonuc = await stokHareket(stokId, yon * n);
      if (sonuc.hata) setHata(sonuc.hata);
      else kapat();
    });
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', gap: 8 }}>
      <button
        type="button"
        className="btn btn-birincil"
        disabled={saltOkunur || adet <= 0}
        onClick={() => setAcikYon(acikYon === -1 ? null : -1)}
      >
        − Stok düş
      </button>
      <button
        type="button"
        className="btn"
        disabled={saltOkunur}
        onClick={() => setAcikYon(acikYon === 1 ? null : 1)}
      >
        + Stok ekle
      </button>

      {acikYon && (
        <div
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
          <input
            className="alan mn"
            style={{ width: 84, height: 34 }}
            type="number"
            min={0}
            step="any"
            autoFocus
            value={miktar}
            onChange={(e) => setMiktar(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-birincil"
            disabled={bekliyor}
            onClick={() => gonder(acikYon)}
          >
            {bekliyor ? '…' : acikYon > 0 ? 'Eklemeyi onayla' : 'Düşüşü onayla'}
          </button>
          <button type="button" className="btn" onClick={kapat} disabled={bekliyor}>
            Vazgeç
          </button>
          {hata && <span style={{ fontSize: 11, color: 'var(--crit)' }}>{hata}</span>}
        </div>
      )}
    </div>
  );
}
