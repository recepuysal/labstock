'use client';

import { useActionState } from 'react';
import { profilGuncelle } from '@/app/ayarlar/actions';
import type { EylemDurum } from '@/app/envanter/actions';
import { useSozluk } from '@/lib/i18n/istemci';

type Baslangic = {
  eposta: string;
  ad: string | null;
  telefon: string | null;
  sirket_adi: string | null;
  sirket_adresi: string | null;
};

export function ProfilFormu({ baslangic }: { baslangic: Baslangic }) {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(profilGuncelle, {});
  const so = useSozluk();
  const s = so.ayarlar.profil;

  return (
    <form action={gonder} className="kart" style={{ padding: 22 }}>
      {durum.hata && (
        <div className="hata" style={{ marginBottom: 16 }}>
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
            marginBottom: 16,
          }}
        >
          {durum.bilgi}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label className="etiket">{s.eposta}</label>
        <div className="alan" style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)' }}>
          {baslangic.eposta}
        </div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <label className="etiket" htmlFor="ad">
          {s.ad}
        </label>
        <input
          className="alan"
          id="ad"
          name="ad"
          defaultValue={baslangic.ad ?? undefined}
          placeholder={s.adOrnek}
        />
      </div>

      <div
        style={{
          margin: '0 0 16px',
          paddingTop: 16,
          borderTop: '1px solid var(--line-soft)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          color: 'var(--muted)',
          textTransform: 'uppercase',
        }}
      >
        {s.sirketBilgileri}
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="etiket" htmlFor="sirket_adi">
          {s.sirketAdi}
        </label>
        <input
          className="alan"
          id="sirket_adi"
          name="sirket_adi"
          defaultValue={baslangic.sirket_adi ?? undefined}
          placeholder={s.sirketOrnek}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="etiket" htmlFor="sirket_adresi">
          {s.sirketAdresi}
        </label>
        <input
          className="alan"
          id="sirket_adresi"
          name="sirket_adresi"
          defaultValue={baslangic.sirket_adresi ?? undefined}
          placeholder={s.adresIpucu}
        />
      </div>

      <div style={{ marginBottom: 22 }}>
        <label className="etiket" htmlFor="telefon">
          {s.telefon}
        </label>
        <input
          className="alan mn"
          id="telefon"
          name="telefon"
          defaultValue={baslangic.telefon ?? undefined}
          placeholder={s.telefonOrnek}
        />
      </div>

      <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
        {bekliyor ? so.ortak.buton.kaydediliyor : so.ortak.buton.kaydet}
      </button>
    </form>
  );
}
