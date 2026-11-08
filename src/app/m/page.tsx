import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { tumSatirlar } from '@/lib/sayfali';
import { durumEtiketi, sayiBicimi, type EnvanterSatiri } from '@/lib/types';
import { dilAl } from '@/lib/i18n/sunucu';
import { AdetAdimlayici } from './adet-adimlayici';

export const dynamic = 'force-dynamic';

const LIMIT = 300;
const EKSIK_DURUMLAR = ['az', 'kritik', 'yok'];

type Cip = { etiket: string; durum?: string };
const CIPLER: Cip[] = [
  { etiket: 'Tümü' },
  { etiket: 'Eksikler', durum: 'eksik' },
  { etiket: 'Tükenenler', durum: 'yok' },
  { etiket: 'Yeterli', durum: 'yeterli' },
];

function cipAdresi(durum: string | undefined, q: string | undefined) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (durum) p.set('durum', durum);
  const s = p.toString();
  return s ? `/m?${s}` : '/m';
}

export default async function MobilStokSayfasi({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; durum?: string }>;
}) {
  const { q, durum } = await searchParams;
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris?devam=/m');
  const { kullaniciId: hedef, saltOkunur } = aktif;
  const supabase = await createClient();
  const dil = await dilAl();
  const sayi = sayiBicimi(dil);

  function sorgu() {
    let s = supabase.from('envanter').select('*').eq('user_id', hedef);
    if (q) {
      const desen = `%${q.replace(/[%,()]/g, '')}%`;
      s = s.or(`mpn.ilike.${desen},aciklama.ilike.${desen},kategori.ilike.${desen},kilif.ilike.${desen}`);
    }
    if (durum === 'eksik') s = s.in('durum', EKSIK_DURUMLAR);
    else if (durum) s = s.eq('durum', durum);
    return s.order('updated_at', { ascending: false }).order('stok_id', { ascending: true });
  }

  let satirlar: EnvanterSatiri[] = [];
  let hata: string | null = null;
  try {
    satirlar = await tumSatirlar<EnvanterSatiri>(sorgu, LIMIT);
  } catch (e) {
    hata = e instanceof Error ? e.message : String(e);
  }

  // Özet tüm depo için (filtreden bağımsız)
  const { count: toplamKalem } = await supabase
    .from('envanter')
    .select('stok_id', { count: 'exact', head: true })
    .eq('user_id', hedef);
  const { count: eksikKalem } = await supabase
    .from('envanter')
    .select('stok_id', { count: 'exact', head: true })
    .eq('user_id', hedef)
    .in('durum', EKSIK_DURUMLAR);

  return (
    <main className="m-kenar m-sayfa">
      <h1 className="m-sayfa-baslik">{durum === 'eksik' ? 'Eksikler' : 'Stok'}</h1>
      <form className="m-ara" action="/m" role="search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          name="q"
          type="search"
          defaultValue={q ?? ''}
          placeholder="Parça no, kılıf, kategori ara"
          aria-label="Ara"
          autoComplete="off"
          enterKeyHint="search"
        />
        {durum && <input type="hidden" name="durum" value={durum} />}
      </form>

      <div className="m-cipler" role="group" aria-label="Stok durumu">
        {CIPLER.map((c) => (
          <Link key={c.etiket} className="m-cip m-dokun" href={cipAdresi(c.durum, q)} aria-current={(durum ?? undefined) === c.durum ? 'true' : undefined}>
            {c.etiket}
          </Link>
        ))}
      </div>

      <div className="m-ozet">
        <Link className="m-kart m-dokun" href="/m">
          <span className="m-kart-etiket">Toplam kalem</span>
          <b>{sayi.format(toplamKalem ?? 0)}</b>
        </Link>
        <Link className="m-kart m-dokun uyari" href="/m?durum=eksik">
          <span className="m-kart-etiket">Eksik / kritik</span>
          <b>{sayi.format(eksikKalem ?? 0)}</b>
        </Link>
      </div>
      {saltOkunur && <div className="m-izleme">İzleme modu · stok değiştirilemez</div>}

      {hata ? (
        <div className="m-bos">Liste yüklenemedi: {hata}</div>
      ) : satirlar.length === 0 ? (
        <div className="m-bos">{q || durum ? 'Eşleşen parça yok.' : 'Henüz parça eklenmemiş.'}</div>
      ) : (
        <div className="m-liste">
          {satirlar.map((r) => (
            <div className="m-satir" key={r.stok_id}>
              <Link className="m-satir-bilgi m-dokun" href={`/m/${r.stok_id}`}>
                <div className="m-mpn">{r.mpn}</div>
                <div className="m-meta">
                  <span className={`m-nokta ${r.durum}`} title={durumEtiketi(r.durum, dil)} />
                  {r.kilif && <span className="m-kilif">{r.kilif}</span>}
                  {(r.konum_kodu || r.konum_adi) && <span>{r.konum_kodu || r.konum_adi}</span>}
                </div>
              </Link>
              <AdetAdimlayici stokId={r.stok_id} adet={r.adet} saltOkunur={saltOkunur} />
            </div>
          ))}
          {satirlar.length >= LIMIT && (
            <div className="m-bos" style={{ padding: '20px 0' }}>
              İlk {LIMIT} kalem gösteriliyor. Aradığını bulmak için aramayı kullan.
            </div>
          )}
        </div>
      )}
    </main>
  );
}
