import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { aktifGorunumAl } from '@/lib/gozlemci';
import { cikisYap } from '@/app/auth-actions';

export const dynamic = 'force-dynamic';

const Ok = () => (
  <svg className="m-ok" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

export default async function MobilAyarlar() {
  const aktif = await aktifGorunumAl();
  if (!aktif) redirect('/giris?devam=/m/ayarlar');
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const eposta = user?.email ?? '';

  return (
    <main className="m-kenar m-sayfa">
      <h1 className="m-sayfa-baslik">Ayarlar</h1>

      <div className="m-hesap">
        <span className="m-avatar" aria-hidden="true">
          {eposta.slice(0, 1).toUpperCase() || '?'}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="m-hesap-ad">{eposta || 'Hesap'}</div>
          <div className="m-alt">{aktif.saltOkunur ? 'İzleme modu (salt okunur)' : 'Depo sahibi'}</div>
        </div>
      </div>

      <div className="m-bolum-baslik">Hesap</div>
      <div className="m-grup">
        <Link className="m-grup-satir m-dokun" href="/ayarlar/profil">
          Profil ve şifre <Ok />
        </Link>
      </div>

      <div className="m-bolum-baslik">Görünüm</div>
      <div className="m-grup">
        <a className="m-grup-satir m-dokun" href="/envanter?masaustu=1">
          <span>
            Masaüstü görünümünü kullan
            <span className="m-grup-not">Telefonda tam sürüm açılır. Geri dönmek için /m adresini aç.</span>
          </span>
          <Ok />
        </a>
      </div>

      <form action={cikisYap}>
        <button type="submit" className="m-cikis m-dokun">
          Çıkış yap
        </button>
      </form>
    </main>
  );
}
