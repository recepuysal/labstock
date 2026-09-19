// Bazı tedarikçi sitelerinin ürün sayfalarında arama motorları için yayınladığı
// schema.org JSON-LD "Product" bloğunu okur. Resmi bir API değil, ama normal
// bir sayfa isteği — sitenin zaten herkese açık yayınladığı yapılandırılmış
// veriyi okuyoruz (bkz. lcsc.ts, aynı yöntemin ilk kullanıldığı yer).

export type LdProduct = {
  '@type'?: string;
  name?: string;
  brand?: { name?: string };
  description?: string;
  category?: string;
  sku?: string;
  image?: string | string[];
  additionalProperty?: { name?: string; value?: string | number }[];
  subjectOf?: { url?: string };
  offers?: { price?: number | string; priceCurrency?: string };
};

/** Sayfadaki <script type="application/ld+json"> bloklarını gezip ilk "Product"
 * düğümünü döner (blok düz bir obje ya da "@graph" listesi içinde olabilir). */
export async function ldJsonUrunGetir(url: string): Promise<LdProduct | null> {
  const yanit = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  });
  if (!yanit.ok) throw new Error(`Sayfa alınamadı (HTTP ${yanit.status}).`);
  const html = await yanit.text();

  for (const esleme of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let veri: unknown;
    try {
      veri = JSON.parse(esleme[1]);
    } catch {
      continue;
    }
    const graf = (veri as { '@graph'?: unknown[] })?.['@graph'];
    const adaylar = Array.isArray(graf) ? (graf as LdProduct[]) : [veri as LdProduct];
    const urun = adaylar.find((a) => a?.['@type'] === 'Product');
    if (urun) return urun;
  }
  return null;
}
