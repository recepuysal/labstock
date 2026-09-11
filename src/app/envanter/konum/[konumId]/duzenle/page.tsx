import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KonumFormu, type KonumBaslangic } from '@/components/konum-formu';
import { agacKur, konumSecenekleri, type Konum, type KonumDugumu } from '@/lib/types';
import { aktifGorunumAl } from '@/lib/gozlemci';

export const dynamic = 'force-dynamic';

/** Bir konumu (ve tüm alt ağacını) üst-konum seçeneklerinden çıkarır — döngü oluşmasın. */
function altAgaciCikar(dugumler: KonumDugumu[], haricId: string): KonumDugumu[] {
  return dugumler
    .filter((d) => d.id !== haricId)
    .map((d) => ({ ...d, cocuklar: altAgaciCikar(d.cocuklar, haricId) }));
}

export default async function KonumDuzenleSayfasi({ params }: { params: Promise<{ konumId: string }> }) {
  const { konumId } = await params;
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');
  if (aktif.saltOkunur) redirect('/envanter');

  const supabase = await createClient();
  const { data: konumVerisi } = await supabase
    .from('locations')
    .select('id, parent_id, ad, kod, tip, aciklama, sira')
    .eq('user_id', aktif.kullaniciId)
    .order('sira', { ascending: true });

  const konumlar = (konumVerisi ?? []) as Konum[];
  const hedef = konumlar.find((k) => k.id === konumId);
  if (!hedef) notFound();

  const agac = agacKur(konumlar);
  const budanmisAgac = altAgaciCikar(agac, konumId);
  const ustler = konumSecenekleri(budanmisAgac);

  const baslangic: KonumBaslangic = {
    id: hedef.id,
    ad: hedef.ad,
    kod: hedef.kod,
    tip: hedef.tip,
    aciklama: hedef.aciklama,
    parent_id: hedef.parent_id,
  };

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
          Konumu düzenle
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          {hedef.ad} — konum bilgilerini güncelle.
        </p>
        <KonumFormu ustler={ustler} mod="duzenle" baslangic={baslangic} />
      </div>
    </main>
  );
}
