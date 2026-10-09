'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { konumDegistir } from '@/app/envanter/actions';
import { useSozluk } from '@/lib/i18n/istemci';

export function KonumDegistirFormu({
  stokId,
  konumId,
  konumlar,
  saltOkunur,
}: {
  stokId: string;
  konumId: string | null;
  konumlar: { id: string; etiket: string }[];
  saltOkunur?: boolean;
}) {
  const sozlukler = useSozluk();
  const s = sozlukler.envanter.konumDegistir;
  const [acik, setAcik] = useState(false);
  const [secili, setSecili] = useState(konumId ?? '');
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();
  const router = useRouter();

  function kapat() {
    setAcik(false);
    setSecili(konumId ?? '');
    setHata(null);
  }

  function kaydet() {
    setHata(null);
    basla(async () => {
      const sonuc = await konumDegistir(stokId, secili || null);
      if (sonuc.hata) {
        setHata(sonuc.hata);
        return;
      }
      setAcik(false);
      router.refresh();
    });
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className="btn" disabled={saltOkunur} onClick={() => setAcik((a) => !a)}>
        {s.buton}
      </button>

      {acik && (
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
          <select
            className="alan mn"
            style={{ height: 34, minWidth: 200 }}
            value={secili}
            onChange={(e) => setSecili(e.target.value)}
            autoFocus
          >
            <option value="">{s.konumsuz}</option>
            {konumlar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.etiket}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn-birincil" disabled={bekliyor} onClick={kaydet}>
            {bekliyor ? sozlukler.ortak.buton.kaydediliyor : sozlukler.ortak.buton.kaydet}
          </button>
          <button type="button" className="btn" onClick={kapat} disabled={bekliyor}>
            {sozlukler.envanter.vazgec}
          </button>
          {hata && <span style={{ fontSize: 11.5, color: 'var(--crit)' }}>{hata}</span>}
        </div>
      )}
    </div>
  );
}
