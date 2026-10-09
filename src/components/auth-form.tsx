'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Marka } from './marka';
import { kodDogrula, kodYenidenGonder, type AuthDurum } from '@/app/auth-actions';
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
};

export function AuthForm({ mod, eylem, devam = '/envanter' }: Props) {
  const [durum, gonder, bekliyor] = useActionState<AuthDurum, FormData>(eylem, {});
  const kayit = mod === 'kayit';
  const s = useSozluk().ayarlar.auth;

  const [eposta, setEposta] = useState('');
  const [sifre, setSifre] = useState('');
  const [hatirla, setHatirla] = useState(true);

  const [kodDurum, kodGonder, kodBekliyor] = useActionState<AuthDurum, FormData>(kodDogrula, {});
  const [geriDon, setGeriDon] = useState(false);
  const [yenidenGonderiliyor, yenidenBasla] = useTransition();
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
              <input className="alan" id="ad" name="ad" autoComplete="name" placeholder="Recep" />
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

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
          <DilSecici />
        </div>
      </div>
    </main>
  );
}
