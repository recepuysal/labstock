'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type ToastOge = { id: number; metin: string };

export function AlinacaklarBildirimi({
  hedef,
  izlenenAdi,
  izleyenler,
}: {
  hedef: string;
  izlenenAdi: string | null;
  izleyenler: { id: string; ad: string }[];
}) {
  const [toastlar, setToastlar] = useState<ToastOge[]>([]);
  const sayacRef = useRef(0);

  useEffect(() => {
    const supabase = createClient();
    let benimId: string | null = null;
    let iptal = false;

    supabase.auth.getUser().then(({ data }) => {
      if (!iptal) benimId = data.user?.id ?? null;
    });

    const kanal = supabase
      .channel(`alinacaklar-bildirim-${hedef}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'alinacaklar', filter: `user_id=eq.${hedef}` },
        (payload) => {
          const satir = payload.new as { olusturan?: string; malzeme_adi?: string };
          if (!satir?.malzeme_adi || !satir.olusturan || satir.olusturan === benimId) return;

          let kim = 'Bir izleyicin';
          if (satir.olusturan === hedef && izlenenAdi) {
            kim = izlenenAdi;
          } else {
            const bulunan = izleyenler.find((i) => i.id === satir.olusturan);
            if (bulunan) kim = bulunan.ad;
          }

          const id = ++sayacRef.current;
          setToastlar((t) => [...t, { id, metin: `${kim}: ${satir.malzeme_adi}` }]);
        },
      )
      .subscribe();

    return () => {
      iptal = true;
      supabase.removeChannel(kanal);
    };
  }, [hedef, izlenenAdi, izleyenler]);

  if (toastlar.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
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
              background: 'var(--copper-soft)',
              color: 'var(--copper)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
            <div
              className="mn"
              style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--copper)' }}
            >
              ALINACAKLARA EKLENDİ
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
  );
}
