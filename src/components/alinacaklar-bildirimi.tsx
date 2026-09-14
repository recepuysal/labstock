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
          setToastlar((t) => [...t, { id, metin: `${kim} alınacaklara ekledi: ${satir.malzeme_adi}` }]);
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
            fontSize: 12.5,
            maxWidth: 300,
            boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
            pointerEvents: 'auto',
          }}
        >
          <span style={{ flex: 1 }}>{t.metin}</span>
          <button
            type="button"
            onClick={() => setToastlar((cur) => cur.filter((x) => x.id !== t.id))}
            aria-label="Bildirimi kapat"
            style={{
              border: 'none',
              background: 'none',
              padding: 0,
              color: 'var(--muted-2)',
              cursor: 'pointer',
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
