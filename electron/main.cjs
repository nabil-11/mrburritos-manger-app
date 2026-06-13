'use strict';

const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// Register custom scheme BEFORE app is ready (required by Electron)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      allowServiceWorkers: true,
      corsEnabled: true,
    },
  },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Mr. Burritos Manager',
    backgroundColor: '#111111',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Remove default menu bar
  win.setMenu(null);

  // Show window only when ready to avoid flash
  win.once('ready-to-show', () => {
    win.show();
  });

  if (!app.isPackaged) {
    // Development: load from Vite dev server
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Production: load from built files via custom app:// protocol
    win.loadURL('app://localhost/');
  }
}

app.whenReady().then(() => {
  // Serve built app files via app:// protocol (production only)
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const distPath = path.join(app.getAppPath(), 'dist');

    // Root → index.html, otherwise strip leading slash
    const relPath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const filePath = path.join(distPath, relPath);

    return net.fetch(pathToFileURL(filePath).toString()).catch(() => {
      // SPA fallback: unknown paths serve index.html so React Router handles routing
      return net.fetch(
        pathToFileURL(path.join(distPath, 'index.html')).toString()
      );
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
