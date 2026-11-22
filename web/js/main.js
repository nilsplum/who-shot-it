/**
 * The app's controller: boots, joins and leaves rooms, handles every tap, deals the
 * player's photos, and repaints.
 *
 * Mechanisms:
 * - Boot: opened in a plain browser (`phone.inApp` is false) this page is the website and
 *   shows only the invite page (`views/landing.js`). In the store apps, the terms come
 *   first after every install and update (`views/welcome.js`, `termsToken`); then the app
 *   rejoins the game this phone was in
 *   (after the app was closed), and an invite link (`phone.onInvite`) turns the home
 *   screen into "Join <CODE>".
 * - Create: "Create game" opens the "New game" step (`session.setup`, presets and
 *   settings for this phone), "Start game" creates the room with those settings.
 * - In a room, `RoomSocket` delivers the player's view; every view replaces
 *   `session.view`, preloads the round's and the next round's photo, acknowledges a
 *   loaded photo (`loaded`), deals photos when the lobby needs a set (`dealIfNeeded`),
 *   vibrates when a round is revealed (one pulse right, two wrong) and repaints. Actions
 *   are sent as small messages; the server decides what happens.
 * - Photo access is asked once ("Continue", then the phone's own question) and checked
 *   again whenever the app comes back to the front, since the player may have changed
 *   it in the phone's settings.
 * - Rendering: `screen()` picks the view for the current state and `createPainter`
 *   repaints only what changed, four times a second and after every change. The timer bar
 *   is animated every frame from `session.clock`.
 * - Hold to look: elements with `data-hold` start an entry of the `HOLDS` table when a
 *   finger stays on them; it ends when the finger lifts anywhere, and meanwhile the page
 *   neither scrolls nor opens the phone's long-press menu. The photo it shows is painted
 *   into `#look` (`views/overlays.js`).
 * - The Android back button closes a sheet, steps back from "New game", asks before
 *   leaving a game, and otherwise puts the app in the background.
 *
 * Invariants:
 * - The app never decides game outcomes: it shows only what the view says, and an
 *   optimistic answer (`session.pick`) is replaced by the room's own as soon as it comes.
 * - All taps go through `data-act` and the `ACTIONS` table, all holds through `data-hold`
 *   and the `HOLDS` table; sheets are the only dialogs.
 */

import { CLOSE } from '../shared/api.js';
import { APP, EMOJIS, LIMITS, PRESETS, REACTIONS, TIMING, isRoomCode, normalizeSetting, normalizeSettings, termsToken } from '../shared/config.js';
import { createRoom, serverUrl, uploadPhotos } from './api.js';
import { RoomSocket } from './connection.js';
import { startEffect, stopEffects } from './effects.js';
import { askPhotoAccess, buzz, inApp, keepAwake, onBack, onInvite, onResume, openSettings, photoAccess, share } from './phone.js';
import { chosenBlobs, photos, resetPhotos, roll, swap } from './photos.js';
import { createPainter } from './render.js';
import { device, keyFor, saveDevice, session } from './store.js';
import { floatEmoji, toast } from './ui.js';
import { endScreen } from './views/end.js';
import { gameScreen } from './views/game.js';
import { homeScreen } from './views/home.js';
import { landingScreen } from './views/landing.js';
import { lobbyScreen } from './views/lobby.js';
import { newGameScreen } from './views/newgame.js';
import { boardScreen } from './views/board.js';
import { awayScreen, bannerHtml, countdownHtml, joiningScreen, lookHtml } from './views/overlays.js';
import { inviteLink, sheetScreen } from './views/sheets.js';
import { welcomeScreen } from './views/welcome.js';

const $ = (id) => document.getElementById(id);
const paintApp = createPainter($('app'));
const paintSheet = createPainter($('sheet'));

let socket = null;
let lastReactAt = 0;
let ackedPhoto = null;
let checkingAccess = false;
/** Preloaded photos by server path: { img, state: 'loading' | 'ok' | 'error' }. */
const images = new Map();

const inLobby = (v) => v.phase === 'lobby' || v.phase === 'countdown';
const inRound = (v) => ['load', 'show', 'reveal', 'board'].includes(v.phase);
const canReadPhotos = () => session.access === 'full' || session.access === 'limited';

// ---------- Time ----------

/** Milliseconds left on the room's current timer, counted down locally (not while the room paused it). */
function leftNow() {
  const { at, left } = session.clock;
  if (left === null) return null;
  return session.view && session.view.paused ? left : Math.max(0, left - (performance.now() - at));
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
  if (device.agreed !== termsToken()) return welcomeScreen();
  if (!session.code) return session.setup ? newGameScreen(context()) : homeScreen(context());
  if (session.conn === 'replaced') return awayScreen;
  if (!v || !v.me) return joiningScreen;
  // The end screen also for whoever is still on their results while the next game fills.
  if (v.phase === 'end' || v.me.onResults) return endScreen(context(), REACTIONS);
  if (inLobby(v)) return lobbyScreen(context());
  if (v.phase === 'board') return boardScreen(context(), { reactions: REACTIONS });
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
  startEffect(stage, { mode: v.round.mode, zoom: v.round.zoom, src: serverUrl(v.round.photo), duration: total - elapsed });
}

/**
 * The leaderboard's entrance, once its rows are painted: a moment in the old order with the
 * old totals, then the rows slide to their places and the totals count up (at once with
 * Reduce Motion).
 */
function startBoard() {
  const rows = [...document.querySelectorAll('[data-part="board"] [data-rank]')];
  const quick = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(() => {
    for (const row of rows) {
      if (!row.isConnected) return;
      row.style.setProperty('--shift', 0);
      row.querySelector('[data-cell="rank"]').textContent = row.dataset.rank;
      const total = row.querySelector('[data-cell="total"]');
      const from = Number(total.dataset.from);
      const to = Number(total.dataset.to);
      const begin = performance.now();
      const step = (t) => {
        const k = quick ? 1 : Math.min(1, (t - begin) / 600);
        total.textContent = Math.round(from + (to - from) * k);
        if (k < 1 && total.isConnected) requestAnimationFrame(step);
      };
      if (from !== to) requestAnimationFrame(step);
    }
  }, quick ? 0 : 400);
}

/** The photo shown big: one this phone holds, or the round's photo while anyone holds "Show again". */
function lookSrc() {
  const v = session.view;
  if (session.look) return session.look;
  return v && v.phase === 'board' && v.round.peek && v.round.photo ? serverUrl(v.round.photo) : null;
}

function render() {
  const changed = paintApp(screen());
  if (changed.includes('stage')) startStage();
  if (changed.includes('board')) startBoard();
  paintSheet(sheetScreen(context()));
  setHtml($('cover'), countdownHtml(session.view, leftNow()));
  setHtml($('look'), lookHtml(lookSrc()));
  setHtml($('banner'), bannerHtml(session, performance.now()));
}

function frame() {
  const bar = $('tbar');
  const v = session.view;
  if (bar && v) {
    let total = null;
    if (v.phase === 'show' && v.settings.time) total = v.settings.time * 1000;
    else if (v.phase === 'reveal') total = TIMING.revealMs;
    else if (v.phase === 'board' && v.settings.auto) total = TIMING.boardMs;
    const left = leftNow();
    bar.toggleAttribute('data-off', total === null || left === null);
    if (total && left !== null) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`;
  }
  requestAnimationFrame(frame);
}

// ---------- Room ----------

function hello() {
  return { type: 'hello', key: keyFor(session.code), name: device.name, avatar: device.avatar };
}

function openSocket(code) {
  if (socket) socket.end();
  socket = new RoomSocket(code, hello, { onMessage, onStatus, onEnd });
}

function enterRoom(code) {
  Object.assign(session, { code, invite: null, setup: false, view: null, conn: 'connecting', sheet: null });
  device.room = code;
  device.lastRoom = code;
  saveDevice();
  openSocket(code);
  keepAwake(true);
  render();
}

/** Back to the start screen; `forget` also clears the remembered code (that game is gone or closed to us). */
function exitRoom(message, { forget = false } = {}) {
  if (socket) socket.end();
  socket = null;
  Object.assign(session, { code: null, view: null, sheet: null, pick: null, conn: 'connecting', shownAt: {} });
  device.room = null;
  if (forget) device.lastRoom = null;
  saveDevice();
  resetPhotos();
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
  else if (code === CLOSE.removed) exitRoom('The host removed you from this game.', { forget: true });
  else if (code === CLOSE.gone) exitRoom(session.view ? 'This game is over.' : 'No game with this code.', { forget: true });
}

/** Preloads the photo on screen and the next one; acknowledges the current one once. */
function preload(v) {
  const wanted = v.round ? [v.round.photo, v.round.next].filter(Boolean) : [];
  for (const path of images.keys()) if (!wanted.includes(path)) images.delete(path);
  for (const path of wanted) {
    if (images.has(path)) continue;
    const entry = { img: new Image(), state: 'loading' };
    images.set(path, entry);
    entry.img.onload = () => { entry.state = 'ok'; acknowledge(); render(); };
    entry.img.onerror = () => { entry.state = 'error'; acknowledge(); render(); };
    entry.img.src = serverUrl(path);
  }
}

/** Tells the room this app can show the round's photo (or never will), once per photo. */
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
  // Sheets that no longer fit close by themselves.
  if (!inLobby(v) && ['settings', 'invite'].includes(session.sheet)) session.sheet = null;
  if (!inRound(v) && ['leave', 'report'].includes(session.sheet)) session.sheet = null;
  if (session.sheet === 'remove' && !v.players.some((p) => p.id === session.target)) session.sheet = null;
  if (inRound(v)) photos.spent = true;
  // The reveal of a round, once: one pulse for a right guess, two for anything else.
  const revealed = (x) => x && x.phase === 'reveal' && x.round ? x.round.n : null;
  if (revealed(v) && revealed(previous) !== revealed(v)) {
    const mine = v.round.results && v.round.results[v.me.id];
    buzz(mine && mine.pick && mine.pick === v.round.owner ? 'yes' : 'no');
  }
  preload(v);
  acknowledge();
  dealIfNeeded();
  render();
}

// ---------- Photos ----------

/**
 * The room's photo settings: how many photos, and which ones ("Which photos" falls back to
 * its default with a server that does not know it yet).
 */
function photoSettings(v) {
  const { photos: size, filter } = normalizeSettings(v.settings);
  return { size, filter };
}

/** Deals a fresh set when the lobby needs one and the app may read photos. */
function dealIfNeeded() {
  const v = session.view;
  if (!v || !v.me || !inLobby(v) || v.me.ready || v.me.onResults || session.uploading) return;
  if (session.access === null) {
    checkAccess();
    return;
  }
  if (!canReadPhotos()) return;
  // A new game, a new "Photos per player" or a new "Which photos" needs a fresh set.
  const { size, filter } = photoSettings(v);
  const stale = photos.spent || (photos.size > 0 && (photos.size !== size || photos.filter !== filter));
  if (stale || (!photos.rolling && !photos.chosen.length && !photos.empty)) roll(size, filter, render);
}

/** Asks the phone what the app may read; a change since last time starts over. */
async function checkAccess() {
  if (!inApp() || checkingAccess) return;
  checkingAccess = true;
  try {
    const access = await photoAccess();
    if (access !== session.access || photos.empty) resetPhotos();
    session.access = access;
  } catch {
    session.access = 'denied';
  } finally {
    checkingAccess = false;
  }
  dealIfNeeded();
  render();
}

/** "Yes" (or playing without photos): waits for the photos, then uploads them. */
async function readyWith(blobsOf) {
  if (session.uploading || !session.code) return;
  session.uploading = true;
  render();
  try {
    let blobs;
    try {
      blobs = await blobsOf();
    } catch {
      toast('These photos would not load. Tap No for others.');
      return;
    }
    await uploadPhotos(session.code, keyFor(session.code), blobs);
  } catch {
    toast('Upload failed. Try again.');
  } finally {
    session.uploading = false;
    render();
  }
}

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
  session.helpKey = null;
  render();
}

async function shareInvite() {
  const url = inviteLink(session.code);
  if (await share({ text: `Join my game in ${APP.name}! Code: ${session.code}`, url })) return;
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
  agree: () => {
    device.agreed = termsToken();
    saveDevice();
    render();
  },
  help: () => openSheet('help'),
  avatar: () => openSheet('avatar'),
  pickavatar: (value) => {
    if (!EMOJIS.includes(value)) return;
    device.avatar = value;
    saveDevice();
    openSheet(null);
  },
  create: () => {
    if (needName()) return;
    session.setup = true;
    render();
  },
  back: () => {
    session.setup = false;
    render();
  },
  preset: (key) => {
    const preset = PRESETS.find((p) => p.key === key);
    if (!preset) return;
    device.settings = { ...preset.settings };
    saveDevice();
    render();
  },
  async start() {
    if (needName() || session.creating) return;
    session.creating = true;
    render();
    try {
      enterRoom(await createRoom(device.settings));
    } catch {
      toast('Could not create a game. Try again.');
    } finally {
      session.creating = false;
      render();
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
    render();
  },
  leave: () => (session.view && inRound(session.view) ? openSheet('leave') : leaveNow()),
  leavenow: leaveNow,
  close: () => openSheet(null),
  settings: () => openSheet('settings'),
  explain: (key) => {
    session.helpKey = session.helpKey === key ? null : key;
    render();
  },
  set: (value, el) => {
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      return;
    }
    const key = el.dataset.k;
    if (normalizeSetting(key, parsed) === undefined) return;
    // In a game the host changes the room's settings; either way this phone remembers
    // them for the next game it creates.
    if (session.view && session.view.me) send({ type: 'setting', key, value: parsed });
    device.settings = { ...device.settings, [key]: parsed };
    saveDevice();
    render();
  },
  invite: () => openSheet('invite'),
  share: shareInvite,
  async allow() {
    session.access = await askPhotoAccess().catch(() => 'denied');
    dealIfNeeded();
    render();
  },
  opensettings: openSettings,
  guess: () => readyWith(async () => []),
  no: () => {
    const v = session.view;
    if (!v || !v.me) return;
    const { size, filter } = photoSettings(v);
    roll(size, filter, render);
  },
  yes: () => readyWith(chosenBlobs),
  swap: (index) => {
    if (session.uploading) return;
    if (!swap(Number(index), render)) buzz('no');
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
  /** The arrow of the reaction row (right after the row, `ui.reactionsRow`): one page further, and back to the start at the end. */
  reactmore: (value, el) => {
    const row = el.previousElementSibling;
    const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
    row.scrollTo({ left: atEnd ? 0 : row.scrollLeft + row.clientWidth * 0.8 });
  },
  report: () => openSheet('report'),
  reportnow: () => {
    send({ type: 'report' });
    openSheet(null);
    toast('Photo deleted. Thank you!');
  },
  remove: (id) => {
    session.target = id;
    openSheet('remove');
  },
  removenow: () => {
    send({ type: 'kick', target: session.target });
    openSheet(null);
  },
  here: () => {
    session.conn = 'connecting';
    openSocket(session.code);
    render();
  },
};

/** The Android back button; false means "nothing to go back to" (the app goes to the background). */
function back() {
  if (session.sheet) openSheet(null);
  else if (session.setup) ACTIONS.back();
  else if (session.code) openSheet('leave');
  else if (session.invite) ACTIONS.newgame();
  else return false;
  return true;
}

// ---------- Hold to look ----------

/**
 * What a held finger does, by the element's `data-hold` (its `data-v` is passed on):
 * `{ delay, start(value), end() }`. `delay` 0 starts at once (a button made for holding);
 * a longer delay tells a hold apart from a tap: moving more than HOLD_SLOP px before it
 * cancels the hold (the page may scroll), and lifting the finger from the held element
 * is not also a tap on it (its click is swallowed; taps elsewhere still count).
 */
let peekTimer = 0;

const HOLDS = {
  /**
   * "Show again" on the leaderboard: this phone shows the photo at once, the room shows it
   * to everyone while the hold is renewed, and lets go when the finger lifts.
   */
  peek: {
    delay: 0,
    start: () => {
      const v = session.view;
      if (!v || v.phase !== 'board' || !v.round.photo) return;
      session.look = serverUrl(v.round.photo);
      send({ type: 'peek', on: true });
      peekTimer = setInterval(() => send({ type: 'peek', on: true }), TIMING.peekRenewMs);
    },
    end: () => {
      clearInterval(peekTimer);
      session.look = null;
      send({ type: 'peek', on: false });
    },
  },
  /** A photo of the choice in the lobby: the sharp upload version once it is there. */
  tile: {
    delay: 350,
    start: (index) => {
      const c = photos.chosen[Number(index)];
      session.look = c ? c.fullUrl || c.url : null;
    },
    end: () => {
      session.look = null;
    },
  },
};
const HOLD_SLOP = 10;
let hold = null;
/** The element a hold just ended on (`data-hold` and `data-v`, as repaints replace nodes), and until when its click is swallowed. */
let heldLast = null;

function endHold() {
  if (!hold) return;
  clearTimeout(hold.timer);
  if (hold.started) {
    hold.kind.end();
    heldLast = { name: hold.name, value: hold.value, until: performance.now() + 400 };
    render();
  }
  hold = null;
}

function isHeldClick(target) {
  const el = target.closest('[data-hold]');
  return Boolean(heldLast && el && performance.now() < heldLast.until && el.dataset.hold === heldLast.name && el.dataset.v === heldLast.value);
}

document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-hold]');
  const kind = el && !el.disabled && HOLDS[el.dataset.hold];
  if (!kind || hold) return;
  const current = { kind, name: el.dataset.hold, value: el.dataset.v, x: e.clientX, y: e.clientY, started: false, timer: 0 };
  const begin = () => {
    if (hold !== current) return;
    current.started = true;
    kind.start(current.value);
    render();
  };
  hold = current;
  if (kind.delay) current.timer = setTimeout(begin, kind.delay);
  else begin();
});
document.addEventListener('pointermove', (e) => {
  if (hold && !hold.started && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLOP) endHold();
});
document.addEventListener('pointerup', endHold);
document.addEventListener('pointercancel', endHold);
// While a hold shows something the finger may wander: the page must not scroll (which
// would also cancel the pointer) and no long-press menu may open.
document.addEventListener('touchmove', (e) => {
  if (hold && hold.started) e.preventDefault();
}, { passive: false });
document.addEventListener('contextmenu', (e) => {
  if (hold) e.preventDefault();
});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  // Lifting the finger from a held photo is not a tap on it.
  if (isHeldClick(e.target)) return;
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

if (!inApp()) {
  // The website: the invite page for "/<CODE>", the plain one for "/".
  const code = location.pathname.slice(1).toUpperCase();
  paintApp(landingScreen(isRoomCode(code) ? code : null));
} else {
  if (device.room && device.name && device.agreed === termsToken()) enterRoom(device.room);
  onInvite((code) => {
    if (session.code === code) return;
    if (session.code) {
      toast('Leave this game first.');
      return;
    }
    Object.assign(session, { invite: code, setup: false, sheet: null });
    render();
  });
  onBack(back);
  onResume(() => {
    if (socket) socket.checkNow();
    if (session.access !== null) checkAccess();
  });
  render();
  setInterval(render, 250);
  requestAnimationFrame(frame);
}
