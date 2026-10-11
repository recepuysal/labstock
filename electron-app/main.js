const { app, BrowserWindow, ipcMain, session, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');
const { KameraSunucusu } = require('./kamera');

// LABSTOCK_PORT: kurulu uygulama açıkken yerel deneme sürümünü başka portta çalıştırmak için
const PORT = Number(process.env.LABSTOCK_PORT) || 4317;
let serverProcess;
let mainWindow;

const logPath = path.join(app.getPath('userData'), 'sunucu-log.txt');
function logYaz(msg) {
  try {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

function standaloneYolu() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'standalone', 'server.js')
    : path.join(__dirname, 'standalone', 'server.js');
}

function sunucuyuBaslat() {
  const yol = standaloneYolu();
  logYaz(`baslatiliyor: ${yol}, exists=${fs.existsSync(yol)}, execPath=${process.execPath}`);
  serverProcess = spawn(process.execPath, [yol], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      NODE_ENV: 'production',
      // Çevrimdışı mod (Ayarlar → Veri depolama): SQLite dosyası ve mod tercihi burada.
      LABSTOCK_VERI_DIZINI: app.getPath('userData'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  serverProcess.stdout.on('data', (d) => logYaz(`[stdout] ${d.toString().trim()}`));
  serverProcess.stderr.on('data', (d) => logYaz(`[stderr] ${d.toString().trim()}`));
  serverProcess.on('error', (err) => logYaz(`[spawn-error] ${err.message}`));
  serverProcess.on('exit', (code, signal) => logYaz(`[exit] code=${code} signal=${signal}`));
}

function sunucuHazirMi(callback, deneme = 0) {
  const istek = http
    .get(`http://127.0.0.1:${PORT}/`, () => callback())
    .on('error', () => {
      if (deneme > 100) return;
      setTimeout(() => sunucuHazirMi(callback, deneme + 1), 300);
    });
  istek.setTimeout(2000, () => istek.destroy());
}

function pencereyiAc() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    show: false,
    // Linux pencere/görev çubuğu simgesi .ico okuyamıyor
    icon: path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Windows/macOS işletim sisteminin kendi yazım denetimini kullanır; Linux'ta
      // Electron sözlüğü Google'ın sunucusundan indirir — gereksiz dış bağlantı.
      spellcheck: process.platform !== 'linux',
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault();
    mainWindow.setTitle(`LabStock v${app.getVersion()}`);
  });
  // Sayfa tam yenilenince (ör. çıkış/giriş) son güncelleme durumunu tekrar gönder —
  // ilk mesaj sayfa henüz hazır değilken gitmiş olabilir, kaybolmasın.
  mainWindow.webContents.on('did-finish-load', () => {
    if (sonDurum) renderereGonder(sonDurum);
  });
  mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
}

let sonDurum = null;
function renderereGonder(veri) {
  sonDurum = veri;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('guncelleme-durumu', veri);
  }
}

function guncellemeleriKontrolEt() {
  // Microsoft Store sürümünü Store günceller; GitHub'dan kendi kendine güncellemeye
  // çalışmak hem gereksiz hem de MSIX paketinde yazma izni olmadığı için başarısız olur.
  if (process.windowsStore) return;
  autoUpdater.autoDownload = false;
  // GitHub'ın sürüm listesi CDN üzerinden önbelleklenebiliyor — arka arkaya
  // sürüm çıkarınca bir öncekinin bir süre "en güncel" görünmesine yol açabilir.
  autoUpdater.requestHeaders = { 'Cache-Control': 'no-cache' };
  autoUpdater.checkForUpdates().catch((err) => logYaz(`[guncelleme-hata] ${err.message}`));
}

// electron-updater surum notlarini GitHub'in releases.atom feed'inden okuyor -
// bu feed'de govde markdown'dan HTML'e cevrilmis halde geliyor (ornegin
// "__NEXT_DATA__" gibi cift alt cizgiler kalin yazi olarak yorumlanip
// <strong>NEXT_DATA</strong>'ya donusuyor). Arayuzumuz duz metin gosterdigi
// icin etiketleri gercek satir/paragraf araligina cevirip temizliyoruz.
function htmlDuzMetneCevir(html) {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// GitHub release'inin gövdesi (releaseNotes) electron-updater'a string ya da
// {version, note}[] olarak gelebilir - ikisini de duz metne cevirir.
function notlariMetneCevir(releaseNotes) {
  if (!releaseNotes) return null;
  if (typeof releaseNotes === 'string') return htmlDuzMetneCevir(releaseNotes) || null;
  if (Array.isArray(releaseNotes)) {
    const parcalar = releaseNotes.map((n) => htmlDuzMetneCevir(n?.note ?? '')).filter(Boolean);
    return parcalar.length > 0 ? parcalar.join('\n\n') : null;
  }
  return null;
}

autoUpdater.on('update-available', (bilgi) => {
  logYaz(`[guncelleme] bulundu: ${bilgi.version}`);
  renderereGonder({ tip: 'mevcut', versiyon: bilgi.version, notlar: notlariMetneCevir(bilgi.releaseNotes) });
});

autoUpdater.on('download-progress', (ilerleme) => {
  renderereGonder({ tip: 'ilerleme', yuzde: Math.round(ilerleme.percent) });
});

autoUpdater.on('update-downloaded', (bilgi) => {
  logYaz(`[guncelleme] indirildi: ${bilgi.version}`);
  renderereGonder({ tip: 'hazir', versiyon: bilgi.version, notlar: notlariMetneCevir(bilgi.releaseNotes) });
});

autoUpdater.on('error', (err) => {
  logYaz(`[guncelleme-hata] ${err.message}`);
  renderereGonder({ tip: 'hata', mesaj: err.message });
});

ipcMain.on('guncelleme-indir', () => autoUpdater.downloadUpdate());
ipcMain.on('guncelleme-kur', () => autoUpdater.quitAndInstall(true, true));
ipcMain.on('guncelleme-kontrol-et', () => guncellemeleriKontrolEt());
ipcMain.handle('surum-al', () => app.getVersion());

// "Beni hatırla" için şifreyi işletim sisteminin kendi kasasıyla (Windows'ta
// DPAPI) şifreleyip diske yazar — düz metin localStorage'a yazmaktan farklı
// olarak sadece bu Windows kullanıcı hesabı çözebilir.
const sifreYolu = path.join(app.getPath('userData'), 'sifre.dat');

// Linux'ta anahtar zinciri (GNOME Keyring / KWallet) yoksa Electron sabit bir anahtarla
// "şifreler" (basic_text) — bu gerçek koruma değil, o durumda şifreyi hiç kaydetmiyoruz.
function guvenliKasaVarMi() {
  if (!safeStorage.isEncryptionAvailable()) return false;
  return process.platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text';
}

ipcMain.handle('sifre-kaydet', (_event, sifre) => {
  try {
    if (!guvenliKasaVarMi()) return false;
    fs.writeFileSync(sifreYolu, safeStorage.encryptString(sifre));
    return true;
  } catch (err) {
    logYaz(`[sifre-kaydet-hata] ${err.message}`);
    return false;
  }
});

ipcMain.handle('sifre-al', () => {
  try {
    if (!guvenliKasaVarMi() || !fs.existsSync(sifreYolu)) return null;
    return safeStorage.decryptString(fs.readFileSync(sifreYolu));
  } catch (err) {
    logYaz(`[sifre-al-hata] ${err.message}`);
    return null;
  }
});

ipcMain.handle('sifre-sil', () => {
  try {
    if (fs.existsSync(sifreYolu)) fs.unlinkSync(sifreYolu);
    return true;
  } catch (err) {
    logYaz(`[sifre-sil-hata] ${err.message}`);
    return false;
  }
});

// ---- Dil (Türkçe / İngilizce)
// LabStock'un dili `labstock-dil` çerezindedir (Next tarafı yazar; bkz. src/lib/i18n). Çerez
// yoksa sistem dili: Türkçe ise 'tr', değilse 'en'. Next sunucusu çerez yokken Accept-Language
// başlığına bakar; Electron bunu sistem diline göre kendisi gönderir, burada değiştirilmiyor.
// Ana süreç dili sadece telefon sayfası ve kamera sunucusunun hata metinleri için kullanır.
const DIL_COOKIE = 'labstock-dil';
let dil = 'tr';

function sistemDili() {
  return (app.getLocale() || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

async function diliGuncelle() {
  let yeni = sistemDili();
  try {
    const cerezler = await session.defaultSession.cookies.get({ name: DIL_COOKIE });
    const deger = cerezler.find((c) => c.value === 'tr' || c.value === 'en')?.value;
    if (deger) yeni = deger;
  } catch (err) {
    logYaz(`[dil-hata] ${err.message}`);
  }
  if (yeni !== dil) {
    dil = yeni;
    kamera.dilDegisti(); // bağlı telefon sayfayı yeni dille yeniler
  }
}

// ---- Telefon kamerası: sunucu ana süreçte, görüntü işleme pencerede (Web Worker)
const kamera = new KameraSunucusu({
  ayarKlasoru: app.getPath('userData'),
  sayfaYolu: path.join(__dirname, 'kamera', 'telefon.html'),
  log: logYaz,
  dil: () => dil,
  olay: (tur, veri) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('kamera-olay', { tur, veri });
  },
});
ipcMain.handle('kamera-baslat', async () => {
  try {
    return { ok: true, ...(await kamera.baslat()) };
  } catch (err) {
    logYaz(`[kamera-hata] ${err.message}`);
    return { ok: false, hata: err.message, ...kamera.durum() };
  }
});
ipcMain.handle('kamera-durdur', () => ({ ok: true, ...kamera.durdur() }));
ipcMain.handle('kamera-durum', () => kamera.durum());
ipcMain.handle('kamera-anahtar-yenile', () => kamera.anahtariYenile());
ipcMain.on('kamera-gonder', (_event, veri) => kamera.gonder(veri));

app.whenReady().then(async () => {
  // Uygulama her zaman kullanıcının kendi deposuyla açılsın: önceki oturum düzgün
  // kapanmadıysa (çökme, zorla kapatma) before-quit temizliği çalışmamış olabilir ve
  // izlenen depo seçimi (labstock_gorunum) bir sonraki açılışa taşınırdı.
  await session.defaultSession.cookies
    .remove(`http://127.0.0.1:${PORT}/`, 'labstock_gorunum')
    .catch((err) => logYaz(`[gorunum-temizleme-hata] ${err.message}`));
  diliGuncelle();
  session.defaultSession.cookies.on('changed', (_event, cerez) => {
    if (cerez.name === DIL_COOKIE) diliGuncelle();
  });
  sunucuyuBaslat();
  sunucuHazirMi(() => {
    pencereyiAc();
    guncellemeleriKontrolEt();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// Uygulama kapanınca oturumu da kapat: çerezleri temizlemeden çıkmıyoruz,
// bir sonraki açılışta tekrar giriş ekranı gelsin.
let cikisTemizlendi = false;
app.on('before-quit', (event) => {
  kamera.durdur();
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (cikisTemizlendi) return;
  event.preventDefault();
  const cerezler = session.defaultSession.cookies;
  // Dil tercihi oturum değil: çerezler silinse de bir sonraki açılışta aynı dille açılsın
  cerezler
    .get({ name: DIL_COOKIE })
    .catch(() => [])
    .then((dilCerezleri) =>
      session.defaultSession
        .clearStorageData({ storages: ['cookies'] })
        .then(() =>
          Promise.all(
            dilCerezleri.map((c) =>
              cerezler.set({
                url: `http://${(c.domain || '127.0.0.1').replace(/^\./, '')}${c.path || '/'}`,
                name: c.name,
                value: c.value,
                path: c.path || '/',
                httpOnly: !!c.httpOnly,
                sameSite: c.sameSite && c.sameSite !== 'unspecified' ? c.sameSite : 'lax',
                expirationDate: c.expirationDate || Date.now() / 1000 + 5 * 365 * 24 * 3600,
              }),
            ),
          ),
        )
        .then(() => cerezler.flushStore()),
    )
    .catch((err) => logYaz(`[cikis-temizleme-hata] ${err.message}`))
    .finally(() => {
      cikisTemizlendi = true;
      app.quit();
    });
});
