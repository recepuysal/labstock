'use client';

import { useState, useTransition } from 'react';
import { bulutaDon, cevrimdisiModaGec, yerelVerileriYukle, yuklemeyiAtla } from '@/app/ayarlar/depolama-actions';
import { useSozluk } from '@/lib/i18n/istemci';

/** Ayarlar → Veri depolama: bulut (varsayılan) ↔ çevrimdışı mod anahtarı. */
export function VeriDepolamaKarti({
  mod,
  dosyaYolu,
  yuklemeBekliyor,
  sonDegisiklik,
}: {
  mod: 'bulut' | 'yerel';
  dosyaYolu: string;
  yuklemeBekliyor: boolean;
  /** Önceden biçimlendirilmiş tarih (sunucuda, aktif dilde). */
  sonDegisiklik: string | null;
}) {
  const s = useSozluk().ayarlar.depolama;
  const [onay, setOnay] = useState(false);
  const [bekliyor, baslat] = useTransition();
  const [mesaj, setMesaj] = useState<{ hata?: string; bilgi?: string }>({});
  const [yuklemeSorusu, setYuklemeSorusu] = useState(yuklemeBekliyor);
  const bulutta = mod === 'bulut';

  function onayla() {
    setMesaj({});
    baslat(async () => {
      // Başarılı olursa sunucu yönlendirir; buraya sadece hata dönerse gelinir.
      const sonuc = bulutta ? await cevrimdisiModaGec() : await bulutaDon();
      if (sonuc && 'hata' in sonuc && sonuc.hata) setMesaj({ hata: sonuc.hata });
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
            <button className="btn btn-birincil" type="button" disabled={bekliyor} onClick={onayla}>
              {bekliyor ? s.kopyalaniyor : bulutta ? s.gec : s.bulutaDon}
            </button>
            <button className="btn" type="button" disabled={bekliyor} onClick={() => setOnay(false)}>
              {s.vazgec}
            </button>
          </div>
        </div>
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
