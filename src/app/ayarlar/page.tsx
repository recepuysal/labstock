import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TemaAnahtari } from '@/components/tema-anahtari';
import { Hakkinda } from '@/components/hakkinda';
import { DisaAktarButonu } from '@/components/disa-aktar-butonu';
import { GozlemciErisimi } from '@/components/gozlemci-erisimi';
import { EtiketAyarlariFormu } from '@/components/etiket-ayarlari-formu';
import { etiketAyarlariniAl } from '@/lib/etiket-sunucu';

export const dynamic = 'force-dynamic';

export default async function AyarlarSayfasi() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/giris');

  const { data: profil } = await supabase
    .from('profiles')
    .select('davet_kodu')
    .eq('id', user.id)
    .maybeSingle();

  const { data: gozlemciVerisi } = await supabase.rpc('gozlemcilerimi_listele');
  const gozlemciler = (gozlemciVerisi ?? []) as {
    id: string;
    ad: string;
    baglandi: string | null;
    son_gorulme: string | null;
  }[];

  const etiketAyarlari = await etiketAyarlariniAl();

  return (
    <main style={{ minHeight: '100vh', overflowY: 'auto', padding: '24px 20px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <Link
          href="/envanter"
          className="btn"
          style={{
            marginBottom: 18,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            color: 'var(--copper)',
            borderColor: 'var(--copper-line)',
            fontWeight: 600,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Envantere dön
        </Link>
        <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.5px' }}>
          Ayarlar
        </h1>
        <p style={{ margin: '0 0 20px', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          Uygulama tercihleri. Kişisel ve şirket bilgilerin için{' '}
          <Link href="/ayarlar/profil" style={{ color: 'var(--copper)' }}>
            profiline
          </Link>{' '}
          bak.
        </p>

        <div className="kart" style={{ padding: 20 }}>
          <div
            className="mn"
            style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: 'var(--muted-2)', marginBottom: 12 }}
          >
            GÖRÜNÜM
          </div>
          <TemaAnahtari />
        </div>

        <EtiketAyarlariFormu baslangic={etiketAyarlari} />

        <GozlemciErisimi mevcutKod={profil?.davet_kodu ?? null} gozlemciler={gozlemciler} />

        <DisaAktarButonu />

        <Hakkinda />
      </div>
    </main>
  );
}
