import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { yerelModda } from '@/lib/yerel/mod';
import { yerelIstemci } from '@/lib/yerel/istemci';

function bulutIstemcisi(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component'ten çağrıldı — oturum yenileme middleware'de yapılıyor.
          }
        },
      },
    },
  );
}

/** Uygulamanın veri istemcisi. Çevrimdışı moddaysa (Ayarlar → Veri depolama)
 * aynı arayüzü bu bilgisayardaki SQLite üzerinden sunan yerel istemciyi döndürür
 * (bkz. src/lib/yerel/istemci.ts). */
export async function createClient() {
  if (yerelModda()) return yerelIstemci() as unknown as ReturnType<typeof bulutIstemcisi>;
  return bulutIstemcisi(await cookies());
}

/** Mod ne olursa olsun Supabase'e bağlanan istemci — modlar arası veri
 * kopyalarken gerekiyor. */
export async function createBulutClient() {
  return bulutIstemcisi(await cookies());
}
