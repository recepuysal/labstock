// Çevrimdışı modda yüklenen resimler (parça / profil) Supabase Storage yerine
// veri klasöründe durur; bu route onları uygulamaya sunar.
import fs from 'node:fs';
import path from 'node:path';
import { yerelDosyaDizini } from '@/lib/yerel/istemci';
import { yerelModDestekleniyor } from '@/lib/yerel/mod';

const TIPLER: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

export async function GET(_istek: Request, { params }: { params: Promise<{ yol: string[] }> }) {
  const { yol } = await params;
  const bulunamadi = () => new Response('Bulunamadı', { status: 404 });
  // Web sürümünde (sunucu internete açık) yerel dosya sunulmaz
  if (!yerelModDestekleniyor()) return bulunamadi();
  const kok = path.resolve(yerelDosyaDizini());
  let hedef: string;
  try {
    hedef = path.resolve(kok, ...yol.map(decodeURIComponent));
  } catch {
    return bulunamadi(); // bozuk % dizisi (URIError)
  }
  if (!hedef.startsWith(kok + path.sep)) return bulunamadi();
  let icerik: Buffer;
  try {
    if (!fs.statSync(hedef).isFile()) return bulunamadi(); // dizin vb.
    icerik = fs.readFileSync(hedef);
  } catch {
    return bulunamadi();
  }
  const uzanti = path.extname(hedef).slice(1).toLowerCase();
  return new Response(new Uint8Array(icerik), {
    headers: {
      'Content-Type': TIPLER[uzanti] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      // SVG içinde betik çalışmasın
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
