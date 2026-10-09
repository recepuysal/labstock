'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { DURUM_ETIKET, durumEtiketi, type Durum } from '@/lib/types';
import { kategoriGoster } from '@/lib/i18n/kategori';
import { useDil, useSozluk } from '@/lib/i18n/istemci';

const SIRALAMALAR = [
  { deger: 'yeni', anahtar: 'yeni' },
  { deger: 'eski', anahtar: 'eski' },
  { deger: 'ad', anahtar: 'ad' },
  { deger: 'adet-azalan', anahtar: 'adetAzalan' },
  { deger: 'adet-artan', anahtar: 'adetArtan' },
] as const;

export function EnvanterFiltreleri({
  kategoriler,
  kiliflar,
  etiketler,
}: {
  kategoriler: string[];
  kiliflar: string[];
  etiketler: string[];
}) {
  const dil = useDil();
  const s = useSozluk().envanter.filtre;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const kategori = searchParams.get('kategori') ?? '';
  const kilif = searchParams.get('kilif') ?? '';
  const durum = searchParams.get('durum') ?? '';
  const etiket = searchParams.get('etiket') ?? '';
  const sira = searchParams.get('sira') ?? 'yeni';
  const gorunum = searchParams.get('gorunum') ?? 'liste';

  function guncelle(anahtar: string, deger: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (deger) p.set(anahtar, deger);
    else p.delete(anahtar);
    router.replace(`${pathname}?${p.toString()}`);
  }

  const filtreliyiz = Boolean(kategori || kilif || durum || etiket);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
      <select
        className="filtre"
        value={kategori}
        onChange={(e) => guncelle('kategori', e.target.value)}
      >
        <option value="">{s.tumKategoriler}</option>
        {kategoriler
          .map((k) => ({ deger: k, metin: kategoriGoster(k, dil) }))
          .sort((a, b) => a.metin.localeCompare(b.metin, dil))
          .map((k) => (
            <option key={k.deger} value={k.deger}>
              {k.metin}
            </option>
          ))}
      </select>

      <select className="filtre" value={kilif} onChange={(e) => guncelle('kilif', e.target.value)}>
        <option value="">{s.tumKiliflar}</option>
        {kiliflar.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>

      <select className="filtre" value={durum} onChange={(e) => guncelle('durum', e.target.value)}>
        <option value="">{s.tumDurumlar}</option>
        {(Object.keys(DURUM_ETIKET) as Durum[]).map((deger) => (
          <option key={deger} value={deger}>
            {durumEtiketi(deger, dil)}
          </option>
        ))}
      </select>

      {etiketler.length > 0 && (
        <select className="filtre" value={etiket} onChange={(e) => guncelle('etiket', e.target.value)}>
          <option value="">{s.tumEtiketler}</option>
          {etiketler.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      )}

      {filtreliyiz && (
        <button
          type="button"
          className="filtre"
          style={{ color: 'var(--muted)', cursor: 'pointer' }}
          onClick={() => {
            const p = new URLSearchParams(searchParams.toString());
            p.delete('kategori');
            p.delete('kilif');
            p.delete('durum');
            p.delete('etiket');
            router.replace(`${pathname}?${p.toString()}`);
          }}
        >
          {s.temizle}
        </button>
      )}

      <span style={{ width: 1, height: 16, background: 'var(--line)', margin: '0 2px' }} />

      <select className="filtre" value={sira} onChange={(e) => guncelle('sira', e.target.value)}>
        {SIRALAMALAR.map((r) => (
          <option key={r.deger} value={r.deger}>
            {s.sira[r.anahtar]}
          </option>
        ))}
      </select>

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 3 }}>
        <button
          type="button"
          onClick={() => guncelle('gorunum', '')}
          aria-label={s.listeGorunumu}
          aria-pressed={gorunum === 'liste'}
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            background: gorunum === 'liste' ? 'var(--copper-soft)' : 'var(--surface)',
            color: gorunum === 'liste' ? 'var(--copper)' : 'var(--muted)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => guncelle('gorunum', 'izgara')}
          aria-label={s.izgaraGorunumu}
          aria-pressed={gorunum === 'izgara'}
          style={{
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-sm)',
            background: gorunum === 'izgara' ? 'var(--copper-soft)' : 'var(--surface)',
            color: gorunum === 'izgara' ? 'var(--copper)' : 'var(--muted)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <rect x="4" y="4" width="7" height="7" rx="1" />
            <rect x="13" y="4" width="7" height="7" rx="1" />
            <rect x="4" y="13" width="7" height="7" rx="1" />
            <rect x="13" y="13" width="7" height="7" rx="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}
