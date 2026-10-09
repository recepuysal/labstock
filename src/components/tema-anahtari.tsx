'use client';

import { useEffect, useState } from 'react';
import { useSozluk } from '@/lib/i18n/istemci';

const ANAHTAR = 'labstock-tema';

export function TemaAnahtari() {
  const [koyu, setKoyu] = useState(false);
  const s = useSozluk().ayarlar.gorunum;

  useEffect(() => {
    setKoyu(document.documentElement.getAttribute('data-theme') === 'koyu');
  }, []);

  function degistir(e: React.ChangeEvent<HTMLInputElement>) {
    const secili = e.target.checked;
    setKoyu(secili);
    if (secili) {
      document.documentElement.setAttribute('data-theme', 'koyu');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      if (secili) localStorage.setItem(ANAHTAR, 'koyu');
      else localStorage.removeItem(ANAHTAR);
    } catch {}
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
      <span>{koyu ? s.koyuTema : s.acikTema}</span>
      <label className="anahtar">
        <input type="checkbox" role="switch" checked={koyu} onChange={degistir} aria-label={s.koyuTema} />
        <span className="parmak" />
      </label>
    </div>
  );
}
