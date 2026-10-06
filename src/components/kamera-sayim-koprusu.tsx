'use client';

import { useEffect, useRef, useState } from 'react';
import { kameraKonumParcalari, kameraParcaAra, kameraSayimUygula, kameraStokBilgisi } from '@/app/envanter/kamera-actions';

/* Kamera sayımı köprüsü: aynı bilgisayarda çalışan görüntü işleme servisine (labstock_sayim.py)
 * saniyede bir "bekleyen iş var mı?" diye sorar; telefonda okutulan QR'lar için parça bilgisini
 * verir ve telefonda onaylanan sayımları stoğa işler. Servis çalışmıyorsa sessizce bekler. */

const SERVIS = 'http://127.0.0.1:8765/labstock';
const ARALIK = 1000;
const BEKLEME = 5000; // servis kapalıyken daha seyrek dene

type Istek =
  | { id: number; tur: 'bilgi'; stokId: string }
  | { id: number; tur: 'konum'; konumId: string }
  | { id: number; tur: 'ara'; q: string }
  | { id: number; tur: 'sayim'; stokId: string; adet: number };

type ToastOge = { id: number; baslik: string; metin: string; hata: boolean };
/** Servisin bildirdiği telefon durumu; servis kapalıysa null (rozet gizlenir). */
type TelefonDurumu = { telefon: boolean; mod: 'kamera' | 'sayim'; canli: boolean } | null;

async function isle(istek: Istek): Promise<unknown> {
  switch (istek.tur) {
    case 'bilgi':
      return kameraStokBilgisi(istek.stokId);
    case 'konum':
      return kameraKonumParcalari(istek.konumId);
    case 'ara':
      return kameraParcaAra(istek.q);
    case 'sayim':
      return kameraSayimUygula(istek.stokId, Number(istek.adet));
    default:
      return { ok: false, hata: 'Bilinmeyen istek' };
  }
}

export function KameraSayimKoprusu() {
  const [toastlar, setToastlar] = useState<ToastOge[]>([]);
  const [durum, setDurum] = useState<TelefonDurumu>(null);
  const sayacRef = useRef(0);

  useEffect(() => {
    let iptal = false;
    let zamanlayici: ReturnType<typeof setTimeout>;

    const toast = (baslik: string, metin: string, hata = false) => {
      const id = ++sayacRef.current;
      setToastlar((t) => [...t, { id, baslik, metin, hata }]);
      setTimeout(() => setToastlar((t) => t.filter((x) => x.id !== id)), 8000);
    };

    const tur = async () => {
      let sonraki = ARALIK;
      try {
        const yanit = await fetch(`${SERVIS}/istekler`, { cache: 'no-store', signal: AbortSignal.timeout(2500) });
        const { istekler, durum: d } = (await yanit.json()) as { istekler: Istek[]; durum?: TelefonDurumu };
        setDurum(d && typeof d === 'object' ? { telefon: !!d.telefon, mod: d.mod === 'sayim' ? 'sayim' : 'kamera', canli: !!d.canli } : null);
        for (const istek of istekler) {
          if (iptal) return;
          let sonuc: unknown;
          try {
            sonuc = await isle(istek);
          } catch (e) {
            sonuc = { ok: false, hata: e instanceof Error ? e.message : 'LabStock hatası' };
          }
          await fetch(`${SERVIS}/cevap`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: istek.id, sonuc }),
          });
          if (istek.tur === 'sayim') {
            const s = sonuc as { ok: boolean; mpn?: string; eski?: number; yeni?: number; degisti?: boolean; hata?: string };
            if (s.ok) toast('KAMERA SAYIMI', s.degisti ? `${s.mpn}: ${s.eski} → ${s.yeni}` : `${s.mpn}: ${s.yeni} (değişmedi)`);
            else toast('KAMERA SAYIMI YAZILAMADI', s.hata ?? 'Bilinmeyen hata', true);
          }
        }
      } catch {
        sonraki = BEKLEME; // servis kapalı ya da ulaşılamıyor
        setDurum(null);
      }
      if (!iptal) zamanlayici = setTimeout(tur, sonraki);
    };

    zamanlayici = setTimeout(tur, ARALIK);
    return () => {
      iptal = true;
      clearTimeout(zamanlayici);
    };
  }, []);

  if (toastlar.length === 0 && !durum) return null;

  const bagli = !!durum?.telefon;
  const etiket = !bagli ? 'Telefon bekleniyor' : durum?.mod === 'sayim' ? 'Telefon bağlı · Sayım' : 'Telefon bağlı';

  return (
    <>
    {durum && (
      <div
        className="kart"
        title={bagli ? 'Telefon kamerası görüntü işleme servisine bağlı' : 'Görüntü işleme servisi çalışıyor, telefon bağlı değil'}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: 1999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 12px 7px 10px',
          borderRadius: 99,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ink-2)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: bagli ? 'var(--copper)' : 'var(--ink-2)', opacity: bagli ? 1 : 0.6 }}>
          <rect x="6" y="2" width="12" height="20" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
        <span>{etiket}</span>
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            borderRadius: 99,
            background: bagli ? (durum?.canli ? '#22c55e' : '#eab308') : '#9ca3af',
            boxShadow: bagli && durum?.canli ? '0 0 0 3px rgba(34,197,94,0.18)' : 'none',
          }}
        />
      </div>
    )}
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: durum ? 60 : 16,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toastlar.map((t) => (
        <div
          key={t.id}
          className="kart alinacak-toast"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            width: 300,
            boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 99,
              background: t.hata ? 'rgba(220,38,38,0.12)' : 'var(--copper-soft)',
              color: t.hata ? '#dc2626' : 'var(--copper)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.6l1.4-2h7l1.4 2h1.6A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" />
              <circle cx="12" cy="13" r="3.6" />
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
            <div
              className="mn"
              style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: t.hata ? '#dc2626' : 'var(--copper)' }}
            >
              {t.baslik}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>{t.metin}</p>
          </div>

          <button
            type="button"
            onClick={() => setToastlar((cur) => cur.filter((x) => x.id !== t.id))}
            aria-label="Bildirimi kapat"
            className="bildirim-kapat"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
    </>
  );
}
