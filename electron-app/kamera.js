// Telefon kamerası sunucusu (Electron ana süreci).
//
// Telefon, aynı Wi-Fi'daki bu bilgisayara https://<ip>:8443 ile bağlanır; sayfa kamerayı açıp
// görüntüyü WebSocket üzerinden H.264 (ya da JPEG) olarak gönderir. Bu modül sadece aracıdır:
// gelen kareleri LabStock penceresine (IPC) iletir, pencereden gelen mesajları telefona yollar.
// Görüntü işleme pencerede (Web Worker) yapılır.
//
// Güvenlik: sunucu sadece kullanıcı "Telefon kamerası"nı açınca çalışır. Telefon, LabStock'ta
// gösterilen QR'daki eşleşme anahtarı olmadan bağlanamaz.
const https = require('https');
const dgram = require('dgram');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const selfsigned = require('selfsigned');

const PORT = 8443;
const TIP_KARE = 1; // JPEG kare
const TIP_FOTO = 2; // tam çözünürlüklü foto
const TIP_H264 = 3; // H.264 kare

/** Bu bilgisayarın yerel ağdaki IP'si (varsayılan rotanın çıktığı arayüz). */
function yerelIp() {
  return new Promise((coz) => {
    const s = dgram.createSocket('udp4');
    s.on('error', () => coz(yedekIp()));
    try {
      s.connect(80, '8.8.8.8', () => {
        // paket gönderilmez, sadece çıkış arayüzü bulunur
        const ip = s.address().address;
        s.close();
        coz(ip && ip !== '0.0.0.0' ? ip : yedekIp());
      });
    } catch {
      coz(yedekIp());
    }
  });
}
function yedekIp() {
  for (const arayuzler of Object.values(os.networkInterfaces())) {
    for (const a of arayuzler || []) if (a.family === 'IPv4' && !a.internal) return a.address;
  }
  return '127.0.0.1';
}

class KameraSunucusu {
  /** @param {{ ayarKlasoru: string, sayfaYolu: string, olay: (tur: string, veri: any) => void, log?: (m: string) => void, port?: number }} p */
  constructor({ ayarKlasoru, sayfaYolu, olay, log, port = PORT }) {
    this.port = port;
    this.ayarYolu = path.join(ayarKlasoru, 'kamera.json');
    this.sayfaYolu = sayfaYolu;
    this.olay = olay;
    this.log = log || (() => {});
    this.sunucu = null;
    this.wss = null;
    this.telefon = null;
    this.ip = null;
  }

  ayarlariOku() {
    try {
      return JSON.parse(fs.readFileSync(this.ayarYolu, 'utf8'));
    } catch {
      return {};
    }
  }
  ayarlariYaz(a) {
    fs.writeFileSync(this.ayarYolu, JSON.stringify(a));
  }

  /** Eşleşme anahtarı (QR'da telefona verilir). Yoksa üretilir. */
  anahtar() {
    const a = this.ayarlariOku();
    if (!a.anahtar) {
      a.anahtar = crypto.randomBytes(18).toString('base64url');
      this.ayarlariYaz(a);
    }
    return a.anahtar;
  }

  /** Eski eşleşmeleri geçersiz kılar (bağlı telefon da düşer). */
  anahtariYenile() {
    const a = this.ayarlariOku();
    a.anahtar = crypto.randomBytes(18).toString('base64url');
    this.ayarlariYaz(a);
    if (this.telefon) this.telefon.close(4001, 'eslesme yenilendi');
    return this.durum();
  }

  /** Telefon tarayıcısı kamera için HTTPS ister: IP'ye özel, kendinden imzalı sertifika.
   * iOS kuralları: en fazla 825 gün, SAN'da IP, serverAuth — yoksa Safari sayfayı hiç açmaz. */
  async sertifika(ip) {
    const a = this.ayarlariOku();
    const s = a.sertifika;
    if (s && s.ip === ip && s.bitis > Date.now() + 7 * 864e5) return s;
    const simdi = new Date();
    const bitis = new Date(simdi.getTime() + 800 * 864e5);
    const pem = await selfsigned.generate([{ name: 'commonName', value: 'LabStock Kamera' }], {
      keySize: 2048,
      algorithm: 'sha256',
      notBeforeDate: new Date(simdi.getTime() - 864e5),
      notAfterDate: bitis,
      extensions: [
        { name: 'basicConstraints', cA: false, critical: true },
        { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
        { name: 'extKeyUsage', serverAuth: true },
        { name: 'subjectAltName', altNames: [{ type: 7, ip }] },
      ],
    });
    a.sertifika = { ip, cert: pem.cert, key: pem.private, bitis: bitis.getTime() };
    this.ayarlariYaz(a);
    this.log(`[kamera] yeni sertifika: ${ip}`);
    return a.sertifika;
  }

  durum() {
    const acik = !!this.sunucu;
    return {
      acik,
      ip: this.ip,
      port: this.port,
      // Telefon bu adresi QR'dan açar; anahtar # sonrasında olduğu için sunucuya istek olarak gitmez
      adres: acik ? `https://${this.ip}:${this.port}/#k=${this.anahtar()}` : null,
      telefon: !!this.telefon,
    };
  }

  async baslat() {
    if (this.sunucu) return this.durum();
    this.ip = await yerelIp();
    const s = await this.sertifika(this.ip);
    const sayfa = fs.readFileSync(this.sayfaYolu, 'utf8');
    const surum = crypto.createHash('md5').update(sayfa).digest('hex').slice(0, 8);
    const govde = Buffer.from(sayfa.replace('__SURUM__', surum), 'utf8');
    this.surum = surum;

    const sunucu = https.createServer({ cert: s.cert, key: s.private || s.key }, (istek, yanit) => {
      if (istek.method === 'GET' && (istek.url === '/' || istek.url.startsWith('/?'))) {
        yanit.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Length': govde.length,
          'Cache-Control': 'no-store',
        });
        return yanit.end(govde);
      }
      yanit.writeHead(404);
      yanit.end();
    });

    this.wss = new WebSocketServer({ noServer: true, maxPayload: 50 * 1024 * 1024, perMessageDeflate: false });
    sunucu.on('upgrade', (istek, soket, bas) => {
      const url = new URL(istek.url, 'https://x');
      const gelen = Buffer.from(url.searchParams.get('k') || '');
      const beklenen = Buffer.from(this.anahtar());
      const dogru = url.pathname === '/ws' && gelen.length === beklenen.length && crypto.timingSafeEqual(gelen, beklenen);
      if (!dogru) {
        // Eşleşmeyen cihaz: bağlantıyı kur ama 4001 ile kapat ki telefon "QR'ı yeniden okut" desin
        this.wss.handleUpgrade(istek, soket, bas, (ws) => ws.close(4001, 'eslesme gecersiz'));
        this.log(`[kamera] eşleşmesiz bağlantı reddedildi: ${istek.socket.remoteAddress}`);
        return;
      }
      this.wss.handleUpgrade(istek, soket, bas, (ws) => this.telefonBaglandi(ws, istek.socket.remoteAddress));
    });

    await new Promise((coz, reddet) => {
      sunucu.once('error', reddet);
      sunucu.listen(this.port, '0.0.0.0', () => {
        sunucu.off('error', reddet);
        coz();
      });
    }).catch((e) => {
      this.wss.close();
      this.wss = null;
      throw new Error(e.code === 'EADDRINUSE' ? `${this.port} portu kullanımda (başka bir kamera programı açık olabilir)` : e.message);
    });
    this.sunucu = sunucu;
    this.log(`[kamera] sunucu açıldı: https://${this.ip}:${this.port}`);
    this.olay('durum', this.durum());
    return this.durum();
  }

  telefonBaglandi(ws, uzak) {
    if (this.telefon) this.telefon.close(4002, 'baska telefon baglandi'); // tek telefon
    this.telefon = ws;
    this.log(`[kamera] telefon bağlandı: ${uzak}`);
    ws.send(JSON.stringify({ surum: this.surum }));
    this.olay('durum', this.durum());

    ws.on('message', (veri, ikili) => {
      if (!ikili) {
        try {
          this.olay('metin', JSON.parse(veri.toString('utf8')));
        } catch {}
        return;
      }
      const tip = veri[0];
      // Hemen onayla: telefon akış kontrolünü buna göre yapıyor (işlenmesini beklemeden)
      if (tip === TIP_KARE || tip === TIP_H264) ws.send('{"ack":1}');
      if (tip === TIP_KARE || tip === TIP_H264 || tip === TIP_FOTO) this.olay('ikili', veri);
    });
    ws.on('close', () => {
      if (this.telefon === ws) {
        this.telefon = null;
        this.log(`[kamera] telefon ayrıldı: ${uzak}`);
        this.olay('durum', this.durum());
      }
    });
    ws.on('error', (e) => this.log(`[kamera] ws hata: ${e.message}`));
  }

  /** Pencereden telefona: nesne -> JSON, Uint8Array/Buffer -> ikili. */
  gonder(veri) {
    const ws = this.telefon;
    if (!ws || ws.readyState !== ws.OPEN) return false;
    if (veri instanceof Uint8Array) ws.send(Buffer.from(veri.buffer, veri.byteOffset, veri.byteLength));
    else ws.send(typeof veri === 'string' ? veri : JSON.stringify(veri));
    return true;
  }

  durdur() {
    if (this.telefon) this.telefon.close(1001, 'sunucu kapandi');
    this.telefon = null;
    if (this.wss) this.wss.close();
    this.wss = null;
    if (this.sunucu) this.sunucu.close();
    this.sunucu = null;
    this.log('[kamera] sunucu kapandı');
    this.olay('durum', this.durum());
    return this.durum();
  }
}

module.exports = { KameraSunucusu, PORT };
