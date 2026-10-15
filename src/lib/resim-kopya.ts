// Satıcı sitelerinden (LCSC, Direnç.net…) gelen parça resimlerini kendi
// Storage'ımıza kopyalar: satıcı sitesi kapanır, adres değişir ya da başka
// sitelerden çekmeyi engellerse resim kaybolmasın.
//
// Yer kaplamasın diye: aynı resim adresi tek kez saklanır (ortak/<sha1>.webp,
// bin kullanıcı aynı parçayı eklese de tek dosya) ve 600 px'e küçültülüp WebP'ye
// çevrilir (~20-40 KB). Herhangi bir adım başarısız olursa orijinal adres döner.
// Storage izni: supabase/migrations/0012_ortak_parca_resimleri.sql

import { createHash } from 'node:crypto';

type Supabase = { storage: { from: (kova: string) => any } };

const KOVA = 'parca-resimleri';
const AZAMI_INDIRME = 5 * 1024 * 1024;
const OZEL_AG = /^(localhost|127\.|0\.0\.0\.0|169\.254\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|\[?::1\]?)/i;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function disAdresMi(url: URL): boolean {
  return (url.protocol === 'http:' || url.protocol === 'https:') && !OZEL_AG.test(url.hostname);
}

async function indir(baslangic: URL): Promise<Response | null> {
  let hedef = baslangic;
  for (let adim = 0; adim < 4; adim++) {
    if (!disAdresMi(hedef)) return null;
    const yanit = await fetch(hedef, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    if (yanit.status >= 300 && yanit.status < 400) {
      const konum = yanit.headers.get('location');
      if (!konum) return null;
      hedef = new URL(konum, hedef);
      continue;
    }
    return yanit.ok ? yanit : null;
  }
  return null;
}

async function kucult(ham: Buffer): Promise<{ veri: Buffer; tip: string; uzanti: string } | null> {
  try {
    const sharp = (await import('sharp')).default;
    const veri = await sharp(ham).rotate().resize(600, 600, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    return { veri, tip: 'image/webp', uzanti: 'webp' };
  } catch {
    return null; // sharp yoksa (ör. bazı masaüstü paketleri) orijinal saklanır
  }
}

/** Dış resim adresini Storage'a kopyalar ve yeni adresi döner; olmazsa orijinali. */
export async function disResmiKopyala(supabase: Supabase, url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  let adres: URL;
  try {
    adres = new URL(url);
  } catch {
    return url; // göreli adres (ör. /yerel-dosya/...) — zaten bizde
  }
  if (!disAdresMi(adres) || adres.pathname.includes(`/storage/v1/object/public/${KOVA}/`)) return url;

  try {
    const yanit = await indir(adres);
    const tip = yanit?.headers.get('content-type')?.split(';')[0].trim() ?? '';
    if (!yanit || !tip.startsWith('image/')) return url;
    const ham = Buffer.from(await yanit.arrayBuffer());
    if (ham.length === 0 || ham.length > AZAMI_INDIRME) return url;

    const kucuk = await kucult(ham);
    const uzanti = kucuk?.uzanti ?? (tip.split('/')[1] || 'jpg').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '');
    const yol = `ortak/${createHash('sha1').update(url).digest('hex')}.${uzanti}`;
    const kova = supabase.storage.from(KOVA);

    const { error } = await kova.upload(yol, kucuk?.veri ?? ham, { upsert: false, contentType: kucuk?.tip ?? tip });
    // Aynı resim daha önce kopyalandıysa "already exists" döner — o dosyayı kullan.
    if (error && !/exist|duplicate/i.test(error.message ?? '')) return url;
    return kova.getPublicUrl(yol).data.publicUrl as string;
  } catch {
    return url;
  }
}
