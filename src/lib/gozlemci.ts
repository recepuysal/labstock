import { cookies } from 'next/headers';
import { createClient } from './supabase/server';

export const GORUNUM_COOKIE = 'labstock_gorunum';

export type AktifGorunum = {
  /** Şu an görüntülenen verinin sahibi — sorgular buna göre filtrelenmeli. */
  kullaniciId: string;
  /** true ise başka birinin deposunu izliyorsun; yazma kapalı. */
  saltOkunur: boolean;
  /** Bu hesap birinin gözlemcisi mi (bağlıysa, switcher'ı göstermek için) — izleme modunda olup olmadığından bağımsız. */
  gozlemciOf: string | null;
  /** Bağlı olduğun kişinin adı — izleme modunda olup olmadığından bağımsız, switcher'da her zaman gösterilsin diye. */
  izlenenAdi: string | null;
  izlenenResim: string | null;
};

/** Bu istekte hangi kullanıcının deposu gösterilecek ve yazmaya izin var mı — hem kendi
 * deposu hem de (varsa) izlediğin depo arasında geçiş yapılabildiği için, "gözlemci
 * misin" sorusu tek başına yetmez: aktif olarak hangi görünümde olduğun cookie'de tutulur. */
export async function aktifGorunumAl(): Promise<AktifGorunum | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profil } = await supabase
    .from('profiles')
    .select('gozlemci_of')
    .eq('id', user.id)
    .maybeSingle();
  const gozlemciOf = profil?.gozlemci_of ?? null;

  // Bağlı olduğun kişinin adı/fotoğrafı, hangi moddayız (kendi/izleme) fark etmeksizin
  // her zaman çekilir — switcher, izlemiyorken de kime bağlı olduğunu göstersin diye.
  let izlenenAdi: string | null = null;
  let izlenenResim: string | null = null;
  if (gozlemciOf) {
    const { data } = await supabase.rpc('gozlemci_hedef_bilgisi');
    const satir = (Array.isArray(data) ? data[0] : data) as
      | { ad: string | null; resim_url: string | null }
      | undefined;
    izlenenAdi = satir?.ad ?? 'bağlı hesap';
    izlenenResim = satir?.resim_url ?? null;
  }

  const cookieDeposu = await cookies();
  const secilen = cookieDeposu.get(GORUNUM_COOKIE)?.value || null;
  const izliyor = Boolean(gozlemciOf) && secilen === gozlemciOf;

  if (!izliyor) {
    return { kullaniciId: user.id, saltOkunur: false, gozlemciOf, izlenenAdi, izlenenResim };
  }

  return {
    kullaniciId: gozlemciOf as string,
    saltOkunur: true,
    gozlemciOf,
    izlenenAdi,
    izlenenResim,
  };
}
