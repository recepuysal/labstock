'use client';

import { useActionState, useState } from 'react';
import { haftalikYedekAyarlariniKaydet } from '@/app/ayarlar/actions';
import type { EylemDurum } from '@/app/envanter/actions';

export function HaftalikYedekFormu({
  baslangicAktif,
  baslangicEposta,
  girisEpostasi,
}: {
  baslangicAktif: boolean;
  baslangicEposta: string | null;
  girisEpostasi: string | null;
}) {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(haftalikYedekAyarlariniKaydet, {});
  const [aktif, setAktif] = useState(baslangicAktif);

  return (
    <div className="kart" style={{ padding: 20, marginTop: 16 }}>
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}
      >
        HAFTALIK YEDEK E-POSTASI
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
        Açarsan her Pazartesi sabahı envanterinin bir özetini (kritik/az stoklu kalemler, tahmini
        toplam değer) ve tam listeyi CSV eki olarak e-posta ile alırsın — hem bilgilendirme hem
        yedek amaçlı.
      </p>

      <form action={gonder} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
          <input
            type="checkbox"
            name="aktif"
            checked={aktif}
            onChange={(e) => setAktif(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Haftalık özet + yedek e-postası gönder
        </label>

        {aktif && (
          <div>
            <label className="etiket" htmlFor="eposta">
              Gönderilecek adres (boş bırakırsan {girisEpostasi ?? 'giriş e-postan'} kullanılır)
            </label>
            <input
              className="alan mn"
              id="eposta"
              name="eposta"
              type="email"
              defaultValue={baslangicEposta ?? ''}
              placeholder={girisEpostasi ?? 'ornek@eposta.com'}
              style={{ maxWidth: 320 }}
            />
          </div>
        )}

        <div>
          <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
            {bekliyor ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </form>

      {durum.hata && (
        <div className="hata" style={{ marginTop: 10 }}>
          {durum.hata}
        </div>
      )}
      {durum.bilgi && <p style={{ margin: '10px 0 0', fontSize: 11.5, color: 'var(--ok)' }}>{durum.bilgi}</p>}
    </div>
  );
}
