'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { etiketAyarlariniKaydet } from '@/app/ayarlar/actions';
import type { EtiketAyarlari } from '@/lib/etiket';

export function EtiketAyarlariFormu({ baslangic }: { baslangic: EtiketAyarlari }) {
  const [ayarlar, setAyarlar] = useState(baslangic);
  const [kaydediliyor, basla] = useTransition();
  const router = useRouter();

  function guncelle(yeni: Partial<EtiketAyarlari>) {
    const birlesik = { ...ayarlar, ...yeni };
    setAyarlar(birlesik);
    basla(async () => {
      await etiketAyarlariniKaydet(birlesik);
      router.refresh();
    });
  }

  const pil = (aktif: boolean): React.CSSProperties => ({
    height: 28,
    padding: '0 12px',
    borderRadius: 'var(--r-sm)',
    fontSize: 12,
    fontWeight: aktif ? 600 : 500,
    background: aktif ? 'var(--copper)' : 'var(--bg)',
    color: aktif ? '#fdfbf7' : 'var(--muted)',
    border: `1px solid ${aktif ? 'var(--copper)' : 'var(--line)'}`,
    cursor: 'pointer',
  });

  return (
    <div className="kart" style={{ padding: 20, marginTop: 16, opacity: kaydediliyor ? 0.7 : 1 }}>
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 14 }}
      >
        ETİKET (QR) GÖRÜNÜMÜ
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="etiket">Şekil</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={pil(ayarlar.sekil === 'kare')} onClick={() => guncelle({ sekil: 'kare' })}>
            Kare
          </button>
          <button
            type="button"
            style={pil(ayarlar.sekil === 'yuvarlak')}
            onClick={() => guncelle({ sekil: 'yuvarlak' })}
          >
            Yuvarlak
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="etiket">Boyut (QR/kart)</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" style={pil(ayarlar.boyut === 'kucuk')} onClick={() => guncelle({ boyut: 'kucuk' })}>
            Küçük
          </button>
          <button type="button" style={pil(ayarlar.boyut === 'orta')} onClick={() => guncelle({ boyut: 'orta' })}>
            Orta
          </button>
          <button type="button" style={pil(ayarlar.boyut === 'buyuk')} onClick={() => guncelle({ boyut: 'buyuk' })}>
            Büyük
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label className="etiket">Yazı büyüklüğü</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={pil(ayarlar.yaziBoyutu === 'kucuk')}
            onClick={() => guncelle({ yaziBoyutu: 'kucuk' })}
          >
            Küçük
          </button>
          <button
            type="button"
            style={pil(ayarlar.yaziBoyutu === 'orta')}
            onClick={() => guncelle({ yaziBoyutu: 'orta' })}
          >
            Orta
          </button>
          <button
            type="button"
            style={pil(ayarlar.yaziBoyutu === 'buyuk')}
            onClick={() => guncelle({ yaziBoyutu: 'buyuk' })}
          >
            Büyük
          </button>
          <button
            type="button"
            style={pil(ayarlar.yaziBoyutu === 'cok-buyuk')}
            onClick={() => guncelle({ yaziBoyutu: 'cok-buyuk' })}
          >
            Çok büyük
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--muted-2)' }}>
          Etikette boşluk kalıyorsa yazıyı büyütmek alanı daha iyi doldurur.
        </p>
      </div>

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12.5,
          color: 'var(--ink-2)',
          cursor: 'pointer',
        }}
      >
        <input
          type="checkbox"
          checked={ayarlar.marka}
          onChange={(e) => guncelle({ marka: e.target.checked })}
          style={{ width: 15, height: 15, accentColor: 'var(--copper)' }}
        />
        Etikette &quot;LabStock&quot; ibaresi göster
      </label>
    </div>
  );
}
