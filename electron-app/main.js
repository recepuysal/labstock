const { app, BrowserWindow, ipcMain, session, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const PORT = 4317;
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
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
  autoUpdater.autoDownload = false;
  // GitHub'ın sürüm listesi CDN üzerinden önbelleklenebiliyor — arka arkaya
  // sürüm çıkarınca bir öncekinin bir süre "en güncel" görünmesine yol açabilir.
  autoUpdater.requestHeaders = { 'Cache-Control': 'no-cache' };
  autoUpdater.checkForUpdates().catch((err) => logYaz(`[guncelleme-hata] ${err.message}`));
}

// GitHub release'inin gövdesi (releaseNotes) electron-updater'a string ya da
// {version, note}[] olarak gelebilir - ikisini de duz metne cevirir.
function notlariMetneCevir(releaseNotes) {
  if (!releaseNotes) return null;
  if (typeof releaseNotes === 'string') return releaseNotes;
  if (Array.isArray(releaseNotes)) {
    return releaseNotes.map((n) => n?.note).filter(Boolean).join('\n\n') || null;
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

ipcMain.handle('sifre-kaydet', (_event, sifre) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    fs.writeFileSync(sifreYolu, safeStorage.encryptString(sifre));
    return true;
  } catch (err) {
    logYaz(`[sifre-kaydet-hata] ${err.message}`);
    return false;
  }
});

ipcMain.handle('sifre-al', () => {
  try {
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(sifreYolu)) return null;
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

app.whenReady().then(() => {
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
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (cikisTemizlendi) return;
  event.preventDefault();
  session.defaultSession
    .clearStorageData({ storages: ['cookies'] })
    .catch((err) => logYaz(`[cikis-temizleme-hata] ${err.message}`))
    .finally(() => {
      cikisTemizlendi = true;
      app.quit();
    });
});
