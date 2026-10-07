/* Kamera sayımı (public/kamera/sayim.js) test karelerinde Python sürümüyle karşılaştırılır.
 *
 *   node scripts/kamera-sayim-testi.js <klasör>
 *
 * Klasörde liste.json ([{ ad, w, h, gercek, python_adet, ... }]) ve her kare için ham RGBA
 * dosyası (<ad>.rgba) olmalı. Kareler kişisel masa fotoğrafları olduğu için depoda tutulmuyor. */
const fs = require('fs');
const path = require('path');
const LabSayim = require('../public/kamera/sayim.js');

(async () => {
  const klasor = process.argv[2];
  if (!klasor) {
    console.error('kullanım: node scripts/kamera-sayim-testi.js <klasör>');
    process.exit(2);
  }
  let cv = require('@techstark/opencv-js');
  if (cv instanceof Promise) cv = await cv;
  else if (!cv.Mat) await new Promise((r) => (cv.onRuntimeInitialized = r));
  const { say } = LabSayim.olustur(cv);

  const liste = JSON.parse(fs.readFileSync(path.join(klasor, 'liste.json'), 'utf8'));
  let hata = 0;
  for (const k of liste) {
    const veri = new Uint8ClampedArray(fs.readFileSync(path.join(klasor, `${k.ad}.rgba`)));
    const t = Date.now();
    const s = say({ data: veri, width: k.w, height: k.h });
    const ms = Date.now() - t;
    const ayni = s.adet === k.python_adet && s.bolgeler.length === k.python_bolge;
    if (!ayni) hata++;
    console.log(
      `${ayni ? 'AYNI ' : 'FARKLI'} ${k.ad.padEnd(20)} gercek ${String(k.gercek).padStart(3)}  ` +
        `python ${String(k.python_adet).padStart(3)} (${k.python_bolge} bolge, birim ${Math.round(k.python_birim)})  ` +
        `js ${String(s.adet).padStart(3)} (${s.bolgeler.length} bolge, birim ${Math.round(s.birimTahmin)})  ${ms} ms`,
    );
  }
  process.exit(hata ? 1 : 0);
})();
