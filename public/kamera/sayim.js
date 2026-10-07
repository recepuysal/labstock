/* Kamera sayımı: masaya dökülmüş parçaları sayar (OpenCV.js).
 *
 * Görüntü işleme servisinin Python sürümünün (sayim.py) birebir karşılığıdır; değişiklik
 * yapılırsa scripts/kamera-sayim-testi.js ile kayıtlı test karelerinde sonuçlar kontrol edilmeli.
 *
 * Yöntem (masanın rengi bilinmiyor):
 *  1) Görüntü küçültülüp güçlü medyanla "boş masa" tahmini çıkarılır.
 *  2) Her pikselin masadan renk farkı (Lab) hesaplanır; çift eşikle (histerezis) parçalar ayrılır:
 *     güçlü farklı yerler tohum, onlara bağlı zayıf farklı yerler (gümüş plaka vb.) parçaya katılır.
 *  3) Her bölge kendi içinde kapatılır (ters dönmüş parçanın kopuk çerçevesi birleşir), ince yapılar
 *     (THT bacakları) silinir; gövdeden ince kırıntılar atılır.
 *  4) Tek parça alanı dolgun bölgelerden tahmin edilir; birbirine değen grup = alan / tek parça alanı.
 *
 * Tarayıcıda (Web Worker) ve Node'da (test) çalışır: LabSayim.olustur(cv) -> { say, Sabitleyici }.
 */
(function (kok) {
  'use strict';

  const AYAR = {
    DUSUK_TABAN: 95.0, // bunun altı kesin masa (kağıt ~7-18, yumuşak gölge ~18)
    DUSUK_ORAN: 0.3, // düşük eşik = yüksek eşiğin bu oranı (daha büyükse)
    BUYUME_ORAN: 0.015, // zayıf bölge, güçlü bölgeye en fazla resmin bu oranı kadar uzak olabilir
    RK_ORAN: 0.2, // bölge içi boşluk doldurma yarıçapı / gövde yarı kalınlığı
  };
  const UYARI = 'Parçalar birbirine değiyor ya da üst üste: biraz dağıt';

  // ---- Python ile aynı sonucu vermek için yardımcılar
  /** Python round(): yarımları en yakın ÇİFT sayıya yuvarlar (2.5 -> 2, 3.5 -> 4). */
  function pyRound(x) {
    const t = Math.floor(x);
    const fark = x - t;
    if (fark > 0.5) return t + 1;
    if (fark < 0.5) return t;
    return t % 2 === 0 ? t : t + 1;
  }
  function ortanca(dizi) {
    const a = Float64Array.from(dizi).sort();
    const n = a.length;
    if (!n) return NaN;
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  }
  /** numpy.percentile (doğrusal ara değer). */
  function yuzdelik(dizi, p) {
    const a = Float64Array.from(dizi).sort();
    if (!a.length) return NaN;
    const k = ((a.length - 1) * p) / 100;
    const alt = Math.floor(k);
    const ust = Math.min(alt + 1, a.length - 1);
    return a[alt] + (a[ust] - a[alt]) * (k - alt);
  }

  function olustur(cv) {
    const elips = (r) => cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2 * r + 1, 2 * r + 1));
    const nokta = () => new cv.Point(-1, -1);

    /** Yuvarlak çekirdekle aşındırma/genişletme, mesafe dönüşümüyle: süresi yarıçaptan bağımsız
     * (OpenCV.js'in elips çekirdeği WASM'da r² ile yavaşlıyor: r=23 -> ~17 sn; bu ~80 ms). */
    function dtEsik(src, tersle, r) {
      const n = src.rows * src.cols;
      let girdi = src;
      if (tersle) {
        girdi = new cv.Mat(src.rows, src.cols, cv.CV_8U);
        const s = src.data;
        const g = girdi.data;
        for (let i = 0; i < n; i++) g[i] = s[i] ? 0 : 255;
      }
      const d = new cv.Mat();
      cv.distanceTransform(girdi, d, cv.DIST_L2, 5);
      if (tersle) girdi.delete();
      const out = new cv.Mat(src.rows, src.cols, cv.CV_8U);
      const dd = d.data32F;
      const od = out.data;
      // aşındırma: arka plana uzaklığı > r olanlar kalır; genişletme: ön plana uzaklığı <= r olanlar dolar
      if (tersle) for (let i = 0; i < n; i++) od[i] = dd[i] <= r ? 255 : 0;
      else for (let i = 0; i < n; i++) od[i] = dd[i] > r ? 255 : 0;
      d.delete();
      return out;
    }

    function morf(src, islem, r, tekrar = 1) {
      if (r >= 3 && tekrar === 1) {
        const [ilk, ikinci] = islem === cv.MORPH_OPEN ? [false, true] : [true, false];
        const ara = dtEsik(src, ilk, r);
        const dst = dtEsik(ara, ikinci, r);
        ara.delete();
        return dst;
      }
      const k = elips(r);
      const dst = new cv.Mat();
      cv.morphologyEx(src, dst, islem, k, nokta(), tekrar, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());
      k.delete();
      return dst;
    }

    /** Parçaların içindeki küçük delikleri doldurur (montaj deliği, yansıma, yazı boşluğu). Yerinde değiştirir. */
    function delikDoldur(maske, enBuyuk) {
      const konturlar = new cv.MatVector();
      const hiyerarsi = new cv.Mat();
      const kopya = maske.clone(); // findContours bazı sürümlerde girdiyi değiştirebilir
      cv.findContours(kopya, konturlar, hiyerarsi, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
      kopya.delete();
      const beyaz = new cv.Scalar(255);
      for (let i = 0; i < konturlar.size(); i++) {
        if (hiyerarsi.data32S[i * 4 + 3] < 0) continue; // dış kontur, delik değil
        const k = konturlar.get(i);
        if (cv.contourArea(k) < enBuyuk) cv.drawContours(maske, konturlar, i, beyaz, -1);
        k.delete();
      }
      konturlar.delete();
      hiyerarsi.delete();
    }

    /** Masadan farklı olan pikseller (parçalar) için ikili maske (CV_8U, 0/255). */
    function maskeCikar(rgb, w, h, hassasiyet) {
      const lab = new cv.Mat();
      cv.cvtColor(rgb, lab, cv.COLOR_RGB2Lab);

      // Boş masa tahmini: küçült -> güçlü medyan -> büyüt
      const kucuk = new cv.Mat();
      const kw = Math.max(8, Math.floor(w / 16));
      const kh = Math.max(8, Math.floor(h / 16));
      cv.resize(rgb, kucuk, new cv.Size(kw, kh), 0, 0, cv.INTER_AREA);
      const k = Math.max(3, Math.floor(Math.min(kw, kh) / 4) | 1);
      const medyan = new cv.Mat();
      cv.medianBlur(kucuk, medyan, k);
      const masa = new cv.Mat();
      cv.resize(medyan, masa, new cv.Size(w, h), 0, 0, cv.INTER_LINEAR);
      const masaLab = new cv.Mat();
      cv.cvtColor(masa, masaLab, cv.COLOR_RGB2Lab);
      kucuk.delete();
      medyan.delete();
      masa.delete();

      // Renk farkı; parlaklık farkı biraz az ağırlıklı (yumuşak gölgeler parça sanılmasın)
      const n = w * h;
      const fark = new cv.Mat(h, w, cv.CV_32F);
      const fd = fark.data32F;
      const ld = lab.data;
      const md = masaLab.data;
      for (let i = 0, j = 0; i < n; i++, j += 3) {
        const dl = ld[j] - md[j];
        const da = ld[j + 1] - md[j + 1];
        const db = ld[j + 2] - md[j + 2];
        fd[i] = Math.sqrt(0.6 * dl * dl + da * da + db * db);
      }
      lab.delete();
      masaLab.delete();
      const sigma = Math.max(1.0, w / 1500);
      cv.GaussianBlur(fark, fark, new cv.Size(0, 0), sigma, sigma, cv.BORDER_DEFAULT);
      const f8 = new cv.Mat(h, w, cv.CV_8U);
      const f8d = f8.data;
      for (let i = 0; i < n; i++) {
        const v = fd[i] * 3;
        f8d[i] = v >= 255 ? 255 : v; // numpy astype(uint8) gibi: aşağı yuvarlar
      }
      fark.delete();

      // Çift eşik (histerezis)
      const atik = new cv.Mat();
      const otsu = cv.threshold(f8, atik, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
      atik.delete();
      const yuksek = Math.max(otsu, 40) / hassasiyet;
      const dusuk = Math.max(AYAR.DUSUK_TABAN, yuksek * AYAR.DUSUK_ORAN) / hassasiyet;

      const gucluDegil = new cv.Mat(h, w, cv.CV_8U);
      const gd = gucluDegil.data;
      for (let i = 0; i < n; i++) gd[i] = f8d[i] > yuksek ? 0 : 1;
      const uzaklik = new cv.Mat();
      cv.distanceTransform(gucluDegil, uzaklik, cv.DIST_L2, 3);
      const ud = uzaklik.data32F;
      const sinir = Math.max(w, h) * AYAR.BUYUME_ORAN;
      const zayif = new cv.Mat(h, w, cv.CV_8U);
      const zd = zayif.data;
      for (let i = 0; i < n; i++) zd[i] = f8d[i] > dusuk && ud[i] < sinir ? 1 : 0;
      uzaklik.delete();

      const etiket = new cv.Mat();
      const adet = cv.connectedComponents(zayif, etiket, 8, cv.CV_32S);
      zayif.delete();
      const ed = etiket.data32S;
      const tohumlu = new Uint8Array(adet);
      for (let i = 0; i < n; i++) if (gd[i] === 0) tohumlu[ed[i]] = 1;
      tohumlu[0] = 0;
      gucluDegil.delete();
      f8.delete();

      let maske = new cv.Mat(h, w, cv.CV_8U);
      const mk = maske.data;
      for (let i = 0; i < n; i++) mk[i] = tohumlu[ed[i]] ? 255 : 0;
      etiket.delete();

      const r = Math.max(1, pyRound(w / 900));
      const acik = morf(maske, cv.MORPH_OPEN, r);
      maske.delete();
      maske = morf(acik, cv.MORPH_CLOSE, r, 2);
      acik.delete();
      delikDoldur(maske, w * h * 0.002);
      return maske;
    }

    /** Bağlı bölgeler + her bölgenin yarı kalınlığı (mesafe dönüşümünün tepe değeri). */
    function bilesenler(maske, w, h) {
      const etiket = new cv.Mat();
      const istatM = new cv.Mat();
      const merkez = new cv.Mat();
      const n = cv.connectedComponentsWithStats(maske, etiket, istatM, merkez, 8, cv.CV_32S);
      merkez.delete();
      const istat = Int32Array.from(istatM.data32S); // satır başına: x, y, w, h, alan
      istatM.delete();
      const mesafe = new cv.Mat();
      cv.distanceTransform(maske, mesafe, cv.DIST_L2, 3);
      const md = mesafe.data32F;
      const ed = etiket.data32S;
      const yk = new Float32Array(n);
      for (let i = 0; i < ed.length; i++) if (md[i] > yk[ed[i]]) yk[ed[i]] = md[i];
      mesafe.delete();
      const gecerli = new Uint8Array(n);
      for (let i = 1; i < n; i++) {
        const bw = istat[i * 5 + 2];
        const bh = istat[i * 5 + 3];
        const alan = istat[i * 5 + 4];
        const dev = bw > 0.5 * w || bh > 0.5 * h; // masa kenarı, el, kutu
        gecerli[i] = alan > w * h * 2e-5 && !dev ? 1 : 0;
      }
      return { n, etiket, istat, yk, gecerli };
    }

    function govdeKalinligi(b) {
      const alanlar = [];
      for (let i = 1; i < b.n; i++) if (b.gecerli[i]) alanlar.push(b.istat[i * 5 + 4]);
      const esik = yuzdelik(alanlar, 90) * 0.15;
      const buyuk = [];
      const hepsi = [];
      for (let i = 1; i < b.n; i++) {
        if (!b.gecerli[i]) continue;
        hepsi.push(b.yk[i]);
        if (b.istat[i * 5 + 4] >= esik) buyuk.push(b.yk[i]);
      }
      return buyuk.length ? ortanca(buyuk) : ortanca(hepsi);
    }

    /** Bölgenin bir kesitini (etiket == i) 0/255 maske olarak çıkarır. */
    function kesit(etiket, w, i, x0, y0, x1, y1) {
      const kw = x1 - x0;
      const kh = y1 - y0;
      const m = new cv.Mat(kh, kw, cv.CV_8U);
      const d = m.data;
      const ed = etiket.data32S;
      for (let y = 0; y < kh; y++) {
        const satir = (y0 + y) * w + x0;
        for (let x = 0; x < kw; x++) d[y * kw + x] = ed[satir + x] === i ? 255 : 0;
      }
      return m;
    }

    /** Bölge alanı / dışbükey zarf alanı. Tek parça ~1, birbirine değen parçalar daha düşük. */
    function dolgunluk(b, w, i) {
      const x = b.istat[i * 5];
      const y = b.istat[i * 5 + 1];
      const parca = kesit(b.etiket, w, i, x, y, x + b.istat[i * 5 + 2], y + b.istat[i * 5 + 3]);
      const konturlar = new cv.MatVector();
      const hiy = new cv.Mat();
      cv.findContours(parca, konturlar, hiy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      parca.delete();
      hiy.delete();
      let enIyi = -1;
      let enAlan = -1;
      for (let k = 0; k < konturlar.size(); k++) {
        const c = konturlar.get(k);
        const a = cv.contourArea(c);
        if (a > enAlan) {
          enAlan = a;
          enIyi = k;
        }
        c.delete();
      }
      let sonuc = 0;
      if (enIyi >= 0) {
        const c = konturlar.get(enIyi);
        const zarf = new cv.Mat();
        cv.convexHull(c, zarf, false, true);
        const za = cv.contourArea(zarf);
        sonuc = za > 0 ? b.istat[i * 5 + 4] / za : 0;
        zarf.delete();
        c.delete();
      }
      konturlar.delete();
      return sonuc;
    }

    /** Her bölgeyi KENDİ İÇİNDE kapatır (kopuk parçalarını birleştirir, deliklerini doldurur). */
    function bilesenKapat(maske, b, w, h, rk, delikSiniri) {
      const cikti = maske.clone();
      const cd = cikti.data;
      for (let i = 1; i < b.n; i++) {
        if (!b.gecerli[i]) continue;
        const x = b.istat[i * 5];
        const y = b.istat[i * 5 + 1];
        const x0 = Math.max(0, x - rk);
        const y0 = Math.max(0, y - rk);
        const x1 = Math.min(w, x + b.istat[i * 5 + 2] + rk);
        const y1 = Math.min(h, y + b.istat[i * 5 + 3] + rk);
        const parca = kesit(b.etiket, w, i, x0, y0, x1, y1);
        const kapali = morf(parca, cv.MORPH_CLOSE, rk);
        parca.delete();
        delikDoldur(kapali, delikSiniri);
        const kw = x1 - x0;
        const kd = kapali.data;
        for (let yy = 0; yy < y1 - y0; yy++) {
          const satir = (y0 + yy) * w + x0;
          for (let xx = 0; xx < kw; xx++) cd[satir + xx] |= kd[yy * kw + xx];
        }
        kapali.delete();
      }
      return cikti;
    }

    function serbest(b) {
      if (b && b.etiket) b.etiket.delete();
    }

    /**
     * Parçaları sayar.
     * goruntu: { data: RGBA Uint8ClampedArray, width, height } (ImageData)
     * birimAlan: tek parçanın piksel alanı; null = bu karede tahmin et.
     * Döndürür: { adet, birimAlan, birimTahmin, bolgeler: [[x, y, w, h, alan, kac], ...], uyari }
     */
    function say(goruntu, birimAlan = null, hassasiyet = 1.0) {
      const w = goruntu.width;
      const h = goruntu.height;
      const rgba = cv.matFromImageData(goruntu);
      const rgb = new cv.Mat();
      cv.cvtColor(rgba, rgb, cv.COLOR_RGBA2RGB);
      rgba.delete();
      let maske = maskeCikar(rgb, w, h, hassasiyet);
      rgb.delete();
      const bos = { adet: 0, birimAlan, birimTahmin: null, bolgeler: [], uyari: null };

      let b = bilesenler(maske, w, h);
      try {
        if (!b.gecerli.some((v) => v)) return bos;
        let govdeYk = govdeKalinligi(b);

        // Kopuk parçaları kendi içinde birleştir, sonra gövdeden çok ince yapıları (bacaklar) sil
        const rk = Math.trunc(govdeYk * AYAR.RK_ORAN);
        if (rk >= 2) {
          const yeni = bilesenKapat(maske, b, w, h, rk, Math.PI * (govdeYk * 2) ** 2);
          maske.delete();
          maske = yeni;
        }
        const r = Math.trunc(govdeYk * 0.4);
        if (r >= 2) {
          const acik = morf(maske, cv.MORPH_OPEN, r);
          maske.delete();
          maske = acik;
          serbest(b);
          b = bilesenler(maske, w, h);
          if (!b.gecerli.some((v) => v)) return bos;
          govdeYk = govdeKalinligi(b);
        }

        // Gövdeden belirgin ince kırıntıları at (masa dokusu, toz, gölge lekesi)
        const idx = [];
        for (let i = 1; i < b.n; i++) if (b.gecerli[i] && b.yk[i] >= govdeYk * 0.45) idx.push(i);
        if (!idx.length) return bos;

        // Tek parça alanı: büyük ve dolgun bölgelerden
        const alanlar = idx.map((i) => b.istat[i * 5 + 4]);
        const dolgun = idx.map((i) => dolgunluk(b, w, i));
        const buyukEsik = yuzdelik(alanlar, 90) * 0.15;
        let tekler = alanlar.filter((a, j) => dolgun[j] >= 0.85 && a >= buyukEsik);
        if (!tekler.length) tekler = alanlar.filter((a) => a >= buyukEsik);
        let tahmin = ortanca(tekler);
        const yakin = tekler.filter((a) => a > tahmin * 0.6 && a < tahmin * 1.5);
        if (yakin.length) tahmin = ortanca(yakin);
        const birim = birimAlan || tahmin;

        // Say: bölge alanı / tek parça alanı
        const bolgeler = [];
        let toplam = 0;
        idx.forEach((i, j) => {
          const a = alanlar[j];
          const oran = a / birim;
          if (oran < 0.4) return; // tek parçanın yarısından küçük: kırıntı
          let kac = Math.max(1, pyRound(oran));
          if (kac === 2 && dolgun[j] >= 0.9 && oran < 1.75) kac = 1; // dolgun ve biraz iri: tek parça
          toplam += kac;
          const o = i * 5;
          bolgeler.push([b.istat[o], b.istat[o + 1], b.istat[o + 2], b.istat[o + 3], a, kac]);
        });
        const gruptan = bolgeler.reduce((t, x) => t + (x[5] > 1 ? x[5] : 0), 0);
        const uyari = toplam && gruptan / toplam > 0.5 ? UYARI : null;
        return { adet: toplam, birimAlan: birim, birimTahmin: tahmin, bolgeler, uyari };
      } finally {
        serbest(b);
        maske.delete();
      }
    }

    /** Canlı sayımı kararlı yapar: tek parça alanını kareler arasında yumuşatır,
     * gösterilen sayı son karelerin ortancasıdır. */
    class Sabitleyici {
      constructor(pencere = 9) {
        this.pencere = pencere;
        this.sifirla();
      }
      sifirla() {
        this.adetler = [];
        this.aday = [];
        this.birim = null;
      }
      guncelle(sonuc) {
        const t = sonuc.birimTahmin;
        if (t) {
          if (this.birim === null) this.birim = t;
          else if (t / this.birim > 0.7 && t / this.birim < 1.4) {
            this.birim = 0.85 * this.birim + 0.15 * t;
            this.aday = [];
          } else {
            this.aday.push(t); // büyük değişim: 4 kare sürerse kabul et
            if (this.aday.length >= 4) {
              this.birim = ortanca(this.aday);
              this.adetler = [];
              this.aday = [];
            }
          }
        }
        this.adetler.push(sonuc.adet);
        if (this.adetler.length > this.pencere) this.adetler.shift();
        return Math.trunc(ortanca(this.adetler));
      }
    }

    return { say, Sabitleyici, AYAR };
  }

  const LabSayim = { olustur, pyRound, ortanca, yuzdelik };
  if (typeof module !== 'undefined' && module.exports) module.exports = LabSayim;
  else kok.LabSayim = LabSayim;
})(typeof self !== 'undefined' ? self : this);
