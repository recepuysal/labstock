import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ParcaFormu, type LinkDolgu } from '@/components/parca-formu';
import { lcscKoduGetir } from '@/lib/lcsc';
import { agacKur, konumSecenekleri, type Konum } from '@/lib/types';
import { aktifGorunumAl } from '@/lib/gozlemci';

export const dynamic = 'force-dynamic';

export default async function YeniParcaSayfasi({
  searchParams,
}: {
  // Telefonla okutulan tedarikçi etiketinden: /envanter/yeni?lcsc=C25744&mpn=...&adet=100
  searchParams: Promise<{ lcsc?: string; mpn?: string; adet?: string }>;
}) {
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');
  if (aktif.saltOkunur) redirect('/envanter');
  const supabase = await createClient();
  const { data } = await supabase
    .from('locations')
    .select('id, parent_id, ad, kod, tip, aciklama, sira')
    .eq('user_id', aktif.kullaniciId)
    .order('sira', { ascending: true });

  const konumlar = konumSecenekleri(agacKur((data ?? []) as Konum[]));

  const { lcsc, mpn, adet } = await searchParams;
  const lcscKodu = /^C\d{1,12}$/i.test(lcsc ?? '') ? lcsc!.toUpperCase() : null;
  const ilkAdet = Number.isInteger(Number(adet)) && Number(adet) > 0 ? Number(adet) : undefined;
  let ilkDolgu: LinkDolgu | undefined;
  let lcscHatasi: string | null = null;
  if (lcscKodu) {
    ilkDolgu = { mpn: mpn?.slice(0, 80) || undefined, tedarikci: 'LCSC', tedarikci_kodu: lcscKodu };
    try {
      const v = await lcscKoduGetir(lcscKodu);
      ilkDolgu = {
        ...ilkDolgu,
        uretici: v.uretici,
        aciklama: v.aciklama,
        kategori: v.kategori,
        parametreler: v.parametreler,
        alis_fiyati: v.fiyat,
        para_birimi: v.paraBirimi,
        resim_url: v.resimUrl,
      };
    } catch (e) {
      lcscHatasi = e instanceof Error ? e.message : 'LCSC bilgisi alınamadı';
    }
  }

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
          Parça ekle
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          MPN ortak katalogda varsa ona bağlanır, yoksa katalog için yeni bir kayıt açılır. Adet
          girersen bu bir stok hareketi olarak da kaydedilir.
        </p>
        {lcscKodu && (
          <p className="kart" style={{ margin: '0 0 16px', padding: '10px 14px', fontSize: 12.5, lineHeight: 1.5 }}>
            Telefonla okutulan LCSC etiketi: <strong className="mn">{lcscKodu}</strong>
            {ilkAdet ? ` · ${ilkAdet} adet` : ''}. Bilgiler LCSC&apos;den dolduruldu; konumu seçip kaydet.
            {lcscHatasi && <span style={{ display: 'block', color: '#dc2626' }}>{lcscHatasi}</span>}
          </p>
        )}
        <ParcaFormu konumlar={konumlar} ilkDolgu={ilkDolgu} ilkAdet={ilkAdet} />
      </div>
    </main>
  );
}
