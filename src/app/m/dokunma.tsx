'use client';

import { useEffect } from 'react';

/** Kısa dokunma titreşimi. Android: navigator.vibrate. iOS 18+ Safari vibrate
 *  desteklemez; gizli bir "switch" checkbox'ın etiketine tıklamak sistemin
 *  hafif haptiğini tetikler. Desteklenmeyen cihazda sessizce hiçbir şey olmaz. */
export function titresim() {
  if (typeof window === 'undefined') return;
  if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
    navigator.vibrate(8);
    return;
  }
  const etiket = document.getElementById('m-haptik-etiket');
  etiket?.click();
}

/** :active durumunun iOS Safari'de görünmesi için boş touchstart dinleyicisi
 *  ve iOS haptiği için gizli switch. Layout'ta bir kez yer alır. */
export function Dokunma() {
  useEffect(() => {
    const bos = () => {};
    document.addEventListener('touchstart', bos, { passive: true });
    return () => document.removeEventListener('touchstart', bos);
  }, []);
  return (
    <label id="m-haptik-etiket" aria-hidden="true" style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', overflow: 'hidden', left: -10, top: -10 }}>
      {/* "switch": iOS 18 Safari'ye özgü nitelik */}
      <input type="checkbox" {...{ switch: '' }} tabIndex={-1} />
    </label>
  );
}
