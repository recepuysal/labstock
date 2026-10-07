const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  guncellemeyiIndir: () => ipcRenderer.send('guncelleme-indir'),
  guncellemeyiKur: () => ipcRenderer.send('guncelleme-kur'),
  guncellemeleriKontrolEt: () => ipcRenderer.send('guncelleme-kontrol-et'),
  guncellemeDurumuDinle: (callback) => {
    const kanal = (_event, veri) => callback(veri);
    ipcRenderer.on('guncelleme-durumu', kanal);
    return () => ipcRenderer.removeListener('guncelleme-durumu', kanal);
  },
  surumAl: () => ipcRenderer.invoke('surum-al'),
  sifreKaydet: (sifre) => ipcRenderer.invoke('sifre-kaydet', sifre),
  sifreAl: () => ipcRenderer.invoke('sifre-al'),
  sifreSil: () => ipcRenderer.invoke('sifre-sil'),
  // Telefon kamerası (bkz. kamera.js)
  kamera: {
    baslat: () => ipcRenderer.invoke('kamera-baslat'),
    durdur: () => ipcRenderer.invoke('kamera-durdur'),
    durum: () => ipcRenderer.invoke('kamera-durum'),
    anahtariYenile: () => ipcRenderer.invoke('kamera-anahtar-yenile'),
    gonder: (veri) => ipcRenderer.send('kamera-gonder', veri),
    dinle: (callback) => {
      const kanal = (_event, olay) => callback(olay);
      ipcRenderer.on('kamera-olay', kanal);
      return () => ipcRenderer.removeListener('kamera-olay', kanal);
    },
  },
});
