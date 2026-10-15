'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Marka } from './marka';
import { kodDogrula, kodYenidenGonder, oauthIleGiris, type AuthDurum } from '@/app/auth-actions';

// Açık sağlayıcılar (Supabase'te etkinleştirildikçe Vercel'de ayarlanır): "github,google"
const OAUTH = (process.env.NEXT_PUBLIC_OAUTH_SAGLAYICILAR ?? '')
  .split(',')
  .map((p) => p.trim())
  .filter((p): p is 'github' | 'google' => p === 'github' || p === 'google');
import { DilSecici } from './dil-secici';
import { useSozluk } from '@/lib/i18n/istemci';

const EPOSTA_ANAHTARI = 'labstock-son-eposta';
const HATIRLA_ANAHTARI = 'labstock-beni-hatirla';

// window.electronAPI tipi guncelleme-bildirimi.tsx'te tanımlı (tek merkezden
// yönetiliyor — burada tekrar tanımlarsak TS "aynı tipte olmalı" hatası verir).

type Props = {
  mod: 'giris' | 'kayit';
  eylem: (onceki: AuthDurum, formData: FormData) => Promise<AuthDurum>;
  devam?: string;
  /** Masaüstünde: hesap açmadan çevrimdışı modda başlama (Ayarlar → Veri depolama). */
  hesapsizEylem?: () => Promise<void>;
};

export function AuthForm({ mod, eylem, devam = '/envanter', hesapsizEylem }: Props) {
  const [durum, gonder, bekliyor] = useActionState<AuthDurum, FormData>(eylem, {});
  const kayit = mod === 'kayit';
  const so = useSozluk();
  const s = so.ayarlar.auth;

  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [hatirla, setHatirla] = useState(true);

  const [kodDurum, kodGonder, kodBekliyor] = useActionState<AuthDurum, FormData>(kodDogrula, {});
  const [geriDon, setGeriDon] = useState(false);
  const [yenidenGonderiliyor, yenidenBasla] = useTransition();
  const [webde, setWebde] = useState(false);
  useEffect(() => setWebde(!window.electronAPI), []);
  const [yenidenMesaj, setYenidenMesaj] = useState<string | null>(null);
  const kodAdimindeyiz = Boolean(durum.kodBekleniyor) && !geriDon;

  useEffect(() => {
    if (kayit) return;
    try {
      const aktif = localStorage.getItem(HATIRLA_ANAHTARI) !== 'hayir';
      setHatirla(aktif);
      if (aktif) {
        const kayitliEposta = localStorage.getItem(EPOSTA_ANAHTARI);
        if (kayitliEposta) setEposta(kayitliEposta);
        // Şifre sadece masaüstü uygulamasında (Electron), işletim sisteminin
        // kendi kasasıyla şifrelenmiş halde saklanır — düz metin localStorage'a yazılmaz.
        window.electronAPI?.sifreAl().then((kayitliSifre) => {
          if (kayitliSifre) setSifre(kayitliSifre);
        });
      }
    } catch {}
  }, [kayit]);

  function epostaDegisti(e: React.ChangeEvent<HTMLInputElement>) {
    setEposta(e.target.value);
    if (kayit || !hatirla) return;
    try {
      localStorage.setItem(EPOSTA_ANAHTARI, e.target.value);
    } catch {}
  }

  function sifreDegisti(e: React.ChangeEvent<HTMLInputElement>) {
    setSifre(e.target.value);
    if (kayit || !hatirla) return;
    window.electronAPI?.sifreKaydet(e.target.value);
  }

  function hatirlaDegisti(e: React.ChangeEvent<HTMLInputElement>) {
    const secili = e.target.checked;
    setHatirla(secili);
    try {
      localStorage.setItem(HATIRLA_ANAHTARI, secili ? 'evet' : 'hayir');
      if (secili) {
        localStorage.setItem(EPOSTA_ANAHTARI, eposta);
        window.electronAPI?.sifreKaydet(sifre);
      } else {
        localStorage.removeItem(EPOSTA_ANAHTARI);
        window.electronAPI?.sifreSil();
      }
    } catch {}
  }

  function yenidenGonder() {
    if (!durum.kodBekleniyor) return;
    setYenidenMesaj(null);
    const hedefEposta = durum.kodBekleniyor;
    yenidenBasla(async () => {
      const sonuc = await kodYenidenGonder(hedefEposta);
      setYenidenMesaj(sonuc.hata ?? sonuc.bilgi ?? null);
    });
  }

  if (kodAdimindeyiz) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <Marka boyut={32} />
          </div>

          <form action={kodGonder} className="kart" style={{ padding: 22 }}>
            <h1 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 600, letterSpacing: '-0.4px' }}>
              {s.dogrulaBaslik}
            </h1>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
              {s.kodGonderildiOnce}
              <strong>{durum.kodBekleniyor}</strong>
              {s.kodGonderildiSonra}
            </p>

            {kodDurum.hata && (
              <div className="hata" style={{ marginBottom: 14 }}>
                {kodDurum.hata}
              </div>
            )}

            <input type="hidden" name="eposta" value={durum.kodBekleniyor} />

            <div style={{ marginBottom: 20 }}>
              <label className="etiket" htmlFor="kod">
                {s.dogrulamaKodu}
              </label>
              <input
                className="alan mn"
                id="kod"
                name="kod"
                required
                autoFocus
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                style={{ fontSize: 20, letterSpacing: '0.3em', textAlign: 'center' }}
              />
            </div>

            <button
              className="btn btn-birincil"
              type="submit"
              disabled={kodBekliyor}
              style={{ width: '100%', height: 40, marginBottom: 10 }}
            >
              {kodBekliyor ? s.onaylaniyor : s.onayla}
            </button>

            <button
              type="button"
              className="btn"
              onClick={yenidenGonder}
              disabled={yenidenGonderiliyor}
              style={{ width: '100%', height: 36 }}
            >
              {yenidenGonderiliyor ? s.gonderiliyor : s.koduTekrarGonder}
            </button>
            {yenidenMesaj && (
              <p style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--muted)', textAlign: 'center' }}>
                {yenidenMesaj}
              </p>
            )}

            <p style={{ margin: '18px 0 0', fontSize: 12.5, color: 'var(--muted)', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => setGeriDon(true)}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--copper)', cursor: 'pointer', font: 'inherit' }}
              >
                {s.farkliEposta}
              </button>
            </p>
          </form>

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <DilSecici />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <Marka boyut={32} />
        </div>

        <form action={gonder} className="kart" style={{ padding: 22 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 19, fontWeight: 600, letterSpacing: '-0.4px' }}>
            {kayit ? s.kayitBaslik : s.girisBaslik}
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)' }}>
            {kayit ? s.kayitAciklama : s.girisAciklama}
          </p>

          {durum.hata && (
            <div className="hata" style={{ marginBottom: 14 }}>
              {durum.hata}
            </div>
          )}
          {durum.bilgi && (
            <div
              style={{
                background: 'var(--ok-bg)',
                color: 'var(--ok)',
                borderRadius: 'var(--r)',
                padding: '9px 12px',
                fontSize: 12.5,
                marginBottom: 14,
              }}
            >
              {durum.bilgi}
            </div>
          )}

          {kayit && (
            <div style={{ marginBottom: 14 }}>
              <label className="etiket" htmlFor="ad">
                {s.ad}
              </label>
              <input className="alan" id="ad" name="ad" autoComplete="name" placeholder={s.adIpucu} />
            </div>
          )}

          {kayit && (
            <div style={{ marginBottom: 14 }}>
              <label className="etiket" htmlFor="davet_kodu">
                {s.davetKodu}
              </label>
              <input
                className="alan mn"
                id="davet_kodu"
                name="davet_kodu"
                autoComplete="off"
                placeholder={s.davetKoduIpucu}
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label className="etiket" htmlFor="eposta">
              {s.eposta}
            </label>
            <input
              className="alan"
              id="eposta"
              name="eposta"
              type="email"
              required
              autoComplete="email"
              placeholder={s.epostaIpucu}
              value={eposta}
              onChange={epostaDegisti}
            />
          </div>

          <div style={{ marginBottom: kayit ? 20 : 14 }}>
            <label className="etiket" htmlFor="sifre">
              {s.sifre}
            </label>
            <input
              className="alan"
              id="sifre"
              name="sifre"
              type="password"
              required
              minLength={kayit ? 8 : undefined}
              autoComplete={kayit ? 'new-password' : 'current-password'}
              placeholder={kayit ? s.sifreIpucuKayit : '••••••••'}
              {...(kayit ? {} : { value: sifre, onChange: sifreDegisti })}
            />
          </div>

          {!kayit && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                marginBottom: 20,
                fontSize: 12.5,
                color: 'var(--ink-2)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={hatirla}
                onChange={hatirlaDegisti}
                style={{ width: 15, height: 15, accentColor: 'var(--copper)' }}
              />
              {s.beniHatirla}
            </label>
          )}

          <input type="hidden" name="devam" value={devam} />

          <button
            className="btn btn-birincil"
            type="submit"
            disabled={bekliyor}
            style={{ width: '100%', height: 40 }}
          >
            {bekliyor ? s.bekle : kayit ? s.kayitBaslik : s.girisBaslik}
          </button>

          <p
            style={{
              margin: '18px 0 0',
              fontSize: 12.5,
              color: 'var(--muted)',
              textAlign: 'center',
            }}
          >
            {kayit ? (
              <>
                {s.hesabinVarMi} <Link href="/giris">{s.girisBaslik}</Link>
              </>
            ) : (
              <>
                {s.hesabinYokMu} <Link href="/kayit">{s.kayitBaslik}</Link>
              </>
            )}
          </p>
        </form>

        {/* GitHub / Google ile giriş: yalnızca web sürümünde (masaüstünde Google
            uygulama içi pencereden girişe izin vermiyor) */}
        {webde && OAUTH.length > 0 && (
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--muted-2)' }}>{s.veya}</div>
            {OAUTH.map((p) => (
              <form key={p} action={oauthIleGiris.bind(null, p, devam)}>
                <button type="submit" className="btn" style={{ width: '100%', justifyContent: 'center', gap: 9 }}>
                  {p === 'github' ? (
                    <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
                      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
                    </svg>
                  )}
                  <span>{p === 'github' ? s.githubIle : s.googleIle}</span>
                </button>
              </form>
            ))}
          </div>
        )}

        {hesapsizEylem && (
          <form action={hesapsizEylem} style={{ marginTop: 14, textAlign: 'center' }}>
            <button type="submit" className="btn" style={{ fontSize: 12.5 }}>
              {so.ayarlar.depolama.hesapsizKullan}
            </button>
            <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--muted-2)' }}>{so.ayarlar.depolama.hesapsizAciklama}</p>
          </form>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <DilSecici />
        </div>
      </div>
    </main>
  );
}
