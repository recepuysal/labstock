'use client';

import { useEffect, useState } from 'react';

export type GuncellemeDurumu =
  | { tip: 'mevcut'; versiyon: string }
  | { tip: 'ilerleme'; yuzde: number }
  | { tip: 'hazir'; versiyon: string }
  | { tip: 'hata'; mesaj: string };

declare global {
  interface Window {
    electronAPI?: {
      guncellemeyiIndir: () => void;
      guncellemeyiKur: () => void;
      guncellemeleriKontrolEt: () => void;
      guncellemeDurumuDinle: (callback: (veri: GuncellemeDurumu) => void) => () => void;
      surumAl: () => Promise<string>;
      sifreKaydet: (sifre: string) => Promise<boolean>;
      sifreAl: () => Promise<string | null>;
      sifreSil: () => Promise<boolean>;
    };
  }
}

export function GuncellemeBildirimi() {
  const [durum, setDurum] = useState<GuncellemeDurumu | null>(null);
  const [kapandi, setKapandi] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;
    return api.guncellemeDurumuDinle((veri) => {
      if (veri.tip === 'hata') {
        console.error('Güncelleme hatası:', veri.mesaj);
        return;
      }
      setKapandi(false);
      setDurum(veri);
    });
  }, []);

  if (!durum || kapandi) return null;

  return (
    <div
      className="kart"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 1000,
        width: 300,
        padding: 16,
        boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div
          className="mn"
          style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--copper)' }}
        >
          {durum.tip === 'hazir' ? 'GÜNCELLEME HAZIR' : 'GÜNCELLEME'}
        </div>
        {durum.tip !== 'ilerleme' && (
          <button
            type="button"
            onClick={() => setKapandi(true)}
            aria-label="Kapat"
            style={{
              border: 'none',
              background: 'none',
              color: 'var(--muted-2)',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {durum.tip === 'mevcut' && (
        <>
          <p style={{ margin: '8px 0 12px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            Yeni bir sürüm var: <span className="mn">v{durum.versiyon}</span>
          </p>
          <button
            type="button"
            className="btn btn-birincil"
            style={{ width: '100%', height: 32, fontSize: 12.5 }}
            onClick={() => window.electronAPI?.guncellemeyiIndir()}
          >
            İndir
          </button>
        </>
      )}

      {durum.tip === 'ilerleme' && (
        <>
          <p style={{ margin: '8px 0 8px', fontSize: 12.5, color: 'var(--ink-2)' }}>İndiriliyor…</p>
          <div
            style={{
              height: 6,
              borderRadius: 99,
              background: 'var(--bg)',
              overflow: 'hidden',
              marginBottom: 8,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${durum.yuzde}%`,
                background: 'var(--copper)',
                borderRadius: 99,
                transition: 'width 0.25s ease',
              }}
            />
          </div>
          <div className="mn" style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>
            %{durum.yuzde}
          </div>
        </>
      )}

      {durum.tip === 'hazir' && (
        <>
          <p style={{ margin: '8px 0 12px', fontSize: 12.5, color: 'var(--ink-2)' }}>
            <span className="mn">v{durum.versiyon}</span> indirildi.
          </p>
          <button
            type="button"
            className="btn btn-birincil"
            style={{ width: '100%', height: 32, fontSize: 12.5 }}
            onClick={() => window.electronAPI?.guncellemeyiKur()}
          >
            Yeniden başlat ve kur
          </button>
        </>
      )}
    </div>
  );
}
