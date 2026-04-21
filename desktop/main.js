'use strict';

const { app, BrowserWindow, Menu, Tray, shell, nativeTheme, ipcMain } = require('electron');
const path = require('path');
const { URL } = require('url');

// ── Security: disable remote module, keep nodeIntegration off ────────────────
app.disableHardwareAcceleration();           // battery/compat safety
// Only disable CORS enforcement in development; never in production
if (process.env.ELECTRON_ENV === 'development') {
  app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
}

const DEV  = process.env.ELECTRON_ENV === 'development';
const PORT = process.env.PORT || 3000;
const APP_URL = DEV ? `http://localhost:${PORT}` : null; // prod loads from bundled out/

let mainWindow = null;
let tray       = null;

// ── Allowed navigation origins ────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  `http://localhost:${PORT}`,
  'https://app.securevoult.com',
];

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1200,
    height: 800,
    minWidth:  900,
    minHeight: 600,
    backgroundColor: '#080d1a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    icon: getIconPath(),
    webPreferences: {
      preload:           path.join(__dirname, 'preload.js'),
      contextIsolation:  true,
      nodeIntegration:   false,
      sandbox:           true,
      webSecurity:       true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
    show: false, // show after ready-to-show to avoid flash
  });

  // Load app
  if (APP_URL) {
    mainWindow.loadURL(APP_URL);
  } else {
    // Static Next.js export
    mainWindow.loadFile(path.join(__dirname, '..', 'out', 'index.html'));
  }

  // Show only when fully loaded
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (DEV) mainWindow.webContents.openDevTools();
  });

  // Graceful fallback when the bundled export is missing (dev build not done yet)
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (errorCode === -6 || errorCode === -2) { // FILE_NOT_FOUND or FAILED
      mainWindow.webContents.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="utf-8"><title>SecureVoult — Not built yet</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                 background: #080d1a; color: #e2e8f0; display: flex; align-items: center;
                 justify-content: center; min-height: 100vh; margin: 0; text-align: center; }
          h1 { font-size: 20px; margin-bottom: 12px; }
          p  { font-size: 13px; color: #7a8ba8; max-width: 380px; line-height: 1.6; }
          code { background: #1e2d4a; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        </style></head>
        <body>
          <div>
            <h1>SecureVoult Desktop — In Development</h1>
            <p>The production build is not available yet.<br>
               Run <code>npm run build &amp;&amp; npx next export</code> in the project root first,<br>
               or start the dev server with <code>npm run desktop:dev</code>.</p>
          </div>
        </body></html>
      `)}`);
    }
  });

  // Block all external navigation — open in system browser instead
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const origin = new URL(url).origin;
    if (!ALLOWED_ORIGINS.includes(origin)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Block popups / new windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Tray ──────────────────────────────────────────────────────────────────────
function createTray() {
  const iconPath = getIconPath('tray');
  tray = new Tray(iconPath);
  tray.setToolTip('SecureVoult');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open SecureVoult', click: () => { if (mainWindow) mainWindow.show(); else createWindow(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { if (mainWindow) mainWindow.show(); });
}

// ── App menu ──────────────────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ]}] : []),
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
      { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { role: 'reload' },
      { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
      ...(DEV ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
    ]},
    { label: 'Window', submenu: [
      { role: 'minimize' },
      ...(isMac ? [{ role: 'zoom' }, { type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
    ]},
    { label: 'Help', submenu: [
      { label: 'SecureVoult on the web', click: () => shell.openExternal('https://securevoult.com') },
      { label: 'Security disclosure',    click: () => shell.openExternal('https://securevoult.com/security') },
    ]},
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getIconPath(variant = 'main') {
  const base = path.join(__dirname, 'icons');
  if (process.platform === 'win32')  return path.join(base, 'icon.ico');
  if (process.platform === 'darwin') return path.join(base, variant === 'tray' ? 'icon-tray.png' : 'icon.icns');
  return path.join(base, 'icon.png');
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
app.on('ready', () => {
  buildMenu();
  createWindow();
  if (process.platform !== 'darwin') createTray(); // macOS uses dock instead
});

app.on('window-all-closed', () => {
  // On macOS keep process alive until Cmd+Q
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// IPC — safe channel for renderer to request theme
ipcMain.handle('get-theme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
nativeTheme.on('updated', () => {
  if (mainWindow) mainWindow.webContents.send('theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
});
