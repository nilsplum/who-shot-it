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
 *   `session.view`, hands the game's photos to the queue that loads them ahead
 *   (`upcoming.js`), tells the room which round this phone is ready for (`loaded`,
 *   `reportReady`), deals photos when the lobby needs a set (`dealIfNeeded`),
 *   lets the phone feel the room's moments (`moments`: a new photo, the reveal) and
 *   repaints. Actions are sent as small messages; the server decides what happens.
 * - Vibrations come only from `phone.buzz` and its five meanings: the room's moments
 *   (`moments`), each new number of the 3-2-1 (when it is painted), and a swap's flip or
 *   refusal (action `swap`).
 * - Photo access is asked once ("Continue", then the phone's own question) and checked
 *   again whenever the app comes back to the front, since the player may have changed
 *   it in the phone's settings. Whenever the app may read photos (from its start, once the
 *   terms are accepted), the photo bucket fills by itself (`photos.startPhotos`), for the
 *   room's "Which photos" or this phone's own setting (`syncPhotoFilter`). "Yes" shows how
 *   far it is (`session.progress`): the big versions getting ready, then the upload.
 * - Rendering: `screen()` picks the view for the current state and `createPainter`
 *   repaints only what changed, four times a second and after every change. The timer bar
 *   is animated every frame from the round's clock (`clock.js`, synced with every view)
 *   and the timer's length the view carries (`total`).
 * - The flag: ⚑ flags the photo in the room (the others stop seeing it, the round waits)
 *   and opens the report sheet on this phone; Delete, Cancel, the backdrop and the back
 *   button end it (`endFlag`). The sheet is this phone's own intent: the room's views only
 *   close it (its photo is gone, its round is over, someone else's flag came first), so a
 *   view that crosses a Cancel on the wire can never reopen it.
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
import { shuffle } from '../shared/random.js';
import { createRoom, uploadPhotos } from './api.js';
import { createClock } from './clock.js';
import { RoomSocket } from './connection.js';
import { startEffect, stopEffects } from './effects.js';
import { askPhotoAccess, buzz, inApp, keepAwake, onBack, onInvite, onResume, openSettings, photoAccess, share } from './phone.js';
import { chosenBlobs, heldLayers, holdPhoto, leaveSet, photos, resetPhotos, roll, setFilter, startPhotos, swap } from './photos.js';
import { createPainter } from './render.js';
import { device, keyFor, saveDevice, session } from './store.js';
import { photoState, photoUrl, readyFor, shareFor, syncUpcoming } from './upcoming.js';
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
let checkingAccess = false;
/** The round this phone last said it is ready for (reset to the room's word with every view). */
let reported = 0;
/** The room's timer for the phase on screen, counted down on this phone between views. */
const roundClock = createClock();
/** How long this phone's flag still waits before the room deletes the photo by itself. */
const flagClock = createClock();

const inLobby = (v) => v.phase === 'lobby' || v.phase === 'countdown';
const inRound = (v) => ['load', 'show', 'reveal', 'board'].includes(v.phase);
const canReadPhotos = () => session.access === 'full' || session.access === 'limited';

// ---------- Time ----------

/** Milliseconds left on the room's current timer (frozen while the room holds the round), or null. */
const leftNow = () => roundClock.left();

const isLate = (v) => v.phase === 'show' && Boolean(v.settings.time) && leftNow() === 0;

function myPick(v) {
  if (v.round.myPick) return v.round.myPick;
  return session.pick && session.pick.photo === v.round.photo ? session.pick.id : null;
}

/**
 * While the room waits for the phones' photos (`view.waiting`), how far the whole table is,
 * 0 to 1: the other phones by what the room knows, this one by what it holds already
 * (finer than its last report); else null.
 */
function loadShare(v) {
  if (!v.waiting || !v.waiting.of || !v.round) return null;
  const target = v.phase === 'board' ? v.round.n + 1 : v.round.n;
  const counted = v.me.loaded >= target;
  const others = v.waiting.ready - (counted ? 1 : 0);
  return (others + (counted ? 1 : shareFor(v.round.n, v.upcoming, target))) / v.waiting.of;
}

// ---------- Rendering ----------

function context() {
  return { device, session, view: session.view, flagLeft: flagClock.left() };
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
  if (v.phase === 'board') return boardScreen(context(), { reactions: REACTIONS, loading: loadShare(v) });
  const photo = v.round.photo;
  return gameScreen(context(), { picked: myPick(v), late: isLate(v), photo: photoState(photo), src: photoUrl(photo), loading: loadShare(v), reactions: REACTIONS });
}

/** Paints `html` into `el` unless it is there already; returns whether it changed. */
function setHtml(el, html) {
  if (el.innerHTML === html) return false;
  el.innerHTML = html;
  return true;
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
  startEffect(stage, { mode: v.round.mode, zoom: v.round.zoom, src: photoUrl(v.round.photo), duration: total - elapsed });
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

/**
 * The photo shown big, as layers for `overlays.lookHtml`: a photo of the choice this phone
 * holds (its preview, then its sharp version above it), the round's photo this phone holds
 * with "Show again", or the one another phone holds (`round.peek`); else none.
 */
function lookLayers() {
  const v = session.view;
  const look = session.look;
  if (look && look.tile !== undefined) return heldLayers(look.tile);
  const link = look ? look.photo : v && v.phase === 'board' && v.round.peek ? v.round.photo : null;
  const url = link ? photoUrl(link) : null;
  return url ? [url] : [];
}

function render() {
  const changed = paintApp(screen());
  if (changed.includes('stage')) startStage();
  if (changed.includes('board')) startBoard();
  paintSheet(sheetScreen(context()));
  // The 3-2-1 paints a new number each second: each one is felt, a little longer than a tap.
  const cover = countdownHtml(session.view, leftNow());
  if (setHtml($('cover'), cover) && cover) buzz('count');
  setHtml($('look'), lookHtml(lookLayers()));
  setHtml($('banner'), bannerHtml(session, performance.now()));
}

/** Shrinks the timer bar every frame: what is left of the timer's full length (`view.total`), hidden while there is none. */
function frame() {
  const bar = $('tbar');
  const v = session.view;
  if (bar && v) {
    const left = leftNow();
    const total = v.total || null;
    bar.toggleAttribute('data-off', total === null || left === null);
    if (total && left !== null) bar.style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`;
  }
  requestAnimationFrame(frame);
}

// ---------- Room ----------

/** The first message of every connection; `ahead`: this app loads the game's photos ahead (`upcoming.js`). */
function hello() {
  return { type: 'hello', key: keyFor(session.code), name: device.name, avatar: device.avatar, ahead: true };
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
  // The set on screen goes with the room; the bucket stays for the next game.
  leaveSet();
  syncPhotoFilter();
  // The game's photos leave memory with the game.
  syncUpcoming([], render);
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

/**
 * Tells the room the round this phone is ready for (`upcoming.readyFor`) whenever it is
 * further than what the room knows; one message per step, so about one per round.
 */
function reportReady() {
  const v = session.view;
  if (!v || !v.me || !v.upcoming || !v.upcoming.length) return;
  const ready = readyFor(v.round ? v.round.n : 1, v.upcoming);
  if (ready <= reported) return;
  reported = ready;
  send({ type: 'loaded', round: ready });
}

/** A game photo arrived or failed: maybe a round further, and the stage may paint it. */
function onPhotos() {
  reportReady();
  render();
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
  // The timer is named by its phase and round: within one, a snapshot never moves it (`clock.js`).
  roundClock.sync(`${v.phase}|${v.round ? v.round.n : ''}`, v.left, v.paused);
  const flag = v.round && v.round.flag;
  flagClock.sync(`flag|${v.round ? v.round.n : ''}`, flag && flag.mine ? flag.left : null);
  if (!v.me) return;
  if (previous && previous.hostId !== v.hostId && v.hostId === v.me.id) toast('You’re the host now 👑');
  if (v.phase === 'show' && !session.shownAt[v.round.photo]) session.shownAt[v.round.photo] = performance.now();
  // Sheets that no longer fit close by themselves.
  if (!inLobby(v) && ['settings', 'invite'].includes(session.sheet)) session.sheet = null;
  if (!inRound(v) && session.sheet === 'leave') session.sheet = null;
  // The report sheet belongs to the photo this phone flagged: it closes when that photo is
  // gone (deleted by itself after the wait, or by someone), its round is over, or someone
  // else's flag came first.
  if (session.sheet === 'report') {
    const r = v.round;
    const otherFlag = Boolean(r && r.flag && !r.flag.mine);
    const still = r && r.n === session.flagged && r.photo && ['show', 'reveal'].includes(v.phase);
    if (!still || otherFlag) {
      // The room had this phone's flag and now the photo is gone: it was deleted by itself.
      const wasMine = Boolean(previous && previous.round && previous.round.flag && previous.round.flag.mine);
      if (wasMine && !otherFlag) toast('Photo deleted. Thank you!');
      endFlag(false);
      session.sheet = null;
    }
  }
  if (session.sheet === 'remove' && !v.players.some((p) => p.id === session.target)) session.sheet = null;
  if (inRound(v)) photos.spent = true;
  moments(previous, v);
  // The room's word on this phone's readiness (it forgets after a changed plan), then the photos.
  reported = v.me.loaded || 0;
  syncUpcoming(v.upcoming || [], onPhotos);
  reportReady();
  syncPhotoFilter();
  dealIfNeeded();
  render();
}

/**
 * What the phone feels when the room moves on, once per moment and round: a light tap when a
 * new photo appears for everyone (`show` starts), one pulse for a right guess and two for
 * anything else when the round is revealed (the room's own results, never the optimistic
 * pick). Only a change between two views counts, so a repaint never vibrates.
 */
function moments(previous, v) {
  const round = (x, phase) => (x && x.phase === phase && x.round ? x.round.n : null);
  if (round(v, 'show') && round(previous, 'show') !== round(v, 'show')) buzz('tap');
  if (round(v, 'reveal') && round(previous, 'reveal') !== round(v, 'reveal')) {
    const mine = v.round.results && v.round.results[v.me.id];
    buzz(mine && mine.pick && mine.pick === v.round.owner ? 'yes' : 'no');
  }
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

/** The "Which photos" the bucket gathers for: the room's in a game, else this phone's own for its next one. */
function syncPhotoFilter() {
  const v = session.view;
  setFilter(v && v.me ? photoSettings(v).filter : normalizeSettings(device.settings).filter);
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

/**
 * Asks the phone what the app may read (never with a question: that stays with "Continue");
 * a change since last time starts over. The photo bucket fills whenever it may.
 */
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
  startPhotos(canReadPhotos(), render);
  dealIfNeeded();
  render();
}

/**
 * "Yes" (or playing without photos): waits for the photos' big versions, then uploads
 * them, showing how far it is in place of No and Yes (`session.progress`).
 */
async function readyWith(blobsOf) {
  if (session.uploading || !session.code) return;
  session.uploading = true;
  const step = (label) => (share) => {
    session.progress = { label, share };
    render();
  };
  step('Getting photos ready')(0);
  try {
    let blobs;
    try {
      blobs = await blobsOf(step('Getting photos ready'));
    } catch {
      toast('These photos would not load. Tap No for others.');
      return;
    }
    // The label turns at once: the first upload progress can take a moment to come.
    step('Sending photos')(0);
    await uploadPhotos(session.code, keyFor(session.code), blobs, step('Sending photos'));
  } catch {
    toast('Upload failed. Try again.');
  } finally {
    session.uploading = false;
    session.progress = null;
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
  // Closing the report sheet any way but Delete (Cancel, the backdrop, the back button) cancels the flag.
  if (session.sheet === 'report' && name !== 'report') endFlag(true);
  session.sheet = name;
  session.helpKey = null;
  render();
}

/** This phone's flag is over; `cancel` tells the room, so the photo comes back for everyone. */
function endFlag(cancel) {
  if (cancel && session.flagged !== null) send({ type: 'flag', round: session.flagged, on: false });
  session.flagged = null;
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
    checkAccess();
    render();
  },
  help: () => openSheet('help'),
  /** The avatar sheet shows every avatar in a new random order each time it opens, so a group spreads over all of them. */
  avatar: () => {
    session.avatarOrder = shuffle(EMOJIS);
    openSheet('avatar');
  },
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
    syncPhotoFilter();
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
    syncPhotoFilter();
    render();
  },
  invite: () => openSheet('invite'),
  share: shareInvite,
  async allow() {
    session.access = await askPhotoAccess().catch(() => 'denied');
    startPhotos(canReadPhotos(), render);
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
  /** A tap on a photo of the choice: it flips to another one (a light tap), or the refusal is felt twice. */
  swap: (index) => {
    if (session.uploading) return;
    buzz(swap(Number(index), render) ? 'tap' : 'no');
  },
  unready: () => send({ type: 'unready' }),
  answer: (id) => {
    const v = session.view;
    if (!v || v.phase !== 'show' || myPick(v) || isLate(v)) return;
    session.pick = { photo: v.round.photo, id };
    send({ type: 'answer', pick: id });
    render();
  },
  next: () => send({ type: 'next' }),
  again: () => send({ type: 'again' }),
  react: (emoji) => {
    if (!REACTIONS.includes(emoji) || performance.now() - lastReactAt < 350) return;
    lastReactAt = performance.now();
    send({ type: 'react', emoji });
    floatEmoji(emoji);
  },
  /**
   * The arrow of the reaction row (right after the row, `ui.reactionsRow`): all the way to
   * the end (the last five reactions), and from there back to the start.
   */
  reactmore: (value, el) => {
    const row = el.previousElementSibling;
    const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 2;
    row.scrollTo({ left: atEnd ? 0 : row.scrollWidth });
  },
  /** ⚑: the room hides the photo from the others and holds the round while this phone decides in the report sheet. */
  report: () => {
    const v = session.view;
    if (!v || !v.round || !v.round.photo) return;
    session.flagged = v.round.n;
    send({ type: 'flag', round: v.round.n, on: true });
    openSheet('report');
  },
  /** Delete: the photo of the flagged round is deleted for everyone (the room ignores it if that round is over). */
  reportnow: () => {
    send({ type: 'report', round: session.flagged });
    endFlag(false);
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
      session.look = { photo: v.round.photo };
      send({ type: 'peek', on: true });
      peekTimer = setInterval(() => send({ type: 'peek', on: true }), TIMING.peekRenewMs);
    },
    end: () => {
      clearInterval(peekTimer);
      session.look = null;
      send({ type: 'peek', on: false });
    },
  },
  /** A photo of the choice in the lobby: its preview at once, sharp as soon as its big version is there (it comes first). */
  tile: {
    delay: 350,
    start: (index) => {
      holdPhoto(Number(index));
      session.look = { tile: Number(index) };
    },
    end: () => {
      holdPhoto(null);
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
  syncPhotoFilter();
  // The photo bucket starts filling as soon as the terms are accepted and the app may read photos.
  if (device.agreed === termsToken()) checkAccess();
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
