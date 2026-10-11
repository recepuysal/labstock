/* Kamera sayımı Web Worker'ı: telefondan gelen H.264/JPEG kareleri çözer, parçaları sayar,
 * LabStock QR etiketlerini okur ve işaretli önizleme resmi üretir. Ağır iş burada döner ki
 * LabStock arayüzü takılmasın.
 *
 * Gelen mesajlar (pencereden):
 *   { tur: 'h264', bayrak, veri: ArrayBuffer }   bayrak: bit0 anahtar kare, bit1 yeni akış, bit2-3 döndürme
 *   { tur: 'jpeg', veri: ArrayBuffer }            canlı JPEG kare
 *   { tur: 'foto', veri: ArrayBuffer }            tam çözünürlüklü foto -> doğrudan sabit sayım
 *   { tur: 'mod', mod: 'kamera' | 'sayim' }   { tur: 'sabitle' }   { tur: 'coz' }
 *   { tur: 'onizleme', acik: bool }               PC panelinde canlı önizleme istensin mi
 *   { tur: 'dokun', x, y, amac }                  telefondaki resimde dokunulan nokta (0-1) -> o bölgenin ölçüsü
 *   { tur: 'olcek', pxMm, referans: {x, y} | null }  mm başına piksel (canlı kare ölçeğinde); referans sayılmaz
 *   { tur: 'birim', mm2 | null, px | null }       tek parça alanı: mm² (ölçekle) ya da doğrudan piksel
 * Giden mesajlar:
 *   { tur: 'hazir' }  { tur: 'sayim', adet, sabit, uyari }  { tur: 'qr', kodTur, id }
 *   { tur: 'tedarikci', kaynak, kod, mpn, adet, iz }  tedarikçi poşet etiketi (LCSC)
 *   { tur: 'dokunuldu', amac, alan, w, h, x, y, kac } | { tur: 'dokunuldu', amac, yok: true }
 *   { tur: 'resim', veri: ArrayBuffer(JPEG), sayim: bool }  { tur: 'anahtar' }  { tur: 'hata', mesaj }
 *   { tur: 'isaretler', bolgeler: [[x, y, w, h, kac]], referans: [x, y, w, h] | null }  (0-1, canlı sayım)
 */
/* global cv, jsQR, LabSayim */
importScripts('opencv.js', 'jsQR.js', 'sayim.js');

const CANLI_BOYUT = 1280; // canlı sayım karesinin uzun kenarı (hız için küçültülür)
const CANLI_ARALIK = 200; // ms, saniyede ~5 canlı sayım
const QR_ARALIK = 400; // QR tam çözünürlükte okunur (tedarikçi etiketleri küçük ve sık)
const QR_TEKRAR = 3000; // aynı QR bu kadar ms içinde tekrar okunursa yok sayılır
const ONIZLEME_GENISLIK = 720;
const ONIZLEME_ARALIK = 333;
const LSTK = /^LSTK:(P|K):([0-9a-fA-F-]{8,})$/;

let S = null; // { say, Sabitleyici }
let sabitleyici = null;
let mod = 'kamera';
let sabit = false;
let onizlemeAcik = false;
let sabitleIstek = null; // { kalan, sonuclar: [{ sonuc, img, olcek }] }

let cozucu = null;
let cozucuKodek = null;
let anahtarBekle = true;
let zaman = 0;
let akisDon = 0;

let sonKare = null; // { kare: VideoFrame | ImageBitmap, don }
let kareNo = 0; // her yeni karede artar (sabitleme aynı kareyi iki kez saymasın)
let mesgul = false;
let sonSayim = 0;
let sonQr = 0;
let sonOnizleme = 0;
let sonKod = null;
let sonKodZamani = 0;
let olcek = 1; // canlı sayım karesinin tam kareye oranı
let sonCanli = null; // son canlı sayım sonucu ve kare boyutu (dokunulan bölgeyi bulmak için)
let pxMm = null; // ölçek: canlı karede mm başına piksel (referansla ölçüldü)
let referans = null; // { x, y } 0-1: ölçek referansı (madeni para vb.) — sayılmaz
let birimMm2 = null; // öğretilmiş/girilmiş tek parça alanı (mm²)
let birimPx = null; // ölçek yokken öğretilen tek parça alanı (canlı kare pikseli)

function gonder(m, aktar) {
  self.postMessage(m, aktar || []);
}

// ---- OpenCV hazırlığı (opencv.js 5: cv bir Promise ya da onRuntimeInitialized bekleyen nesne olabilir)
(async () => {
  try {
    let c = self.cv;
    if (c instanceof Promise) c = await c;
    else if (!c.Mat) await new Promise((r) => (c.onRuntimeInitialized = r));
    self.cv = c;
    S = LabSayim.olustur(c);
    sabitleyici = new S.Sabitleyici();
    gonder({ tur: 'hazir' });
  } catch (e) {
    gonder({ tur: 'hata', mesaj: 'OpenCV yüklenemedi: ' + e });
  }
})();

// ---- H.264 çözme (WebCodecs)
function spsKodek(b) {
  // Annex B içinde SPS (NAL tipi 7): profil, uyumluluk, seviye -> avc1.PPCCLL
  for (let i = 0; i + 4 < b.length; i++) {
    if (b[i] === 0 && b[i + 1] === 0 && b[i + 2] === 1 && (b[i + 3] & 0x1f) === 7) {
      const h = (x) => x.toString(16).padStart(2, '0');
      return `avc1.${h(b[i + 4])}${h(b[i + 5])}${h(b[i + 6])}`;
    }
  }
  return null;
}

function cozucuKur(kodek) {
  if (cozucu) {
    try {
      cozucu.close();
    } catch (_) {}
  }
  cozucu = new VideoDecoder({
    output: (kare) => kareAl(kare, akisDon),
    error: (e) => {
      gonder({ tur: 'hata', mesaj: 'H.264 çözme: ' + e.message });
      cozucu = null;
      anahtarBekle = true;
      gonder({ tur: 'anahtar' });
    },
  });
  // 'prefer-hardware' donanım çözücü şart koşar; Linux'taki Electron'da H.264 için
  // donanım çözücü yok (yalnızca yazılım) ve çözücü hiç kurulamıyordu. 'no-preference'
  // varsa donanımı yine kullanır, yoksa yazılıma düşer.
  cozucu.configure({ codec: kodek, optimizeForLatency: true, hardwareAcceleration: 'no-preference' });
  cozucuKodek = kodek;
}

function h264(bayrak, veri) {
  const anahtar = !!(bayrak & 1);
  const yeni = !!(bayrak & 2);
  akisDon = (bayrak >> 2) & 3;
  const b = new Uint8Array(veri);
  if (yeni || !cozucu) {
    if (!anahtar) {
      if (!cozucu) gonder({ tur: 'anahtar' });
      return;
    }
    const kodek = spsKodek(b) || 'avc1.640033';
    if (yeni || !cozucu || kodek !== cozucuKodek) cozucuKur(kodek);
    anahtarBekle = false;
  }
  if (anahtarBekle && !anahtar) return;
  anahtarBekle = false;
  // Çözücü yetişemiyorsa eski kareleri biriktirme (gecikme artmasın): anahtar kareye kadar atla
  if (cozucu.decodeQueueSize > 8 && !anahtar) {
    anahtarBekle = true;
    gonder({ tur: 'anahtar' });
    return;
  }
  zaman += 33333;
  cozucu.decode(new EncodedVideoChunk({ type: anahtar ? 'key' : 'delta', timestamp: zaman, data: b }));
}

// ---- Kare alma ve işleme
function kareAl(kare, don) {
  if (sonKare) sonKare.kare.close();
  sonKare = { kare, don };
  kareNo++;
  isle();
}

/** Kareyi döndürerek ve ölçekleyerek bir tuvale çizer; { tuval, w, h } */
function ciz(kare, don, uzunKenar) {
  const kw = kare.displayWidth || kare.width;
  const kh = kare.displayHeight || kare.height;
  const donuk = don === 1 || don === 3;
  const tw = donuk ? kh : kw;
  const th = donuk ? kw : kh;
  const o = uzunKenar ? Math.min(1, uzunKenar / Math.max(tw, th)) : 1;
  const w = Math.round(tw * o);
  const h = Math.round(th * o);
  const sw = kw * o;
  const sh = kh * o;
  const tuval = new OffscreenCanvas(w, h);
  const c = tuval.getContext('2d', { willReadFrequently: true });
  // iPhone ham kareyi sensör yönünde (yatay) verir; telefonun bildirdiği döndürme burada uygulanır
  if (don === 1) {
    c.translate(w, 0);
    c.rotate(Math.PI / 2);
  } else if (don === 2) {
    c.translate(w, h);
    c.rotate(Math.PI);
  } else if (don === 3) {
    c.translate(0, h);
    c.rotate(-Math.PI / 2);
  }
  c.drawImage(kare, 0, 0, sw, sh);
  c.setTransform(1, 0, 0, 1, 0, 0);
  return { tuval, c, w, h, o };
}

async function isaretliGonder(tuval, w, h, sonuc, sayimMi) {
  // Önizleme: küçült, sayılan parçaları işaretle, JPEG yap
  const o = Math.min(1, ONIZLEME_GENISLIK / w);
  const pw = Math.round(w * o);
  const ph = Math.round(h * o);
  const t = new OffscreenCanvas(pw, ph);
  const c = t.getContext('2d');
  c.drawImage(tuval, 0, 0, pw, ph);
  if (sonuc && sonuc.referansKutusu) {
    const [x, y, bw, bh] = sonuc.referansKutusu;
    c.strokeStyle = '#3b82f6';
    c.lineWidth = Math.max(3, Math.round(pw / 240));
    c.beginPath();
    c.ellipse((x + bw / 2) * o, (y + bh / 2) * o, (bw / 2) * o + 4, (bh / 2) * o + 4, 0, 0, Math.PI * 2);
    c.stroke();
  }
  if (sonuc) {
    const kal = Math.max(2, Math.round(pw / 360));
    c.lineWidth = kal;
    c.font = `700 ${Math.round(pw / 26)}px system-ui, sans-serif`;
    for (const [x, y, bw, bh, , kac] of sonuc.bolgeler) {
      const renk = kac === 1 ? '#50dc50' : '#ffa500';
      c.strokeStyle = renk;
      c.strokeRect(x * o, y * o, bw * o, bh * o);
      if (kac > 1) {
        c.fillStyle = renk;
        c.fillText(`x${kac}`, x * o, Math.max(pw / 26, y * o - 4));
      }
    }
  }
  const blob = await t.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
  const veri = await blob.arrayBuffer();
  gonder({ tur: 'resim', veri, sayim: sayimMi }, [veri]);
}

/** LCSC poşet etiketi QR'ı: {pbn:...,on:...,pc:C25744,pm:0402WGF1002TCE,qty:100,...} */
function lcscCoz(metin) {
  if (!/^\{.*\bpc:C\d+.*\}$/s.test(metin)) return null;
  const alan = {};
  for (const parca of metin.slice(1, -1).split(',')) {
    const i = parca.indexOf(':');
    if (i > 0) alan[parca.slice(0, i).trim()] = parca.slice(i + 1).trim();
  }
  const adet = parseInt(alan.qty, 10);
  if (!/^C\d+$/.test(alan.pc || '') || !(adet > 0)) return null;
  return { kaynak: 'LCSC', kod: alan.pc, mpn: alan.pm || '', adet, iz: 'lcsc-' + ozet(metin) };
}

/** Etiket metninin kısa özeti (aynı etiket iki kez işlenmesin diye iz olarak saklanır). */
function ozet(metin) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < metin.length; i++) {
    const c = metin.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

function qrOku(c, w, h) {
  const img = c.getImageData(0, 0, w, h);
  const kod = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
  if (!kod) return;
  const metin = kod.data || '';
  const tedarikci = lcscCoz(metin);
  const m = tedarikci ? null : LSTK.exec(metin);
  if (!m && !tedarikci) return;
  const anahtar = tedarikci ? tedarikci.iz : m[1] + m[2];
  const simdi = Date.now();
  if (anahtar === sonKod && simdi - sonKodZamani < QR_TEKRAR) return;
  sonKod = anahtar;
  sonKodZamani = simdi;
  if (tedarikci) {
    gonder({ tur: 'tedarikci', ...tedarikci });
    return;
  }
  sabit = false;
  sabitleyici.sifirla();
  gonder({ tur: 'qr', kodTur: m[1], id: m[2] });
}

/** Sabit tek parça alanı (canlı kare pikseli): ölçek + mm² varsa ondan, yoksa öğretilen pikselden. */
function sabitBirim() {
  if (pxMm && birimMm2) return birimMm2 * pxMm * pxMm;
  return birimPx;
}

/** Referans nesnesini (madeni para) sonuçtan çıkarır; noktası referans içinde kalan bölge sayılmaz. */
function referansiCikar(sonuc, w, h) {
  if (!referans) return sonuc;
  const rx = referans.x * w;
  const ry = referans.y * h;
  const kalan = [];
  let cikan = null;
  for (const b of sonuc.bolgeler) {
    if (!cikan && rx >= b[0] && rx <= b[0] + b[2] && ry >= b[1] && ry <= b[1] + b[3]) cikan = b;
    else kalan.push(b);
  }
  if (cikan) {
    sonuc.bolgeler = kalan;
    sonuc.adet -= cikan[5];
    sonuc.referansKutusu = cikan;
  }
  return sonuc;
}

/** Telefonda dokunulan noktadaki bölge (son canlı sayımdan). */
function dokun(x, y, amac) {
  if (!sonCanli) return gonder({ tur: 'dokunuldu', amac, yok: true });
  const { sonuc, w, h } = sonCanli;
  const px = x * w;
  const py = y * h;
  let sec = null;
  for (const b of [...sonuc.bolgeler, ...(sonuc.referansKutusu ? [sonuc.referansKutusu] : [])]) {
    if (px >= b[0] && px <= b[0] + b[2] && py >= b[1] && py <= b[1] + b[3] && (!sec || b[4] < sec[4])) sec = b;
  }
  if (!sec) return gonder({ tur: 'dokunuldu', amac, yok: true });
  gonder({
    tur: 'dokunuldu',
    amac,
    alan: sec[4],
    w: sec[2],
    h: sec[3],
    x: (sec[0] + sec[2] / 2) / w,
    y: (sec[1] + sec[3] / 2) / h,
    kac: sec[5],
    pxMm,
  });
}

function ortanca(a) {
  const s = [...a].sort((x, y) => x - y);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

async function isle() {
  if (mesgul || !S || !sonKare) return;
  mesgul = true;
  try {
    const { kare, don } = sonKare;
    const simdi = Date.now();

    if (sabitleIstek && sabitleIstek.sonNo === kareNo) {
      // sabitleme sürüyor ama yeni kare henüz gelmedi: bekle
    } else if (sabitleIstek) {
      // "Sabitle": tam çözünürlükte art arda 3 FARKLI kare, ortanca
      sabitleIstek.sonNo = kareNo;
      const { tuval, c, w, h } = ciz(kare, don, 0);
      // Tek parça alanı: tam çözünürlüklü karenin kendi tahmini. Canlı sayımdan ölçeklenen değer
      // küçük karede ölçüldüğü için birkaç % sapabiliyor (bir bölge 2 parça sanılıyordu); sadece kendi
      // tahmini ondan %30'dan fazla saparsa (ör. parçaların çoğu birbirine değiyorsa) canlı değer kullanılır.
      const img = c.getImageData(0, 0, w, h);
      const sabitB = sabitBirim();
      let sonuc;
      if (sabitB) {
        sonuc = S.say(img, sabitB / (olcek * olcek)); // ölçekle/öğretilerek bilinen tek parça alanı
      } else {
        const canliBirim = sabitleyici.birim ? sabitleyici.birim / (olcek * olcek) : null;
        sonuc = S.say(img, null);
        const oran = canliBirim && sonuc.birimTahmin ? sonuc.birimTahmin / canliBirim : 1;
        if (oran < 0.7 || oran > 1.43) sonuc = S.say(img, canliBirim);
      }
      referansiCikar(sonuc, w, h);
      sabitleIstek.sonuclar.push({ sonuc, tuval, w, h });
      if (--sabitleIstek.kalan <= 0) {
        const adetler = sabitleIstek.sonuclar.map((x) => x.sonuc.adet);
        const orta = Math.trunc(ortanca(adetler));
        const sec = sabitleIstek.sonuclar.reduce((a, b) =>
          Math.abs(b.sonuc.adet - orta) < Math.abs(a.sonuc.adet - orta) ? b : a,
        );
        sec.sonuc.adet = orta;
        sabit = true;
        sabitleIstek = null;
        gonder({ tur: 'sayim', adet: orta, sabit: true, uyari: sec.sonuc.uyari, adetler, birim: sec.sonuc.birimAlan });
        await isaretliGonder(sec.tuval, sec.w, sec.h, sec.sonuc, true);
      }
    } else if (mod === 'sayim') {
      if (simdi - sonQr >= QR_ARALIK || (!sabit && simdi - sonSayim >= CANLI_ARALIK)) {
        if (simdi - sonQr >= QR_ARALIK) {
          sonQr = simdi;
          const tam = ciz(kare, don, 0);
          qrOku(tam.c, tam.w, tam.h);
        }
        if (!sabit && simdi - sonSayim >= CANLI_ARALIK) {
          const { tuval, c, w, h, o } = ciz(kare, don, CANLI_BOYUT);
          sonSayim = simdi;
          olcek = o;
          const sabitB = sabitBirim();
          const sonuc = referansiCikar(S.say(c.getImageData(0, 0, w, h), sabitB || sabitleyici.birim), w, h);
          sonCanli = { sonuc: { ...sonuc, bolgeler: [...sonuc.bolgeler] }, w, h };
          if (!sabitB) sonuc.adet = sabitleyici.guncelle(sonuc); // gösterilen sayı: son karelerin ortancası
          else sonuc.adet = sabitleyici.guncelle({ adet: sonuc.adet, birimTahmin: null });
          gonder({ tur: 'sayim', adet: sonuc.adet, sabit: false, uyari: sonuc.uyari });
          // Canlı sayımda telefona resim değil sadece işaretler gider: telefon kendi canlı
          // videosunu gösterip işaretleri üstüne çizer (resim beklerken görüntü donuyordu).
          const n = (v, b) => Math.round((v / b) * 10000) / 10000;
          gonder({
            tur: 'isaretler',
            bolgeler: sonuc.bolgeler.map(([x, y, bw, bh, , kac]) => [n(x, w), n(y, h), n(bw, w), n(bh, h), kac]),
            referans: sonuc.referansKutusu
              ? [n(sonuc.referansKutusu[0], w), n(sonuc.referansKutusu[1], h), n(sonuc.referansKutusu[2], w), n(sonuc.referansKutusu[3], h)]
              : null,
          });
          if (onizlemeAcik) await isaretliGonder(tuval, w, h, sonuc, false); // sadece PC panelindeki önizleme
        }
      }
    } else if (onizlemeAcik && simdi - sonOnizleme >= ONIZLEME_ARALIK) {
      sonOnizleme = simdi;
      const { tuval, w, h } = ciz(kare, don, ONIZLEME_GENISLIK);
      await isaretliGonder(tuval, w, h, null, false);
    }
  } catch (e) {
    gonder({ tur: 'hata', mesaj: String((e && e.message) || e) });
  } finally {
    mesgul = false;
  }
  // Sabitleme sürüyorsa ve bu arada yeni kare geldiyse hemen devam et (gelmediyse kareAl çağıracak)
  if (sabitleIstek && sabitleIstek.sonNo !== kareNo) setTimeout(isle, 0);
}

async function resimKaresi(veri, foto) {
  try {
    const bmp = await createImageBitmap(new Blob([veri]));
    if (foto) {
      // Tam çözünürlüklü foto: doğrudan tek kare sabit sayım (birim otomatik — çözünürlük farklı)
      const { tuval, c, w, h } = ciz(bmp, 0, 0);
      bmp.close();
      const sonuc = S.say(c.getImageData(0, 0, w, h), null);
      sabit = true;
      gonder({ tur: 'sayim', adet: sonuc.adet, sabit: true, uyari: sonuc.uyari, foto: true });
      await isaretliGonder(tuval, w, h, sonuc, true);
      return;
    }
    kareAl(bmp, 0);
  } catch (e) {
    gonder({ tur: 'hata', mesaj: 'Resim çözülemedi: ' + e });
  }
}

self.onmessage = (e) => {
  const m = e.data;
  switch (m.tur) {
    case 'h264':
      h264(m.bayrak, m.veri);
      break;
    case 'jpeg':
      resimKaresi(m.veri, false);
      break;
    case 'foto':
      if (S) resimKaresi(m.veri, true);
      break;
    case 'mod':
      mod = m.mod === 'sayim' ? 'sayim' : 'kamera';
      sabit = false;
      sabitleIstek = null;
      if (sabitleyici) sabitleyici.sifirla();
      break;
    case 'sabitle':
      sabitleIstek = { kalan: 3, sonuclar: [], sonNo: -1 };
      isle();
      break;
    case 'coz':
      sabit = false;
      sabitleIstek = null;
      if (sabitleyici) sabitleyici.sifirla();
      break;
    case 'onizleme':
      onizlemeAcik = !!m.acik;
      break;
    case 'dokun':
      dokun(Number(m.x), Number(m.y), m.amac);
      break;
    case 'olcek':
      pxMm = m.pxMm > 0 ? m.pxMm : null;
      referans = m.referans || null;
      if (sabitleyici) sabitleyici.sifirla();
      break;
    case 'birim':
      birimMm2 = m.mm2 > 0 ? m.mm2 : null;
      birimPx = m.px > 0 ? m.px : null;
      if (sabitleyici) sabitleyici.sifirla();
      break;
  }
};
