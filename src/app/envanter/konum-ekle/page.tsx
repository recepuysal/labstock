import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { KonumFormu } from '@/components/konum-formu';
import { agacKur, konumSecenekleri, type Konum } from '@/lib/types';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { sozlukAl } from '@/lib/i18n/sunucu';

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
  const s = (await sozlukAl()).envanter.konumFormu;

  return (
    <main style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
          {s.ekleBaslik}
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          {s.ekleAciklama}
        </p>
        <KonumFormu ustler={ustler} />
      </div>
    </main>
  );
}
