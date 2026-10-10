'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { aiAnahtarEkle, aiAnahtarSil, aiAnahtarSiradaTasi } from '@/app/ayarlar/actions';
import type { EylemDurum } from '@/app/envanter/actions';
import type { AiSaglayici } from '@/lib/ai-anahtarlari';
import { yerel } from '@/lib/i18n';
import { useDil, useSozluk } from '@/lib/i18n/istemci';

export type AiAnahtarSatiri = {
  id: string;
  saglayici: AiSaglayici;
  ad: string | null;
  sonDortHane: string;
  /** Bugün (UTC) yapılan istek sayısı. */
  istek: number;
  /** Günlük ücretsiz istek limiti; ücretli sağlayıcıda null. */
  limit: number | null;
  kotaDoldu: boolean;
};

type SaglayiciBilgisi = { ad: string; renk: string; ucretsiz: boolean; anahtarSayfasi: string };

// Ayarlar'daki sıra: önce ücretsizler (önerilen deneme sırası), en sonda ücretli Claude.
const SAGLAYICILAR: Record<AiSaglayici, SaglayiciBilgisi> = {
  groq: { ad: 'Groq', renk: '#e8590c', ucretsiz: true, anahtarSayfasi: 'https://console.groq.com/keys' },
  gemini: { ad: 'Gemini', renk: '#2b8a3e', ucretsiz: true, anahtarSayfasi: 'https://aistudio.google.com/apikey' },
  openrouter: { ad: 'OpenRouter', renk: '#7048e8', ucretsiz: true, anahtarSayfasi: 'https://openrouter.ai/settings/keys' },
  claude: { ad: 'Claude', renk: '#a3611f', ucretsiz: false, anahtarSayfasi: 'https://console.anthropic.com/settings/keys' },
};
const SAGLAYICI_SIRASI = Object.keys(SAGLAYICILAR) as AiSaglayici[];

const kucukBaslik = {
  fontSize: 9.5,
  fontWeight: 600,
  letterSpacing: '0.1em',
  color: 'var(--muted-2)',
} as const;

function Rozet({ saglayici }: { saglayici: AiSaglayici }) {
  const b = SAGLAYICILAR[saglayici];
  return (
    <span
      className="mn"
      style={{
        fontSize: 10.5,
        fontWeight: 700,
        padding: '3px 7px',
        borderRadius: 999,
        background: `color-mix(in srgb, ${b.renk} 14%, transparent)`,
        color: b.renk,
        whiteSpace: 'nowrap',
      }}
    >
      {b.ad}
    </span>
  );
}

/** Ücretsiz anahtarların bugünkü toplam kotası: sağlayıcı renginde dilimler + kalan. */
function KullanimBari({ anahtarlar, takipAktif }: { anahtarlar: AiAnahtarSatiri[]; takipAktif: boolean }) {
  const s = useSozluk().ayarlar.ai.kullanim;
  const dil = useDil();
  const sayi = (n: number) => n.toLocaleString(yerel(dil));

  const ucretsizler = anahtarlar.filter((a) => a.limit !== null);
  const ucretliler = anahtarlar.filter((a) => a.limit === null);
  const toplam = ucretsizler.reduce((t, a) => t + (a.limit ?? 0), 0);
  // Kotası dolan anahtar, sayaç limite ulaşmamış olsa bile tamamen kullanılmış sayılır.
  const kullanilanlar = ucretsizler.map((a) => (a.kotaDoldu ? (a.limit ?? 0) : Math.min(a.istek, a.limit ?? 0)));
  const kullanilan = kullanilanlar.reduce((t, n) => t + n, 0);
  const oran = toplam > 0 ? kullanilan / toplam : 0;

  return (
    <div
      style={{
        padding: 14,
        marginBottom: 14,
        background: 'var(--bg)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div className="mn" style={kucukBaslik}>
          {s.baslik}
        </div>
        {toplam > 0 && (
          <div className="mn" style={{ fontSize: 12.5, fontWeight: 700 }}>
            {s.toplam(sayi(kullanilan), sayi(toplam))}
          </div>
        )}
      </div>

      {toplam > 0 ? (
        <>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={toplam}
            aria-valuenow={kullanilan}
            aria-label={s.baslik}
            style={{
              display: 'flex',
              height: 12,
              marginTop: 10,
              borderRadius: 999,
              overflow: 'hidden',
              background: 'var(--line)',
            }}
          >
            {ucretsizler.map((a, i) =>
              kullanilanlar[i] > 0 ? (
                <div
                  key={a.id}
                  title={`${SAGLAYICILAR[a.saglayici].ad}${a.ad ? ` (${a.ad})` : ''}: ${sayi(kullanilanlar[i])}`}
                  style={{ width: `${(kullanilanlar[i] / toplam) * 100}%`, background: SAGLAYICILAR[a.saglayici].renk }}
                />
              ) : null,
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {ucretsizler.map((a, i) => (
                <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: SAGLAYICILAR[a.saglayici].renk }} />
                  {SAGLAYICILAR[a.saglayici].ad}
                  <span className="mn">
                    {sayi(kullanilanlar[i])}/{sayi(a.limit ?? 0)}
                  </span>
                </span>
              ))}
            </div>
            <span className="mn" style={{ fontSize: 11, color: oran >= 0.9 ? 'var(--crit)' : 'var(--ok)', fontWeight: 600 }}>
              {s.kalan(sayi(Math.max(toplam - kullanilan, 0)))}
            </span>
          </div>
        </>
      ) : (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)' }}>{s.bos}</p>
      )}

      {ucretliler.map((a) => (
        <div key={a.id} style={{ marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
          <Rozet saglayici={a.saglayici} /> {s.ucretliIstek(sayi(a.istek))}
        </div>
      ))}

      <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted-2)', lineHeight: 1.5 }}>
        {takipAktif ? s.aciklama : s.gocGerekli}
      </p>
    </div>
  );
}

export function AiAnahtarlariKarti({ anahtarlar, takipAktif }: { anahtarlar: AiAnahtarSatiri[]; takipAktif: boolean }) {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(aiAnahtarEkle, {});
  const [eklemeAcik, setEklemeAcik] = useState(anahtarlar.length === 0);
  const [islemGoren, basla] = useTransition();
  const [islemGorenId, setIslemGorenId] = useState<string | null>(null);
  const router = useRouter();
  const so = useSozluk();
  const s = so.ayarlar.ai;
  const dil = useDil();
  const sayi = (n: number) => n.toLocaleString(yerel(dil));

  useEffect(() => {
    if (durum.bilgi) setEklemeAcik(false);
  }, [durum.bilgi]);

  function sil(id: string) {
    if (!window.confirm(s.silOnay)) return;
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
      <div className="mn" style={{ ...kucukBaslik, marginBottom: 12 }}>
        {s.baslik}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{s.aciklama}</p>

      <KullanimBari anahtarlar={anahtarlar} takipAktif={takipAktif} />

      {anahtarlar.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {anahtarlar.map((a, i) => {
            const doluluk = a.limit ? Math.min(a.kotaDoldu ? 1 : a.istek / a.limit, 1) : 0;
            return (
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
                  flexWrap: 'wrap',
                }}
              >
                <Rozet saglayici={a.saglayici} />
                <span className="mn" style={{ fontSize: 12.5, flex: 1, minWidth: 120 }}>
                  {a.ad ? `${a.ad} — ` : ''}···· {a.sonDortHane}
                </span>
                {a.limit !== null ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 70, height: 6, borderRadius: 999, background: 'var(--line)', overflow: 'hidden' }}>
                      <span
                        style={{
                          display: 'block',
                          height: '100%',
                          width: `${doluluk * 100}%`,
                          background: a.kotaDoldu ? 'var(--crit)' : SAGLAYICILAR[a.saglayici].renk,
                        }}
                      />
                    </span>
                    <span className="mn" style={{ fontSize: 10.5, color: 'var(--muted)', minWidth: 64 }}>
                      {sayi(a.istek)}/{sayi(a.limit)}
                    </span>
                  </span>
                ) : (
                  <span className="mn" style={{ fontSize: 10.5, color: 'var(--muted)' }}>
                    {s.ucretli} · {sayi(a.istek)}
                  </span>
                )}
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: a.kotaDoldu ? 'var(--crit)' : 'var(--ok)',
                    minWidth: 62,
                  }}
                >
                  {a.kotaDoldu ? s.kullanim.kotaDoldu : s.kullanim.hazir}
                </span>
                <button
                  type="button"
                  className="btn"
                  style={{ height: 26, width: 26, padding: 0, fontSize: 12 }}
                  onClick={() => tasi(a.id, 'yukari')}
                  disabled={i === 0 || islemGoren}
                  title={s.yukariTasi}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ height: 26, width: 26, padding: 0, fontSize: 12 }}
                  onClick={() => tasi(a.id, 'asagi')}
                  disabled={i === anahtarlar.length - 1 || islemGoren}
                  title={s.asagiTasi}
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
                  {s.kaldir}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {eklemeAcik ? (
        <form action={gonder} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="alan mn" name="saglayici" defaultValue="groq" style={{ width: 170 }}>
            {SAGLAYICI_SIRASI.map((k) => (
              <option key={k} value={k}>
                {SAGLAYICILAR[k].ad} ({SAGLAYICILAR[k].ucretsiz ? s.ucretsiz : s.ucretli})
              </option>
            ))}
          </select>
          <input className="alan mn" name="ad" placeholder={s.adIpucu} autoComplete="off" style={{ width: 160 }} />
          <input
            className="alan mn"
            name="api_anahtari"
            type="password"
            placeholder={s.anahtarIpucu}
            required
            autoComplete="off"
            style={{ flex: 1, minWidth: 160 }}
          />
          <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
            {bekliyor ? s.dogrulaniyor : so.ortak.buton.ekle}
          </button>
          {anahtarlar.length > 0 && (
            <button type="button" className="btn" onClick={() => setEklemeAcik(false)} disabled={bekliyor}>
              {s.vazgec}
            </button>
          )}
        </form>
      ) : (
        <button type="button" className="btn" onClick={() => setEklemeAcik(true)}>
          {s.anahtarEkle}
        </button>
      )}

      {durum.hata && (
        <div className="hata" style={{ marginTop: 10 }}>
          {durum.hata}
        </div>
      )}
      {durum.bilgi && <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ok)' }}>{durum.bilgi}</p>}

      <div className="mn" style={{ ...kucukBaslik, margin: '18px 0 8px' }}>
        {s.saglayicilarBaslik}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
        {SAGLAYICI_SIRASI.map((k) => (
          <div
            key={k}
            style={{
              padding: '9px 10px',
              border: '1px solid var(--line)',
              borderRadius: 'var(--r)',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Rozet saglayici={k} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: SAGLAYICILAR[k].ucretsiz ? 'var(--ok)' : 'var(--muted)',
                }}
              >
                {SAGLAYICILAR[k].ucretsiz ? s.ucretsiz : s.ucretli}
              </span>
              <a
                href={SAGLAYICILAR[k].anahtarSayfasi}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--copper)', fontWeight: 600 }}
              >
                {s.anahtarAl} ↗
              </a>
            </div>
            <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.45 }}>{s.saglayiciNotu[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
