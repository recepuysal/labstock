import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { durumEtiketi, hareketAciklamasi, sayiBicimi, zamanOnce, type EnvanterSatiri } from '@/lib/types';
import { kategoriGoster } from '@/lib/i18n/kategori';
import { dilAl } from '@/lib/i18n/sunucu';
import { AdetAdimlayici } from '../adet-adimlayici';

export const dynamic = 'force-dynamic';

export default async function MobilParcaSayfasi({ params }: { params: Promise<{ stokId: string }> }) {
  const { stokId } = await params;
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect(`/giris?devam=/m/${stokId}`);
  const { kullaniciId: hedef, saltOkunur } = aktif;
  const supabase = await createClient();
  const dil = await dilAl();
  const sayi = sayiBicimi(dil);

  const { data } = await supabase
    .from('envanter')
    .select('*')
    .eq('stok_id', stokId)
    .eq('user_id', hedef)
    .maybeSingle();
  if (!data) notFound();
  const s = data as EnvanterSatiri;

  const { data: hareketVerisi } = await supabase
    .from('stock_movements')
    .select('id, delta, sonraki_adet, aciklama, created_at')
    .eq('stock_item_id', s.stok_id)
    .eq('user_id', hedef)
    .order('created_at', { ascending: false })
    .limit(6);
  const hareketler = hareketVerisi ?? [];

  const konum = [s.konum_kodu, s.konum_adi].filter(Boolean).join(' · ');
  const ozellikler: [string, string][] = [
    ['Kılıf', s.kilif ?? '—'],
    ['Konum', konum || '—'],
    ['Minimum', `${sayi.format(s.min_adet)} ${s.birim}`],
    ['Kategori', kategoriGoster(s.kategori, dil) || '—'],
  ];
  if (s.uretici) ozellikler.push(['Üretici', s.uretici]);
  if (s.tedarikci_kodu) ozellikler.push([s.tedarikci ?? 'Tedarikçi kodu', s.tedarikci_kodu]);

  return (
    <main className="m-kenar" style={{ paddingBottom: 24 }}>
      <Link href="/m" className="m-geri">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Stok
      </Link>

      <div className={`m-durum ${s.durum}`}>
        <span className={`m-nokta ${s.durum}`} />
        {durumEtiketi(s.durum, dil)}
      </div>
      <h1 className="m-baslik">{s.mpn}</h1>
      {s.aciklama && <div className="m-alt">{s.aciklama}</div>}

      {s.resim_url && <img className="m-resim" src={s.resim_url} alt={s.mpn} />}

      <div className="m-stok-kutu">
        <span className="m-etiket">Stokta · {s.birim}</span>
        <AdetAdimlayici stokId={s.stok_id} adet={s.adet} saltOkunur={saltOkunur} buyuk hizliDugmeler />
      </div>

      <dl className="m-ozellik">
        {ozellikler.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {s.datasheet_url && (
        <a className="m-link-dugme" href={s.datasheet_url} target="_blank" rel="noreferrer">
          Datasheet'i aç
        </a>
      )}

      <div className="m-bolum-baslik">Son hareketler</div>
      {hareketler.length === 0 ? (
        <div className="m-alt">Henüz hareket yok.</div>
      ) : (
        hareketler.map((h) => (
          <div className="m-hareket" key={h.id}>
            <span className={`m-delta ${Number(h.delta) >= 0 ? 'arti' : 'eksi'}`}>
              {Number(h.delta) > 0 ? '+' : ''}
              {sayi.format(Number(h.delta))}
            </span>
            <span>→ {sayi.format(Number(h.sonraki_adet))}</span>
            {h.aciklama && <span className="m-alt" style={{ fontSize: 12.5 }}>{hareketAciklamasi(h.aciklama, dil)}</span>}
            <time dateTime={h.created_at}>{zamanOnce(h.created_at, dil)}</time>
          </div>
        ))
      )}

      <Link className="m-link-dugme" href={`/envanter/${s.stok_id}`}>
        Tüm ayrıntılar (masaüstü görünüm)
      </Link>
    </main>
  );
}
