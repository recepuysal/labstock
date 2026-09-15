'use client';

import { useEffect, useState } from 'react';

export type GuncellemeDurumu =
  | { tip: 'mevcut'; versiyon: string; notlar?: string | null }
  | { tip: 'ilerleme'; yuzde: number }
  | { tip: 'hazir'; versiyon: string; notlar?: string | null }
  | { tip: 'hata'; mesaj: string };

// Sürüm notu metninin ilk satırı/paragrafı kısa açıklamadır (CI, tag'lenen
// commit mesajının ilk satırını yazar — bkz. .github/workflows/build-desktop.yml).
// Geri kalan ayrıntı gösterilmiyor.
function kisaAciklamaCikar(notlar: string | null | undefined): string | null {
  const temiz = notlar?.trim();
  if (!temiz) return null;
  const bosSatir = temiz.search(/\r?\n\s*\r?\n/);
  return (bosSatir === -1 ? temiz : temiz.slice(0, bosSatir)).trim() || null;
}

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

  const hazirMi = durum.tip === 'hazir';
  const kisa = kisaAciklamaCikar(durum.tip === 'mevcut' || durum.tip === 'hazir' ? durum.notlar : null);

  return (
    <div
      className="kart guncelleme-karti"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 1000,
        width: 300,
        padding: 16,
        boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 99,
            background: hazirMi ? 'var(--ok-bg)' : 'var(--copper-soft)',
            color: hazirMi ? 'var(--ok)' : 'var(--copper)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {hazirMi ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="m8 12.5 2.5 2.5 5-5.5" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="m7 10.5 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
          <div
            className="mn"
            style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: hazirMi ? 'var(--ok)' : 'var(--copper)' }}
          >
            {hazirMi ? 'GÜNCELLEME HAZIR' : 'GÜNCELLEME'}
          </div>

          {durum.tip === 'mevcut' && (
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-2)' }}>
              Yeni bir sürüm var: <span className="mn">v{durum.versiyon}</span>
            </p>
          )}
          {durum.tip === 'ilerleme' && (
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-2)' }}>İndiriliyor…</p>
          )}
          {durum.tip === 'hazir' && (
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-2)' }}>
              <span className="mn">v{durum.versiyon}</span> indirildi.
            </p>
          )}

          {kisa && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>{kisa}</p>
          )}
        </div>

        {durum.tip !== 'ilerleme' && (
          <button type="button" onClick={() => setKapandi(true)} aria-label="Kapat" className="bildirim-kapat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {durum.tip === 'mevcut' && (
        <button
          type="button"
          className="btn btn-birincil"
          style={{ width: '100%', height: 32, fontSize: 12.5, marginTop: 12 }}
          onClick={() => window.electronAPI?.guncellemeyiIndir()}
        >
          İndir
        </button>
      )}

      {durum.tip === 'ilerleme' && (
        <>
          <div
            style={{
              height: 6,
              borderRadius: 99,
              background: 'var(--bg)',
              overflow: 'hidden',
              marginTop: 12,
              marginBottom: 6,
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
        <button
          type="button"
          className="btn btn-birincil"
          style={{ width: '100%', height: 32, fontSize: 12.5, marginTop: 12 }}
          onClick={() => window.electronAPI?.guncellemeyiKur()}
        >
          Yeniden başlat ve kur
        </button>
      )}
    </div>
  );
}
