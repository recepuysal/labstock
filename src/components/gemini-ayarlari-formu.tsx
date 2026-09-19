'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { geminiAnahtariKaydet, geminiAnahtariniKaldir } from '@/app/ayarlar/actions';
import type { EylemDurum } from '@/app/envanter/actions';

export function GeminiAyarlariFormu({
  anahtarVarMi,
  sonDortHane,
}: {
  anahtarVarMi: boolean;
  sonDortHane: string | null;
}) {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(geminiAnahtariKaydet, {});
  const [degistirModu, setDegistirModu] = useState(!anahtarVarMi);
  const [kaldiriliyor, basla] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (durum.bilgi) setDegistirModu(false);
  }, [durum.bilgi]);

  function kaldir() {
    if (!window.confirm('Gemini API anahtarını kaldırmak istediğine emin misin? Desteklenmeyen sitelerden "Linkten çek" artık çalışmaz.')) {
      return;
    }
    basla(async () => {
      await geminiAnahtariniKaldir();
      setDegistirModu(true);
      router.refresh();
    });
  }

  return (
    <div className="kart" style={{ padding: 20, marginTop: 16 }}>
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}
      >
        YAPAY ZEKA İLE LİNKTEN ÇEKME
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Direnç.net / Robotistan / Motorobit dışındaki sitelerde "Linkten çek" bu anahtarla
        çalışır — ücretsiz bir{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--copper)', fontWeight: 600 }}
        >
          Google Gemini API anahtarı
        </a>{' '}
        alıp buraya eklersen herhangi bir elektronik satıcısının ürün sayfasından malzeme
        bilgisi çekebilirsin. Anahtar sadece sende kalır, sunucumuzda paylaşılmaz; kullanım
        kendi Google hesabındaki ücretsiz kotandan düşer.
      </p>

      {anahtarVarMi && !degistirModu ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            className="mn"
            style={{
              fontSize: 12.5,
              padding: '7px 12px',
              background: 'var(--ok-bg)',
              color: 'var(--ok)',
              borderRadius: 'var(--r)',
              fontWeight: 600,
            }}
          >
            Ayarlı — ···· {sonDortHane}
          </span>
          <button type="button" className="btn" style={{ height: 32, fontSize: 12.5 }} onClick={() => setDegistirModu(true)}>
            Değiştir
          </button>
          <button
            type="button"
            className="btn"
            style={{ height: 32, fontSize: 12.5, color: 'var(--crit)' }}
            onClick={kaldir}
            disabled={kaldiriliyor}
          >
            {kaldiriliyor ? '…' : 'Kaldır'}
          </button>
        </div>
      ) : (
        <form action={gonder} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            className="alan mn"
            name="api_anahtari"
            type="password"
            placeholder="AIzaSy..."
            required
            autoComplete="off"
            style={{ flex: 1 }}
          />
          <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
            {bekliyor ? 'Doğrulanıyor…' : 'Kaydet'}
          </button>
          {anahtarVarMi && (
            <button type="button" className="btn" onClick={() => setDegistirModu(false)} disabled={bekliyor}>
              Vazgeç
            </button>
          )}
        </form>
      )}

      {durum.hata && (
        <div className="hata" style={{ marginTop: 10 }}>
          {durum.hata}
        </div>
      )}
      {durum.bilgi && (
        <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ok)' }}>{durum.bilgi}</p>
      )}
    </div>
  );
}
