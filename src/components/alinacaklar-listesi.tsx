'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { alinacakEkle, alinacakGuncelle, alinacakSil } from '@/app/envanter/alinacaklar/actions';
import type { EylemDurum } from '@/app/envanter/actions';
import { AlinacakSatirMenu } from '@/components/alinacak-satir-menu';
import { sayi } from '@/lib/types';

export type AlinacakKaydi = {
  id: string;
  malzeme_adi: string;
  adet: number;
  not_metni: string | null;
  link: string | null;
};

export function AlinacaklarListesi({
  kayitlar,
  saltOkunur,
}: {
  kayitlar: AlinacakKaydi[];
  saltOkunur?: boolean;
}) {
  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);

  return (
    <div>
      {!saltOkunur && <EklemeFormu />}

      <div className="kart" style={{ marginTop: 16, overflow: 'hidden' }}>
        {kayitlar.length === 0 ? (
          <p style={{ padding: 20, margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            Henüz bir şey eklenmemiş.
          </p>
        ) : (
          kayitlar.map((k, i) =>
            duzenlenenId === k.id ? (
              <DuzenleSatiri key={k.id} kayit={k} onIptal={() => setDuzenlenenId(null)} />
            ) : (
              <GosterSatiri
                key={k.id}
                kayit={k}
                ilk={i === 0}
                saltOkunur={saltOkunur}
                onDuzenle={() => setDuzenlenenId(k.id)}
              />
            ),
          )
        )}
      </div>
    </div>
  );
}

function EklemeFormu() {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(alinacakEkle, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (durum.bilgi) formRef.current?.reset();
  }, [durum.bilgi]);

  return (
    <form ref={formRef} action={gonder} className="kart" style={{ padding: 16 }}>
      {durum.hata && (
        <div className="hata" style={{ marginBottom: 12 }}>
          {durum.hata}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 2fr 1.4fr auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label className="etiket" htmlFor="malzeme_adi">
            Malzeme adı *
          </label>
          <input className="alan" id="malzeme_adi" name="malzeme_adi" required placeholder="Örn. 100nF kondansatör" />
        </div>
        <div>
          <label className="etiket" htmlFor="adet">
            Adet
          </label>
          <input className="alan mn" id="adet" name="adet" type="number" min={0} step="any" defaultValue={1} />
        </div>
        <div>
          <label className="etiket" htmlFor="not_metni">
            Not
          </label>
          <input className="alan" id="not_metni" name="not_metni" placeholder="Örn. Mouser'dan al" />
        </div>
        <div>
          <label className="etiket" htmlFor="link">
            Link
          </label>
          <input className="alan mn" id="link" name="link" type="url" placeholder="https://..." />
        </div>
        <button className="btn btn-birincil" type="submit" disabled={bekliyor} style={{ height: 38 }}>
          {bekliyor ? '…' : '+ Ekle'}
        </button>
      </div>
    </form>
  );
}

function GosterSatiri({
  kayit,
  ilk,
  saltOkunur,
  onDuzenle,
}: {
  kayit: AlinacakKaydi;
  ilk: boolean;
  saltOkunur?: boolean;
  onDuzenle: () => void;
}) {
  const [, basla] = useTransition();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderTop: ilk ? undefined : '1px solid var(--line-soft)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13.5 }}>{kayit.malzeme_adi}</span>
          <span className="mn" style={{ fontSize: 11.5, color: 'var(--muted)' }}>
            × {sayi.format(kayit.adet)}
          </span>
        </div>
        {(kayit.not_metni || kayit.link) && (
          <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
            {kayit.not_metni && (
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{kayit.not_metni}</span>
            )}
            {kayit.link && (
              <a
                href={kayit.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mn"
                style={{ fontSize: 11.5 }}
              >
                Bağlantı ↗
              </a>
            )}
          </div>
        )}
      </div>

      {!saltOkunur && (
        <AlinacakSatirMenu
          malzemeAdi={kayit.malzeme_adi}
          onDuzenle={onDuzenle}
          onSil={() => basla(async () => await alinacakSil(kayit.id))}
        />
      )}
    </div>
  );
}

function DuzenleSatiri({ kayit, onIptal }: { kayit: AlinacakKaydi; onIptal: () => void }) {
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(alinacakGuncelle, {});

  useEffect(() => {
    if (durum.bilgi) onIptal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum.bilgi]);

  return (
    <form action={gonder} style={{ padding: 16, borderTop: '1px solid var(--line-soft)', background: 'var(--surface-2)' }}>
      <input type="hidden" name="id" value={kayit.id} />
      {durum.hata && (
        <div className="hata" style={{ marginBottom: 12 }}>
          {durum.hata}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 2fr 1.4fr auto auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label className="etiket">Malzeme adı *</label>
          <input className="alan" name="malzeme_adi" required defaultValue={kayit.malzeme_adi} autoFocus />
        </div>
        <div>
          <label className="etiket">Adet</label>
          <input className="alan mn" name="adet" type="number" min={0} step="any" defaultValue={kayit.adet} />
        </div>
        <div>
          <label className="etiket">Not</label>
          <input className="alan" name="not_metni" defaultValue={kayit.not_metni ?? ''} />
        </div>
        <div>
          <label className="etiket">Link</label>
          <input className="alan mn" name="link" type="url" defaultValue={kayit.link ?? ''} />
        </div>
        <button className="btn btn-birincil" type="submit" disabled={bekliyor} style={{ height: 38 }}>
          {bekliyor ? '…' : 'Kaydet'}
        </button>
        <button type="button" className="btn" onClick={onIptal} disabled={bekliyor} style={{ height: 38 }}>
          Vazgeç
        </button>
      </div>
    </form>
  );
}
