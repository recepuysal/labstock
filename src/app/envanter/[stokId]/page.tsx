import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { SatirMenu } from '@/components/satir-menu';
import { HareketHizli } from '@/components/hareket-hizli';
import { KonumHaritasi } from '@/components/konum-haritasi';
import { ProjeEkleFormu } from '@/components/proje-ekle-formu';
import { LcscCekFormu } from '@/components/lcsc-cek-formu';
import { EtiketlerKarti } from '@/components/etiketler-karti';
import { GeriButonu } from '@/components/geri-butonu';
import { aktifGorunumAl } from '@/lib/gozlemci';
import {
  DURUM_ETIKET,
  paraFormatla,
  sayi,
  SEBEP_ETIKET,
  zamanOnce,
  type EnvanterSatiri,
  type Konum,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

const HAREKET_LIMIT = 8;

function IstatKart({
  baslik,
  children,
  vurgu,
}: {
  baslik: string;
  children: React.ReactNode;
  vurgu?: boolean;
}) {
  return (
    <div
      className="kart"
      style={{
        padding: 14,
        background: vurgu ? 'var(--copper-soft)' : undefined,
        borderColor: vurgu ? 'var(--copper-line)' : undefined,
      }}
    >
      <div
        className="mn"
        style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)' }}
      >
        {baslik}
      </div>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

export default async function ParcaDetaySayfasi({
  params,
  searchParams,
}: {
  params: Promise<{ stokId: string }>;
  searchParams: Promise<{ tumu?: string }>;
}) {
  const { stokId } = await params;
  const { tumu } = await searchParams;
  const supabase = await createClient();
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');
  const { kullaniciId: hedef, saltOkunur } = aktif;

  const { data: satir } = await supabase
    .from('envanter')
    .select('*')
    .eq('stok_id', stokId)
    .eq('user_id', hedef)
    .maybeSingle();

  if (!satir) notFound();
  const s = satir as EnvanterSatiri;
  const donus = `/envanter/${s.stok_id}`;

  const { data: konumVerisi } = await supabase
    .from('locations')
    .select('id, parent_id, ad, kod, tip, aciklama, sira')
    .eq('user_id', hedef);
  const konumlar = (konumVerisi ?? []) as Konum[];

  const { data: stokLokasyonVerisi } = await supabase
    .from('stock_items')
    .select('location_id')
    .eq('user_id', hedef);
  const dogrudanSayilar = new Map<string, number>();
  for (const row of stokLokasyonVerisi ?? []) {
    if (row.location_id) dogrudanSayilar.set(row.location_id, (dogrudanSayilar.get(row.location_id) ?? 0) + 1);
  }
  const sayilar = Object.fromEntries(dogrudanSayilar);

  const { data: projeler } = await supabase
    .from('projects')
    .select('id, ad')
    .eq('user_id', hedef)
    .order('ad', { ascending: true });
  const projeAdHarita = new Map((projeler ?? []).map((p) => [p.id, p.ad]));

  const { data: bomVerisi } = await supabase
    .from('project_bom')
    .select('id, adet, referans, proje_id')
    .eq('part_id', s.part_id)
    .eq('user_id', hedef);
  const bomSatirlari = bomVerisi ?? [];
  const ayrilan = bomSatirlari.reduce((t, b) => t + Number(b.adet), 0);
  const kullanilabilir = Math.max(0, s.adet - ayrilan);

  let hareketSorgu = supabase
    .from('stock_movements')
    .select('id, delta, sonraki_adet, sebep, aciklama, proje_id, created_at')
    .eq('stock_item_id', s.stok_id)
    .eq('user_id', hedef)
    .order('created_at', { ascending: false });
  if (!tumu) hareketSorgu = hareketSorgu.limit(HAREKET_LIMIT);
  const { data: hareketVerisi } = await hareketSorgu;
  const hareketler = hareketVerisi ?? [];

  const { count: toplamHareket } = await supabase
    .from('stock_movements')
    .select('id', { count: 'exact', head: true })
    .eq('stock_item_id', s.stok_id)
    .eq('user_id', hedef);

  const { data: etiketVerisi } = await supabase
    .from('stock_item_tags')
    .select('tag_id, tags(id, ad)')
    .eq('stock_item_id', s.stok_id);
  const etiketler = (etiketVerisi ?? [])
    .map((e) => e.tags as unknown as { id: string; ad: string } | null)
    .filter((t): t is { id: string; ad: string } => Boolean(t))
    .sort((a, b) => a.ad.localeCompare(b.ad, 'tr'));

  const { data: tumEtiketVerisi } = await supabase
    .from('tags')
    .select('ad')
    .eq('user_id', hedef)
    .order('ad', { ascending: true });
  const etiketOnerileri = (tumEtiketVerisi ?? []).map((t) => t.ad);

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 40px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ marginBottom: 12 }}>
          <GeriButonu yedekHref="/envanter" />
        </div>

        <div className="mn" style={{ fontSize: 10.5, color: 'var(--muted-2)', marginBottom: 8 }}>
          <Link href="/envanter" style={{ color: 'inherit' }}>
            Envanter
          </Link>
          {s.kategori && (
            <>
              {' / '}
              <Link href={`/envanter?kategori=${encodeURIComponent(s.kategori)}`} style={{ color: 'inherit' }}>
                {s.kategori}
              </Link>
            </>
          )}
          {' / '}
          {s.mpn}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 24 }}>
          <div style={{ flex: '2 1 560px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 className="mn" style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>
                {s.mpn}
              </h1>
              {s.kategori && <span className="rozet rozet-notr">{s.kategori}</span>}
              {s.kilif && (
                <span className="rozet rozet-notr mn">
                  {s.kilif}
                </span>
              )}
              {s.rohs === true && <span className="rozet rozet-yesil">RoHS uyumlu</span>}
              {s.rohs === false && (
                <span className="rozet" style={{ background: 'var(--crit-bg)', color: 'var(--crit)' }}>
                  RoHS değil
                </span>
              )}
            </div>

            {(s.uretici || s.aciklama) && (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>
                {[s.uretici, s.aciklama].filter(Boolean).join(' · ')}
              </p>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 16 }}>
              <HareketHizli stokId={s.stok_id} adet={s.adet} saltOkunur={saltOkunur} />
              {saltOkunur ? (
                <span className="btn" aria-disabled="true" style={{ opacity: 0.45, cursor: 'default' }}>
                  Konum değiştir
                </span>
              ) : (
                <Link href={`/envanter/${s.stok_id}/duzenle?donus=${encodeURIComponent(donus)}`} className="btn">
                  Konum değiştir
                </Link>
              )}
              <Link href={`/envanter/${s.stok_id}/etiket`} className="btn">
                Etiket yazdır
              </Link>
              {s.datasheet_url && (
                <a href={s.datasheet_url} target="_blank" rel="noopener noreferrer" className="btn">
                  Datasheet
                </a>
              )}
              {s.tedarikci === 'LCSC' && s.tedarikci_kodu && (
                <a
                  href={`https://www.lcsc.com/product-detail/_${encodeURIComponent(s.tedarikci_kodu)}.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn"
                >
                  LCSC&apos;de gör
                </a>
              )}
              <LcscCekFormu
                stokId={s.stok_id}
                partId={s.part_id}
                mevcutKod={s.tedarikci_kodu}
                saltOkunur={saltOkunur}
              />
              <SatirMenu stokId={s.stok_id} mpn={s.mpn} saltOkunur={saltOkunur} />
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: 10,
                marginTop: 18,
              }}
            >
              <IstatKart baslik="TOPLAM ADET">
                <span className="mn" style={{ fontSize: 22, fontWeight: 600 }}>
                  {sayi.format(s.adet)}
                </span>
              </IstatKart>
              <IstatKart baslik="PROJELERE AYRILAN">
                <span className="mn" style={{ fontSize: 22, fontWeight: 600 }}>
                  {sayi.format(ayrilan)}
                </span>
              </IstatKart>
              <IstatKart baslik="KULLANILABİLİR">
                <span className="mn" style={{ fontSize: 22, fontWeight: 600 }}>
                  {sayi.format(kullanilabilir)}
                </span>
              </IstatKart>
              <IstatKart baslik={`MİN. SEVİYE · ${sayi.format(s.min_adet)}`} vurgu={s.durum !== 'yeterli'}>
                <span className={`pill pill-${s.durum}`}>
                  <span className="dot" />
                  {DURUM_ETIKET[s.durum]}
                </span>
              </IstatKart>
            </div>

            {Object.keys(s.parametreler ?? {}).length > 0 && (
              <div className="kart" style={{ padding: 16, marginTop: 16 }}>
                <div
                  className="mn"
                  style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 10 }}
                >
                  PARAMETRELER
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 24, rowGap: 8 }}>
                  {Object.entries(s.parametreler).map(([anahtar, deger]) => (
                    <div key={anahtar} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
                      <span style={{ color: 'var(--muted)' }}>{anahtar}</span>
                      <span className="mn" style={{ fontWeight: 500 }}>{deger}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="kart" style={{ padding: 16, marginTop: 16, overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <span
                  className="mn"
                  style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)' }}
                >
                  HAREKET GEÇMİŞİ
                </span>
                {!tumu && (toplamHareket ?? 0) > HAREKET_LIMIT && (
                  <Link href={`/envanter/${s.stok_id}?tumu=1`} style={{ fontSize: 11, color: 'var(--copper)' }}>
                    tümünü gör ({toplamHareket})
                  </Link>
                )}
              </div>

              {hareketler.length === 0 ? (
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--muted)' }}>Henüz hareket yok.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="mn" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', color: 'var(--muted-2)', fontSize: 10 }}>
                        <th style={{ fontWeight: 600, padding: '0 8px 8px 0' }}>TARIH</th>
                        <th style={{ fontWeight: 600, padding: '0 8px 8px 0' }}>İŞLEM</th>
                        <th style={{ fontWeight: 600, padding: '0 8px 8px 0', textAlign: 'right' }}>ADET</th>
                        <th style={{ fontWeight: 600, padding: '0 8px 8px 0' }}>SEBEP / PROJE</th>
                        <th style={{ fontWeight: 600, padding: '0 0 8px', textAlign: 'right' }}>SONRA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hareketler.map((h) => {
                        const artis = Number(h.delta) > 0;
                        const projeAdi = h.proje_id ? projeAdHarita.get(h.proje_id) : undefined;
                        const sebepMetni = SEBEP_ETIKET[h.sebep] ?? h.sebep;
                        const aciklamaParcalari = [projeAdi, h.aciklama ?? (projeAdi ? undefined : sebepMetni)].filter(
                          Boolean,
                        );
                        return (
                          <tr key={h.id} style={{ borderTop: '1px solid var(--line-soft)' }}>
                            <td style={{ padding: '7px 8px 7px 0', color: 'var(--muted)' }}>
                              {new Date(h.created_at).toLocaleDateString('tr-TR')}
                            </td>
                            <td style={{ padding: '7px 8px 7px 0', color: artis ? 'var(--ok)' : 'var(--crit)' }}>
                              {artis ? 'Giriş' : 'Düşüldü'}
                            </td>
                            <td
                              style={{
                                padding: '7px 8px 7px 0',
                                textAlign: 'right',
                                color: artis ? 'var(--ok)' : 'var(--crit)',
                                fontWeight: 600,
                              }}
                            >
                              {artis ? '+' : ''}
                              {sayi.format(Number(h.delta))}
                            </td>
                            <td style={{ padding: '7px 8px 7px 0', color: 'var(--ink-2)' }}>
                              {aciklamaParcalari.join(' · ') || '—'}
                            </td>
                            <td style={{ padding: '7px 0', textAlign: 'right' }}>{sayi.format(Number(h.sonraki_adet))}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div style={{ flex: '1 1 280px', minWidth: 260, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="kart" style={{ padding: 12 }}>
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  borderRadius: 'var(--r-sm)',
                  overflow: 'hidden',
                  background: 'var(--bg)',
                  border: '1px solid var(--line-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--muted-2)',
                }}
              >
                {s.resim_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.resim_url}
                    alt={s.mpn}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="9" cy="9" r="1.8" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                )}
              </div>
            </div>

            <KonumHaritasi konumlar={konumlar} konumId={s.konum_id} sayilar={sayilar} />

            {(s.tedarikci || s.alis_fiyati != null) && (
              <div className="kart" style={{ padding: 16 }}>
                <div
                  className="mn"
                  style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)' }}
                >
                  TEDARİK
                </div>
                {s.tedarikci && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12.5 }}>
                    <span>
                      {s.tedarikci}
                      {s.tedarikci_kodu && <span className="mn" style={{ color: 'var(--muted)' }}> {s.tedarikci_kodu}</span>}
                    </span>
                  </div>
                )}
                {s.alis_fiyati != null && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
                    Son alım fiyatı:{' '}
                    <span className="mn" style={{ color: 'var(--ink-2)', fontWeight: 500 }}>
                      {paraFormatla(s.alis_fiyati, s.para_birimi)}
                    </span>{' '}
                    · {zamanOnce(s.updated_at)}
                  </div>
                )}
              </div>
            )}

            <div className="kart" style={{ padding: 16 }}>
              <div
                className="mn"
                style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 10 }}
              >
                KULLANILDIĞI PROJELER
              </div>

              {bomSatirlari.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {bomSatirlari.map((b) => (
                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {projeAdHarita.get(b.proje_id) ?? 'Proje'}
                        {b.referans && <span style={{ color: 'var(--muted)' }}> · {b.referans}</span>}
                      </span>
                      <span className="mn" style={{ color: 'var(--muted)', flexShrink: 0, marginLeft: 8 }}>
                        {sayi.format(Number(b.adet))} / kart
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {bomSatirlari.length === 0 && (
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>
                  Henüz bir projede kullanılmıyor.
                </p>
              )}

              <ProjeEkleFormu
                partId={s.part_id}
                projeler={projeler ?? []}
                donus={donus}
                saltOkunur={saltOkunur}
              />
            </div>

            <EtiketlerKarti
              stokId={s.stok_id}
              etiketler={etiketler}
              oneriler={etiketOnerileri}
              saltOkunur={saltOkunur}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
