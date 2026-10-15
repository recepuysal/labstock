import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Masaüstü kısayolu için: tek klasörde çalışabilen, kendi node_modules'ünü
  // taşıyan minimal bir sunucu üretir (bkz. desktop-app/baslat.vbs).
  // Vercel (web sürümü) kendi çıktı biçimini kullanır
  output: process.env.VERCEL ? undefined : 'standalone',
  experimental: {
    serverActions: {
      // Varsayılan 1MB, Excel/CSV içe aktarma dosyaları için yetersiz kalabilir.
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
