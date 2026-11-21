const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { resolveGame } = require('./game-finder');

const ROOT = __dirname;
const SCREENSHOT = process.argv.includes('--screenshot');

function readJson(file) {
  // Notepad / PowerShell often save UTF-8 with a BOM, which JSON.parse rejects.
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(text);
}

function loadConfig() {
  const cfg = {
    title: 'GRAND THEFT AUTO VI',
    logo: 'assets/logo.png',
    game: { path: '', args: [], cwd: '', aumid: '' },
  };

  try {
    const raw = readJson(path.join(ROOT, 'config.json'));
    const game = Object.assign({}, cfg.game, raw.game || {});
    Object.assign(cfg, raw);
    cfg.game = game;
  } catch {
    /* keep defaults */
  }

  const logoPath = path.isAbsolute(cfg.logo) ? cfg.logo : path.join(ROOT, cfg.logo);
  cfg.logoUrl = fs.existsSync(logoPath) ? pathToFileURL(logoPath).href : '';

  return cfg;
}

function launchGame(cfg, target) {
  const g = cfg.game || {};

  if (target.mode === 'exe') {
    const cwd = g.cwd
      ? (path.isAbsolute(g.cwd) ? g.cwd : path.join(ROOT, g.cwd))
      : path.dirname(target.target);

    const child = spawn(target.target, Array.isArray(g.args) ? g.args : [], {
      cwd,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return;
  }

  // steam:// and shell:appsFolder\... both go through the shell handler.
  const uri = target.mode === 'steam' ? target.target : `shell:appsFolder\\${target.target}`;
  const child = spawn('explorer.exe', [uri], { detached: true, stdio: 'ignore' });
  child.unref();
}

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 576,
    frame: false,
    show: false,
    backgroundColor: '#07030c',
    icon: path.join(ROOT, 'assets', 'logo.png'),
    webPreferences: {
      preload: path.join(ROOT, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // keep the boot animation running if the splash loses focus
      backgroundThrottling: false,
    },
  });

  win.loadFile(path.join(ROOT, 'renderer', 'index.html'));

  win.webContents.on('console-message', (_e, level, message) => {
    console.log(`[renderer:${level}] ${message}`);
  });

  win.once('ready-to-show', () => {
    win.show();
    if (SCREENSHOT) {
      setTimeout(async () => {
        try {
          const image = await win.webContents.capturePage();
          fs.writeFileSync(path.join(ROOT, 'screenshot.png'), image.toPNG());
        } catch (err) {
          console.error(err);
        }
        app.quit();
      }, 6500);
    }
  });

  win.on('closed', () => {
    win = null;
  });
}

ipcMain.handle('app:config', () => {
  const cfg = loadConfig();
  cfg.gameTarget = resolveGame(cfg, ROOT);
  return cfg;
});

ipcMain.handle('game:detect', () => resolveGame(loadConfig(), ROOT));

ipcMain.handle('game:launch', () => {
  const cfg = loadConfig();
  const target = resolveGame(cfg, ROOT);

  if (!target.ok) return target;

  try {
    launchGame(cfg, target);
    return Object.assign({}, target, { launched: true });
  } catch (err) {
    return {
      ok: false,
      reason: 'spawn-failed',
      message: String((err && err.message) || err),
      target: target.target,
    };
  }
});

ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:close', () => win && win.close());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
