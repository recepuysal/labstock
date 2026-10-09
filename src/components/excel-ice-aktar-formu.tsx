'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { excelIceAktar, type IceAktarSonuc } from '@/app/envanter/ice-aktar/actions';
import { useSozluk } from '@/lib/i18n/istemci';

export function ExcelIceAktarFormu() {
  const sozlukler = useSozluk();
  const s = sozlukler.envanter.iceAktar;
  const [durum, gonder, bekliyor] = useActionState<IceAktarSonuc, FormData>(excelIceAktar, {});

  return (
    <div>
      <form action={gonder} className="kart" style={{ padding: 22 }}>
        {durum.hata && (
          <div className="hata" style={{ marginBottom: 16 }}>
            {durum.hata}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label className="etiket" htmlFor="dosya">
            {s.dosya}
          </label>
          <input
            className="alan"
            id="dosya"
            name="dosya"
            type="file"
            accept=".xlsx,.xls,.csv"
            required
            style={{ height: 'auto', padding: 8 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
            {bekliyor ? s.isleniyor : s.iceAktar}
          </button>
          <Link href="/envanter" className="btn">
            {sozlukler.envanter.vazgec}
          </Link>
        </div>
      </form>

      {durum.ozet && (
        <div className="kart" style={{ padding: 22, marginTop: 16 }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>{s.sonuc}</h2>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12.5, lineHeight: 1.9 }}>
            <li>{s.toplam} {durum.ozet.toplam}</li>
            <li>{s.yeniParca} {durum.ozet.yeniParca}</li>
            <li>{s.yeniStok} {durum.ozet.yeniStok}</li>
            <li>{s.guncellenen} {durum.ozet.guncellenenStok}</li>
            <li style={{ color: durum.ozet.atlanan > 0 ? 'var(--crit)' : undefined }}>
              {s.atlanan} {durum.ozet.atlanan}
            </li>
          </ul>

          {durum.ozet.hatalar.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div className="etiket">{s.hataOrnekleri}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, color: 'var(--muted)' }}>
                {durum.ozet.hatalar.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href="/envanter"
            className="btn btn-birincil"
            style={{ marginTop: 16, display: 'inline-flex' }}
          >
            {sozlukler.ortak.buton.envantereDon}
          </Link>
        </div>
      )}
    </div>
  );
}
