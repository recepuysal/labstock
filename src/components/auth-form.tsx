'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Marka } from './marka';
import { kodDogrula, kodYenidenGonder, type AuthDurum } from '@/app/auth-actions';

const EPOSTA_ANAHTARI = 'labstock-son-eposta';
const HATIRLA_ANAHTARI = 'labstock-beni-hatirla';

declare global {
  interface Window {
    electronAPI?: {
      sifreKaydet: (sifre: string) => Promise<boolean>;
      sifreAl: () => Promise<string | null>;
      sifreSil: () => Promise<boolean>;
    };
  }
}

type Props = {
  mod: 'giris' | 'kayit';
  eylem: (onceki: AuthDurum, formData: FormData) => Promise<AuthDurum>;
  devam?: string;
};

export function AuthForm({ mod, eylem, devam = '/envanter' }: Props) {
  const [durum, gonder, bekliyor] = useActionState<AuthDurum, FormData>(eylem, {});
  const kayit = mod === 'kayit';

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
              E-postanı doğrula
            </h1>
            <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
              <strong>{durum.kodBekleniyor}</strong> adresine 6 haneli bir doğrulama kodu gönderdik.
            </p>

            {kodDurum.hata && (
              <div className="hata" style={{ marginBottom: 14 }}>
                {kodDurum.hata}
              </div>
            )}

            <input type="hidden" name="eposta" value={durum.kodBekleniyor} />

            <div style={{ marginBottom: 20 }}>
              <label className="etiket" htmlFor="kod">
                Doğrulama kodu
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
              {kodBekliyor ? 'Onaylanıyor…' : 'Onayla'}
            </button>

            <button
              type="button"
              className="btn"
              onClick={yenidenGonder}
              disabled={yenidenGonderiliyor}
              style={{ width: '100%', height: 36 }}
            >
              {yenidenGonderiliyor ? 'Gönderiliyor…' : 'Kodu tekrar gönder'}
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
                Farklı e-posta ile dene
              </button>
            </p>
          </form>
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
            {kayit ? 'Hesap oluştur' : 'Giriş yap'}
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)' }}>
            {kayit
              ? 'Kendi deponu kur, parçalarını ve konumlarını yönet.'
              : 'Depona devam etmek için giriş yap.'}
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
                Ad
              </label>
              <input className="alan" id="ad" name="ad" autoComplete="name" placeholder="Recep" />
            </div>
          )}

          {kayit && (
            <div style={{ marginBottom: 14 }}>
              <label className="etiket" htmlFor="davet_kodu">
                Davet kodu (varsa)
              </label>
              <input
                className="alan mn"
                id="davet_kodu"
                name="davet_kodu"
                autoComplete="off"
                placeholder="birinin envanterini izlemek için"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label className="etiket" htmlFor="eposta">
              E-posta
            </label>
            <input
              className="alan"
              id="eposta"
              name="eposta"
              type="email"
              required
              autoComplete="email"
              placeholder="ornek@eposta.com"
              value={eposta}
              onChange={epostaDegisti}
            />
          </div>

          <div style={{ marginBottom: kayit ? 20 : 14 }}>
            <label className="etiket" htmlFor="sifre">
              Şifre
            </label>
            <input
              className="alan"
              id="sifre"
              name="sifre"
              type="password"
              required
              minLength={kayit ? 8 : undefined}
              autoComplete={kayit ? 'new-password' : 'current-password'}
              placeholder={kayit ? 'en az 8 karakter' : '••••••••'}
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
              Beni hatırla
            </label>
          )}

          <input type="hidden" name="devam" value={devam} />

          <button
            className="btn btn-birincil"
            type="submit"
            disabled={bekliyor}
            style={{ width: '100%', height: 40 }}
          >
            {bekliyor ? 'Bekle…' : kayit ? 'Hesap oluştur' : 'Giriş yap'}
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
                Hesabın var mı? <Link href="/giris">Giriş yap</Link>
              </>
            ) : (
              <>
                Hesabın yok mu? <Link href="/kayit">Hesap oluştur</Link>
              </>
            )}
          </p>
        </form>
      </div>
    </main>
  );
}
