'use strict';

// Preload script — runs in renderer context but with Node access sandboxed.
// Exposes only a minimal, typed API to the renderer via contextBridge.
// contextIsolation: true + nodeIntegration: false = no Node in renderer.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Theme
  getTheme:       ()          => ipcRenderer.invoke('get-theme'),
  onThemeChanged: (callback)  => {
    const listener = (_event, theme) => callback(theme);
    ipcRenderer.on('theme-changed', listener);
    // Return cleanup function
    return () => ipcRenderer.removeListener('theme-changed', listener);
  },

  // Platform info (read-only)
  platform: process.platform,  // 'win32' | 'darwin' | 'linux'
});
