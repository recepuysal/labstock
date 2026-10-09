'use client';

import { useState } from 'react';
import { envanterDisaAktar } from '@/app/ayarlar/actions';
import { useSozluk } from '@/lib/i18n/istemci';

export function DisaAktarButonu() {
  const s = useSozluk().envanter.disaAktar;
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function disaAktar() {
    setCalisiyor(true);
    setHata(null);
    try {
      const sonuc = await envanterDisaAktar();
      if (sonuc.hata || !sonuc.xlsxTaban64) {
        setHata(sonuc.hata ?? s.hata);
        return;
      }

      const ikili = atob(sonuc.xlsxTaban64);
      const baytlar = new Uint8Array(ikili.length);
      for (let i = 0; i < ikili.length; i++) baytlar[i] = ikili.charCodeAt(i);

      const blob = new Blob([baytlar], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const tarih = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `labstock-envanter-${tarih}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setCalisiyor(false);
    }
  }

  return (
    <div className="kart" style={{ padding: 20, marginTop: 16 }}>
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}
      >
        {s.baslik}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        {s.aciklama}
      </p>
      <button type="button" className="btn" style={{ height: 32, fontSize: 12.5 }} onClick={disaAktar} disabled={calisiyor}>
        {calisiyor ? s.hazirlaniyor : s.indir}
      </button>
      {hata && (
        <div className="hata" style={{ marginTop: 10 }}>
          {hata}
        </div>
      )}
    </div>
  );
}
