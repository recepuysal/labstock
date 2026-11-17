'use client';

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { alinacakDurumDegistir, alinacakEkle, alinacakGuncelle, alinacakSil } from '@/app/envanter/alinacaklar/actions';
import type { EylemDurum } from '@/app/envanter/actions';
import { AlinacakSatirMenu } from '@/components/alinacak-satir-menu';
import { KopyalaButonu } from '@/components/kopyala-butonu';
import {
  ALINACAK_DURUMLAR,
  ALINACAK_DURUM_ROZET,
  alinacakDurumEtiketi,
  paraFormatla,
  sayiBicimi,
  type AlinacakDurumu,
} from '@/lib/types';
import type { Dil } from '@/lib/i18n';
import { useDil, useSozluk } from '@/lib/i18n/istemci';

export type AlinacakKaydi = {
  id: string;
  malzeme_adi: string;
  adet: number;
  not_metni: string | null;
  link: string | null;
  durum: string;
  created_at: string;
  olusturan: string | null;
  tedarikci?: string | null;
  birim_fiyat?: number | null;
  para_birimi?: string | null;
  siparis_tarihi?: string | null;
  alinma_tarihi?: string | null;
  guncellendi?: string | null;
};

type Filtre = 'tumu' | AlinacakDurumu;
type Siralama = 'yeni' | 'eski' | 'ad';

// Sunucu ve tarayıcı aynı metni üretsin (hydration uyumsuzluğu olmasın) diye
// saat dilimi sabit; "şimdi" de sunucudan prop olarak gelir.
const TZ = 'Europe/Istanbul';

type Bicimler = {
  gunAy: Intl.DateTimeFormat;
  gunAyYil: Intl.DateTimeFormat;
  saat: Intl.DateTimeFormat;
  tam: Intl.DateTimeFormat;
  yil: Intl.DateTimeFormat;
};

const BICIM_ONBELLEK: Partial<Record<Dil, Bicimler>> = {};

function bicimler(dil: Dil): Bicimler {
  const mevcut = BICIM_ONBELLEK[dil];
  if (mevcut) return mevcut;
  const yerel = dil === 'tr' ? 'tr-TR' : 'en-GB';
  const yeni: Bicimler = {
    gunAy: new Intl.DateTimeFormat(yerel, { day: 'numeric', month: 'short', timeZone: TZ }),
    gunAyYil: new Intl.DateTimeFormat(yerel, { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }),
    saat: new Intl.DateTimeFormat(yerel, { hour: '2-digit', minute: '2-digit', timeZone: TZ }),
    tam: new Intl.DateTimeFormat(yerel, { dateStyle: 'long', timeStyle: 'short', timeZone: TZ }),
    yil: new Intl.DateTimeFormat(yerel, { year: 'numeric', timeZone: TZ }),
  };
  BICIM_ONBELLEK[dil] = yeni;
  return yeni;
}

function kisaTarih(b: Bicimler, d: Date, simdi: number): string {
  return b.yil.format(d) === b.yil.format(new Date(simdi)) ? b.gunAy.format(d) : b.gunAyYil.format(d);
}

/** "date" kolonları (YYYY-MM-DD) gün ortası olarak yorumlanır ki saat dilimi kaydırmasın. */
function gunTarihi(s: string): Date {
  return new Date(`${s.slice(0, 10)}T12:00:00Z`);
}

function gunFarki(oncekiMs: number, sonrakiMs: number): number {
  return Math.max(0, Math.floor((sonrakiMs - oncekiMs) / 86_400_000));
}

function goreli(iso: string, simdi: number, dil: Dil): string {
  const rtf = new Intl.RelativeTimeFormat(dil === 'tr' ? 'tr-TR' : 'en-GB', { numeric: 'auto' });
  const dk = Math.floor((simdi - new Date(iso).getTime()) / 60000);
  if (dk < 60) return rtf.format(-Math.max(dk, 0), 'minute');
  const saat = Math.floor(dk / 60);
  if (saat < 24) return rtf.format(-saat, 'hour');
  const gun = Math.floor(saat / 24);
  if (gun < 30) return rtf.format(-gun, 'day');
  const ay = Math.floor(gun / 30);
  return ay < 12 ? rtf.format(-ay, 'month') : rtf.format(-Math.floor(ay / 12), 'year');
}

function gecerliDurum(d: string): AlinacakDurumu {
  return (ALINACAK_DURUMLAR as readonly string[]).includes(d) ? (d as AlinacakDurumu) : 'bekliyor';
}

function sonrakiDurum(mevcut: AlinacakDurumu): AlinacakDurumu {
  const i = ALINACAK_DURUMLAR.indexOf(mevcut);
  return ALINACAK_DURUMLAR[(i + 1) % ALINACAK_DURUMLAR.length];
}

export function AlinacaklarListesi({
  kayitlar,
  isimler,
  benimId,
  simdi,
  detaylarAcik,
}: {
  kayitlar: AlinacakKaydi[];
  isimler: Record<string, string>;
  benimId: string | null;
  simdi: number;
  /** false ise 0016 migration'ı uygulanmamış — ek alanlar gizlenir. */
  detaylarAcik: boolean;
}) {
  const dil = useDil();
  const s = useSozluk().envanter.alinacaklar;
  const [duzenlenenId, setDuzenlenenId] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('tumu');
  const [siralama, setSiralama] = useState<Siralama>('yeni');
  const [arama, setArama] = useState('');

  const sayilar = useMemo(() => {
    const say: Record<Filtre, number> = { tumu: kayitlar.length, bekliyor: 0, siparis_verildi: 0, alindi: 0 };
    for (const k of kayitlar) say[gecerliDurum(k.durum)]++;
    return say;
  }, [kayitlar]);

  // Henüz alınmamış ve fiyatı girilmiş kalemlerin tahmini toplamı (para birimine göre).
  const bekleyenTutar = useMemo(() => {
    const toplam: Record<string, number> = {};
    for (const k of kayitlar) {
      if (gecerliDurum(k.durum) === 'alindi' || k.birim_fiyat == null) continue;
      const birim = k.para_birimi || 'TRY';
      toplam[birim] = (toplam[birim] ?? 0) + Number(k.birim_fiyat) * Number(k.adet);
    }
    return Object.entries(toplam);
  }, [kayitlar]);

  const gorunen = useMemo(() => {
    const yerel = dil === 'tr' ? 'tr' : 'en';
    const q = arama.trim().toLocaleLowerCase(yerel);
    const liste = kayitlar.filter((k) => {
      if (filtre !== 'tumu' && gecerliDurum(k.durum) !== filtre) return false;
      if (!q) return true;
      return [k.malzeme_adi, k.not_metni, k.tedarikci, k.link].some((v) => v?.toLocaleLowerCase(yerel).includes(q));
    });
    if (siralama === 'eski') liste.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (siralama === 'ad') liste.sort((a, b) => a.malzeme_adi.localeCompare(b.malzeme_adi, yerel));
    else liste.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return liste;
  }, [kayitlar, filtre, siralama, arama, dil]);

  const sekmeler: { anahtar: Filtre; etiket: string }[] = [
    { anahtar: 'tumu', etiket: s.tumu },
    ...ALINACAK_DURUMLAR.map((d) => ({ anahtar: d as Filtre, etiket: alinacakDurumEtiketi(d, dil) })),
  ];

  return (
    <div>
      <EklemeFormu detaylarAcik={detaylarAcik} />

      {!detaylarAcik && (
        <div className="hata" style={{ marginTop: 12 }}>
          {s.migrationGerekli} <span className="mn">supabase/migrations/0016_alinacak_detaylari.sql</span>
        </div>
      )}

      <div className="alc-arac">
        <div className="alc-sekmeler" role="tablist">
          {sekmeler.map((sk) => (
            <button
              key={sk.anahtar}
              type="button"
              role="tab"
              aria-selected={filtre === sk.anahtar}
              className={`alc-sekme${filtre === sk.anahtar ? ' alc-sekme-aktif' : ''}`}
              onClick={() => setFiltre(sk.anahtar)}
            >
              {sk.etiket}
              <span className="alc-sekme-sayi mn">{sayilar[sk.anahtar]}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="alan"
            type="search"
            value={arama}
            onChange={(e) => setArama(e.target.value)}
            placeholder={s.ara}
            style={{ height: 32, width: 180, fontSize: 12.5 }}
          />
          <select
            className="alan"
            value={siralama}
            onChange={(e) => setSiralama(e.target.value as Siralama)}
            style={{ height: 32, width: 'auto', fontSize: 12.5 }}
            aria-label={s.siralama}
          >
            <option value="yeni">{s.siraYeni}</option>
            <option value="eski">{s.siraEski}</option>
            <option value="ad">{s.siraAd}</option>
          </select>
        </div>
      </div>

      {bekleyenTutar.length > 0 && (
        <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>
          {s.bekleyenTutar}{' '}
          <strong className="mn" style={{ color: 'var(--ink-2)' }}>
            {bekleyenTutar.map(([birim, tutar]) => paraFormatla(tutar, birim, dil)).join(' + ')}
          </strong>
        </p>
      )}

      <div className="kart" style={{ overflow: 'hidden' }}>
        {gorunen.length === 0 ? (
          <p style={{ padding: 20, margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            {kayitlar.length === 0 ? s.bos : s.filtreBos}
          </p>
        ) : (
          <>
            <div className="alc-satir alc-baslik mn">
              <div>{s.malzemeDurum}</div>
              <div style={{ textAlign: 'right' }}>{s.adetFiyat}</div>
              <div>{s.tarihler}</div>
              <div />
            </div>

            {gorunen.map((k) =>
              duzenlenenId === k.id ? (
                <DuzenleSatiri
                  key={k.id}
                  kayit={k}
                  detaylarAcik={detaylarAcik}
                  onIptal={() => setDuzenlenenId(null)}
                />
              ) : (
                <GosterSatiri
                  key={k.id}
                  kayit={k}
                  ekleyen={k.olusturan ? (k.olusturan === benimId ? s.sen : isimler[k.olusturan]) : undefined}
                  simdi={simdi}
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

function ParaBirimiSecimi({ varsayilan }: { varsayilan?: string | null }) {
  const s = useSozluk().envanter.alinacaklar;
  return (
    <select className="alan" name="para_birimi" defaultValue={varsayilan || 'TRY'} style={{ width: 72 }} aria-label={s.paraBirimi}>
      <option value="TRY">₺</option>
      <option value="USD">$</option>
      <option value="EUR">€</option>
    </select>
  );
}

function EklemeFormu({ detaylarAcik }: { detaylarAcik: boolean }) {
  const s = useSozluk().envanter.alinacaklar;
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(alinacakEkle, {});
  const [ekAcik, setEkAcik] = useState(false);
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
      <div className="alc-form-ana">
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
          <input className="alan" id="not_metni" name="not_metni" placeholder={s.notOrnekProje} />
        </div>
        <button className="btn btn-birincil" type="submit" disabled={bekliyor} style={{ height: 38 }}>
          {bekliyor ? '…' : s.ekle}
        </button>
      </div>

      <button type="button" className="alc-ek-dugme" onClick={() => setEkAcik((a) => !a)} aria-expanded={ekAcik}>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          style={{ transform: ekAcik ? 'rotate(90deg)' : undefined, transition: 'transform 150ms' }}
        >
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {detaylarAcik ? s.ekBilgiler : s.ekBilgilerLink}
      </button>

      {/* Kapalıyken de DOM'da kalsın ki form reset'i ve gönderimi tutarlı olsun. */}
      <div className="alc-form-ek" style={{ display: ekAcik ? undefined : 'none' }}>
        <div>
          <label className="etiket" htmlFor="link">
            {s.link}
          </label>
          <input className="alan mn" id="link" name="link" type="url" placeholder="https://..." />
        </div>
        {detaylarAcik && (
          <>
            <div>
              <label className="etiket" htmlFor="tedarikci">
                {s.tedarikci}
              </label>
              <input className="alan" id="tedarikci" name="tedarikci" placeholder={s.tedarikciOrnek} />
            </div>
            <div>
              <label className="etiket" htmlFor="birim_fiyat">
                {s.birimFiyat}
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="alan mn" id="birim_fiyat" name="birim_fiyat" inputMode="decimal" placeholder="0,00" />
                <ParaBirimiSecimi />
              </div>
            </div>
          </>
        )}
      </div>
    </form>
  );
}

function DurumRozeti({ durum, onTikla }: { durum: string; onTikla: () => void }) {
  const dil = useDil();
  const s = useSozluk().envanter.alinacaklar;
  const gecerli = gecerliDurum(durum);
  return (
    <button
      type="button"
      onClick={onTikla}
      className={`rozet ${ALINACAK_DURUM_ROZET[gecerli]}`}
      title={s.sonrakiDurumAdli(alinacakDurumEtiketi(sonrakiDurum(gecerli), dil))}
      style={{ flexShrink: 0, cursor: 'pointer', fontFamily: 'inherit' }}
    >
      {alinacakDurumEtiketi(gecerli, dil)}
    </button>
  );
}

function TarihSatiri({
  etiket,
  deger,
  baslik,
  ek,
  vurgu,
}: {
  etiket: string;
  deger: string;
  baslik?: string;
  ek?: React.ReactNode;
  vurgu?: 'ok' | 'mavi' | 'uyari';
}) {
  return (
    <div className="alc-tarih" title={baslik}>
      <span className={`alc-nokta${vurgu ? ` alc-nokta-${vurgu}` : ''}`} />
      <span className="alc-tarih-etiket">{etiket}</span>
      <span className="mn alc-tarih-deger">{deger}</span>
      {ek && <span className="alc-tarih-ek">{ek}</span>}
    </div>
  );
}

function GosterSatiri({
  kayit,
  ekleyen,
  simdi,
  onDuzenle,
}: {
  kayit: AlinacakKaydi;
  ekleyen?: string;
  simdi: number;
  onDuzenle: () => void;
}) {
  const dil = useDil();
  const s = useSozluk().envanter.alinacaklar;
  const b = bicimler(dil);
  const [, basla] = useTransition();
  const durum = gecerliDurum(kayit.durum);
  const eklendi = new Date(kayit.created_at);
  const birim = kayit.para_birimi || 'TRY';
  const fiyat = kayit.birim_fiyat != null ? Number(kayit.birim_fiyat) : null;

  // Uzun süredir bekleyen/teslim edilmeyenler için küçük bir hatırlatma.
  const bekleyenGun = durum === 'bekliyor' ? gunFarki(eklendi.getTime(), simdi) : 0;
  const siparisGun =
    durum === 'siparis_verildi' && kayit.siparis_tarihi
      ? gunFarki(gunTarihi(kayit.siparis_tarihi).getTime(), simdi)
      : 0;
  const teslimSuresi =
    kayit.siparis_tarihi && kayit.alinma_tarihi
      ? gunFarki(gunTarihi(kayit.siparis_tarihi).getTime(), gunTarihi(kayit.alinma_tarihi).getTime())
      : null;

  return (
    <div className={`alc-satir alc-kayit${durum === 'alindi' ? ' alc-alindi' : ''}`}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="alc-ad" title={kayit.malzeme_adi}>
            {kayit.malzeme_adi}
          </span>
          <KopyalaButonu metin={kayit.malzeme_adi} baslik={s.malzemeKopyala} />
          <DurumRozeti
            durum={kayit.durum}
            onTikla={() => basla(async () => await alinacakDurumDegistir(kayit.id, sonrakiDurum(durum)))}
          />
        </div>
        {(kayit.tedarikci || kayit.not_metni || kayit.link) && (
          <div className="alc-alt">
            {kayit.tedarikci && <span className="alc-etiket-kutu">{kayit.tedarikci}</span>}
            {kayit.not_metni && (
              <span className="alc-not" title={kayit.not_metni}>
                {kayit.not_metni}
              </span>
            )}
            {kayit.link && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                <a href={kayit.link} target="_blank" rel="noopener noreferrer" className="mn alc-link" title={kayit.link}>
                  {kayit.link.replace(/^https?:\/\/(www\.)?/, '')}
                </a>
                <KopyalaButonu metin={kayit.link} baslik={s.baglantiKopyala} boyut={12} />
              </span>
            )}
          </div>
        )}
      </div>

      <div className="alc-miktar mn">
        <div style={{ fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }}>
          {s.adetKisa(sayiBicimi(dil).format(kayit.adet))}
        </div>
        {fiyat != null && (
          <div style={{ fontSize: 11, color: 'var(--muted)' }} title={s.birimFiyatBaslik(paraFormatla(fiyat, birim, dil))}>
            {paraFormatla(fiyat * Number(kayit.adet), birim, dil)}
          </div>
        )}
      </div>

      <div className="alc-tarihler">
        <TarihSatiri
          etiket={s.eklendi}
          deger={`${kisaTarih(b, eklendi, simdi)} ${b.saat.format(eklendi)}`}
          baslik={`${b.tam.format(eklendi)} · ${goreli(kayit.created_at, simdi, dil)}${ekleyen ? ` · ${ekleyen}` : ''}`}
          ek={ekleyen}
          vurgu={bekleyenGun >= 7 ? 'uyari' : undefined}
        />
        {kayit.siparis_tarihi && (
          <TarihSatiri
            etiket={s.siparis}
            deger={kisaTarih(b, gunTarihi(kayit.siparis_tarihi), simdi)}
            baslik={b.gunAyYil.format(gunTarihi(kayit.siparis_tarihi))}
            ek={siparisGun > 0 ? s.gundurYolda(siparisGun) : undefined}
            vurgu="mavi"
          />
        )}
        {kayit.alinma_tarihi && (
          <TarihSatiri
            etiket={s.alindi}
            deger={kisaTarih(b, gunTarihi(kayit.alinma_tarihi), simdi)}
            baslik={b.gunAyYil.format(gunTarihi(kayit.alinma_tarihi))}
            ek={teslimSuresi != null ? s.gundeGeldi(teslimSuresi) : undefined}
            vurgu="ok"
          />
        )}
        {bekleyenGun >= 3 && (
          <div className={`alc-hatirlatma${bekleyenGun >= 7 ? ' alc-hatirlatma-uyari' : ''}`}>
            {s.gundurBekliyor(bekleyenGun)}
          </div>
        )}
      </div>

      <div>
        <AlinacakSatirMenu
          malzemeAdi={kayit.malzeme_adi}
          onDuzenle={onDuzenle}
          onSil={() => basla(async () => await alinacakSil(kayit.id))}
        />
      </div>
    </div>
  );
}

function DuzenleSatiri({
  kayit,
  detaylarAcik,
  onIptal,
}: {
  kayit: AlinacakKaydi;
  detaylarAcik: boolean;
  onIptal: () => void;
}) {
  const dil = useDil();
  const sozlukler = useSozluk();
  const s = sozlukler.envanter.alinacaklar;
  const b = bicimler(dil);
  const [durum, gonder, bekliyor] = useActionState<EylemDurum, FormData>(alinacakGuncelle, {});

  useEffect(() => {
    if (durum.bilgi) onIptal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durum.bilgi]);

  return (
    <form action={gonder} className="alc-duzenle">
      <input type="hidden" name="id" value={kayit.id} />
      {durum.hata && (
        <div className="hata" style={{ marginBottom: 12 }}>
          {durum.hata}
        </div>
      )}
      <div className="alc-duzenle-izgara">
        <div style={{ gridColumn: 'span 2' }}>
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

        <div style={{ gridColumn: 'span 2' }}>
          <label className="etiket">{s.not}</label>
          <input className="alan" name="not_metni" defaultValue={kayit.not_metni ?? ''} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label className="etiket">{s.link}</label>
          <input className="alan mn" name="link" type="url" defaultValue={kayit.link ?? ''} />
        </div>

        {detaylarAcik && (
          <>
            <div>
              <label className="etiket">{s.tedarikci}</label>
              <input className="alan" name="tedarikci" defaultValue={kayit.tedarikci ?? ''} />
            </div>
            <div>
              <label className="etiket">{s.birimFiyat}</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="alan mn"
                  name="birim_fiyat"
                  inputMode="decimal"
                  defaultValue={kayit.birim_fiyat != null ? String(kayit.birim_fiyat) : ''}
                />
                <ParaBirimiSecimi varsayilan={kayit.para_birimi} />
              </div>
            </div>
            <div>
              <label className="etiket">{s.siparisTarihi}</label>
              <input
                className="alan mn"
                name="siparis_tarihi"
                type="date"
                defaultValue={kayit.siparis_tarihi?.slice(0, 10) ?? ''}
              />
            </div>
            <div>
              <label className="etiket">{s.alinmaTarihi}</label>
              <input
                className="alan mn"
                name="alinma_tarihi"
                type="date"
                defaultValue={kayit.alinma_tarihi?.slice(0, 10) ?? ''}
              />
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 'auto' }}>
          {s.eklenmeBilgisi(b.tam.format(new Date(kayit.created_at)))}
          {kayit.guncellendi && ` · ${s.sonDegisiklik(b.tam.format(new Date(kayit.guncellendi)))}`}
        </span>
        <button type="button" className="btn" onClick={onIptal} disabled={bekliyor} style={{ height: 36 }}>
          {sozlukler.envanter.vazgec}
        </button>
        <button className="btn btn-birincil" type="submit" disabled={bekliyor} style={{ height: 36 }}>
          {bekliyor ? '…' : sozlukler.ortak.buton.kaydet}
        </button>
      </div>
    </form>
  );
}
