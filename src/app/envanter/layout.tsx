import { UstBar } from '@/components/ust-bar';
import { createClient, createSonradanClient } from '@/lib/supabase/server';
import { basHarfleri } from '@/lib/types';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { dilAl, sozlukAl } from '@/lib/i18n/sunucu';
import Link from 'next/link';
import { after } from 'next/server';
import { kullaniciAl } from '@/lib/oturum';
import { ayarOku, yerelModda } from '@/lib/yerel/mod';

export const dynamic = 'force-dynamic';

const SON_GORULME_ARALIGI = 5 * 60 * 1000;

export default async function EnvanterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const user = await kullaniciAl();

  let etiket = user?.email ?? '';
  let resimUrl: string | null = null;
  // Birbirinden bağımsız sorgular aynı anda gider (eskiden sırayla bekleniyordu).
  const [gorunum, profilSonucu] = await Promise.all([
    user ? aktifGorunumAl() : null,
    user
      ? supabase.from('profiles').select('ad, resim_url, son_gorulme').eq('id', user.id).maybeSingle()
      : null,
  ]);

  if (user) {
    const profil = profilSonucu?.data as
      | { ad: string | null; resim_url: string | null; son_gorulme: string | null }
      | null
      | undefined;
    if (profil?.ad) etiket = profil.ad;
    resimUrl = profil?.resim_url ?? null;

    // Kendisini izleyen kişi Ayarlar'da "son görülme" bilgisini görebilsin diye dokunuyoruz.
    // Her sayfa açılışında yazmak yerine en fazla 5 dakikada bir, ve sayfa
    // gönderildikten sonra (after) — kullanıcıyı bekletmez.
    const sonGorulme = profil?.son_gorulme ? Date.parse(profil.son_gorulme) : 0;
    if (Date.now() - sonGorulme > SON_GORULME_ARALIGI) {
      const sonradan = await createSonradanClient();
      after(async () => {
        await sonradan.from('profiles').update({ son_gorulme: new Date().toISOString() }).eq('id', user.id);
      });
    }
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
