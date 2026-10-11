import { UstBar } from '@/components/ust-bar';
import { createClient } from '@/lib/supabase/server';
import { basHarfleri } from '@/lib/types';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { dilAl, sozlukAl } from '@/lib/i18n/sunucu';
import Link from 'next/link';
import { ayarOku, yerelModda } from '@/lib/yerel/mod';

export const dynamic = 'force-dynamic';

export default async function EnvanterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let etiket = user?.email ?? '';
  let resimUrl: string | null = null;
  const gorunum = user ? await aktifGorunumAl() : null;

  if (user) {
    const { data: profil } = await supabase.from('profiles').select('ad, resim_url').eq('id', user.id).maybeSingle();
    if (profil?.ad) etiket = profil.ad;
    resimUrl = profil?.resim_url ?? null;

    // Kendisini izleyen kişi Ayarlar'da "son görülme" bilgisini görebilsin diye dokunuyoruz.
    await supabase.from('profiles').update({ son_gorulme: new Date().toISOString() }).eq('id', user.id);
  }

  const avatarEtiket = gorunum?.saltOkunur ? gorunum.izlenenAdi || '' : etiket;
  const dil = await dilAl();
  const cevrimdisi = yerelModda();
  const yuklemeBekliyor = !cevrimdisi && Boolean(ayarOku().yuklemeBekliyor);
  const ds = (await sozlukAl()).ayarlar.depolama;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UstBar
        bas={avatarEtiket ? basHarfleri(avatarEtiket, dil) : undefined}
        resimUrl={gorunum?.saltOkunur ? gorunum.izlenenResim : resimUrl}
        saltOkunur={gorunum?.saltOkunur ?? false}
        gozlemciOf={gorunum?.gozlemciOf ?? null}
        izlenenAdi={gorunum?.izlenenAdi ?? null}
        cevrimdisi={cevrimdisi}
      />
      {yuklemeBekliyor && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            justifyContent: 'center',
            flexWrap: 'wrap',
            padding: '7px 16px',
            fontSize: 12.5,
            borderBottom: '1px solid var(--copper-line)',
            color: 'var(--ink)',
          }}
        >
          {ds.banner}
          <Link href="/ayarlar#depolama" style={{ color: 'var(--copper)', fontWeight: 600 }}>
            {ds.bannerLink}
          </Link>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
    </div>
  );
}
