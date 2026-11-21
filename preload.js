const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('app:config'),
  launchGame: () => ipcRenderer.invoke('game:launch'),
  detectGame: () => ipcRenderer.invoke('game:detect'),
  minimize: () => ipcRenderer.send('win:minimize'),
  close: () => ipcRenderer.send('win:close'),
});
