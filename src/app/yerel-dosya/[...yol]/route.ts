// Çevrimdışı modda yüklenen resimler (parça / profil) Supabase Storage yerine
// veri klasöründe durur; bu route onları uygulamaya sunar.
import fs from 'node:fs';
import path from 'node:path';
import { yerelDosyaDizini } from '@/lib/yerel/istemci';

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
  const kok = path.resolve(yerelDosyaDizini());
  const hedef = path.resolve(kok, ...yol.map(decodeURIComponent));
  if (!hedef.startsWith(kok + path.sep) || !fs.existsSync(hedef)) {
    return new Response('Bulunamadı', { status: 404 });
  }
  const uzanti = path.extname(hedef).slice(1).toLowerCase();
  return new Response(new Uint8Array(fs.readFileSync(hedef)), {
    headers: {
      'Content-Type': TIPLER[uzanti] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
      // SVG içinde betik çalışmasın
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
