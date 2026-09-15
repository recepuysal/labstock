import type { Metadata } from 'next';
import './globals.css';
import { GuncellemeBildirimi } from '@/components/guncelleme-bildirimi';
import { AlinacaklarBildirimi } from '@/components/alinacaklar-bildirimi';
import { alinacaklarBildirimVerisiAl } from '@/lib/gozlemci';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'LabStock — elektronik komponent deposu',
  description: 'Elektronik komponent stok ve depo takibi.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Kök layout'ta: "alınacaklara eklendi" bildirimi uygulamanın her sayfasında
  // çalışsın diye burada - sadece /envanter/* altında olsaydı, Ayarlar gibi
  // diğer sayfalardayken bildirim kaçırılırdı.
  const bildirimVerisi = await alinacaklarBildirimVerisiAl();

  return (
    <html lang="tr">
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
        {children}
        <GuncellemeBildirimi />
        {bildirimVerisi && (
          <AlinacaklarBildirimi
            hedef={bildirimVerisi.hedef}
            izlenenAdi={bildirimVerisi.izlenenAdi}
            izleyenler={bildirimVerisi.izleyenler}
          />
        )}
      </body>
    </html>
  );
}
