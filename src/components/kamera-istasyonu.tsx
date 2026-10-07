'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import {
  kameraKonumParcalari,
  kameraParcaAra,
  kameraSayimUygula,
  kameraStokBilgisi,
  kameraStokGiris,
  kameraTedarikciEtiketi,
} from '@/app/envanter/kamera-actions';
import { TIP_FOTO, TIP_H264, TIP_KARE, TIP_RESIM, type KameraAPI, type KameraDurumu } from '@/lib/kamera';

/* Telefon kamerasıyla sayım istasyonu (sadece masaüstü uygulamasında).
 *
 *   telefon --wss--> Electron ana süreç (electron-app/kamera.js) --IPC--> bu bileşen --> Web Worker
 *                                                                         (/kamera/sayim-worker.js:
 *                                                                          H.264 çözme, sayım, QR)
 * Telefondaki olaylar (parça ara/seç, sabitle, LabStock'a yaz) burada LabStock eylemleriyle karşılanır;
 * veritabanına her zaman kullanıcının kendi oturumuyla yazılır. Sunucu sadece kullanıcı açınca çalışır. */

const ACIK_ANAHTARI = 'labstock-kamera-acik';
/** Sayfanın altındaki özet satırının (footer, ~34 px) üstünde dursun, onu kapatmasın. */
const ALT_BOSLUK = 48;

const BIRIM_ANAHTARI = 'labstock-kamera-birimler'; // parça başına öğretilen tek parça alanı (mm²)

type ToastOge = { id: number; baslik: string; metin: string; hata: boolean };
// referans: madeni paranın görüntüdeki yeri (sayımdan çıkarılır)
type Olcek = { pxMm: number; ad: string; referans: { x: number; y: number } };
type BekleyenOlcek = { tip: 'daire' | 'kare'; mm: number; ad: string };
type Birimler = Record<string, { mm2: number; tarih: string }>;

function birimleriOku(): Birimler {
  try {
    return JSON.parse(localStorage.getItem(BIRIM_ANAHTARI) || '{}') as Birimler;
  } catch {
    return {};
  }
}
function birimleriYaz(b: Birimler) {
  try {
    localStorage.setItem(BIRIM_ANAHTARI, JSON.stringify(b));
  } catch {}
}
type TelefonIstatistik = { fps?: number; kamera?: string; format?: string; rtt?: number };

function kameraApi(): KameraAPI | null {
  if (typeof window === 'undefined') return null;
  return window.electronAPI?.kamera ?? null;
}

export function KameraIstasyonu() {
  const router = useRouter();
  const [api, setApi] = useState<KameraAPI | null>(null);
  const [durum, setDurum] = useState<KameraDurumu | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const [mod, setMod] = useState<'kamera' | 'sayim'>('kamera');
  const [sonAdet, setSonAdet] = useState<{ adet: number; sabit: boolean } | null>(null);
  const [istat, setIstat] = useState<TelefonIstatistik | null>(null);
  const [toastlar, setToastlar] = useState<ToastOge[]>([]);
  const [islem, setIslem] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const onizlemeRef = useRef<string | null>(null);
  const sayacRef = useRef(0);
  const panelRef = useRef(false);
  panelRef.current = panel;
  // Ölçek (madeni para) ve tek parça boyu: worker'a ve telefona aynı anda bildirilir
  const olcekRef = useRef<Olcek | null>(null);
  const bekleyenOlcekRef = useRef<BekleyenOlcek | null>(null);
  const seciliStokRef = useRef<string | null>(null);

  const toast = useCallback((baslik: string, metin: string, hataMi = false) => {
    const id = ++sayacRef.current;
    setToastlar((t) => [...t, { id, baslik, metin, hata: hataMi }]);
    setTimeout(() => setToastlar((t) => t.filter((x) => x.id !== id)), 8000);
  }, []);

  // ---- Telefona gönder
  const telefona = useCallback((m: Record<string, unknown>) => api?.gonder(m), [api]);

  /** Seçili parçanın kayıtlı boyutunu (varsa) worker'a ve telefona uygula. */
  const birimUygula = useCallback(
    (stokId: string | null) => {
      seciliStokRef.current = stokId;
      const kayit = stokId ? birimleriOku()[stokId] : undefined;
      workerRef.current?.postMessage({ tur: 'birim', mm2: kayit?.mm2 ?? null, px: null });
      api?.gonder({ birim: kayit ? { kaynak: 'kayitli', mm2: kayit.mm2 } : null });
    },
    [api],
  );

  const olcekGonder = useCallback(() => {
    const o = olcekRef.current;
    workerRef.current?.postMessage({ tur: 'olcek', pxMm: o?.pxMm ?? null, referans: o?.referans ?? null });
    api?.gonder({ olcek: o ? { ad: o.ad, pxMm: o.pxMm } : null });
  }, [api]);

  /** Telefonda resimde dokunulan bölge ölçüldü: ölçek referansı ya da öğretilen tek parça. */
  const dokunuldu = useCallback(
    (m: { amac: string; yok?: boolean; alan?: number; x?: number; y?: number; kac?: number }) => {
      if (m.yok || !m.alan) {
        api?.gonder({ dokunHata: 'Dokunduğun yerde bir nesne bulunamadı; tekrar dene' });
        return;
      }
      if (m.amac === 'olcek') {
        const b = bekleyenOlcekRef.current;
        if (!b) return;
        const alanMm2 = b.tip === 'daire' ? Math.PI * (b.mm / 2) ** 2 : b.mm * b.mm;
        olcekRef.current = { pxMm: Math.sqrt(m.alan / alanMm2), ad: b.ad, referans: { x: m.x!, y: m.y! } };
        bekleyenOlcekRef.current = null;
        olcekGonder();
        birimUygula(seciliStokRef.current); // kayıtlı mm² artık kullanılabilir
        api?.gonder({ bilgiMesaj: `Ölçek alındı: ${b.ad} (${olcekRef.current.pxMm.toFixed(1)} piksel/mm)` });
      } else if (m.amac === 'ogret') {
        const o = olcekRef.current;
        const stok = seciliStokRef.current;
        if (o) {
          const mm2 = m.alan / (o.pxMm * o.pxMm);
          if (stok) birimleriYaz({ ...birimleriOku(), [stok]: { mm2, tarih: new Date().toISOString() } });
          workerRef.current?.postMessage({ tur: 'birim', mm2, px: null });
          api?.gonder({ birim: { kaynak: stok ? 'kayitli' : 'oturum', mm2 } });
        } else {
          // Ölçek yok: alan bu kamera yüksekliği için piksel olarak kullanılır (kaydedilmez)
          workerRef.current?.postMessage({ tur: 'birim', mm2: null, px: m.alan });
          api?.gonder({ birim: { kaynak: 'oturum', mm2: null }, bilgiMesaj: 'Öğretildi (ölçek olmadığı için sadece bu sayımda geçerli)' });
        }
      }
    },
    [api, olcekGonder, birimUygula],
  );

  // ---- Worker (görüntü işleme)
  const workerAc = useCallback(() => {
    if (workerRef.current || !api) return workerRef.current;
    const w = new Worker('/kamera/sayim-worker.js');
    w.onmessage = async (e: MessageEvent) => {
      const m = e.data;
      switch (m.tur) {
        case 'sayim':
          api.gonder({ sayim: { adet: m.adet, sabit: m.sabit, uyari: m.uyari ?? null } });
          setSonAdet({ adet: m.adet, sabit: !!m.sabit });
          break;
        case 'resim': {
          const jpeg = new Uint8Array(m.veri);
          if (m.sayim) {
            const ikili = new Uint8Array(jpeg.length + 1);
            ikili[0] = TIP_RESIM;
            ikili.set(jpeg, 1);
            api.gonder(ikili);
          }
          if (panelRef.current) {
            const url = URL.createObjectURL(new Blob([jpeg], { type: 'image/jpeg' }));
            if (onizlemeRef.current) URL.revokeObjectURL(onizlemeRef.current);
            onizlemeRef.current = url;
            setOnizleme(url);
          }
          break;
        }
        case 'qr': {
          api.gonder({ qr: { tur: m.kodTur, id: m.id } });
          const sonuc = m.kodTur === 'P' ? await kameraStokBilgisi(m.id) : await kameraKonumParcalari(m.id);
          api.gonder(m.kodTur === 'P' ? { parca: sonuc } : { konum: sonuc });
          if (m.kodTur === 'P' && sonuc.ok) birimUygula(m.id);
          break;
        }
        case 'tedarikci': {
          // Tedarikçi poşet etiketi (LCSC): depoda var mı, daha önce işlendi mi
          const etiket = { kaynak: m.kaynak, kod: m.kod, mpn: m.mpn, adet: m.adet, iz: m.iz };
          api.gonder({ giris: { ...etiket, yukleniyor: true } });
          api.gonder({ giris: { ...etiket, ...(await kameraTedarikciEtiketi(m.kod, m.mpn, m.iz)) } });
          break;
        }
        case 'dokunuldu':
          dokunuldu(m);
          break;
        case 'anahtar':
          api.gonder({ anahtar: 1 }); // çözücü baştan başlamak istiyor
          break;
        case 'hata':
          console.warn('[kamera]', m.mesaj);
          break;
      }
    };
    workerRef.current = w;
    return w;
  }, [api, birimUygula, dokunuldu, olcekGonder]);

  const workerKapat = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
  }, []);

  // ---- Telefondan gelen uygulama olayları
  const olayIsle = useCallback(
    async (o: Record<string, unknown>) => {
      const w = workerRef.current;
      switch (o.olay) {
        case 'mod':
          setMod(o.mod === 'sayim' ? 'sayim' : 'kamera');
          w?.postMessage({ tur: 'mod', mod: o.mod });
          break;
        case 'sabitle':
          w?.postMessage({ tur: 'sabitle' });
          break;
        case 'coz':
          w?.postMessage({ tur: 'coz' });
          break;
        case 'ara': {
          const q = String(o.q ?? '').slice(0, 60);
          telefona({ arama: { ...(await kameraParcaAra(q)), q } });
          break;
        }
        case 'sec': {
          const p = await kameraStokBilgisi(String(o.stokId));
          telefona({ parca: p });
          if (p.ok) birimUygula(p.stokId);
          break;
        }
        case 'parca_birak':
          birimUygula(null);
          break;
        case 'dokun':
          w?.postMessage({ tur: 'dokun', x: Number(o.x), y: Number(o.y), amac: o.amac });
          break;
        case 'olcek_baslat':
          bekleyenOlcekRef.current = {
            tip: o.tip === 'kare' ? 'kare' : 'daire',
            mm: Number(o.mm),
            ad: String(o.ad ?? 'Referans').slice(0, 30),
          };
          break;
        case 'olcek_sifirla':
          olcekRef.current = null;
          olcekGonder();
          birimUygula(seciliStokRef.current);
          break;
        case 'birim_elle': {
          const ol = olcekRef.current;
          const mm2 = Number(o.en) * Number(o.boy);
          if (!ol || !(mm2 > 0)) {
            telefona({ dokunHata: 'Önce ölçek ayarla' });
            break;
          }
          const stok = seciliStokRef.current;
          if (stok) birimleriYaz({ ...birimleriOku(), [stok]: { mm2, tarih: new Date().toISOString() } });
          w?.postMessage({ tur: 'birim', mm2, px: null });
          telefona({ birim: { kaynak: stok ? 'kayitli' : 'oturum', mm2 } });
          break;
        }
        case 'birim_sifirla': {
          const stok = seciliStokRef.current;
          if (stok) {
            const b = birimleriOku();
            delete b[stok];
            birimleriYaz(b);
          }
          w?.postMessage({ tur: 'birim', mm2: null, px: null });
          telefona({ birim: null });
          break;
        }
        case 'giris_ekle': {
          const r = await kameraStokGiris(String(o.stokId), Number(o.adet), String(o.iz), String(o.kaynak ?? ''), !!o.zorla);
          telefona({ girisSonuc: r });
          if (r.ok) {
            toast('ETİKETTEN GİRİŞ', `${r.mpn}: ${r.eski} → ${r.yeni}`);
            router.refresh();
          } else toast('ETİKETTEN GİRİŞ YAPILAMADI', r.hata, true);
          break;
        }
        case 'yeni_parca': {
          const kod = String(o.kod ?? '').replace(/[^A-Za-z0-9]/g, '');
          const q = new URLSearchParams({ lcsc: kod, mpn: String(o.mpn ?? ''), adet: String(Number(o.adet) || '') });
          router.push(`/envanter/yeni?${q}`);
          break;
        }
        case 'onayla': {
          const r = await kameraSayimUygula(String(o.stokId), Number(o.adet));
          telefona({ islendi: r });
          if (r.ok) {
            toast('KAMERA SAYIMI', r.degisti ? `${r.mpn}: ${r.eski} → ${r.yeni}` : `${r.mpn}: ${r.yeni} (değişmedi)`);
            birimUygula(null);
            router.refresh();
          } else toast('KAMERA SAYIMI YAZILAMADI', r.hata, true);
          break;
        }
      }
    },
    [telefona, toast, router, birimUygula, olcekGonder],
  );

  // ---- Masaüstü API'si var mı (web sürümünde ve eski masaüstü sürümlerinde yok)
  useEffect(() => {
    setApi(kameraApi());
  }, []);

  // ---- Ana süreçten gelen olaylar
  useEffect(() => {
    if (!api) return;
    let iptal = false;
    api.durum().then((d) => !iptal && setDurum(d));
    const birak = api.dinle((olay) => {
      if (olay.tur === 'durum') {
        setDurum(olay.veri);
        if (olay.veri.telefon) {
          api.gonder({ labstock: { bagli: true } });
          const o = olcekRef.current;
          api.gonder({ olcek: o ? { ad: o.ad, pxMm: o.pxMm } : null });
        }
      } else if (olay.tur === 'ikili') {
        const v = olay.veri;
        const w = workerRef.current;
        if (!w) return;
        const tip = v[0];
        if (tip === TIP_H264) {
          const govde = v.slice(2);
          w.postMessage({ tur: 'h264', bayrak: v[1], veri: govde.buffer }, [govde.buffer]);
        } else if (tip === TIP_KARE || tip === TIP_FOTO) {
          const govde = v.slice(1);
          w.postMessage({ tur: tip === TIP_FOTO ? 'foto' : 'jpeg', veri: govde.buffer }, [govde.buffer]);
        }
      } else if (olay.tur === 'metin') {
        const m = olay.veri;
        if ('olay' in m) olayIsle(m);
        else if ('hata' in m || 'bilgi' in m) console.info('[telefon]', m.hata ?? m.bilgi);
        else setIstat(m as TelefonIstatistik);
      }
    });
    // Telefondaki "LabStock bağlı" ışığı için
    const nabiz = setInterval(() => api.gonder({ labstock: { bagli: true } }), 2000);
    return () => {
      iptal = true;
      birak();
      clearInterval(nabiz);
    };
  }, [api, olayIsle]);

  // ---- Aç / kapat
  const ac = useCallback(async () => {
    if (!api) return;
    setIslem(true);
    setHata(null);
    workerAc();
    const r = await api.baslat();
    setIslem(false);
    setDurum(r);
    if (!r.ok) {
      setHata(r.hata ?? 'Başlatılamadı');
      workerKapat();
      return;
    }
    try {
      localStorage.setItem(ACIK_ANAHTARI, '1');
    } catch {}
  }, [api, workerAc, workerKapat]);

  const kapat = useCallback(async () => {
    if (!api) return;
    setDurum(await api.durdur());
    workerKapat();
    setOnizleme(null);
    setSonAdet(null);
    try {
      localStorage.setItem(ACIK_ANAHTARI, '0');
    } catch {}
  }, [api, workerKapat]);

  // Daha önce açık bırakıldıysa uygulama açılınca kendiliğinden aç
  useEffect(() => {
    if (!api) return;
    try {
      if (localStorage.getItem(ACIK_ANAHTARI) === '1') ac();
    } catch {}
    // sadece ilk açılışta
  }, [api]);

  useEffect(() => () => workerKapat(), [workerKapat]);

  // QR (eşleşme adresi) ve panel açıkken canlı önizleme
  useEffect(() => {
    if (!durum?.adres) return setQr(null);
    QRCode.toDataURL(durum.adres, { margin: 1, width: 220 }).then(setQr, () => setQr(null));
  }, [durum?.adres]);
  useEffect(() => {
    workerRef.current?.postMessage({ tur: 'onizleme', acik: panel });
  }, [panel, durum?.acik]);

  const anahtariYenile = useCallback(async () => {
    if (!api) return;
    if (!confirm('Eşleşme sıfırlansın mı? Bağlı telefonlar QR kodu yeniden okutmak zorunda kalacak.')) return;
    setDurum(await api.anahtariYenile());
  }, [api]);

  if (!api) return null;

  const acik = !!durum?.acik;
  const telefon = !!durum?.telefon;
  const etiket = !acik ? 'Telefon kamerası' : !telefon ? 'Telefon bekleniyor' : mod === 'sayim' ? 'Telefon bağlı · Sayım' : 'Telefon bağlı';
  const nokta = !acik ? '#9ca3af' : telefon ? '#22c55e' : '#eab308';

  return (
    <>
      <button
        type="button"
        className="kart"
        onClick={() => setPanel((p) => !p)}
        title="Telefon kamerasıyla QR okuma ve parça sayımı"
        style={{
          position: 'fixed',
          left: 16,
          bottom: ALT_BOSLUK,
          zIndex: 1999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '7px 12px 7px 10px',
          borderRadius: 99,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ink-2)',
          boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
          cursor: 'pointer',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: telefon ? 'var(--copper)' : 'var(--ink-2)', opacity: acik ? 1 : 0.6 }}>
          <rect x="6" y="2" width="12" height="20" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
        <span>{etiket}</span>
        <span
          aria-hidden
          style={{ width: 8, height: 8, borderRadius: 99, background: nokta, boxShadow: telefon ? '0 0 0 3px rgba(34,197,94,0.18)' : 'none' }}
        />
      </button>

      {panel && (
        <div
          className="kart"
          style={{
            position: 'fixed',
            left: 16,
            bottom: ALT_BOSLUK + 44,
            zIndex: 2001,
            width: 340,
            maxHeight: `calc(100vh - ${ALT_BOSLUK + 74}px)`,
            overflow: 'auto',
            padding: 16,
            boxShadow: '0 16px 40px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <strong style={{ fontSize: 14 }}>Telefon kamerası</strong>
            <button type="button" onClick={() => setPanel(false)} aria-label="Kapat" className="bildirim-kapat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {!acik && (
            <>
              <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                Telefonun kamerasıyla QR etiketi okut, masaya döktüğün parçaları say ve tek dokunuşla stoğa işle. Telefon ve
                bilgisayar aynı Wi-Fi&apos;da olmalı.
              </p>
              <button type="button" className="btn btn-birincil" onClick={ac} disabled={islem} style={{ width: '100%' }}>
                {islem ? 'Açılıyor…' : 'Aç'}
              </button>
              {hata && <p style={{ margin: '10px 0 0', fontSize: 12, color: '#dc2626' }}>{hata}</p>}
            </>
          )}

          {acik && !telefon && (
            <>
              {qr && (
                <img src={qr} alt="Telefon için eşleşme QR kodu" width={220} height={220} style={{ display: 'block', margin: '0 auto 10px', borderRadius: 8, background: '#fff' }} />
              )}
              <ol style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                <li>Telefonun kamerasıyla bu QR kodu okut.</li>
                <li>&quot;Bu bağlantı gizli değil&quot; uyarısında: <em>Ayrıntılar → bu web sitesini ziyaret et</em>.</li>
                <li>
                  İstersen Safari&apos;de <em>Paylaş → Ana Ekrana Ekle</em> de; sonraki seferler ana ekrandan açarsın.
                </li>
              </ol>
              <p style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--ink-2)', opacity: 0.8 }}>
                Windows güvenlik duvarı sorarsa LabStock&apos;a özel ağlarda izin ver. Adres: {durum?.ip}:{durum?.port}
              </p>
            </>
          )}

          {acik && telefon && (
            <>
              <div style={{ position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden', marginBottom: 10, minHeight: 120 }}>
                {onizleme ? (
                  <img src={onizleme} alt="Telefon kamerası önizleme" style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'contain' }} />
                ) : (
                  <div style={{ color: '#aaa', fontSize: 12, padding: 40, textAlign: 'center' }}>Telefonda yayını başlat</div>
                )}
                {mod === 'sayim' && sonAdet && (
                  <div style={{ position: 'absolute', left: 8, top: 8, background: 'rgba(0,0,0,0.65)', color: sonAdet.sabit ? '#facc15' : '#fff', borderRadius: 8, padding: '4px 10px', fontWeight: 700, fontSize: 20 }}>
                    {sonAdet.adet} adet
                  </div>
                )}
              </div>
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--ink-2)' }}>
                {mod === 'sayim' ? 'Sayım modu: telefondan QR okut ya da parça ara, sabitle, LabStock\'a yaz.' : 'Kamera modu. Telefonda “Sayım”a geç.'}
                {istat?.fps ? ` · ${Math.round(istat.fps)} fps` : ''}
                {istat?.kamera ? ` · ${istat.kamera}` : ''}
              </p>
            </>
          )}

          {acik && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
              <button type="button" className="btn" onClick={kapat}>
                Kapat
              </button>
              <button type="button" onClick={anahtariYenile} style={{ background: 'none', border: 0, color: 'var(--ink-2)', fontSize: 11.5, textDecoration: 'underline', cursor: 'pointer' }}>
                Eşleşmeyi sıfırla
              </button>
            </div>
          )}
        </div>
      )}

      {toastlar.length > 0 && (
        <div style={{ position: 'fixed', right: 16, bottom: ALT_BOSLUK, zIndex: 2000, display: 'flex', flexDirection: 'column-reverse', gap: 8, pointerEvents: 'none' }}>
          {toastlar.map((t) => (
            <div
              key={t.id}
              className="kart alinacak-toast"
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', width: 300, boxShadow: '0 12px 32px rgba(0,0,0,0.18)', pointerEvents: 'auto' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mn" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: t.hata ? '#dc2626' : 'var(--copper)' }}>
                  {t.baslik}
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>{t.metin}</p>
              </div>
              <button type="button" onClick={() => setToastlar((cur) => cur.filter((x) => x.id !== t.id))} aria-label="Bildirimi kapat" className="bildirim-kapat">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
