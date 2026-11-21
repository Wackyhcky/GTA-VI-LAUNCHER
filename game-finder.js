const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const GAME_TITLE = 'Grand Theft Auto VI';
const DRIVES = 'CDEFGHIJKLMNOPQRSTUVWXYZ';

function fileExists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function resolvePath(root, p) {
  if (!p) return '';
  return path.isAbsolute(p) ? p : path.join(root, p);
}

/** Steam root folders: from the registry plus every drive's usual layout. */
function steamRoots() {
  const roots = new Set();

  try {
    const out = execFileSync(
      'reg',
      ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'],
      { encoding: 'utf8', windowsHide: true }
    );
    const m = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (m) roots.add(m[1].trim().replace(/\//g, '\\'));
  } catch {
    /* registry unavailable */
  }

  for (const d of DRIVES) {
    roots.add(`${d}:\\SteamLibrary`);
    roots.add(`${d}:\\Program Files (x86)\\Steam`);
    roots.add(`${d}:\\Steam`);
  }

  return [...roots];
}

/** Every steamapps folder we can find, including extra library folders. */
function steamLibraries(roots) {
  const libs = new Set();

  for (const root of roots || steamRoots()) {
    const apps = path.join(root, 'steamapps');
    if (!fs.existsSync(apps)) continue;

    libs.add(root);

    const vdf = path.join(apps, 'libraryfolders.vdf');
    try {
      const txt = fs.readFileSync(vdf, 'utf8');
      for (const m of txt.matchAll(/"path"\s+"([^"]+)"/g)) {
        libs.add(m[1].replace(/\\\\/g, '\\'));
      }
    } catch {
      /* no libraryfolders.vdf */
    }
  }

  return [...libs];
}

function findSteamGame(roots) {
  for (const lib of steamLibraries(roots)) {
    const apps = path.join(lib, 'steamapps');
    let entries = [];
    try {
      entries = fs.readdirSync(apps);
    } catch {
      continue;
    }

    for (const file of entries) {
      const m = file.match(/^appmanifest_(\d+)\.acf$/);
      if (!m) continue;

      let txt;
      try {
        txt = fs.readFileSync(path.join(apps, file), 'utf8');
      } catch {
        continue;
      }

      if (!new RegExp(`"name"\\s+"${GAME_TITLE}"`, 'i').test(txt)) continue;

      const dir = (txt.match(/"installdir"\s+"([^"]+)"/i) || [])[1];
      return {
        appid: m[1],
        installDir: dir ? path.join(apps, 'common', dir) : '',
      };
    }
  }

  return null;
}

function findXboxGame(bases) {
  const roots = bases || [...DRIVES].map((d) => `${d}:\\XboxGames`);

  for (const base of roots) {
    if (!fs.existsSync(base)) continue;

    let titles = [];
    try {
      titles = fs.readdirSync(base);
    } catch {
      continue;
    }

    for (const title of titles) {
      if (!/grand theft auto vi/i.test(title)) continue;

      const content = path.join(base, title, 'Content');
      if (!fs.existsSync(content)) continue;

      let exes = [];
      try {
        exes = fs.readdirSync(content).filter((f) => /\.exe$/i.test(f));
      } catch {
        continue;
      }

      const found = exes
        .map((f) => path.join(content, f))
        .filter(fileExists)
        .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];

      if (found) return found;
    }
  }

  return null;
}

/**
 * Decide how to start the game.
 * Priority: explicit AUMID -> explicit exe path -> Steam manifest -> XboxGames folder.
 */
function resolveGame(cfg, root) {
  const g = (cfg && cfg.game) || {};
  const tried = [];

  if (g.aumid) {
    return { ok: true, mode: 'aumid', target: g.aumid, label: 'Microsoft Store app' };
  }

  if (g.path) {
    const p = resolvePath(root, g.path);
    tried.push(p);
    if (fileExists(p)) {
      return { ok: true, mode: 'exe', target: p, label: path.basename(p) };
    }
  }

  const steam = findSteamGame();
  if (steam) {
    return {
      ok: true,
      mode: 'steam',
      target: `steam://rungameid/${steam.appid}`,
      label: `Steam app ${steam.appid}`,
      installDir: steam.installDir,
    };
  }

  const xbox = findXboxGame();
  if (xbox) {
    return { ok: true, mode: 'exe', target: xbox, label: path.basename(xbox) };
  }

  return { ok: false, reason: 'not-installed', tried };
}

module.exports = { resolveGame, findSteamGame, findXboxGame, steamLibraries };
