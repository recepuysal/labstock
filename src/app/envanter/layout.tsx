import { UstBar } from '@/components/ust-bar';
import { createClient } from '@/lib/supabase/server';
import { basHarfleri } from '@/lib/types';
import { aktifGorunumAl } from '@/lib/gozlemci';

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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <UstBar
        bas={avatarEtiket ? basHarfleri(avatarEtiket) : undefined}
        resimUrl={gorunum?.saltOkunur ? gorunum.izlenenResim : resimUrl}
        saltOkunur={gorunum?.saltOkunur ?? false}
        gozlemciOf={gorunum?.gozlemciOf ?? null}
        izlenenAdi={gorunum?.izlenenAdi ?? null}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>
    </div>
  );
}
