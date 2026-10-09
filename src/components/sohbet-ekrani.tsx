'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { sohbetSor, type SohbetMesaji } from '@/app/envanter/sohbet/actions';

/* Konuşma bileşenin dışında, modül düzeyinde tutulur: başka sayfaya gidip dönünce bileşen yeniden
 * kurulsa da konuşma ve süren istek yaşar (cevap sayfa dışındayken gelse bile konuşmaya eklenir).
 * Ayrıca bu bilgisayarda localStorage'a yazılır; uygulama kapanıp açılınca da kalır. Depo başına
 * ayrı tutulur (kendi depon / izlediğin depo, aynı bilgisayardaki farklı hesaplar karışmasın). */
type SohbetDurumu = { mesajlar: SohbetMesaji[]; gonderiliyor: boolean; hata: string | null; surum: number };

const KAYIT_ONEKI = 'labstock-sohbet:';
const AZAMI_KAYIT = 100; // bu bilgisayarda saklanan en fazla mesaj
const BOS: SohbetDurumu = { mesajlar: [], gonderiliyor: false, hata: null, surum: 0 };
const durumlar = new Map<string, SohbetDurumu>();
const dinleyiciler = new Set<() => void>();

function durumOku(depoId: string): SohbetDurumu {
  let d = durumlar.get(depoId);
  if (!d) {
    let mesajlar: SohbetMesaji[] = [];
    try {
      const ham = JSON.parse(localStorage.getItem(KAYIT_ONEKI + depoId) || '[]');
      if (Array.isArray(ham)) mesajlar = ham.filter((m) => m && typeof m.icerik === 'string');
    } catch {}
    d = { ...BOS, mesajlar };
    durumlar.set(depoId, d);
  }
  return d;
}

function durumYaz(depoId: string, degisiklik: Partial<SohbetDurumu>) {
  const yeni = { ...durumOku(depoId), ...degisiklik };
  durumlar.set(depoId, yeni);
  if ('mesajlar' in degisiklik) {
    try {
      localStorage.setItem(KAYIT_ONEKI + depoId, JSON.stringify(yeni.mesajlar.slice(-AZAMI_KAYIT)));
    } catch {}
  }
  dinleyiciler.forEach((f) => f());
}

function abone(f: () => void) {
  dinleyiciler.add(f);
  return () => dinleyiciler.delete(f);
}

async function sor(depoId: string, metin: string) {
  const d = durumOku(depoId);
  if (d.gonderiliyor) return;
  const surum = d.surum;
  const mesajlar: SohbetMesaji[] = [...d.mesajlar, { rol: 'kullanici', icerik: metin }];
  durumYaz(depoId, { mesajlar, gonderiliyor: true, hata: null });
  try {
    const sonuc = await sohbetSor(mesajlar);
    // Bu arada "Yeni sohbet" dendiyse eski sorunun cevabı yeni konuşmaya karışmasın
    if (durumOku(depoId).surum !== surum) return;
    if (sonuc.hata) durumYaz(depoId, { hata: sonuc.hata });
    else if (sonuc.cevap) durumYaz(depoId, { mesajlar: [...durumOku(depoId).mesajlar, { rol: 'asistan', icerik: sonuc.cevap }] });
  } catch (e) {
    if (durumOku(depoId).surum === surum) durumYaz(depoId, { hata: e instanceof Error ? e.message : 'Cevap alınamadı.' });
  } finally {
    if (durumOku(depoId).surum === surum) durumYaz(depoId, { gonderiliyor: false });
  }
}

function yeniSohbet(depoId: string) {
  durumYaz(depoId, { mesajlar: [], gonderiliyor: false, hata: null, surum: durumOku(depoId).surum + 1 });
}

const ORNEK_SORULAR = [
  '12V\'u 5V\'a düşüren bir şeyim var mı?',
  'Kaç tane ESP32 modülüm var, nerede?',
  'Elimde röle sürmek için ne var?',
];

function AsistanAvatar({ boyut = 26 }: { boyut?: number }) {
  return (
    <span
      style={{
        position: 'relative',
        width: boyut,
        height: boyut,
        flexShrink: 0,
        display: 'inline-block',
        borderRadius: '50%',
        background: 'var(--copper-soft)',
        border: '1px solid var(--copper-line)',
        padding: boyut * 0.2,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-mark.svg"
        alt=""
        className="logo-acik-tema"
        style={{ position: 'absolute', inset: boyut * 0.2, width: boyut * 0.6, height: boyut * 0.6 }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-mark-koyu.svg"
        alt=""
        className="logo-koyu-tema"
        style={{ position: 'absolute', inset: boyut * 0.2, width: boyut * 0.6, height: boyut * 0.6 }}
      />
    </span>
  );
}

function SohbetNoktalari() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, padding: '2px 0' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--muted-2)',
            animation: 'sohbet-nabiz 1s infinite ease-in-out',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </span>
  );
}

function MesajBalonu({ mesaj, yukleniyor }: { mesaj: SohbetMesaji; yukleniyor?: boolean }) {
  const kullaniciMi = mesaj.rol === 'kullanici';
  return (
    <div style={{ display: 'flex', gap: 10, flexDirection: kullaniciMi ? 'row-reverse' : 'row', alignItems: 'flex-start' }}>
      {!kullaniciMi && <AsistanAvatar />}
      <div
        style={{
          maxWidth: '74%',
          padding: '10px 13px',
          borderRadius: 'var(--r-lg)',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          background: kullaniciMi ? 'var(--copper-soft)' : 'var(--surface-2)',
          border: `1px solid ${kullaniciMi ? 'var(--copper-line)' : 'var(--line)'}`,
          color: 'var(--ink)',
        }}
      >
        {yukleniyor ? <SohbetNoktalari /> : kullaniciMi ? mesaj.icerik : <BicimliMetin metin={mesaj.icerik} />}
      </div>
    </div>
  );
}

// Asistan cevaplarındaki basit markdown'ı (**kalın**, "- " maddeleri) ham işaret
// olarak göstermek yerine biçimlendirir.
function BicimliMetin({ metin }: { metin: string }) {
  const satirlar = metin.split('\n').map((s) => s.replace(/^(\s*)[-*]\s+/, '$1• '));
  return (
    <>
      {satirlar.map((satir, i) => (
        <span key={i}>
          {satir.split(/\*\*(.+?)\*\*/g).map((parca, j) => (j % 2 ? <strong key={j}>{parca}</strong> : parca))}
          {i < satirlar.length - 1 && '\n'}
        </span>
      ))}
    </>
  );
}

export function SohbetEkrani({ depoId }: { depoId: string }) {
  const { mesajlar, gonderiliyor, hata } = useSyncExternalStore(
    abone,
    () => durumOku(depoId),
    () => BOS,
  );
  const [girdi, setGirdi] = useState('');
  const sonRef = useRef<HTMLDivElement>(null);
  const girdiRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    sonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mesajlar, gonderiliyor]);

  async function gonder(metin: string) {
    const temiz = metin.trim();
    if (!temiz || gonderiliyor) return;
    setGirdi('');
    await sor(depoId, temiz);
    girdiRef.current?.focus();
  }

  function formuGonder(e: React.FormEvent) {
    e.preventDefault();
    gonder(girdi);
  }

  function tuslamaOldu(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      gonder(girdi);
    }
  }

  return (
    <div
      className="kart"
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        padding: 0,
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes sohbet-nabiz {
          0%, 80%, 100% { opacity: 0.35; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {mesajlar.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
          <button
            type="button"
            className="btn"
            style={{ fontSize: 12 }}
            onClick={() => {
              if (confirm('Bu konuşma silinsin ve yeni bir sohbet başlasın mı?')) yeniSohbet(depoId);
            }}
          >
            Yeni sohbet
          </button>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mesajlar.length === 0 && (
          <div style={{ margin: 'auto', textAlign: 'center', maxWidth: 380 }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <AsistanAvatar boyut={44} />
            </div>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 15 }}>LabStock Asistanı</p>
            <p style={{ margin: '0 0 18px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
              Depon hakkında soru sor — stokta ne var, nerede, ya da bir şey yoksa yerine ne
              kullanabileceğini öğren.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {ORNEK_SORULAR.map((soru) => (
                <button
                  key={soru}
                  type="button"
                  className="btn"
                  style={{ fontSize: 12.5, textAlign: 'left', justifyContent: 'flex-start' }}
                  onClick={() => gonder(soru)}
                >
                  {soru}
                </button>
              ))}
            </div>
          </div>
        )}

        {mesajlar.map((m, i) => (
          <MesajBalonu key={i} mesaj={m} />
        ))}
        {gonderiliyor && <MesajBalonu mesaj={{ rol: 'asistan', icerik: '' }} yukleniyor />}
        {hata && (
          <div className="hata" style={{ marginTop: 2 }}>
            {hata}
          </div>
        )}
        <div ref={sonRef} />
      </div>

      <form onSubmit={formuGonder} style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        <textarea
          ref={girdiRef}
          className="alan"
          rows={1}
          value={girdi}
          onChange={(e) => setGirdi(e.target.value)}
          onKeyDown={tuslamaOldu}
          placeholder="Depon hakkında bir şey sor…"
          autoFocus
          style={{ flex: 1, resize: 'none', height: 40, padding: '9px 12px', fontFamily: 'inherit' }}
        />
        <button className="btn btn-birincil" type="submit" disabled={gonderiliyor || !girdi.trim()}>
          Gönder
        </button>
      </form>
    </div>
  );
}
