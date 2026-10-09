import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { hareketAciklamasi, sayiBicimi, sebepEtiketi, type EnvanterSatiri } from '@/lib/types';
import { sozluk, yerel } from '@/lib/i18n';
import { dilAl } from '@/lib/i18n/sunucu';

export const dynamic = 'force-dynamic';

const LIMIT = 200;

export default async function AktivitelerSayfasi() {
  const supabase = await createClient();
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');
  const hedef = aktif.kullaniciId;
  const dil = await dilAl();
  const s = sozluk(dil).envanter.aktivite;
  const sayi = sayiBicimi(dil);

  const { data: hareketVerisi } = await supabase
    .from('stock_movements')
    .select('id, stock_item_id, delta, sonraki_adet, sebep, aciklama, proje_id, created_at')
    .eq('user_id', hedef)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  const hareketler = hareketVerisi ?? [];

  const { data: envanterVerisi } = await supabase
    .from('envanter')
    .select('stok_id, mpn, konum_kodu, konum_adi')
    .eq('user_id', hedef);
  const envanterHarita = new Map(
    ((envanterVerisi ?? []) as Pick<EnvanterSatiri, 'stok_id' | 'mpn' | 'konum_kodu' | 'konum_adi'>[]).map(
      (e) => [e.stok_id, e],
    ),
  );

  const { data: projeler } = await supabase.from('projects').select('id, ad').eq('user_id', hedef);
  const projeHarita = new Map((projeler ?? []).map((p) => [p.id, p.ad]));

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div className="mn" style={{ fontSize: 10.5, color: 'var(--muted-2)', marginBottom: 8 }}>
          <Link href="/envanter" style={{ color: 'inherit' }}>
            {s.envanter}
          </Link>{' '}
          / {s.baslik}
        </div>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
          {s.baslik}
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)' }}>
          {s.aciklama}
          {hareketler.length === LIMIT && s.sonN(LIMIT)}
        </p>

        <div className="kart" style={{ overflow: 'hidden' }}>
          {hareketler.length === 0 ? (
            <p style={{ margin: 0, padding: 24, fontSize: 13, color: 'var(--muted)' }}>
              {s.bos}
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="mn" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--muted-2)', fontSize: 10 }}>
                    <th style={{ fontWeight: 600, padding: '10px 12px' }}>{s.tarih}</th>
                    <th style={{ fontWeight: 600, padding: '10px 12px' }}>{s.parca}</th>
                    <th style={{ fontWeight: 600, padding: '10px 12px' }}>{s.islem}</th>
                    <th style={{ fontWeight: 600, padding: '10px 12px', textAlign: 'right' }}>{s.adet}</th>
                    <th style={{ fontWeight: 600, padding: '10px 12px' }}>{s.sebepProje}</th>
                    <th style={{ fontWeight: 600, padding: '10px 12px' }}>{s.konum}</th>
                    <th style={{ fontWeight: 600, padding: '10px 12px', textAlign: 'right' }}>{s.sonra}</th>
                  </tr>
                </thead>
                <tbody>
                  {hareketler.map((h) => {
                    const artis = Number(h.delta) > 0;
                    const parca = envanterHarita.get(h.stock_item_id);
                    const projeAdi = h.proje_id ? projeHarita.get(h.proje_id) : undefined;
                    const sebepMetni = sebepEtiketi(h.sebep, dil);
                    const aciklamaParcalari = [
                      projeAdi,
                      h.aciklama != null ? hareketAciklamasi(h.aciklama, dil) : projeAdi ? undefined : sebepMetni,
                    ].filter(Boolean);
                    return (
                      <tr key={h.id} style={{ borderTop: '1px solid var(--line-soft)' }}>
                        <td style={{ padding: '9px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {new Date(h.created_at).toLocaleString(yerel(dil), {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td style={{ padding: '9px 12px', fontWeight: 500 }}>
                          {parca ? (
                            <Link href={`/envanter/${h.stock_item_id}`} className="parca-link">
                              {parca.mpn}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '9px 12px', color: artis ? 'var(--ok)' : 'var(--crit)' }}>
                          {artis ? s.giris : s.dusuldu}
                        </td>
                        <td
                          style={{
                            padding: '9px 12px',
                            textAlign: 'right',
                            color: artis ? 'var(--ok)' : 'var(--crit)',
                            fontWeight: 600,
                          }}
                        >
                          {artis ? '+' : ''}
                          {sayi.format(Number(h.delta))}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--ink-2)' }}>
                          {aciklamaParcalari.join(' · ') || '—'}
                        </td>
                        <td style={{ padding: '9px 12px', color: 'var(--muted)' }}>
                          {parca?.konum_kodu ?? parca?.konum_adi ?? '—'}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right' }}>
                          {sayi.format(Number(h.sonraki_adet))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
