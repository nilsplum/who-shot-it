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
 * - The version gate: the app asks its server once per start which versions may play there
 *   and which is the newest out (`fetchGate`, `session.gate`). A newer one shows "✨ Update"
 *   on the start screen (`newerOut`). A version too old to play is told "Update to play"
 *   (the 'update' sheet, `askUpdate`) only when the player taps "Create game" or "Join":
 *   at once by the gate it knows, else by the server's own answer (Create's `STATUS.update`,
 *   Join's `CLOSE.update`; the server decides, the app's copy only saves a step).
 * - In a room, `RoomSocket` delivers the player's view; every view replaces
 *   `session.view`, hands the game's photos to the queue that loads them ahead
 *   (`upcoming.js`), tells the room which round this phone is ready for (`loaded`,
 *   `reportReady`), deals photos when the lobby needs a set (`dealIfNeeded`),
 *   lets the phone feel the room's moments (`moments`: a new photo) and repaints. Actions
 *   are sent as small messages; the server decides what happens.
 * - Vibrations come only from `phone.buzz` and its five meanings: the room's moments
 *   (`moments`), each new number of the 3-2-1 (when it is painted, `paintStart`), the
 *   reveal's verdict (as my card pops, `reveal.js`, which `startReveal` hands `buzz`) and my
 *   streak's blocks and bonus (`streak.js`, which `reveal.js` hands `buzz`), a
 *   swap or its refusal (action `swap`), the leaderboard's first coin, its medal landing
 *   and FINAL ROUND landing (`board.js`, which `startBoard` hands `buzz`), and the podium's
 *   charges, bursts and fireworks (`podium.js`, which `startPodium` hands `buzz`).
 * - Entrances: a screen that tells a story when it appears (the reveal: the answer, my
 *   card, its pop, my streak's tower; the leaderboard: who overtakes whom; FINAL ROUND; the
 *   podium's charges) is painted in its final state, and `startReveal`, `startBoard` or `startPodium` has
 *   `reveal.js`, `board.js` or `podium.js` play the story over it once (`session.shown`), so
 *   a repaint or a reconnect never plays it again or cuts it. Their sparks and fireworks
 *   (`sparks.js`) end the moment another screen is painted.
 * - The rating: once the podium's story of a close game from the group's 3rd game has ended,
 *   every phone still on those results asks the phone for the store's own rating window
 *   (`startPodium`, `review.js`, `phone.askForRating`), at most once while the app runs. "How
 *   to play" carries a quiet link to the store's review page instead (`RATE_LINK`).
 * - Photo access is asked once ("Continue", then the phone's own question) and checked
 *   again whenever the app comes back to the front, since the player may have changed
 *   it in the phone's settings. Whenever the app may read photos (from its start, once the
 *   terms are accepted), the photo bucket fills by itself (`photos.startPhotos`), for the
 *   room's "Which photos" and "Photos per player" or this phone's own settings, and rests
 *   while a game runs (`syncPhotoNeeds`).
 * - "Yes" never waits (`readyWith`): the player is ready at once and tells the room so
 *   (`sending`, with the id the upload carries), then the photos go in the background, no
 *   more than the game can show of this player (`sendCount`). If the group then waits for
 *   them, the start's film leader fills its ring as they come in (`startShare`,
 *   `views/overlays.js` `startScreen`).
 *   "Change" cancels an upload still on its way. Every hello names the upload in flight,
 *   so the room never waits for one this phone no longer sends. The Yes that would start the
 *   game (`nudge.startsWith`, its button stamped START) asks "Is everyone here?" on this
 *   phone first in a group's first game (`sayYes`, the 'start' sheet) and then goes
 *   confirmed (`sending` with `start`), so the room starts at once without asking every
 *   phone.
 * - Rendering: `screen()` picks the view for the current state and `createPainter`
 *   repaints only what changed, four times a second and after every change, right on each
 *   second of the 3-2-1 (`paintStart`, which keeps its film leader on the room's clock with
 *   `countdown.js`), and the moment the room's timer ends. The timer bar is one animation
 *   per timer that the browser runs by itself (`syncBar`), pinned to that moment on the
 *   server's clock (`clock.js`, learned from every view), over the timer's length the view
 *   carries (`total`). The arrow
 *   of a row that scrolls sideways (`ui.sidewaysRow`: the lobby's players, the reactions)
 *   follows its row after every paint and every scroll (`ui.syncRow`).
 * - The flag: ⚑ flags the photo in the room (the others stop seeing it, the round waits)
 *   and opens the report sheet on this phone; Delete, Cancel, the backdrop and the back
 *   button end it (`endFlag`). The sheet is this phone's own intent: the room's views only
 *   close it (its photo is gone, its round is over, someone else's flag came first), so a
 *   view that crosses a Cancel on the wire can never reopen it.
 * - The bubble: while the group waits for one last player, the lobby teases them on every
 *   other phone (`nudge.js`). Every paint first brings this phone's memory of that wait up to
 *   date (`session.nudge`, `nudgeTrack`) and hands the moment's appearance to the lobby
 *   (`context().nudge`, `nudgeAt`), so the bubble comes and goes with the paints that run
 *   anyway; when its part was painted, its line is fitted in the same task (`fitNudge`).
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

import { CLOSE, STATUS } from '../shared/api.js';
import { APP, EMOJIS, LIMITS, PRESETS, REACTIONS, TIMING, balancedRange, isRoomCode, mayPlay, normalizeSetting, normalizeSettings, olderThan, reviewLink, termsToken } from '../shared/config.js';
import { makeId, shuffle } from '../shared/random.js';
import { createRoom, fetchGate, uploadPhotos } from './api.js';
import { playBoard } from './board.js';
import { createClock } from './clock.js';
import { RoomSocket } from './connection.js';
import { cut, nextNumberIn, onTheClock } from './countdown.js';
import { startEffect, stopEffects } from './effects.js';
import { askForRating, askPhotoAccess, buzz, inApp, keepAwake, onBack, onInvite, onResume, openSettings, photoAccess, platform, share, updateLink } from './phone.js';
import { chosenBlobs, heldLayers, holdPhoto, leaveSet, photos, resetPhotos, roll, setNeeds, startPhotos, swap } from './photos.js';
import { playPodium } from './podium.js';
import { playReveal } from './reveal.js';
import { RATING, rateNow } from './review.js';
import { fitNudge, nudgeAt, nudgeTrack, startsWith } from './nudge.js';
import { createPainter } from './render.js';
import { clearSparks } from './sparks.js';
import { device, keyFor, saveDevice, session } from './store.js';
import { photoState, photoUrl, readyFor, shareFor, syncUpcoming } from './upcoming.js';
import { canRemove, floatEmoji, quietScrollbars, stepRow, syncRow, toast } from './ui.js';
import { endScreen } from './views/end.js';
import { gameScreen } from './views/game.js';
import { homeScreen } from './views/home.js';
import { landingScreen } from './views/landing.js';
import { lobbyScreen } from './views/lobby.js';
import { newGameScreen } from './views/newgame.js';
import { boardScreen } from './views/board.js';
import { awayScreen, bannerHtml, joiningScreen, lookScreen, startScreen } from './views/overlays.js';
import { inviteLink, sheetScreen } from './views/sheets.js';
import { welcomeScreen } from './views/welcome.js';

const $ = (id) => document.getElementById(id);
const paintApp = createPainter($('app'));
const paintSheet = createPainter($('sheet'));
const paintLook = createPainter($('look'));
const paintCover = createPainter($('cover'));

let socket = null;
let lastReactAt = 0;
let checkingAccess = false;
/**
 * The round this phone last told the room it is ready for (`reportReady`). Set back whenever
 * the room may not have it: a new connection (a message sent while it broke is lost), or
 * the room forgot (a new deal, or a changed plan after someone left: `roomMark` went down).
 */
let reported = 0;
/** The room's word on that in the last view (`view.me.loaded`); it only grows unless the room forgot. */
let roomMark = 0;
/** The server's clock as this phone knows it (`clock.js`), learned from every view. */
const clock = createClock();
/** The room's timer for the phase on screen, on the server's clock (`clock.timer`). */
let roundTimer = null;
/** When the room deletes the photo this phone flagged by itself, on the server's clock; null without such a flag. */
let flagTimer = null;
/** Whether the cover showed the 3-2-1 at the last paint (its end is the film leader's cut, `paintStart`). */
let counting = false;
/** The paint due on the 3-2-1's next second (`paintStart`). */
let nextNumber = 0;
/** This phone's store page for writing a review ("How to play"), or null (`reviewLink`); the platform never changes while the app runs. */
const RATE_LINK = reviewLink(platform());
/** Where this build gets a newer version (`phone.updateLink`: its store page, TestFlight for a test build), or null in a browser. */
const UPDATE_LINK = updateLink();

/** Whether a newer version of this app is out for this phone's platform (the server's version gate), and it knows where to get it. */
function newerOut() {
  const newest = session.gate.newest[platform()];
  return Boolean(UPDATE_LINK && newest && olderThan(APP.version, newest));
}

/** "Update to play": this app is too old for its server. */
const askUpdate = () => openSheet('update');

const inLobby = (v) => v.phase === 'lobby' || v.phase === 'countdown';
const inRound = (v) => ['load', 'show', 'reveal', 'board'].includes(v.phase);
const canReadPhotos = () => session.access === 'full' || session.access === 'limited';

// ---------- Time ----------

/** Milliseconds left on the room's current timer (frozen while the room holds the round), or null. */
const leftNow = () => clock.left(roundTimer);

const isLate = (v) => v.phase === 'show' && Boolean(v.settings.time) && leftNow() === 0;

function myPick(v) {
  if (v.round.myPick) return v.round.myPick;
  return session.pick && session.pick.photo === v.round.photo ? session.pick.id : null;
}

/**
 * While the room waits for the phones' photos (`view.waiting`), how far the whole table is,
 * 0 to 1: the other phones by what the room knows, this one by whether it holds the photo
 * already (its report may still be on the way); else null.
 */
function loadShare(v) {
  if (!v.waiting || !v.waiting.of || !v.round) return null;
  const target = v.phase === 'board' ? v.round.n + 1 : v.round.n;
  const counted = v.me.loaded >= target;
  const others = v.waiting.ready - (counted ? 1 : 0);
  return (others + (counted ? 1 : shareFor(v.round.n, v.upcoming, target))) / v.waiting.of;
}

/**
 * How far the start's loading is, 0 to 1, for the film leader's ring: while photos are still
 * on their way (`view.uploads`), the others by whether theirs are in and this phone by how
 * much of its upload is sent (`session.sending`); once every photo is in (the game is dealt
 * and the first photo goes to every phone), full. Within one start it only grows: `of` stays
 * the same (anyone leaving or unreadying ends the start), and this phone's upload counts as
 * sent until the room counts it in.
 */
function startShare(v) {
  if (!v || !v.uploads || !v.uploads.of) return 1;
  const mine = v.me.sending && session.sending ? session.sending.share : 0;
  return (v.uploads.done + mine) / v.uploads.of;
}

// ---------- Rendering ----------

function context() {
  return { device, session, view: session.view, flagLeft: clock.left(flagTimer), nudge: nudgeAt(session.view, session.nudge, performance.now()), rateLink: RATE_LINK, updateLink: UPDATE_LINK, newer: newerOut() };
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
 * The leaderboard's entrance, once per board (`session.shown`): `board.js` plays it over the
 * board just painted in its final state (`views/board.js`), in the same task as the paint,
 * cause before effect (the points into the totals, who overtakes whom, the medal to the
 * leader); FINAL ROUND instead falls onto the screen, which shakes and vibrates (`land`) as
 * it lands. With Reduce Motion, or for a board already shown, the final state simply stays.
 * The room's board time (`TIMING.boardMs`) is the story's length and a rest after it.
 */
function startBoard() {
  const v = session.view;
  const screenEl = $('app').firstElementChild;
  const key = `board|${v.code}|${v.round.n}`;
  if (!screenEl || !screenEl.querySelector('[data-part="board"]') || session.shown.has(key)) return;
  session.shown.add(key);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  playBoard(screenEl, buzz);
}

/**
 * The reveal's story, once per round (`session.shown`): `reveal.js` plays it over the round's
 * screen just painted in its final state (`views/game.js`), in the same task as the paint,
 * and makes the verdict felt as my card pops: one firm pulse for a right guess, two for
 * anything else (the room's own results, never the optimistic pick). My streak and what it
 * earned come from the same results (a room that does not send them tells no streak). With Reduce Motion the
 * result simply stays and the verdict is felt at once; a reveal already shown (a repaint, a
 * reconnect) is neither played nor felt again.
 */
function startReveal() {
  const v = session.view;
  const key = `reveal|${v.code}|${v.round.n}`;
  const screenEl = $('app').firstElementChild;
  if (v.phase !== 'reveal' || !screenEl || session.shown.has(key)) return;
  session.shown.add(key);
  const mine = v.round.results && v.round.results[v.me.id];
  const verdict = !mine || !mine.pick ? 'none' : mine.pick === v.round.owner ? 'right' : 'wrong';
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) buzz(verdict === 'right' ? 'yes' : 'no');
  else playReveal(screenEl, { verdict, points: mine ? mine.points : 0, streak: (mine && mine.streak) || 0, bonus: (mine && mine.bonus) || 0 }, buzz);
}

/**
 * The podium's reveal, once per game end (`session.shown`): `podium.js` plays it over the
 * end screen just painted in its final state (`views/end.js`), in the same task as the
 * paint. Reduce Motion, or an end screen already shown, keeps the final state. When the
 * story has ended (at once without it), `RATING.afterMs` later, the phone asks for the
 * store's rating window if `review.js` says this is the moment; the wait holds nothing: it
 * reads the view of that moment, and asks only while this phone still shows the same end
 * screen (not after "Play again" or leaving).
 */
function startPodium() {
  const v = session.view;
  const key = `end|${v.code}`;
  const screenEl = $('app').firstElementChild;
  if (!screenEl || session.shown.has(key)) return;
  session.shown.add(key);
  const story = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? Promise.resolve() : playPodium(screenEl, buzz);
  story.then(() => setTimeout(() => {
    const now = session.view;
    const onEnd = now && now.me && now.code === v.code && (now.phase === 'end' || now.me.onResults);
    if (onEnd && rateNow(now)) askForRating();
  }, RATING.afterMs));
}

/**
 * The photo shown big, for `overlays.lookScreen`: a photo of the choice this phone holds
 * (its preview, and its sharp version above it once decoded), the round's photo this phone
 * holds with "Show again", or the one another phone holds (`round.peek`); else null.
 */
function lookLayers() {
  const v = session.view;
  const look = session.look;
  if (look && look.tile !== undefined) {
    const [base, sharp = null] = heldLayers(look.tile);
    return base ? { key: `tile|${look.tile}`, base, sharp } : null;
  }
  const link = look ? look.photo : v && v.phase === 'board' && v.round.peek ? v.round.photo : null;
  const url = link ? photoUrl(link) : null;
  return url ? { key: link, base: url, sharp: null } : null;
}

/**
 * Paints the start over the lobby (`views/overlays.js` `startScreen`): the film leader, which
 * loads first (its ring as full as `startShare`; felt nowhere). Each new number of the
 * 3-2-1 is felt, a little longer than a tap, and kept on the room's clock (`countdown.js`):
 * a number painted late starts as far into its second as the clock is, and the next one is
 * painted right on its second (one timer for the next number, renewed with every paint, so
 * at most one waits). When the 3-2-1 gives way to the round, the film leader cuts to the
 * photo with one white frame: after this frame's `clearSparks`, so it stays.
 */
function paintStart() {
  const left = leftNow();
  const start = startScreen(session.view, left, startShare(session.view));
  const now = Boolean(start && start.parts.count);
  if (paintCover(start).includes('count') && now) {
    buzz('count');
    onTheClock($('cover'), left);
  }
  if (counting && !now && session.view && inRound(session.view)) cut();
  counting = now;
  clearTimeout(nextNumber);
  const due = now ? nextNumberIn(left) : null;
  if (due !== null) nextNumber = setTimeout(render, due + 1);
}

function render() {
  // The wait for the last player as of now (it stays the same object while the same wait goes on).
  session.nudge = nudgeTrack(session.nudge, session.view, performance.now());
  const changed = paintApp(screen());
  // Its bubble's line is sized to the photos in the same task as the paint, so no frame shows it unfitted.
  if (changed.includes('nudge')) fitNudge(document.querySelector('[data-part="nudge"]'));
  // In the same task as the paint, so no frame shows a bar or an arrow that does not fit.
  syncBar();
  for (const row of $('app').querySelectorAll('[data-sideways]')) syncRow(row);
  // Another screen: the podium's light (sparks, fireworks) belongs to the one before.
  if (changed.includes('layout')) clearSparks();
  if (changed.includes('stage')) startStage();
  if (changed.includes('opts')) startReveal();
  if (changed.includes('board')) startBoard();
  if (changed.includes('podium')) startPodium();
  paintSheet(sheetScreen(context()));
  paintStart();
  paintLook(lookScreen(lookLayers()));
  setHtml($('banner'), bannerHtml(session, performance.now()));
}

/** The timer bar's one animation (`syncBar`), and the end it is pinned to; null without one. */
let shrink = null;
let pinnedEnd = null;
/** The paint due when the timer ends (`syncBar`). */
let timeUp = 0;

/**
 * The timer bar shows what is left of the room's timer, out of its whole length (`view.total`):
 * full that long before the timer ends, empty when it ends. It is one animation per timer,
 * which the browser runs by itself, so the phone does no work for it on any frame. It is
 * pinned to the moment the timer ends on this phone's clock (`clock.endsAt`), so every phone
 * empties its bar together; a view that arrives late or after a reconnect names the same
 * moment and changes nothing, a closer reading of the server's clock or a restarted timer
 * only moves the pin (the bar steps there at once, without starting over), and an app coming
 * back from the background shows the bar where the time stands. While the room holds the
 * round (`paused`) the bar stands where the clock stopped; without a timer it is hidden
 * (`data-off`, the empty track stays). `render` calls this after every paint, so a new bar
 * (the reveal's) gets its animation in the same task as it is painted, and no frame shows it
 * full. The moment the bar is empty the screen is painted again (one timer, renewed with
 * every paint), so "time is up" (the cards grey out, `isLate`) lands with it, not up to a
 * quarter second later.
 */
function syncBar() {
  const bar = $('tbar');
  const v = session.view;
  const total = (v && v.total) || null;
  const left = leftNow();
  const end = clock.endsAt(roundTimer);
  const running = Boolean(bar && total && end !== null);
  clearTimeout(timeUp);
  if (running && left > 0) timeUp = setTimeout(render, left + 1);
  // A bar that was replaced, held or ended lets go of its animation.
  if (shrink && (!running || shrink.effect.target !== bar || shrink.effect.getTiming().duration !== total)) {
    shrink.cancel();
    shrink = null;
  }
  if (!bar) return;
  bar.toggleAttribute('data-off', total === null || left === null);
  if (total === null || left === null) return;
  if (!running) {
    bar.style.transform = `scaleX(${Math.max(0, Math.min(1, left / total))})`;
    return;
  }
  if (!shrink) {
    shrink = bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: total, fill: 'both' });
    pinnedEnd = null;
  }
  if (pinnedEnd !== end) {
    shrink.startTime = end - total;
    pinnedEnd = end;
  }
}

// ---------- Room ----------

/**
 * The first message of every connection; `ahead`: this app loads the game's photos ahead
 * (`upcoming.js`); `uploading`: its upload still on its way, so the room waits for that one
 * and no other (`readyWith`); `asks`: it can show the room-wide "Is everyone here?" and
 * "Start now", the fallback for when the last Yes did not come confirmed
 * (`views/overlays.js`, `views/lobby.js`); `version`: for the server's version gate.
 */
function hello() {
  const uploading = session.sending ? session.sending.upload : null;
  return { type: 'hello', key: keyFor(session.code), name: device.name, avatar: device.avatar, ahead: true, uploading, asks: true, version: APP.version };
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
  cancelSending();
  Object.assign(session, { code: null, view: null, sheet: null, pick: null, conn: 'connecting', shownAt: {}, nudge: null });
  device.room = null;
  if (forget) device.lastRoom = null;
  saveDevice();
  // The set on screen goes with the room; the bucket stays for the next game.
  leaveSet();
  syncPhotoNeeds();
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
  if (status === 'open') {
    session.conn = 'open';
    // A report sent while the old connection broke may be lost: say it again on the first view.
    reported = 0;
  } else if (session.conn !== 'down') {
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
  else if (code === CLOSE.update) {
    // Too old to join here: back on the start screen with the code still typed, so after the update it is one tap.
    exitRoom();
    askUpdate();
  }
}

/**
 * Tells the room the round this phone is ready for (it holds that round's photo,
 * `upcoming.readyFor`), counted no further than the round after the one on screen: the
 * furthest the room ever waits for. So a phone sends one message per round (during the
 * start for round 1, then in each round for the next), however fast its photos arrive, and
 * never one the room already has or that is still on its way (`reported`).
 */
function reportReady() {
  const v = session.view;
  if (!v || !v.me || !v.upcoming || !v.upcoming.length) return;
  const round = v.round ? v.round.n : 0;
  const ready = Math.min(readyFor(Math.max(1, round), v.upcoming), round + 1);
  if (ready <= Math.max(reported, v.me.loaded || 0)) return;
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
  // The timers end at moments on the server's clock, which every view teaches a little better (`clock.js`).
  clock.heard(v.now);
  roundTimer = clock.timer(v.left, v.now, v.paused);
  const flag = v.round && v.round.flag;
  flagTimer = flag && flag.mine ? clock.timer(flag.left, v.now) : null;
  if (!v.me) return;
  if (previous && previous.hostId !== v.hostId && v.hostId === v.me.id) toast('You’re the host now 👑');
  // Back in a lobby (not still looking at the last results): the next game plays its entrances again.
  if (inLobby(v) && !v.me.onResults) session.shown.clear();
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
  // "Is everyone here?" belongs to this phone's last Yes: it closes once that Yes would no
  // longer start the game (someone joined or tapped Change), the group is past that question,
  // or the lobby is over.
  if (session.sheet === 'start' && !(v.start && v.start.mode === 'ask' && startsWith(v, session.confirm === 'yes'))) {
    session.sheet = null;
    session.confirm = null;
  }
  // "Remove?" closes once its player is gone, or may no longer be removed from this phone
  // (they came back online and this phone does not host).
  if (session.sheet === 'remove' && !v.players.some((p) => p.id === session.target && canRemove(v, p))) session.sheet = null;
  if (inRound(v)) photos.spent = true;
  moments(previous, v);
  // The room forgot this phone's readiness (a new deal, a changed plan): it reports again.
  const mark = v.me.loaded || 0;
  if (mark < roomMark || !(v.upcoming && v.upcoming.length)) reported = mark;
  roomMark = mark;
  syncUpcoming(v.upcoming || [], onPhotos);
  reportReady();
  syncPhotoNeeds();
  dealIfNeeded();
  render();
}

/**
 * What the phone feels when the room moves on, once per round: a light tap when a new photo
 * appears for everyone (`show` starts). Only a change between two views counts, so a
 * repaint never vibrates. (The reveal's verdict is felt with its story, `startReveal`.)
 */
function moments(previous, v) {
  const round = (x, phase) => (x && x.phase === phase && x.round ? x.round.n : null);
  if (round(v, 'show') && round(previous, 'show') !== round(v, 'show')) buzz('tap');
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

/**
 * What the photo bucket gathers for: the room's "Which photos" and "Photos per player" in a
 * game, else this phone's own for its next one. It rests from the start until the end
 * screen: the game's photos need the phone then, and nobody chooses photos.
 */
function syncPhotoNeeds() {
  const v = session.view;
  const { size, filter } = photoSettings(v && v.me ? v : { settings: device.settings });
  setNeeds({ filter, size, paused: Boolean(v && v.me && (v.phase === 'countdown' || inRound(v))) });
}

/**
 * How many of the set on screen "Yes" sends: no more than the game can show of one player
 * (`balancedRange`, counting everyone here who may still bring photos; every photo when all
 * are played), and at least an equal share rounded up, so together the photos always fill
 * every round. Fewer photos leave the phone and "Yes" is quicker. If players leave the
 * lobby afterwards, the game may end a round or two earlier.
 */
function sendCount(v) {
  const s = normalizeSettings(v.settings);
  if (!s.rounds) return photos.chosen.length;
  // Everyone may still bring photos but those who said "Yes" without any.
  const owners = Math.max(1, v.players.filter((p) => !(p.ready && !p.sending && p.photoCount === 0)).length);
  return s.fair ? Math.max(Math.ceil(s.rounds / owners), balancedRange(s.rounds, owners).high) : s.rounds;
}

/** Deals a fresh set when the lobby needs one and the app may read photos. */
function dealIfNeeded() {
  const v = session.view;
  if (!v || !v.me || !inLobby(v) || v.me.ready || v.me.onResults || session.sending) return;
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
 * "Yes" (or playing without photos, `count` 0): the player is ready at once. The room hears
 * it first (`sending`, with a new upload id, and `start` when it is the confirmed last Yes,
 * `sayYes`), then the photos' big versions are gathered
 * (`blobsOf`; usually there already) and uploaded in the background with that id. The lobby
 * shows "✓ Ready" meanwhile; if the group waits for the upload, the start's film leader fills
 * its ring as it goes (`startShare`). If it fails, the player is not ready any more (the room
 * hears "unready") and is told; after "Change" (`cancelSending`) it ends without a word. It holds nothing
 * of the room across its waits: what it finds afterwards it reads from `session` again.
 */
async function readyWith(count, blobsOf, start = false) {
  if (session.sending || !session.code) return;
  const code = session.code;
  const job = { upload: makeId(Math.random, 16), count, share: 0, stop: new AbortController() };
  session.sending = job;
  send({ type: 'sending', upload: job.upload, start });
  render();
  let problem = 'Upload failed. Try again.';
  try {
    let blobs;
    try {
      blobs = await blobsOf();
    } catch {
      problem = 'These photos would not load. Tap No for others.';
      throw new Error('unreadable');
    }
    if (session.sending !== job) return;
    const onProgress = (share) => {
      job.share = share;
      render();
    };
    await uploadPhotos(code, keyFor(code), blobs, { upload: job.upload, signal: job.stop.signal, onProgress });
  } catch {
    if (session.sending !== job) return;
    send({ type: 'unready' });
    toast(problem);
  } finally {
    if (session.sending === job) session.sending = null;
    render();
  }
}

/**
 * "Yes" or "Play without photos" (`kind` 'yes' or 'guess'). When this phone's Yes would start
 * the game (`startsWith`) in a group's first game (`view.start.mode` 'ask'), it asks "Is
 * everyone here?" first: the 'start' sheet opens and remembers which Yes it was
 * (`session.confirm`). Otherwise it says Yes at once, confirmed (`start`) when it is the Yes
 * that starts the game, so the room never asks every phone.
 */
function sayYes(kind) {
  const v = session.view;
  if (!v || !v.me) return;
  const starts = startsWith(v, kind === 'yes');
  if (starts && v.start && v.start.mode === 'ask') {
    session.confirm = kind;
    openSheet('start');
    return;
  }
  readyAs(kind, starts);
}

/** Says Yes with the set on screen (no more of it than the game can show of this player, `sendCount`), or without photos; `start` confirms the last Yes. */
function readyAs(kind, start) {
  if (kind === 'guess') {
    readyWith(0, async () => [], start);
    return;
  }
  const count = Math.min(sendCount(session.view), photos.chosen.length);
  readyWith(count, () => chosenBlobs(count), start);
}

/** "Change" (or leaving the room): an upload still on its way is cancelled and will not count. */
function cancelSending() {
  const job = session.sending;
  session.sending = null;
  if (job) job.stop.abort();
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
    if (!mayPlay(APP.version, session.gate)) return askUpdate();
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
    syncPhotoNeeds();
    render();
  },
  async start() {
    if (needName() || session.creating) return;
    session.creating = true;
    render();
    try {
      enterRoom(await createRoom(device.settings));
    } catch (error) {
      if (error.status === STATUS.update) askUpdate();
      else toast('Could not create a game. Try again.');
    } finally {
      session.creating = false;
      render();
    }
  },
  join() {
    const code = session.invite || (($('code') || {}).value || '').toUpperCase();
    if (!mayPlay(APP.version, session.gate)) {
      // Remembered for after the update (the code field shows it), so the game is one tap away.
      if (isRoomCode(code)) {
        device.lastRoom = code;
        saveDevice();
      }
      return askUpdate();
    }
    if (needName()) return;
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
    syncPhotoNeeds();
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
  guess: () => sayYes('guess'),
  no: () => {
    const v = session.view;
    if (!v || !v.me) return;
    const { size, filter } = photoSettings(v);
    roll(size, filter, render);
  },
  yes: () => sayYes('yes'),
  /** "Is everyone here?" Yes, on this phone: its Yes goes, confirmed, and the game starts (the count from the latest view). */
  yesstart: () => {
    const kind = session.confirm;
    session.confirm = null;
    openSheet(null);
    if (kind) readyAs(kind, true);
  },
  /**
   * A tap on a photo of the choice: it turns to the swaps left and the new photo pops in (a
   * light tap), or it is refused: the photo shakes, with a red ✕ when none is left (felt twice).
   */
  swap: (index) => {
    if (session.sending) return;
    buzz(swap(Number(index), render) ? 'tap' : 'no');
  },
  unready: () => {
    cancelSending();
    send({ type: 'unready' });
    render();
  },
  /** The room-wide "Is everyone here?" Yes, or "Start now" (the fallback): the room starts the game if everyone still said "Yes". */
  go: () => send({ type: 'start', go: true }),
  /** The room-wide "Is everyone here?" No: the group waits, and "Start now" appears on every phone once everyone said "Yes". */
  wait: () => send({ type: 'start', go: false }),
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
  /** The arrow of a row that scrolls sideways (`ui.sidewaysRow`): a page the way it points. */
  sideways: (value, el) => stepRow(el),
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

// A list scrolling inside a screen shows its thin scrollbar only meanwhile.
quietScrollbars();
// A sideways row's arrow turns as its row reaches an end, swiped or paged (scroll events do
// not bubble, so one listener for the whole page catches them on their way down).
document.addEventListener('scroll', (e) => {
  const row = e.target instanceof Element ? e.target.parentElement : null;
  if (row && row.hasAttribute('data-sideways')) syncRow(row);
}, { capture: true, passive: true });

// ---------- Boot ----------

if (!inApp()) {
  // The website: the invite page for "/<CODE>", the plain one for "/".
  const code = location.pathname.slice(1).toUpperCase();
  paintApp(landingScreen(isRoomCode(code) ? code : null));
} else {
  syncPhotoNeeds();
  // Once per start: whether a newer version is out, and whether this one may still play.
  fetchGate().then((gate) => {
    session.gate = gate;
    render();
  });
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
}
