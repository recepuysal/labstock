'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { davetKoduOlustur, gozlemciyiCikar } from '@/app/ayarlar/actions';
import { zamanOnce } from '@/lib/types';

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
    if (!window.confirm(`${g.ad} artık deponu izleyemesin mi? İstersen kodu tekrar paylaşarak yeniden bağlanabilir.`)) {
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
        GÖZLEMCİ ERİŞİMİ
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Bu kodu paylaştığın kişiler envanterini salt-okunur görebilir — düzenleyemez, silemez.
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
            {kopyalandi ? 'Kopyalandı' : 'Kopyala'}
          </button>
        </div>
      ) : (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>Henüz kod oluşturulmadı.</p>
      )}

      <button
        type="button"
        className="btn"
        style={{ height: 32, fontSize: 12.5 }}
        onClick={olustur}
        disabled={calisiyor}
      >
        {calisiyor ? '…' : kod ? 'Yeniden oluştur' : 'Kod oluştur'}
      </button>
      {kod && (
        <p style={{ margin: '8px 0 0', fontSize: 10.5, color: 'var(--muted-2)' }}>
          Yeniden oluşturmak eski kodu geçersiz kılar — o kodu daha önce kullanmış olanları etkilemez.
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
            SENİ İZLEYENLER · {gozlemciler.length}/8
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
                    {g.baglandi && `${zamanOnce(g.baglandi)} bağlandı`}
                    {g.baglandi && g.son_gorulme && ' · '}
                    {g.son_gorulme && `son görülme ${zamanOnce(g.son_gorulme)}`}
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
                    {cikariliyor && cikariliyorId === g.id ? '…' : 'Çıkar'}
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
