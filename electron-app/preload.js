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
});
