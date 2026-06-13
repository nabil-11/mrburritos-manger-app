'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal safe API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  // Sound control — played by the main process to bypass all renderer audio policies
  playSound: () => ipcRenderer.invoke('sound:play'),
  stopSound: () => ipcRenderer.invoke('sound:stop'),
});
