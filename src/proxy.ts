import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { yerelModda } from '@/lib/yerel/mod';

const HERKESE_ACIK = ['/giris', '/kayit', '/auth'];
const MASAUSTU_COOKIE = 'labstock-masaustu';
// iPad masaüstü görünümde kalır; sadece telefonlar
const TELEFON = /iPhone|iPod|Android.+Mobile|Windows Phone/i;

export async function proxy(request: NextRequest) {
  // GitHub / Google girişi: Supabase dönüş adresini izinli listede bulamazsa
  // Site URL'e (/?code=...) döner — kodu oturuma çeviren sayfaya aktar.
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.has('code')) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/callback';
    return NextResponse.redirect(url);
  }

  // Çevrimdışı mod: hesap yok, oturum kontrolü de yok — giriş/kayıt sayfaları
  // yerine doğrudan envantere.
  if (yerelModda()) {
    const { pathname } = request.nextUrl;
    if (pathname === '/giris' || pathname === '/kayit') {
      const url = request.nextUrl.clone();
      url.pathname = '/envanter';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() oturumu tazeler; getSession() sunucuda güvenilir değil.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const acik = HERKESE_ACIK.some((p) => pathname.startsWith(p));

  if (!user && !acik) {
    const url = request.nextUrl.clone();
    url.pathname = '/giris';
    url.searchParams.set('devam', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/giris' || pathname === '/kayit')) {
    const url = request.nextUrl.clone();
    url.pathname = '/envanter';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Telefon görünümü: telefondan /envanter açılınca /m'ye yönlendir.
  // "Masaüstü" bağlantısı (?masaustu=1) tercihi çereze yazar; /m'ye dönünce silinir.
  if (user && pathname === '/m') {
    response.cookies.delete(MASAUSTU_COOKIE);
  }
  if (user && pathname === '/envanter') {
    if (request.nextUrl.searchParams.get('masaustu') === '1') {
      response.cookies.set(MASAUSTU_COOKIE, '1', { path: '/', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 });
    } else if (
      !request.cookies.has(MASAUSTU_COOKIE) &&
      request.nextUrl.search === '' &&
      TELEFON.test(request.headers.get('user-agent') ?? '')
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/m';
      const yonlendir = NextResponse.redirect(url);
      // Oturum tazelendiyse yeni çerezler kaybolmasın
      response.cookies.getAll().forEach((c) => yonlendir.cookies.set(c));
      return yonlendir;
    }
  }

  return response;
}

export const config = {
  // kamera/: kamera sayımı Web Worker'ı ve kütüphaneleri (public/kamera) — gizli bir şey yok;
  // oturum kontrolüne takılınca worker JS yerine giriş sayfasının HTML'ini alıp çöküyordu
  matcher: ['/((?!_next/static|_next/image|favicon.ico|kamera/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
