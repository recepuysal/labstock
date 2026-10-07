// Kamera sayımı Web Worker'ının kullandığı kütüphaneleri node_modules'tan public/kamera/'ya kopyalar
// (worker bunları importScripts ile yükler). Dosyalar büyük olduğu için depoda tutulmuyor.
const fs = require('fs');
const path = require('path');

const kok = path.join(__dirname, '..');
const hedef = path.join(kok, 'public', 'kamera');
const dosyalar = [
  ['node_modules/@techstark/opencv-js/dist/opencv.js', 'opencv.js'],
  ['node_modules/jsqr/dist/jsQR.js', 'jsQR.js'],
];
fs.mkdirSync(hedef, { recursive: true });
for (const [kaynak, ad] of dosyalar) {
  fs.copyFileSync(path.join(kok, kaynak), path.join(hedef, ad));
}
console.log('kamera dosyaları kopyalandı:', dosyalar.map((d) => d[1]).join(', '));
