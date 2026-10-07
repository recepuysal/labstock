import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const HERKESE_ACIK = ['/giris', '/kayit', '/auth'];

export async function proxy(request: NextRequest) {
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

  return response;
}

export const config = {
  // kamera/: kamera sayımı Web Worker'ı ve kütüphaneleri (public/kamera) — gizli bir şey yok;
  // oturum kontrolüne takılınca worker JS yerine giriş sayfasının HTML'ini alıp çöküyordu
  matcher: ['/((?!_next/static|_next/image|favicon.ico|kamera/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
