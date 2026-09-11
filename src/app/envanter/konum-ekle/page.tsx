import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KonumFormu } from '@/components/konum-formu';
import { agacKur, konumSecenekleri, type Konum } from '@/lib/types';
import { aktifGorunumAl } from '@/lib/gozlemci';

export const dynamic = 'force-dynamic';

export default async function KonumEkleSayfasi() {
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris');
  if (aktif.saltOkunur) redirect('/envanter');
  const supabase = await createClient();
  const { data } = await supabase
    .from('locations')
    .select('id, parent_id, ad, kod, tip, aciklama, sira')
    .eq('user_id', aktif.kullaniciId)
    .order('sira', { ascending: true });

  const ustler = konumSecenekleri(agacKur((data ?? []) as Konum[]));

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
          Konum ekle
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          Oda, dolap, çekmece, bölme — istediğin ismi ve derinliği sen belirlersin. Üst konum
          seçmezsen en üst seviyede (ör. bir oda/atölye) oluşur.
        </p>
        <KonumFormu ustler={ustler} />
      </div>
    </main>
  );
}
