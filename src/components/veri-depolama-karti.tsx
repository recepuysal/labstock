'use client';

import { useState, useTransition } from 'react';
import { bulutaDon, cevrimdisiModaGec, yedektenGeriEkle, yerelVerileriYukle, yuklemeyiAtla } from '@/app/ayarlar/depolama-actions';
import { useSozluk } from '@/lib/i18n/istemci';

/** Ayarlar → Veri depolama: bulut (varsayılan) ↔ çevrimdışı mod anahtarı. */
export function VeriDepolamaKarti({
  mod,
  dosyaYolu,
  yuklemeBekliyor,
  sonDegisiklik,
  yedekler,
}: {
  mod: 'bulut' | 'yerel';
  dosyaYolu: string;
  yuklemeBekliyor: boolean;
  /** Önceden biçimlendirilmiş tarih (sunucuda, aktif dilde). */
  sonDegisiklik: string | null;
  /** Bu hesaba ait önceki bulut yedekleri (etiket sunucuda hazırlanır). */
  yedekler: { ad: string; etiket: string }[];
}) {
  const s = useSozluk().ayarlar.depolama;
  const [onay, setOnay] = useState(false);
  const [bekliyor, baslat] = useTransition();
  const [mesaj, setMesaj] = useState<{ hata?: string; bilgi?: string }>({});
  const [yuklemeSorusu, setYuklemeSorusu] = useState(yuklemeBekliyor);
  const bulutta = mod === 'bulut';

  function onayla(ekle = false) {
    setMesaj({});
    baslat(async () => {
      // Başarılı olursa sunucu yönlendirir; buraya sadece hata dönerse gelinir.
      const sonuc = bulutta ? await cevrimdisiModaGec() : await bulutaDon(ekle);
      if (sonuc?.hata) setMesaj({ hata: sonuc.hata });
    });
  }

  function yukleme(yukle: boolean) {
    setMesaj({});
    baslat(async () => {
      const sonuc = yukle ? await yerelVerileriYukle() : await yuklemeyiAtla();
      setMesaj(sonuc);
      if (!sonuc.hata) setYuklemeSorusu(false);
    });
  }

  return (
    <div id="depolama" className="kart" style={{ padding: 20, marginTop: 16 }}>
      <div className="mn" style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}>
        {s.baslik}
      </div>

      {yuklemeSorusu && bulutta && (
        <div style={{ border: '1px solid var(--copper-line)', background: 'var(--copper-soft, transparent)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{s.yuklemeBaslik}</div>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{s.yuklemeAciklama(sonDegisiklik)}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-birincil" type="button" disabled={bekliyor} onClick={() => yukleme(true)}>
              {bekliyor ? s.yukleniyor : s.yukle}
            </button>
            <button className="btn" type="button" disabled={bekliyor} onClick={() => yukleme(false)}>
              {s.yukleme}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, fontSize: 13 }}>
        <span style={{ fontWeight: 600 }}>{s.bulutEtiket}</span>
        <label className="anahtar">
          <input
            type="checkbox"
            role="switch"
            checked={bulutta && !onay}
            disabled={bekliyor}
            onChange={() => {
              setMesaj({});
              setOnay(true);
            }}
            aria-label={s.bulutEtiket}
          />
          <span className="parmak" />
        </label>
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        {bulutta ? s.bulutAciklama : s.cevrimdisiAciklama}
      </p>
      {bulutta && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{s.kapatAciklama}</p>}

      {!bulutta && (
        <>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{s.internetGerekenler}</p>
          <p className="mn" style={{ margin: '8px 0 0', fontSize: 11.5, color: 'var(--muted-2)', overflowWrap: 'anywhere' }}>
            {s.dosyaYeri}: {dosyaYolu}
          </p>
        </>
      )}

      {onay && (
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{bulutta ? s.onayBaslik : s.bulutaDonBaslik}</div>
          <p style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            {bulutta ? s.onayAciklama : s.bulutaDonAciklama}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {bulutta ? (
              <button className="btn btn-birincil" type="button" disabled={bekliyor} onClick={() => onayla()}>
                {bekliyor ? s.kopyalaniyor : s.gec}
              </button>
            ) : (
              <>
                <button className="btn btn-birincil" type="button" disabled={bekliyor} onClick={() => onayla(true)}>
                  {bekliyor ? s.yukleniyor : s.bulutaDonEkle}
                </button>
                <button className="btn" type="button" disabled={bekliyor} onClick={() => onayla(false)}>
                  {s.bulutaDonEkleme}
                </button>
              </>
            )}
            <button className="btn" type="button" disabled={bekliyor} onClick={() => setOnay(false)}>
              {s.vazgec}
            </button>
          </div>
        </div>
      )}

      {bulutta && yedekler.length > 0 && (
        <details style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 12.5, color: 'var(--muted)' }}>{s.yedekBaslik}</summary>
          <p style={{ margin: '8px 0 10px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{s.yedekAciklama}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {yedekler.map((y) => (
              <div key={y.ad} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
                <span className="mn" style={{ fontSize: 11.5 }}>{y.etiket}</span>
                <button
                  className="btn"
                  type="button"
                  disabled={bekliyor}
                  style={{ height: 28, fontSize: 12 }}
                  onClick={() => {
                    setMesaj({});
                    baslat(async () => setMesaj(await yedektenGeriEkle(y.ad)));
                  }}
                >
                  {s.geriEkle}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {mesaj.hata && (
        <div className="hata" style={{ marginTop: 10 }}>
          {mesaj.hata}
        </div>
      )}
      {mesaj.bilgi && <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ok)', overflowWrap: 'anywhere' }}>{mesaj.bilgi}</p>}
    </div>
  );
}
