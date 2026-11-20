import type { createClient } from './supabase/server';
import { tumSatirlar } from './sayfali';

type Istemci = Awaited<ReturnType<typeof createClient>>;

const sirala = (v: Iterable<string | null | undefined>) =>
  Array.from(new Set(Array.from(v).filter((x): x is string => Boolean(x)))).sort((a, b) => a.localeCompare(b, 'tr'));

/** Envanter filtrelerindeki kategori ve kılıf listeleri.
 *
 * Önce `katalog_filtreleri` RPC'si denenir (migration 0017): tekilleştirme
 * veritabanında yapılır, sadece birkaç yüz kısa metin gelir. RPC yoksa
 * (migration henüz çalıştırılmadı veya çevrimdışı SQLite modu) eski yönteme
 * düşer: tüm `parts` tablosu 1000'erlik sayfalarla çekilip burada tekilleştirilir. */
export async function katalogFiltreleri(supabase: Istemci): Promise<{ kategoriler: string[]; kiliflar: string[] }> {
  try {
    const { data, error } = await supabase.rpc('katalog_filtreleri');
    if (!error && data) {
      const satir = (Array.isArray(data) ? data[0] : data) as
        | { kategoriler: string[] | null; kiliflar: string[] | null }
        | undefined;
      if (satir) return { kategoriler: sirala(satir.kategoriler ?? []), kiliflar: sirala(satir.kiliflar ?? []) };
    }
  } catch {
    // eski yönteme düş
  }

  const katalog = await tumSatirlar<{ kategori: string | null; kilif: string | null }>(() =>
    supabase.from('parts').select('kategori, kilif').order('id', { ascending: true }),
  ).catch(() => []);
  return { kategoriler: sirala(katalog.map((p) => p.kategori)), kiliflar: sirala(katalog.map((p) => p.kilif)) };
}
