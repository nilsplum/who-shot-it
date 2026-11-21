/**
 * The browser app's controller: boots, joins and leaves rooms, handles every tap, keeps
 * the photo choice in step with the room, and repaints.
 *
 * Mechanisms:
 * - Boot: `/<CODE>` either rejoins the room this device is in (reload, or the return
 *   from the iPhone shortcut) or shows the one-tap join screen of an invite link.
 * - In a room, `RoomSocket` delivers the player's view; every view replaces
 *   `session.view`, preloads the round's and the next round's photo, acknowledges a
 *   loaded photo (`loaded`), and repaints. Actions are sent as small messages; the server
 *   decides what happens.
 * - Rendering: `screen()` picks the view for the current state and `createPainter`
 *   repaints only what changed, four times a second and after every change. The timer bar
 *   is animated every frame from `session.clock`.
 *
 * Invariants:
 * - The browser never decides game outcomes: it shows only what the view says, and an
 *   optimistic answer (`session.pick`) is replaced by the room's own as soon as it comes.
 * - All taps go through `data-act` and the `ACTIONS` table; sheets are the only dialogs.
 */

import { CLOSE } from '../shared/api.js';
import { APP, EMOJIS, LIMITS, REACTIONS, TIMING, isRoomCode, normalizeSetting } from '../shared/config.js';
import { createRoom, takePool, uploadPhotos } from './api.js';
import { RoomSocket } from './connection.js';
import { keepAwake } from './device.js';
import { startEffect, stopEffects } from './effects.js';
import { clearPhotos, isImageFile, photos, readyBlobs, roll, setCandidates } from './photos.js';
import { createPainter } from './render.js';
import { device, saveDevice, session } from './store.js';
import { floatEmoji, toast } from './ui.js';
import { endScreen } from './views/end.js';
import { gameScreen } from './views/game.js';
import { homeScreen } from './views/home.js';
import { lobbyScreen } from './views/lobby.js';
import { awayScreen, bannerHtml, countdownHtml, joiningScreen } from './views/overlays.js';
import { sheetScreen } from './views/sheets.js';

const $ = (id) => document.getElementById(id);
const paintApp = createPainter($('app'));
const paintSheet = createPainter($('sheet'));
const pickFiles = $('pick-files');
const pickFolder = $('pick-folder');

let socket = null;
let creating = false;
let lastReactAt = 0;
let ackedPhoto = null;
/** Preloaded photos by URL: { img, state: 'loading' | 'ok' | 'error' }. */
const images = new Map();

const inLobby = (v) => v.phase === 'lobby' || v.phase === 'countdown';
const inRound = (v) => v.phase === 'load' || v.phase === 'show' || v.phase === 'reveal';

// ---------- Time ----------

/** Milliseconds left on the room's current timer, counted down locally. */
function leftNow() {
  const { at, left } = session.clock;
  return left === null ? null : Math.max(0, left - (performance.now() - at));
}

const isLate = (v) => v.phase === 'show' && Boolean(v.settings.time) && leftNow() === 0;

function myPick(v) {
  if (v.round.myPick) return v.round.myPick;
  return session.pick && session.pick.photo === v.round.photo ? session.pick.id : null;
}

// ---------- Rendering ----------

function context() {
  return { device, session, view: session.view, emojis: EMOJIS };
}

function screen() {
  const v = session.view;
  if (!session.code) return homeScreen(context());
  if (session.conn === 'replaced') return awayScreen;
  if (!v || !v.me) return joiningScreen;
  if (inLobby(v)) return lobbyScreen(context());
  if (v.phase === 'end') return endScreen(context(), REACTIONS);
  const photo = images.get(v.round.photo);
  return gameScreen(context(), { picked: myPick(v), late: isLate(v), loaded: Boolean(photo && photo.state === 'ok'), reactions: REACTIONS });
}

function setHtml(el, html) {
  if (el.innerHTML !== html) el.innerHTML = html;
}

/** Starts the round's effect on a freshly painted photo. */
function startStage() {
  const v = session.view;
  stopEffects();
  if (!v || v.phase !== 'show') return;
  const stage = document.querySelector('[data-part="stage"]');
  if (!stage || !stage.querySelector('img, canvas')) return;
  const time = v.settings.time * 1000;
  const total = time ? time * TIMING.effectShare : TIMING.untimedEffectMs;
  const elapsed = time ? time - leftNow() : performance.now() - (session.shownAt[v.round.photo] || performance.now());
  startEffect(stage, { mode: v.round.mode, zoom: v.round.zoom, src: v.round.photo, duration: total - elapsed });
}

function render() {
  const changed = paintApp(screen());
  if (changed.includes('stage')) startStage();
  const sheet = sheetScreen(context());
  if (sheet) paintSheet(sheet);
  else paintSheet(null);
  setHtml($('cover'), countdownHtml(session.view, leftNow()));
  setHtml($('banner'), bannerHtml(session, performance.now()));
}

function frame() {
  const bar = $('tbar');
  const v = session.view;
  if (bar && v) {
    let total = null;
    if (v.phase === 'show' && v.settings.time) total = v.settings.time * 1000;
    else if (v.phase === 'reveal' && v.settings.auto) total = TIMING.revealMs;
    const left = leftNow();
    $('timer').classList.toggle('off', total === null || left === null);
    if (total && left !== null) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`;
  }
  requestAnimationFrame(frame);
}

// ---------- Room ----------

function hello() {
  return { type: 'hello', key: device.key, name: device.name, avatar: device.avatar };
}

function openSocket(code) {
  if (socket) socket.end();
  socket = new RoomSocket(code, hello, { onMessage, onStatus, onEnd });
}

function enterRoom(code) {
  session.code = code;
  session.invite = null;
  session.view = null;
  session.conn = 'connecting';
  session.sheet = null;
  device.room = code;
  saveDevice();
  history.replaceState(null, '', `/${code}`);
  openSocket(code);
  keepAwake(true);
  render();
}

function exitRoom(message) {
  if (socket) socket.end();
  socket = null;
  Object.assign(session, { code: null, view: null, sheet: null, pick: null, conn: 'connecting', shownAt: {} });
  device.room = null;
  saveDevice();
  history.replaceState(null, '', '/');
  keepAwake(false);
  stopEffects();
  if (message) toast(message);
  render();
}

function send(message) {
  if (socket) socket.send(message);
}

function onStatus(status) {
  if (status === 'open') session.conn = 'open';
  else if (session.conn !== 'down') {
    session.conn = 'down';
    session.downSince = performance.now();
  }
  render();
}

function onEnd(code) {
  if (code === CLOSE.replaced) {
    session.conn = 'replaced';
    render();
  } else if (code === CLOSE.full) exitRoom('This game is full.');
  else if (code === CLOSE.gone) exitRoom(session.view ? 'This game is over.' : 'No game with this code.');
}

/** Preloads the photo on screen and the next one; acknowledges the current one once. */
function preload(v) {
  const wanted = v.round ? [v.round.photo, v.round.next].filter(Boolean) : [];
  for (const url of images.keys()) if (!wanted.includes(url)) images.delete(url);
  for (const url of wanted) {
    if (images.has(url)) continue;
    const entry = { img: new Image(), state: 'loading' };
    images.set(url, entry);
    entry.img.onload = () => { entry.state = 'ok'; acknowledge(); render(); };
    entry.img.onerror = () => { entry.state = 'error'; acknowledge(); render(); };
    entry.img.src = url;
  }
}

/** Tells the room this browser can show the round's photo (or never will), once per photo. */
function acknowledge() {
  const v = session.view;
  if (!v || v.phase !== 'load') return;
  const entry = images.get(v.round.photo);
  if (!entry || entry.state === 'loading' || ackedPhoto === v.round.photo) return;
  ackedPhoto = v.round.photo;
  send({ type: 'loaded', round: v.round.n });
}

function onMessage(msg) {
  if (msg.type === 'react') {
    if (REACTIONS.includes(msg.emoji)) floatEmoji(msg.emoji);
    return;
  }
  if (msg.type !== 'state' || !msg.view) return;
  const previous = session.view;
  const v = msg.view;
  session.view = v;
  session.clock = { at: performance.now(), left: v.left };
  if (!v.me) return;
  if (previous && previous.hostId !== v.hostId && v.hostId === v.me.id) toast('You’re the host now 👑');
  if (v.phase === 'show' && !session.shownAt[v.round.photo]) session.shownAt[v.round.photo] = performance.now();
  // Lobby-only sheets close when the game starts; the leave question closes after it.
  if (!inLobby(v) && ['settings', 'invite', 'ios'].includes(session.sheet)) session.sheet = null;
  if (!inRound(v) && session.sheet === 'leave') session.sheet = null;
  if (inRound(v)) photos.spent = true;
  preload(v);
  acknowledge();
  syncPhotos(v);
  render();
}

// ---------- Photos ----------

function reroll() {
  const v = session.view;
  if (v && v.me) roll(v.settings.photos, render);
}

/** Keeps the local photo choice in step with the room. */
function syncPhotos(v) {
  if (!inLobby(v)) return;
  const pool = v.me.pool;
  if (pool.done && pool.token !== session.poolTaken && !session.poolLoading) loadPool(pool.token);
  // A new game, or a new "Photos per player", needs a fresh set.
  if (!v.me.ready && photos.candidates.length && !session.uploading && (photos.spent || photos.size !== v.settings.photos)) reroll();
}

async function loadPool(token) {
  session.poolLoading = true;
  session.poolTaken = token;
  render();
  try {
    const blobs = await takePool(session.code, device.key);
    if (!blobs.length) toast('No photos arrived. Try again.');
    else {
      device.shortcutOk = true;
      saveDevice();
      setCandidates(blobs);
      reroll();
    }
  } catch {
    toast('Photos could not be loaded. Try again.');
  } finally {
    session.poolLoading = false;
    render();
  }
}

async function readyWith(blobs) {
  if (session.uploading || !session.code) return;
  session.uploading = true;
  render();
  try {
    await uploadPhotos(session.code, device.key, blobs);
  } catch {
    toast('Upload failed. Try again.');
  } finally {
    session.uploading = false;
    render();
  }
}

function onFilesPicked(input, emptyMessage) {
  const files = [...(input.files || [])].filter(isImageFile);
  input.value = '';
  if (!files.length) {
    toast(emptyMessage);
    return;
  }
  setCandidates(files);
  reroll();
}

pickFiles.addEventListener('change', () => onFilesPicked(pickFiles, 'No photos picked.'));
pickFolder.addEventListener('change', () => onFilesPicked(pickFolder, 'No photos in this folder.'));

// ---------- Actions ----------

function needName() {
  if (device.name) return false;
  toast('What’s your name?');
  const input = $('name');
  if (input) input.focus();
  return true;
}

function openSheet(name) {
  session.sheet = name;
  render();
}

async function shareLink() {
  const url = `${location.origin}/${session.code}`;
  if (navigator.share) {
    navigator.share({ title: APP.name, text: 'Join my game!', url }).catch(() => {});
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Link copied');
  } catch {
    toast(url);
  }
}

function leaveNow() {
  send({ type: 'leave' });
  exitRoom();
}

const ACTIONS = {
  help: () => openSheet('help'),
  avatar: () => openSheet('avatar'),
  pickavatar: (value) => {
    if (!EMOJIS.includes(value)) return;
    device.avatar = value;
    saveDevice();
    session.sheet = null;
    render();
  },
  async create() {
    if (needName() || creating) return;
    creating = true;
    try {
      enterRoom(await createRoom(device.settings));
    } catch {
      toast('Could not create a game. Try again.');
    } finally {
      creating = false;
    }
  },
  join() {
    if (needName()) return;
    const code = session.invite || (($('code') || {}).value || '').toUpperCase();
    if (!isRoomCode(code)) {
      toast('Enter the 4-letter code');
      const input = $('code');
      if (input) input.focus();
      return;
    }
    enterRoom(code);
  },
  newgame: () => {
    session.invite = null;
    history.replaceState(null, '', '/');
    render();
  },
  leave: () => (session.view && inRound(session.view) ? openSheet('leave') : leaveNow()),
  leavenow: leaveNow,
  close: () => openSheet(null),
  settings: () => openSheet('settings'),
  set: (value, el) => {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      return;
    }
    const key = el.dataset.k;
    if (normalizeSetting(key, parsed) === undefined) return;
    send({ type: 'setting', key, value: parsed });
    // Remembered for the next game this device creates.
    device.settings[key] = parsed;
    saveDevice();
  },
  invite: () => openSheet('invite'),
  share: shareLink,
  folder: () => pickFolder.click(),
  choose: () => pickFiles.click(),
  ios: () => openSheet('ios'),
  guess: () => readyWith([]),
  no: () => reroll(),
  yes: () => readyWith(readyBlobs()),
  other: () => {
    clearPhotos();
    render();
  },
  unready: () => send({ type: 'unready' }),
  answer: (id) => {
    const v = session.view;
    if (!v || v.phase !== 'show' || myPick(v) || isLate(v)) return;
    session.pick = { photo: v.round.photo, id };
    send({ type: 'answer', pick: id });
    render();
  },
  resolve: () => send({ type: 'resolve' }),
  next: () => send({ type: 'next' }),
  again: () => send({ type: 'again' }),
  react: (emoji) => {
    if (!REACTIONS.includes(emoji) || performance.now() - lastReactAt < 350) return;
    lastReactAt = performance.now();
    send({ type: 'react', emoji });
    floatEmoji(emoji);
  },
  here: () => {
    session.conn = 'connecting';
    openSocket(session.code);
    render();
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const action = ACTIONS[el.dataset.act];
  if (action) action(el.dataset.v, el);
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'name') {
    device.name = e.target.value.trim().slice(0, LIMITS.nameMax);
    saveDevice();
  } else if (e.target.id === 'code') {
    const clean = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean !== e.target.value) e.target.value = clean;
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'code') ACTIONS.join();
  else if (e.target.id === 'name') {
    if (session.invite) ACTIONS.join();
    else e.target.blur();
  }
});

// ---------- Boot ----------

const pathCode = location.pathname.slice(1).toUpperCase();
// Back from a failed shortcut run: set it up again instead of offering a dead link.
const shortcutFailed = new URLSearchParams(location.search).has('setup');
if (shortcutFailed) {
  device.shortcutOk = false;
  saveDevice();
}
if (isRoomCode(pathCode)) {
  if (device.room === pathCode && device.name) {
    enterRoom(pathCode);
    if (shortcutFailed) session.sheet = 'ios';
  } else session.invite = pathCode;
} else if (location.pathname !== '/') {
  history.replaceState(null, '', '/');
}
render();
setInterval(render, 250);
requestAnimationFrame(frame);
