const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flikDesktop', {
    toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen')
});
