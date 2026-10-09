'use client';

import { useActionState, useRef, useTransition } from 'react';
import { etiketEkle, etiketSil, type EylemDurum } from '@/app/envanter/actions';
import { useSozluk } from '@/lib/i18n/istemci';

type Etiket = { id: string; ad: string };

export function EtiketlerKarti({
  stokId,
  etiketler,
  oneriler,
  saltOkunur,
}: {
  stokId: string;
  etiketler: Etiket[];
  oneriler: string[];
  saltOkunur?: boolean;
}) {
  const [durum, gonder, ekleniyor] = useActionState<EylemDurum, FormData>(etiketEkle, {});
  const [siliniyor, basla] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const sz = useSozluk();
  const s = sz.parca.etiketler;

  function sil(tagId: string) {
    basla(async () => {
      await etiketSil(stokId, tagId);
    });
  }

  return (
    <div className="kart" style={{ padding: 16 }}>
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 10 }}
      >
        {s.baslik}
      </div>

      {etiketler.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {etiketler.map((e) => (
            <span
              key={e.id}
              className="rozet rozet-notr"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {e.ad}
              <button
                type="button"
                onClick={() => sil(e.id)}
                disabled={saltOkunur || siliniyor}
                aria-label={s.kaldir(e.ad)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 13,
                  height: 13,
                  padding: 0,
                  border: 'none',
                  background: 'none',
                  color: 'var(--muted)',
                  cursor: saltOkunur ? 'default' : 'pointer',
                  opacity: saltOkunur ? 0.4 : 1,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {etiketler.length === 0 && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>{s.yok}</p>
      )}

      <form
        ref={formRef}
        action={(fd) => {
          gonder(fd);
          formRef.current?.reset();
        }}
        style={{ display: 'flex', gap: 6, opacity: saltOkunur ? 0.5 : 1 }}
      >
        <input type="hidden" name="stok_id" value={stokId} />
        <input
          className="alan"
          style={{ height: 30, fontSize: 12 }}
          name="etiket_adi"
          placeholder={s.ekle}
          list="etiket-onerileri"
          autoComplete="off"
          disabled={saltOkunur}
        />
        <datalist id="etiket-onerileri">
          {oneriler.map((ad) => (
            <option key={ad} value={ad} />
          ))}
        </datalist>
        <button
          className="btn"
          style={{ height: 30, fontSize: 12, flexShrink: 0 }}
          type="submit"
          disabled={saltOkunur || ekleniyor}
        >
          {ekleniyor ? '…' : sz.ortak.buton.ekle}
        </button>
      </form>
      {durum.hata && (
        <div className="hata" style={{ marginTop: 8, fontSize: 11.5, padding: '6px 9px' }}>
          {durum.hata}
        </div>
      )}
    </div>
  );
}
