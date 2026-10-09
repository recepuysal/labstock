'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { diliDegistir } from '@/app/dil-actions';
import { DILLER } from '@/lib/i18n';
import { useDil, useSozluk } from '@/lib/i18n/istemci';

/** Türkçe / English seçimi. Seçim çereze yazılır, sayfa yeni dilde yeniden çizilir. */
export function DilSecici() {
  const dil = useDil();
  const s = useSozluk();
  const router = useRouter();
  const [bekliyor, baslat] = useTransition();

  return (
    <div role="group" aria-label={s.ortak.dil.baslik} style={{ display: 'inline-flex', gap: 6 }}>
      {DILLER.map((d) => (
        <button
          key={d}
          type="button"
          className="btn"
          aria-pressed={d === dil}
          disabled={bekliyor}
          onClick={() =>
            baslat(async () => {
              await diliDegistir(d);
              router.refresh();
            })
          }
          style={
            d === dil
              ? { background: 'var(--copper)', borderColor: 'var(--copper)', color: '#fff' }
              : undefined
          }
        >
          {s.ortak.dil[d]}
        </button>
      ))}
    </div>
  );
}
