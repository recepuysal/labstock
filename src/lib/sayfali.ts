// Supabase (PostgREST) bir istekte en fazla 1000 satır döndürür; büyük listeler
// sayfa sayfa okunur. Uzun `.in()` listeleri de URL sınırına takılmasın diye
// parçalara bölünür.

export const SAYFA = 1000;
export const PARCA = 200;

export function parcala<T>(dizi: T[], n = PARCA): T[][] {
  const gruplar: T[][] = [];
  for (let i = 0; i < dizi.length; i += n) gruplar.push(dizi.slice(i, i + n));
  return gruplar;
}

type SayfaliSorgu = {
  range: (bas: number, son: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

/** Sorgunun tüm satırlarını sayfa sayfa çeker; hata olursa fırlatır.
 *  Sıralama benzersiz olmalı (ör. son sırada id), yoksa sayfa sınırında satır kayabilir. */
export async function tumSatirlar<T>(sorgu: () => SayfaliSorgu): Promise<T[]> {
  const sonuc: T[] = [];
  for (let bas = 0; ; bas += SAYFA) {
    const { data, error } = await sorgu().range(bas, bas + SAYFA - 1);
    if (error) throw new Error(error.message);
    const satirlar = (data ?? []) as T[];
    sonuc.push(...satirlar);
    if (satirlar.length < SAYFA) return sonuc;
  }
}
