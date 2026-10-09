'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { gorunumuDegistir } from '@/app/envanter/actions';
import { useSozluk } from '@/lib/i18n/istemci';

export function GorunumSecici({
  izleniyor,
  izlenenAdi,
}: {
  izleniyor: boolean;
  izlenenAdi: string;
}) {
  const s = useSozluk().envanter.gorunum;
  const [bekliyor, basla] = useTransition();
  const router = useRouter();

  function degistir(hedef: 'kendi' | 'gozlemci') {
    if ((hedef === 'gozlemci') === izleniyor) return;
    basla(async () => {
      await gorunumuDegistir(hedef);
      router.push('/envanter');
      router.refresh();
    });
  }

  const pil = (aktif: boolean): React.CSSProperties => ({
    height: 26,
    padding: '0 10px',
    borderRadius: 'var(--r-sm)',
    fontSize: 11.5,
    fontWeight: aktif ? 600 : 500,
    background: aktif ? 'var(--copper)' : 'transparent',
    color: aktif ? '#fdfbf7' : 'var(--muted)',
    border: 'none',
    cursor: 'pointer',
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 2,
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r)',
        opacity: bekliyor ? 0.6 : 1,
      }}
      title={s.baslik}
    >
      <button type="button" style={pil(!izleniyor)} disabled={bekliyor} onClick={() => degistir('kendi')}>
        {s.benimDepom}
      </button>
      <button type="button" style={pil(izleniyor)} disabled={bekliyor} onClick={() => degistir('gozlemci')}>
        {izlenenAdi}
      </button>
    </div>
  );
}
