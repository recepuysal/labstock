import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ParcaFormu } from '@/components/parca-formu';
import { agacKur, konumSecenekleri, type Konum } from '@/lib/types';
import { aktifGorunumAl } from '@/lib/gozlemci';

export const dynamic = 'force-dynamic';

export default async function YeniParcaSayfasi() {
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
        <ParcaFormu konumlar={konumlar} />
      </div>
    </main>
  );
}
