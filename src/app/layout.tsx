import type { Metadata } from 'next';
// Yazı tipleri uygulamayla birlikte paketlenir (@fontsource): açılışta Google
// Fonts'a istek atılmaz, derleme de ağ gerektirmez.
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './globals.css';
import { GuncellemeBildirimi } from '@/components/guncelleme-bildirimi';
import { AlinacaklarBildirimi } from '@/components/alinacaklar-bildirimi';
import { KameraIstasyonu } from '@/components/kamera-istasyonu';
import { alinacaklarBildirimVerisiAl } from '@/lib/gozlemci';
import { dilAl, sozlukAl } from '@/lib/i18n/sunucu';
import { DilSaglayici } from '@/lib/i18n/istemci';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const s = await sozlukAl();
  return { title: s.ortak.uygulamaBaslik, description: s.ortak.uygulamaAciklama };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Kök layout'ta: "alınacaklara eklendi" bildirimi uygulamanın her sayfasında
  // çalışsın diye burada - sadece /envanter/* altında olsaydı, Ayarlar gibi
  // diğer sayfalardayken bildirim kaçırılırdı.
  const bildirimVerisi = await alinacaklarBildirimVerisiAl();
  const dil = await dilAl();

  return (
    <html lang={dil}>
      <head>
        {/* Tema flaşını önlemek için: sayfa boyanmadan önce kayıtlı tercihi uygula. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('labstock-tema')==='koyu'){document.documentElement.setAttribute('data-theme','koyu');}}catch(e){}`,
          }}
        />
      </head>
      <body>
        <DilSaglayici dil={dil}>
        {children}
        <GuncellemeBildirimi />
        {bildirimVerisi && (
          <AlinacaklarBildirimi
            hedef={bildirimVerisi.hedef}
            izlenenAdi={bildirimVerisi.izlenenAdi}
            izleyenler={bildirimVerisi.izleyenler}
          />
        )}
        {/* Telefon kamerasıyla QR okuma ve sayım (sadece masaüstü uygulamasında); izleme modunda yazma kapalı */}
        {bildirimVerisi && !bildirimVerisi.saltOkunur && <KameraIstasyonu />}
        </DilSaglayici>
      </body>
    </html>
  );
}
