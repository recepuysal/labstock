// GitHub / Google girişinden dönüş: Supabase'in verdiği kodu oturuma çevirir.
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(istek: NextRequest) {
  const url = new URL(istek.url);
  const kod = url.searchParams.get('code');
  const devam = url.searchParams.get('devam') ?? '/envanter';
  const hedef = devam.startsWith('/') && !devam.startsWith('//') ? devam : '/envanter';

  if (kod) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(kod);
    if (!error) {
      // İstatistik: son giriş kaynağı (0010 göçü); hata girişi etkilemez
      await supabase.rpc('giris_kaynagi_kaydet', { p_kaynak: process.env.VERCEL ? 'web' : 'masaustu' }).then(
        () => {},
        () => {},
      );
      return NextResponse.redirect(new URL(hedef, url.origin));
    }
  }
  return NextResponse.redirect(new URL('/giris?hata=oauth', url.origin));
}
