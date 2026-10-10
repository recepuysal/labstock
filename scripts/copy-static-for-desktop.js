// `next build` (output: 'standalone') statik dosyaları (.next/static, public/)
// standalone klasörünün dışında bırakır — masaüstü kısayolunun çalışması için
// bunları elle standalone'un içine kopyalamak gerekiyor.
// https://nextjs.org/docs/app/api-reference/config/next-config-js/output

const fs = require('fs');
const path = require('path');

const kok = path.join(__dirname, '..');
const standalone = path.join(kok, '.next', 'standalone');

if (!fs.existsSync(standalone)) {
  console.error('.next/standalone yok — önce `next build` çalıştı mı?');
  process.exit(1);
}

fs.cpSync(path.join(kok, '.next', 'static'), path.join(standalone, '.next', 'static'), {
  recursive: true,
});

const publicKlasoru = path.join(kok, 'public');
if (fs.existsSync(publicKlasoru)) {
  fs.cpSync(publicKlasoru, path.join(standalone, 'public'), { recursive: true });
}

console.log('Masaüstü kısayolu için statik dosyalar kopyalandı.');

// electron-builder (afterPack.js) uygulamayı electron-app/standalone'dan paketler.
// Burada güncellenmezse yerel paketlere eski bir derleme girer.
const hedef = path.join(kok, 'electron-app', 'standalone');
fs.rmSync(hedef, { recursive: true, force: true });
fs.cpSync(standalone, hedef, { recursive: true });
console.log('Derleme electron-app/standalone klasörüne kopyalandı.');
