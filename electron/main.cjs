'use strict';

const { app, BrowserWindow, protocol, net, ipcMain } = require('electron');
const path      = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');

// Allow Web Audio API without requiring a prior user gesture.
// This is a desktop manager app, so the browser autoplay policy is irrelevant.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

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

// ─── Sound: played from main process to bypass ALL renderer audio policies ────
// We spin up a PowerShell process that loops the MP3 using Windows MediaPlayer.
// Killing the process stops the sound instantly.
let soundProc = null;

function getSoundPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'dist', 'notification.mp3')
    : path.join(__dirname, '..', 'public', 'notification.mp3');
}

function killSound() {
  if (soundProc) {
    try { soundProc.kill('SIGKILL'); } catch {}
    soundProc = null;
  }
}

ipcMain.handle('sound:play', () => {
  killSound(); // stop any previous ring first

  // Convert Windows path → file:///C:/... URI that .NET MediaPlayer understands
  const fileUri = 'file:///' + getSoundPath().replace(/\\/g, '/');

  // Use System.Windows.Media.MediaPlayer (presentationCore / WPF) which ships
  // with every Windows 10/11 install — far more reliable than WMPlayer.OCX.7.
  // The loop runs every 200 ms; when the track ends it resets and replays.
  const ps = `
Add-Type -AssemblyName presentationCore
$p = New-Object System.Windows.Media.MediaPlayer
$p.Open([System.Uri]'${fileUri}')
Start-Sleep -Milliseconds 400
$p.Play()
$end = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $end) {
  Start-Sleep -Milliseconds 200
  if ($p.NaturalDuration.HasTimeSpan -and $p.Position -ge ($p.NaturalDuration.TimeSpan - [TimeSpan]::FromMilliseconds(300))) {
    $p.Position = [TimeSpan]::Zero
    $p.Play()
  }
}
$p.Close()
`;

  soundProc = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', ps], {
    detached: false,
    stdio:    'ignore',
  });

  soundProc.on('error', (err) => {
    console.error('[Sound] PowerShell error:', err.message);
    soundProc = null;
  });
});

ipcMain.handle('sound:stop', () => {
  killSound();
});

// Clean up sound if the window is closed
app.on('before-quit', killSound);

// ─── Window ────────────────────────────────────────────────────────────────────
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
  killSound();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
