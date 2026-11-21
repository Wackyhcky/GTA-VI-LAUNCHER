const $ = (sel) => document.querySelector(sel);

const barFill = $('#barFill');
const statusEl = $('#status');
const hintEl = $('#hint');

const gameError = $('#gameError');
const gameErrorTitle = $('#gameErrorTitle');
const gameErrorBody = $('#gameErrorBody');

let config = null;
let target = { ok: false };
let busy = false;
let ready = false;

const STEPS = [
  [0, 'CONNECTING TO LAUNCHER SERVICES\u2026'],
  [16, 'VERIFYING ENTITLEMENT\u2026'],
  [34, 'MOUNTING VICE CITY ASSETS\u2026'],
  [56, 'LOADING SCARLETT\u2026'],
  [78, 'SYNCING SOCIAL CLUB\u2026'],
  [100, 'READY'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readyState() {
  if (target && target.ok) {
    statusEl.textContent = 'BUILD 1.0.2.1 \u00B7 READY';
    hintEl.textContent = 'PRESS ENTER TO PLAY';
  } else {
    statusEl.textContent = 'GAME NOT INSTALLED \u2014 PRESS ENTER FOR DETAILS';
    hintEl.textContent = 'PRESS ENTER';
  }
  hintEl.classList.add('show');
}

async function boot() {
  config = await window.api.getConfig();
  target = config.gameTarget || { ok: false };

  document.title = config.title || 'GRAND THEFT AUTO VI';
  if (config.logoUrl) $('#brandIcon').src = config.logoUrl;

  for (const [pct, label] of STEPS) {
    barFill.style.width = pct + '%';
    statusEl.textContent = label;
    await sleep(340 + Math.random() * 220);
  }

  await sleep(260);
  ready = true;
  readyState();
}

/* ---------- errors ---------- */

function showGameError(res) {
  const reason = (res && res.reason) || 'unknown';

  if (reason === 'not-installed') {
    const tried = (res.tried || []).filter(Boolean);
    gameErrorTitle.textContent = 'GAME NOT FOUND';
    gameErrorBody.textContent =
      'Grand Theft Auto VI is not installed on this PC.\n\n' +
      (tried.length ? 'Tried:\n' + tried.join('\n') + '\n\n' : '') +
      'Set game.path in config.json, or install the game, then press R to rescan.';
  } else if (reason === 'spawn-failed') {
    gameErrorTitle.textContent = 'LAUNCH FAILED';
    gameErrorBody.textContent = (res.message || 'Unknown error') + (res.target ? '\n\n' + res.target : '');
  } else {
    gameErrorTitle.textContent = 'GAME NOT FOUND';
    gameErrorBody.textContent = 'No launch target is configured.';
  }

  gameError.hidden = false;
  hintEl.classList.remove('show');
}

function hideGameError() {
  gameError.hidden = true;
  readyState();
}

/* ---------- launch ---------- */

async function launch() {
  if (!target || !target.ok) {
    showGameError(target || { reason: 'not-installed' });
    return;
  }

  busy = true;
  hintEl.classList.remove('show');
  statusEl.textContent = 'LAUNCHING ' + String(target.label || 'GAME').toUpperCase() + '\u2026';

  const res = await window.api.launchGame();
  busy = false;

  if (res && res.ok && res.launched) {
    statusEl.textContent = 'GAME LAUNCHED \u00B7 HAVE FUN';
    hintEl.textContent = 'PRESS ENTER TO RELAUNCH';
    hintEl.classList.add('show');
    setTimeout(() => window.api.minimize(), 1400);
  } else {
    showGameError(res || {});
  }
}

async function rescan() {
  statusEl.textContent = 'SCANNING FOR INSTALL\u2026';
  hintEl.classList.remove('show');
  target = await window.api.detectGame();
  readyState();
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!gameError.hidden) hideGameError();
    return;
  }
  if ((e.key === 'Enter' || e.key === ' ') && !busy && ready) {
    e.preventDefault();
    if (!gameError.hidden) hideGameError();
    launch();
    return;
  }
  if ((e.key === 'r' || e.key === 'R') && !busy && ready) {
    e.preventDefault();
    if (!gameError.hidden) hideGameError();
    rescan();
  }
});

$('#btnMin').addEventListener('click', (e) => {
  e.stopPropagation();
  window.api.minimize();
});

$('#btnClose').addEventListener('click', (e) => {
  e.stopPropagation();
  window.api.close();
});

boot();
