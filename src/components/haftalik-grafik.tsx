'use client';

import { useState } from 'react';

/** Tek serilik haftalık sütun grafiği (yönetici istatistikleri). Sütunun
 * üzerine gelince hafta ve değer gösterilir; ince sütunlar, tabana oturan
 * yuvarlatılmış uçlar, sadece son değer etiketli, soluk ızgara. */
export function HaftalikGrafik({
  baslik,
  aciklama,
  veriler,
}: {
  baslik: string;
  aciklama?: string;
  /** etiket: okunur hafta adı (ör. "06.10 haftası"), degerMetni: ör. "3 kişi" — sunucuda hazırlanır. */
  veriler: { hafta: string; deger: number; etiket: string; degerMetni: string }[];
}) {
  const [secili, setSecili] = useState<number | null>(null);
  const enBuyuk = Math.max(1, ...veriler.map((v) => v.deger));
  const tavan = Math.max(1, Math.ceil(enBuyuk));
  const YUKSEKLIK = 120;
  const son = veriler.length - 1;

  return (
    <div className="kart" style={{ padding: 20, marginTop: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{baslik}</div>
      {aciklama && <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{aciklama}</div>}

      <div style={{ position: 'relative', marginTop: 16, height: YUKSEKLIK + 22 }}>
        {/* soluk ızgara: taban ve tavan çizgisi */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, borderTop: '1px dashed var(--line)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: YUKSEKLIK, borderTop: '1px solid var(--line)' }} />
        <span className="mn" style={{ position: 'absolute', right: 0, top: -14, fontSize: 9.5, color: 'var(--muted-2)' }}>
          {tavan}
        </span>

        <div style={{ position: 'absolute', inset: `0 0 22px 0`, display: 'flex', alignItems: 'flex-end', gap: 6 }}>
          {veriler.map((v, i) => {
            const h = (v.deger / tavan) * YUKSEKLIK;
            return (
              <div
                key={v.hafta}
                onMouseEnter={() => setSecili(i)}
                onMouseLeave={() => setSecili(null)}
                aria-label={`${v.etiket}: ${v.degerMetni}`}
                style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', position: 'relative', cursor: 'default' }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: 22,
                    height: Math.max(h, v.deger > 0 ? 3 : 0),
                    background: 'var(--copper)',
                    opacity: secili === null || secili === i ? 1 : 0.45,
                    borderRadius: '4px 4px 0 0',
                  }}
                />
                {(i === son || secili === i) && v.deger >= 0 && (
                  <span
                    className="mn"
                    style={{
                      position: 'absolute',
                      bottom: h + 4,
                      fontSize: 10.5,
                      fontWeight: 600,
                      color: 'var(--ink)',
                    }}
                  >
                    {v.deger}
                  </span>
                )}
                {secili === i && (
                  <div
                    role="tooltip"
                    style={{
                      position: 'absolute',
                      bottom: h + 22,
                      whiteSpace: 'nowrap',
                      padding: '5px 8px',
                      borderRadius: 6,
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      boxShadow: '0 4px 12px rgba(0,0,0,.12)',
                      fontSize: 11,
                      color: 'var(--ink)',
                      zIndex: 2,
                    }}
                  >
                    {v.etiket} · <b>{v.degerMetni}</b>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* x ekseni: ilk, orta ve son hafta */}
        {[0, Math.floor(son / 2), son].map((i) => (
          <span
            key={i}
            className="mn"
            style={{
              position: 'absolute',
              bottom: 0,
              left: i === 0 ? 0 : undefined,
              right: i === son ? 0 : undefined,
              ...(i !== 0 && i !== son ? { left: '50%', transform: 'translateX(-50%)' } : {}),
              fontSize: 9.5,
              color: 'var(--muted-2)',
            }}
          >
            {veriler[i]?.hafta.slice(5).split('-').reverse().join('.')}
          </span>
        ))}
      </div>
    </div>
  );
}
