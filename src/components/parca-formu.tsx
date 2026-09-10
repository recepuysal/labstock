'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parcaEkle, parcaGuncelle, type EylemDurum } from '@/app/envanter/actions';
import { parametrelerToMetin } from '@/lib/types';

const KATEGORILER = [
  'Direnç',
  'Kondansatör',
  'Bobin',
  'Diyot',
  'Transistör',
  'Entegre',
  'Regülatör',
  'Optoelektronik',
  'Konnektör',
  'Kristal / Osilatör',
  'Modül',
  'Koruma',
  'Mekanik',
  'Diğer',
];

export type ParcaBaslangic = {
  stok_id: string;
  part_id: string;
  mpn: string;
  uretici: string | null;
  aciklama: string | null;
  kategori: string | null;
  kilif: string | null;
  konum_id: string | null;
  min_adet: number;
  adet: number;
  tedarikci: string | null;
  tedarikci_kodu: string | null;
  alis_fiyati: number | null;
  para_birimi: string;
  datasheet_url: string | null;
  parametreler: Record<string, string>;
  rohs: boolean | null;
  resim_url: string | null;
};

type Props = {
  konumlar: { id: string; etiket: string }[];
  mod?: 'ekle' | 'duzenle';
  baslangic?: ParcaBaslangic;
  donus?: string;
};

export function ParcaFormu({ konumlar, mod = 'ekle', baslangic, donus }: Props) {
  const duzenle = mod === 'duzenle';
  const eylem = duzenle ? parcaGuncelle : parcaEkle;
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(eylem, {});
  const router = useRouter();
  const [onizleme, setOnizleme] = useState<string | null>(null);
  const resimGirdi = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (durum.bilgi) {
      router.push(donus || '/envanter');
      router.refresh();
    }
  }, [durum.bilgi, donus, router]);

  function resimSecildi(e: React.ChangeEvent<HTMLInputElement>) {
    const dosya = e.target.files?.[0];
    if (!dosya) return;
    setOnizleme(URL.createObjectURL(dosya));
  }

  const gosterilecekResim = onizleme ?? baslangic?.resim_url ?? null;

  return (
    <form action={gonder} className="kart" style={{ padding: 22 }}>
      {durum.hata && (
        <div className="hata" style={{ marginBottom: 16 }}>
          {durum.hata}
        </div>
      )}

      {duzenle && (
        <>
          <input type="hidden" name="stok_id" value={baslangic!.stok_id} />
          <input type="hidden" name="part_id" value={baslangic!.part_id} />
          {donus && <input type="hidden" name="donus" value={donus} />}
        </>
      )}

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 20 }}>
        <div
          style={{
            width: 76,
            height: 76,
            flexShrink: 0,
            borderRadius: 'var(--r)',
            overflow: 'hidden',
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--muted-2)',
          }}
        >
          {gosterilecekResim ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gosterilecekResim} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="9" cy="9" r="1.8" />
              <path d="m21 15-5-5L5 21" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <label className="etiket">Parça görseli</label>
          <input
            ref={resimGirdi}
            type="file"
            name="resim"
            accept="image/png,image/jpeg,image/webp"
            onChange={resimSecildi}
            style={{ display: 'none' }}
          />
          <button type="button" className="btn" onClick={() => resimGirdi.current?.click()}>
            Görsel seç
          </button>
          <p style={{ margin: '6px 0 0', fontSize: 10.5, color: 'var(--muted-2)' }}>
            PNG, JPEG ya da WEBP — en fazla 2 MB.
          </p>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="etiket" htmlFor="mpn">
          MPN — parça numarası *
        </label>
        <input
          className="alan mn"
          id="mpn"
          name="mpn"
          required
          autoFocus
          defaultValue={baslangic?.mpn}
          placeholder="RC0805FR-0710KL"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div>
          <label className="etiket" htmlFor="uretici">
            Üretici
          </label>
          <input
            className="alan"
            id="uretici"
            name="uretici"
            defaultValue={baslangic?.uretici ?? undefined}
            placeholder="Yageo"
          />
        </div>
        <div>
          <label className="etiket" htmlFor="kilif">
            Kılıf
          </label>
          <input
            className="alan mn"
            id="kilif"
            name="kilif"
            defaultValue={baslangic?.kilif ?? undefined}
            placeholder="0805"
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="etiket" htmlFor="aciklama">
          Açıklama
        </label>
        <input
          className="alan"
          id="aciklama"
          name="aciklama"
          defaultValue={baslangic?.aciklama ?? undefined}
          placeholder="Direnç 10 kΩ ±1% 1/8 W"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
        <div>
          <label className="etiket" htmlFor="kategori">
            Kategori
          </label>
          <select
            className="alan"
            id="kategori"
            name="kategori"
            defaultValue={baslangic?.kategori ?? ''}
          >
            <option value="">seçilmedi</option>
            {KATEGORILER.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="etiket" htmlFor="konum_id">
            Konum
          </label>
          <select
            className="alan"
            id="konum_id"
            name="konum_id"
            defaultValue={baslangic?.konum_id ?? ''}
          >
            <option value="">konumsuz</option>
            {konumlar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.etiket}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="etiket" htmlFor="rohs">
          Uyumluluk
        </label>
        <select
          className="alan"
          id="rohs"
          name="rohs"
          defaultValue={baslangic?.rohs === true ? 'evet' : baslangic?.rohs === false ? 'hayir' : ''}
        >
          <option value="">Bilinmiyor</option>
          <option value="evet">RoHS uyumlu</option>
          <option value="hayir">RoHS değil</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
        {duzenle ? (
          <div>
            <label className="etiket">Adet</label>
            <div
              className="alan mn"
              style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)' }}
            >
              {baslangic!.adet}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--muted-2)' }}>
              Adet burada değişmez — listedeki +/− ile ayarlanır.
            </p>
          </div>
        ) : (
          <div>
            <label className="etiket" htmlFor="adet">
              Adet
            </label>
            <input
              className="alan mn"
              id="adet"
              name="adet"
              type="number"
              min={0}
              step="any"
              defaultValue={0}
            />
          </div>
        )}
        <div>
          <label className="etiket" htmlFor="min_adet">
            Minimum seviye
          </label>
          <input
            className="alan mn"
            id="min_adet"
            name="min_adet"
            type="number"
            min={0}
            step="any"
            defaultValue={baslangic?.min_adet ?? 0}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 22 }}>
        <div>
          <label className="etiket" htmlFor="tedarikci">
            Tedarikçi
          </label>
          <input
            className="alan"
            id="tedarikci"
            name="tedarikci"
            defaultValue={baslangic?.tedarikci ?? undefined}
            placeholder="LCSC"
          />
        </div>
        <div>
          <label className="etiket" htmlFor="tedarikci_kodu">
            Tedarikçi kodu
          </label>
          <input
            className="alan mn"
            id="tedarikci_kodu"
            name="tedarikci_kodu"
            defaultValue={baslangic?.tedarikci_kodu ?? undefined}
            placeholder="C17414"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 14, marginBottom: 22 }}>
        <div>
          <label className="etiket" htmlFor="alis_fiyati">
            Son alım fiyatı
          </label>
          <input
            className="alan mn"
            id="alis_fiyati"
            name="alis_fiyati"
            type="number"
            min={0}
            step="any"
            defaultValue={baslangic?.alis_fiyati ?? undefined}
            placeholder="17.10"
          />
        </div>
        <div>
          <label className="etiket" htmlFor="para_birimi">
            Birim
          </label>
          <select
            className="alan mn"
            id="para_birimi"
            name="para_birimi"
            defaultValue={baslangic?.para_birimi ?? 'TRY'}
          >
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="etiket" htmlFor="datasheet_url">
          Datasheet URL
        </label>
        <input
          className="alan mn"
          id="datasheet_url"
          name="datasheet_url"
          type="url"
          defaultValue={baslangic?.datasheet_url ?? undefined}
          placeholder="https://..."
        />
      </div>

      <div style={{ marginBottom: 22 }}>
        <label className="etiket" htmlFor="parametreler">
          Parametreler
        </label>
        <textarea
          className="alan mn"
          id="parametreler"
          name="parametreler"
          rows={4}
          style={{ height: 'auto', padding: '9px 11px', resize: 'vertical' }}
          defaultValue={parametrelerToMetin(baslangic?.parametreler)}
          placeholder={'Çekirdek: ARM Cortex-M3\nFrekans: 72 MHz\nFlash: 64 KB'}
        />
        <p style={{ margin: '4px 0 0', fontSize: 10.5, color: 'var(--muted-2)' }}>
          Her satıra bir tane: "Anahtar: Değer".
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-birincil" type="submit" disabled={bekliyor}>
          {bekliyor ? 'Kaydediliyor…' : duzenle ? 'Güncelle' : 'Kaydet'}
        </button>
        <Link href={donus || '/envanter'} className="btn">
          Vazgeç
        </Link>
      </div>
    </form>
  );
}
