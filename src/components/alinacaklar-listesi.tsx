'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { alinacakDurumDegistir, alinacakEkle, alinacakGuncelle, alinacakSil } from '@/app/envanter/alinacaklar/actions';
import type { EylemDurum } from '@/app/envanter/actions';
import { AlinacakSatirMenu } from '@/components/alinacak-satir-menu';
import { KopyalaButonu } from '@/components/kopyala-butonu';
import {
  ALINACAK_DURUMLAR,
  ALINACAK_DURUM_ROZET,
  alinacakDurumEtiketi,
  sayiBicimi,
  type AlinacakDurumu,
} from '@/lib/types';
import { useDil, useSozluk } from '@/lib/i18n/istemci';

export type AlinacakKaydi = {
  id: string;
  malzeme_adi: string;
  adet: number;
  not_metni: string | null;
  link: string | null;
  durum: string;
};

function gecerliDurum(d: string): AlinacakDurumu {
  return (ALINACAK_DURUMLAR as readonly string[]).includes(d) ? (d as AlinacakDurumu) : 'bekliyor';
}

function sonrakiDurum(mevcut: AlinacakDurumu): AlinacakDurumu {
  const i = ALINACAK_DURUMLAR.indexOf(mevcut);
  return ALINACAK_DURUMLAR[(i + 1) % ALINACAK_DURUMLAR.length];
}

const SUTUN = {
  malzeme: { flex: '2.2 1 0', minWidth: 0 },
  adet: { width: 48, flexShrink: 0 },
  not: { flex: '1.2 1 0', minWidth: 0 },
  link: { flex: '1.6 1 0', minWidth: 0 },
  menu: { width: 22, flexShrink: 0 },
} as const;

export function AlinacaklarListesi({ kayitlar }: { kayitlar: AlinacakKaydi[] }) {
  const s = useSozluk().envanter.alinacaklar;
  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);

  return (
    <div>
      <EklemeFormu />

      <div className="kart" style={{ marginTop: 16, overflow: 'hidden' }}>
        {kayitlar.length === 0 ? (
          <p style={{ padding: 20, margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            {s.bos}
          </p>
        ) : (
          <>
            <div
              className="mn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '9px 16px',
                borderBottom: '1px solid var(--line)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--muted-2)',
              }}
            >
              <div style={SUTUN.malzeme}>{s.malzemeDurum}</div>
              <div style={{ ...SUTUN.adet, textAlign: 'right' }}>{s.adet}</div>
              <div style={SUTUN.not}>{s.not}</div>
              <div style={SUTUN.link}>{s.link}</div>
              <div style={SUTUN.menu} />
            </div>

            {kayitlar.map((k, i) =>
              duzenlenenId === k.id ? (
                <DuzenleSatiri key={k.id} kayit={k} onIptal={() => setDuzenlenenId(null)} />
              ) : (
                <GosterSatiri
                  key={k.id}
                  kayit={k}
                  ilk={i === 0}
                  onDuzenle={() => setDuzenlenenId(k.id)}
                />
              ),
            )}
          </>
        )}
      </div>
    </div>
  );
}

function EklemeFormu() {
  const s = useSozluk().envanter.alinacaklar;
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
            {s.malzemeAdi}
          </label>
          <input className="alan" id="malzeme_adi" name="malzeme_adi" required placeholder={s.malzemeOrnek} />
        </div>
        <div>
          <label className="etiket" htmlFor="adet">
            {s.adet}
          </label>
          <input className="alan mn" id="adet" name="adet" type="number" min={0} step="any" defaultValue={1} />
        </div>
        <div>
          <label className="etiket" htmlFor="not_metni">
            {s.not}
          </label>
          <input className="alan" id="not_metni" name="not_metni" placeholder={s.notOrnek} />
        </div>
        <div>
          <label className="etiket" htmlFor="link">
            {s.link}
          </label>
          <input className="alan mn" id="link" name="link" type="url" placeholder="https://..." />
        </div>
        <button className="btn btn-birincil" type="submit" disabled={bekliyor} style={{ height: 38 }}>
          {bekliyor ? '…' : s.ekle}
        </button>
      </div>
    </form>
  );
}

function DurumRozeti({ durum, tiklanabilir, onTikla }: { durum: string; tiklanabilir?: boolean; onTikla?: () => void }) {
  const dil = useDil();
  const s = useSozluk().envanter.alinacaklar;
  const gecerli = gecerliDurum(durum);
  const sinif = `rozet ${ALINACAK_DURUM_ROZET[gecerli]}`;
  const etiket = alinacakDurumEtiketi(gecerli, dil);

  if (!tiklanabilir) {
    return (
      <span className={sinif} style={{ flexShrink: 0 }}>
        {etiket}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onTikla}
      className={sinif}
      title={s.sonrakiDurum}
      style={{ flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit' }}
    >
      {etiket}
    </button>
  );
}

function GosterSatiri({
  kayit,
  ilk,
  onDuzenle,
}: {
  kayit: AlinacakKaydi;
  ilk: boolean;
  onDuzenle: () => void;
}) {
  const dil = useDil();
  const s = useSozluk().envanter.alinacaklar;
  const [, basla] = useTransition();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 16px',
        borderTop: ilk ? undefined : '1px solid var(--line-soft)',
      }}
    >
      <div style={{ ...SUTUN.malzeme, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
          title={kayit.malzeme_adi}
        >
          {kayit.malzeme_adi}
        </span>
        <KopyalaButonu metin={kayit.malzeme_adi} baslik={s.malzemeKopyala} />
        <DurumRozeti
          durum={kayit.durum}
          tiklanabilir
          onTikla={() =>
            basla(async () => await alinacakDurumDegistir(kayit.id, sonrakiDurum(gecerliDurum(kayit.durum))))
          }
        />
      </div>

      <div className="mn" style={{ ...SUTUN.adet, textAlign: 'right', fontSize: 12.5, color: 'var(--muted)' }}>
        {sayiBicimi(dil).format(kayit.adet)}
      </div>

      <div style={{ ...SUTUN.not, fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={kayit.not_metni ?? ''}>
        {kayit.not_metni || <span style={{ color: 'var(--muted-2)' }}>—</span>}
      </div>

      <div style={{ ...SUTUN.link, display: 'flex', alignItems: 'center', gap: 6 }}>
        {kayit.link ? (
          <>
            <a
              href={kayit.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mn"
              title={kayit.link}
              style={{ fontSize: 11.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            >
              {kayit.link.replace(/^https?:\/\//, '')}
            </a>
            <KopyalaButonu metin={kayit.link} baslik={s.baglantiKopyala} />
          </>
        ) : (
          <span style={{ color: 'var(--muted-2)' }}>—</span>
        )}
      </div>

      <div style={SUTUN.menu}>
        <AlinacakSatirMenu
          malzemeAdi={kayit.malzeme_adi}
          onDuzenle={onDuzenle}
          onSil={() => basla(async () => await alinacakSil(kayit.id))}
        />
      </div>
    </div>
  );
}

function DuzenleSatiri({ kayit, onIptal }: { kayit: AlinacakKaydi; onIptal: () => void }) {
  const dil = useDil();
  const sozlukler = useSozluk();
  const s = sozlukler.envanter.alinacaklar;
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
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 70px 160px', gap: 8, marginBottom: 10 }}>
        <div>
          <label className="etiket">{s.malzemeAdi}</label>
          <input className="alan" name="malzeme_adi" required defaultValue={kayit.malzeme_adi} autoFocus />
        </div>
        <div>
          <label className="etiket">{s.adet}</label>
          <input className="alan mn" name="adet" type="number" min={0} step="any" defaultValue={kayit.adet} />
        </div>
        <div>
          <label className="etiket">{s.durum}</label>
          <select className="alan" name="durum" defaultValue={gecerliDurum(kayit.durum)}>
            {ALINACAK_DURUMLAR.map((d) => (
              <option key={d} value={d}>
                {alinacakDurumEtiketi(d, dil)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.6fr auto auto', gap: 8, alignItems: 'end' }}>
        <div>
          <label className="etiket">{s.not}</label>
          <input className="alan" name="not_metni" defaultValue={kayit.not_metni ?? ''} />
        </div>
        <div>
          <label className="etiket">{s.link}</label>
          <input className="alan mn" name="link" type="url" defaultValue={kayit.link ?? ''} />
        </div>
        <button className="btn btn-birincil" type="submit" disabled={bekliyor} style={{ height: 38 }}>
          {bekliyor ? '…' : sozlukler.ortak.buton.kaydet}
        </button>
        <button type="button" className="btn" onClick={onIptal} disabled={bekliyor} style={{ height: 38 }}>
          {sozlukler.envanter.vazgec}
        </button>
      </div>
    </form>
  );
}
