'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { davetKoduOlustur, gozlemciyiCikar } from '@/app/ayarlar/actions';
import { zamanOnce } from '@/lib/types';
import { useDil, useSozluk } from '@/lib/i18n/istemci';

type Gozlemci = { id: string; ad: string; baglandi: string | null; son_gorulme: string | null };

export function GozlemciErisimi({
  mevcutKod,
  gozlemciler,
}: {
  mevcutKod: string | null;
  gozlemciler: Gozlemci[];
}) {
  const [kod, setKod] = useState(mevcutKod);
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [cikariliyorId, setCikariliyorId] = useState<string | null>(null);
  const [cikariliyor, basla] = useTransition();
  const router = useRouter();
  const dil = useDil();
  const so = useSozluk();
  const s = so.ayarlar.gozlemci;

  async function olustur() {
    setCalisiyor(true);
    setHata(null);
    try {
      const sonuc = await davetKoduOlustur();
      if (sonuc.hata) setHata(sonuc.hata);
      else setKod(sonuc.kod ?? null);
    } finally {
      setCalisiyor(false);
    }
  }

  async function kopyala() {
    if (!kod) return;
    try {
      await navigator.clipboard.writeText(kod);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 1500);
    } catch {
      // pano izni yoksa sessizce yoksay — kod zaten ekranda okunabilir
    }
  }

  function cikar(g: Gozlemci) {
    if (!window.confirm(s.cikarOnay(g.ad))) {
      return;
    }
    setCikariliyorId(g.id);
    basla(async () => {
      await gozlemciyiCikar(g.id);
      router.refresh();
    });
  }

  return (
    <div className="kart" style={{ padding: 20, marginTop: 16 }}>
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}
      >
        {s.baslik}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        {s.aciklama}
      </p>

      {kod ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span
            className="mn"
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: '0.1em',
              padding: '7px 14px',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
            }}
          >
            {kod}
          </span>
          <button type="button" className="btn" style={{ height: 32, fontSize: 12.5 }} onClick={kopyala}>
            {kopyalandi ? so.ortak.buton.kopyalandi : so.ortak.buton.kopyala}
          </button>
        </div>
      ) : (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>{s.kodYok}</p>
      )}

      <button
        type="button"
        className="btn"
        style={{ height: 32, fontSize: 12.5 }}
        onClick={olustur}
        disabled={calisiyor}
      >
        {calisiyor ? '…' : kod ? s.yenidenOlustur : s.kodOlustur}
      </button>
      {kod && (
        <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'var(--muted-2)' }}>
          {s.yenidenIpucu}
        </p>
      )}
      {hata && (
        <div className="hata" style={{ marginTop: 10 }}>
          {hata}
        </div>
      )}

      {gozlemciler.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
          <div
            className="mn"
            style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 10 }}
          >
            {s.izleyenler(gozlemciler.length)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gozlemciler.map((g) => (
              <div
                key={g.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5, gap: 8 }}
              >
                <span style={{ fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.ad}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <span style={{ color: 'var(--muted)', fontSize: 11, textAlign: 'right' }}>
                    {g.baglandi && s.baglandi(zamanOnce(g.baglandi, dil))}
                    {g.baglandi && g.son_gorulme && ' · '}
                    {g.son_gorulme && s.sonGorulme(zamanOnce(g.son_gorulme, dil))}
                  </span>
                  <button
                    type="button"
                    onClick={() => cikar(g)}
                    disabled={cikariliyor && cikariliyorId === g.id}
                    style={{
                      fontSize: 11,
                      color: 'var(--crit)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      opacity: cikariliyor && cikariliyorId === g.id ? 0.5 : 1,
                    }}
                  >
                    {cikariliyor && cikariliyorId === g.id ? '…' : s.cikar}
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
