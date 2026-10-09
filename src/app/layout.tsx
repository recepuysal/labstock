import type { Metadata } from 'next';
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
        {/* next/font yerine <link>: derleme sırasında Google'a istek atmaz,
            ağı kısıtlı ortamlarda build kırılmaz. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
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
