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
          setTimeout(() => {
            setToastlar((t) => t.filter((x) => x.id !== id));
          }, 2200);
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
            padding: '12px 16px',
            fontSize: 12.5,
            maxWidth: 300,
            boxShadow: '0 8px 24px rgba(0,0,0,0.16)',
          }}
        >
          {t.metin}
        </div>
      ))}
    </div>
  );
}
