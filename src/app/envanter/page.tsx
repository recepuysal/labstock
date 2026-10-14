import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KonumAgaci } from '@/components/konum-agaci';
import { ParcaTablosu } from '@/components/parca-tablosu';
import { ParcaIzgara } from '@/components/parca-izgara';
import { EnvanterFiltreleri } from '@/components/envanter-filtreleri';
import { aktifGorunumAl } from '@/lib/gozlemci';
import {
  agacKur,
  altAgacIdleri,
  konumToplamSayilari,
  konumTipOzeti,
  paraFormatla,
  saatFormatla,
  sayiBicimi,
  type EnvanterSatiri,
  type Konum,
} from '@/lib/types';
import { sozluk } from '@/lib/i18n';
import { dilAl } from '@/lib/i18n/sunucu';
import { tumSatirlar } from '@/lib/sayfali';

export const dynamic = 'force-dynamic';

const LIMIT = 200;
const EN_FAZLA = 5000;

export default async function EnvanterSayfasi({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    konum?: string;
    kategori?: string;
    kilif?: string;
    durum?: string;
    etiket?: string;
    sira?: string;
    gorunum?: string;
    adet?: string;
  }>;
}) {
  const parametreler = await searchParams;
  const { q, konum, kategori, kilif, durum, etiket, sira, gorunum } = parametreler;
  // "Daha fazla yükle" her basışta LIMIT kadar artırır
  const gosterilen = Math.min(EN_FAZLA, Math.max(LIMIT, Math.floor(Number(parametreler.adet) / LIMIT) * LIMIT || LIMIT));
  const dil = await dilAl();
  const s = sozluk(dil).envanter.liste;
  const sayi = sayiBicimi(dil);
  const supabase = await createClient();
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');
  const { kullaniciId: hedef, saltOkunur } = aktif;

  const { data: konumVerisi } = await supabase
    .from('locations')
    .select('id, parent_id, ad, kod, tip, aciklama, sira')
    .eq('user_id', hedef)
    .order('sira', { ascending: true });

  const konumlar = (konumVerisi ?? []) as Konum[];
  const agac = agacKur(konumlar);

  let stokIdleri: string[] | null = null;
  if (etiket) {
    const etiketliStokVerisi = await tumSatirlar<{ stock_item_id: string }>(() =>
      supabase
        .from('stock_item_tags')
        .select('stock_item_id, tags!inner(ad, user_id)')
        .eq('tags.ad', etiket)
        .eq('tags.user_id', hedef)
        .order('stock_item_id', { ascending: true })
        .order('tag_id', { ascending: true }),
    ).catch(() => []);
    stokIdleri = etiketliStokVerisi.map((r) => r.stock_item_id);
  }

  // Supabase tek istekte en fazla 1000 satır verdiği için liste sayfa sayfa
  // okunur; sorgu her sayfa için yeniden kurulur.
  function listeSorgusu() {
    let sorgu = supabase.from('envanter').select('*').eq('user_id', hedef);
    if (konum) sorgu = sorgu.in('konum_id', altAgacIdleri(konum, konumlar));
    if (q) {
      const desen = `%${q.replace(/[%,]/g, '')}%`;
      sorgu = sorgu.or(`mpn.ilike.${desen},aciklama.ilike.${desen},kategori.ilike.${desen}`);
    }
    if (kategori) sorgu = sorgu.eq('kategori', kategori);
    if (kilif) sorgu = sorgu.eq('kilif', kilif);
    if (durum) sorgu = sorgu.eq('durum', durum);
    if (stokIdleri) sorgu = sorgu.in('stok_id', stokIdleri);

    switch (sira) {
      case 'eski':
        sorgu = sorgu.order('updated_at', { ascending: true });
        break;
      case 'ad':
        sorgu = sorgu.order('mpn', { ascending: true });
        break;
      case 'adet-azalan':
        sorgu = sorgu.order('adet', { ascending: false });
        break;
      case 'adet-artan':
        sorgu = sorgu.order('adet', { ascending: true });
        break;
      default:
        sorgu = sorgu.order('updated_at', { ascending: false });
    }
    // Sayfa sınırında satır kaymasın diye benzersiz son sıralama
    return sorgu.order('stok_id', { ascending: true });
  }

  let satirlar: EnvanterSatiri[] = [];
  let error: { message: string } | null = null;
  if (stokIdleri?.length !== 0) {
    try {
      satirlar = await tumSatirlar<EnvanterSatiri>(listeSorgusu, gosterilen);
    } catch (e) {
      error = { message: e instanceof Error ? e.message : String(e) };
    }
  }

  const katalogVerisi = await tumSatirlar<{ kategori: string | null; kilif: string | null }>(() =>
    supabase.from('parts').select('kategori, kilif').order('id', { ascending: true }),
  ).catch(() => []);
  const kategoriler = Array.from(
    new Set((katalogVerisi ?? []).map((p) => p.kategori).filter((v): v is string => Boolean(v))),
  ).sort((a, b) => a.localeCompare(b, 'tr'));
  const kiliflar = Array.from(
    new Set((katalogVerisi ?? []).map((p) => p.kilif).filter((v): v is string => Boolean(v))),
  ).sort((a, b) => a.localeCompare(b, 'tr'));

  const { data: etiketVerisi } = await supabase
    .from('tags')
    .select('ad')
    .eq('user_id', hedef)
    .order('ad', { ascending: true });
  const etiketler = (etiketVerisi ?? []).map((t) => t.ad);

  const { count: toplamCesit } = await supabase
    .from('stock_items')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', hedef);

  // Konum sayıları ve depo değeri tüm kalemlerden hesaplanır (1000 satır sınırına takılmadan)
  const stokOzetVerisi = await tumSatirlar<{
    location_id: string | null;
    adet: number;
    alis_fiyati: number | null;
    para_birimi: string | null;
  }>(() =>
    supabase
      .from('stock_items')
      .select('location_id, adet, alis_fiyati, para_birimi')
      .eq('user_id', hedef)
      .order('id', { ascending: true }),
  ).catch(() => []);

  const dogrudanSayilar = new Map<string, number>();
  const depoDegeri = new Map<string, number>();
  for (const row of stokOzetVerisi) {
    if (row.location_id) {
      dogrudanSayilar.set(row.location_id, (dogrudanSayilar.get(row.location_id) ?? 0) + 1);
    }
    if (row.alis_fiyati != null) {
      const anahtar = row.para_birimi ?? 'TRY';
      depoDegeri.set(anahtar, (depoDegeri.get(anahtar) ?? 0) + Number(row.adet) * Number(row.alis_fiyati));
    }
  }
  const sayilar = Object.fromEntries(konumToplamSayilari(agac, dogrudanSayilar));
  const tipOzeti = konumTipOzeti(konumlar, dil);

  const { data: sonHareket } = await supabase
    .from('stock_movements')
    .select('created_at')
    .eq('user_id', hedef)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const seciliKonum = konum ? konumlar.find((k) => k.id === konum) : undefined;
  const toplamAdet = satirlar.reduce((t, r) => t + Number(r.adet), 0);
  const kritik = satirlar.filter((r) => r.durum === 'kritik' || r.durum === 'yok').length;
  const az = satirlar.filter((r) => r.durum === 'az').length;

  const bosDepo = konumlar.length === 0 && (toplamCesit ?? 0) === 0;

  return (
    <>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <KonumAgaci
          agac={agac}
          seciliId={konum}
          arama={q}
          toplam={toplamCesit ?? 0}
          sayilar={sayilar}
          tipOzeti={tipOzeti}
          saltOkunur={saltOkunur}
        />

        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px 0' }}>
          <div className="mn" style={{ fontSize: 10.5, color: 'var(--muted-2)' }}>
            {s.depo} / {seciliKonum ? seciliKonum.ad : s.tumEnvanter}
            {q && ` / "${q}"`}
            {etiket && ` / #${etiket}`}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 5 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
              {seciliKonum ? seciliKonum.ad : s.tumEnvanter}
            </h1>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {s.kayitAdet(satirlar.length, sayi.format(toplamAdet))}
              {satirlar.length === gosterilen && s.ilk(gosterilen)}
            </span>
          </div>

          <div style={{ marginTop: 12 }}>
            <Suspense fallback={<div style={{ height: 28 }} />}>
              <EnvanterFiltreleri kategoriler={kategoriler} kiliflar={kiliflar} etiketler={etiketler} />
            </Suspense>
          </div>
        </div>

        <div style={{ flex: 1, padding: '14px 20px 20px', overflowY: 'auto' }}>
          {error && <div className="hata">{s.yuklenemedi} {error.message}</div>}

          {!error && bosDepo && (
            <div className="kart" style={{ padding: 28, maxWidth: 560 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600 }}>{s.bosBaslik}</h2>
              <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                {saltOkunur ? s.bosIzleyen : s.bosAciklama}
              </p>
              {!saltOkunur && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link href="/envanter/konum-ekle" className="btn btn-birincil">
                    {s.konumEkle}
                  </Link>
                  <Link href="/envanter/yeni" className="btn">
                    {s.parcaEkle}
                  </Link>
                </div>
              )}
            </div>
          )}

          {!error && !bosDepo && satirlar.length === 0 && (
            <div className="kart" style={{ padding: 24, maxWidth: 480 }}>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                {q || konum || kategori || kilif || durum
                  ? s.filtreBos
                  : saltOkunur
                    ? s.depoBosIzleyen
                    : s.depoBos}
              </p>
            </div>
          )}

          {!error && satirlar.length > 0 && gorunum === 'izgara' && (
            <ParcaIzgara satirlar={satirlar} saltOkunur={saltOkunur} />
          )}
          {!error && satirlar.length > 0 && gorunum !== 'izgara' && (
            <ParcaTablosu satirlar={satirlar} saltOkunur={saltOkunur} />
          )}
          {!error && satirlar.length === gosterilen && gosterilen < EN_FAZLA && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
              <Link
                className="btn"
                scroll={false}
                href={{
                  query: Object.fromEntries(
                    Object.entries({ ...parametreler, adet: String(gosterilen + LIMIT) }).filter(
                      (g): g is [string, string] => typeof g[1] === 'string' && g[1] !== '',
                    ),
                  ),
                }}
              >
                {s.dahaFazla(LIMIT)}
              </Link>
            </div>
          )}
        </div>
        </main>
      </div>

      <footer
          style={{
            height: 34,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            padding: '0 20px',
            background: 'var(--surface)',
            borderTop: '1px solid var(--line)',
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          <span className="mn">
            {s.cesitAdet(toplamCesit ?? 0, sayi.format(toplamAdet))}
          </span>
          {kritik > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--crit-dot)' }}
              />
              {s.kritik(kritik)}
            </span>
          )}
          {az > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{ width: 5, height: 5, borderRadius: 99, background: 'var(--warn-dot)' }}
              />
              {s.azKaldi(az)}
            </span>
          )}

          <div style={{ flex: 1 }} />

          <span>
            {s.depoDegeri}{' '}
            {depoDegeri.size > 0
              ? Array.from(depoDegeri.entries())
                  .map(([birim, tutar]) => paraFormatla(tutar, birim, dil))
                  .join(' · ')
              : '—'}
          </span>

          <Link href="/envanter/aktiviteler" style={{ color: 'inherit' }}>
            {s.sonIslem} {sonHareket?.created_at ? saatFormatla(sonHareket.created_at, dil) : '—'}
          </Link>
      </footer>
    </>
  );
}
