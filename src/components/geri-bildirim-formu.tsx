'use client';

import { useActionState, useEffect, useState } from 'react';
import { geriBildirimGonder } from '@/app/ayarlar/actions';
import type { EylemDurum } from '@/app/envanter/actions';

export function GeriBildirimFormu() {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(geriBildirimGonder, {});
  const [surum, setSurum] = useState<string | null>(null);
  const [gonderildi, setGonderildi] = useState(false);

  useEffect(() => {
    window.electronAPI?.surumAl().then(setSurum);
  }, []);

  useEffect(() => {
    if (durum.bilgi) setGonderildi(true);
  }, [durum.bilgi]);

  return (
    <div className="kart" style={{ padding: 20, marginTop: 16 }}>
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 4 }}
      >
        GERİ BİLDİRİM
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        Bir sorun mu buldun, bir önerin mi var? Doğrudan bize yaz.
      </p>

      {gonderildi ? (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--ok)' }}>Gönderildi, teşekkürler!</p>
      ) : (
        <form action={gonder}>
          <input type="hidden" name="surum" value={surum ?? ''} />
          <textarea
            className="alan mn"
            name="mesaj"
            rows={4}
            required
            maxLength={4000}
            style={{ height: 'auto', padding: '9px 11px', resize: 'vertical' }}
            placeholder="Ne düşünüyorsun?"
          />
          {durum.hata && (
            <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--crit)' }}>{durum.hata}</p>
          )}
          <button
            className="btn btn-birincil"
            type="submit"
            disabled={bekliyor}
            style={{ marginTop: 10 }}
          >
            {bekliyor ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </form>
      )}
    </div>
  );
}
