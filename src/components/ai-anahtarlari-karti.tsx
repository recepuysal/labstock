'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { aiAnahtarEkle, aiAnahtarSil, aiAnahtarSiradaTasi } from '@/app/ayarlar/actions';
import type { EylemDurum } from '@/app/envanter/actions';
import type { AiSaglayici } from '@/lib/ai-anahtarlari';

export type AiAnahtarSatiri = {
  id: string;
  saglayici: AiSaglayici;
  ad: string | null;
  sonDortHane: string;
};

const SAGLAYICI_ETIKETI: Record<AiSaglayici, string> = { gemini: 'Gemini', claude: 'Claude' };

export function AiAnahtarlariKarti({ anahtarlar }: { anahtarlar: AiAnahtarSatiri[] }) {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(aiAnahtarEkle, {});
  const [eklemeAcik, setEklemeAcik] = useState(anahtarlar.length === 0);
  const [islemGoren, basla] = useTransition();
  const [islemGorenId, setIslemGorenId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (durum.bilgi) setEklemeAcik(false);
  }, [durum.bilgi]);

  function sil(id: string) {
    if (!window.confirm('Bu API anahtarını kaldırmak istediğine emin misin?')) return;
    setIslemGorenId(id);
    basla(async () => {
      await aiAnahtarSil(id);
      setIslemGorenId(null);
      router.refresh();
    });
  }

  function tasi(id: string, yon: 'yukari' | 'asagi') {
    setIslemGorenId(id);
    basla(async () => {
      await aiAnahtarSiradaTasi(id, yon);
      setIslemGorenId(null);
      router.refresh();
    });
  }

  return (
    <div className="kart" style={{ padding: 20, marginTop: 16 }}>
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}
      >
        YAPAY ZEKA API ANAHTARLARI
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Direnç.net / Robotistan / Motorobit dışındaki sitelerde "Linkten çek", LCSC açıklamalarının
        Türkçe çevirisi ve Sohbet asistanı buradaki anahtarlarla çalışır. Birden fazla{' '}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--copper)', fontWeight: 600 }}
        >
          Gemini
        </a>{' '}
        ve/veya{' '}
        <a
          href="https://console.anthropic.com/settings/keys"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--copper)', fontWeight: 600 }}
        >
          Claude
        </a>{' '}
        anahtarı ekleyebilirsin — yukarıdakinden başlanır, o çalışmazsa (kota dolu, geçersiz vb.)
        otomatik olarak bir alttaki denenir. Sırayı ok tuşlarıyla değiştirebilirsin. Anahtarlar sadece
        sende kalır, kimseyle paylaşılmaz; kullanım kendi hesabındaki kotandan düşer.
      </p>

      {anahtarlar.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {anahtarlar.map((a, i) => (
            <div
              key={a.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 10px',
                background: 'var(--bg)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r)',
                opacity: islemGorenId === a.id ? 0.5 : 1,
              }}
            >
              <span
                className="mn"
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: '3px 7px',
                  borderRadius: 999,
                  background: a.saglayici === 'gemini' ? 'var(--ok-bg)' : 'var(--copper-soft)',
                  color: a.saglayici === 'gemini' ? 'var(--ok)' : 'var(--copper-dark)',
                }}
              >
                {SAGLAYICI_ETIKETI[a.saglayici]}
              </span>
              <span className="mn" style={{ fontSize: 12.5, flex: 1 }}>
                {a.ad ? `${a.ad} — ` : ''}···· {a.sonDortHane}
              </span>
              <button
                type="button"
                className="btn"
                style={{ height: 26, width: 26, padding: 0, fontSize: 12 }}
                onClick={() => tasi(a.id, 'yukari')}
                disabled={i === 0 || islemGoren}
                title="Yukarı taşı"
              >
                ↑
              </button>
              <button
                type="button"
                className="btn"
                style={{ height: 26, width: 26, padding: 0, fontSize: 12 }}
                onClick={() => tasi(a.id, 'asagi')}
                disabled={i === anahtarlar.length - 1 || islemGoren}
                title="Aşağı taşı"
              >
                ↓
              </button>
              <button
                type="button"
                className="btn"
                style={{ height: 26, fontSize: 11.5, color: 'var(--crit)' }}
                onClick={() => sil(a.id)}
                disabled={islemGoren}
              >
                Kaldır
              </button>
            </div>
          ))}
        </div>
      )}

      {eklemeAcik ? (
        <form action={gonder} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="alan mn" name="saglayici" defaultValue="gemini" style={{ width: 110 }}>
            <option value="gemini">Gemini</option>
            <option value="claude">Claude</option>
          </select>
          <input
            className="alan mn"
            name="ad"
            placeholder="etiket (ops.) — ör. iş hesabı"
            autoComplete="off"
            style={{ width: 160 }}
          />
          <input
            className="alan mn"
            name="api_anahtari"
            type="password"
            placeholder="API anahtarı"
            required
            autoComplete="off"
            style={{ flex: 1, minWidth: 160 }}
          />
          <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
            {bekliyor ? 'Doğrulanıyor…' : 'Ekle'}
          </button>
          {anahtarlar.length > 0 && (
            <button type="button" className="btn" onClick={() => setEklemeAcik(false)} disabled={bekliyor}>
              Vazgeç
            </button>
          )}
        </form>
      ) : (
        <button type="button" className="btn" onClick={() => setEklemeAcik(true)}>
          + Anahtar ekle
        </button>
      )}

      {durum.hata && (
        <div className="hata" style={{ marginTop: 10 }}>
          {durum.hata}
        </div>
      )}
      {durum.bilgi && <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ok)' }}>{durum.bilgi}</p>}
    </div>
  );
}
