/**
 * The shape of a room and the small questions every other game module asks about it.
 *
 * Mechanisms: part of the pure game logic (`src/game/`). The room's Durable Object
 * (`src/room.js`) keeps one such plain JSON object per room, persists it after every
 * change and hands it to `rules.js` with each event. Nothing here touches storage,
 * sockets or the clock: time and randomness always come in as arguments.
 *
 * Invariants:
 * - A player's `key` is the secret their app proves its identity with. It never leaves
 *   the server: `view.js` builds what apps see from an explicit list of fields.
 * - `players` stays in join order; the host role and ties always follow that order.
 * - No two players in a room share an avatar (`freeAvatar`).
 * - Photo ids in the state are the only references to stored photo blobs: whatever the
 *   state no longer references, the Durable Object deletes (`referencedPhotoIds`).
 * - `banned` holds the keys of players the host removed, so they cannot rejoin this
 *   room; like every key it never leaves the server.
 * - `final` (the last game's standings) exists only while someone is on the end screen.
 *
 * Room shape:
 *   { code, createdAt, touchedAt, closed, hostId, settings, phase, deadline, start,
 *     players: [Player], banned: [key], game: Game | null, final: Final | null }
 *   start: how the next game starts once everyone said "Yes" (`startMode`): 'ask' (the
 *   first game of a group asks "Is everyone here?"), 'button' (someone answered No: the
 *   group starts with "Start now") or 'auto' (by itself; a room saved before this existed)
 *   phase: 'lobby' | 'countdown' | 'load' | 'show' | 'reveal' | 'board' | 'end'
 *   Player: { id, key, name, avatar, joinedAt, connected, goneAt, ready, sending, photos: [id],
 *             score, streak, onResults, ahead, asks }
 *   (ready: their chosen photos are in; sending: they said "Yes" and their photos are on
 *   their way, the id their upload carries, else null; onResults: still on the last game's
 *   end screen; ahead: the app loads the game's photos ahead and says which round it is
 *   ready for, see `holdsRound`; asks: the app can ask "Is everyone here?" and show "Start
 *   now", see `startMode`)
 *   Final:  { players: [{ id, name, avatar, score }], stats: Game.stats }
 *   Game:   { plan: [{ owner, photo }], round, mode, zoom: { x, y }, options: [id],
 *             answers: { [id]: { pick, ms } }, loaded: { [id]: round }, waiting, shownAt,
 *             results: { [id]: { pick, points } } | null,
 *             peeks: { [id]: until }, flag: { by, until } | null, pausedAt: ms | null,
 *             stats: { fastest: { id, ms } | null, fooled: { [id]: count } } }
 *   (The game exists from its deal on: once everyone's photos are in during the start
 *   (`countdown`), `round` 0 until it starts. `loaded`: the round each phone is ready for;
 *   `waiting`: during the start, the phones are getting the first photo before the 3-2-1;
 *   in a game, a leaderboard whose time is up waits for the phones to be ready for the next
 *   round. `peeks`: who holds "Show again"
 *   and until when; `flag`: who flagged the photo on screen and when it is deleted unless
 *   they cancel. While either holds the round, its clock stands still: `pausedAt` says
 *   since when, `rules.js` `settleClock`.)
 */

import { BLOCKED_WORDS, EMOJIS, LIMITS, TIMING, normalizeSettings } from '../../web/shared/config.js';

/** A room code from the unambiguous code alphabet. */
export function makeCode(rng) {
  let code = '';
  for (let i = 0; i < LIMITS.codeLength; i++) code += LIMITS.codeAlphabet[Math.floor(rng() * LIMITS.codeAlphabet.length)];
  return code;
}

export function newRoom(code, now, settings) {
  return {
    code,
    createdAt: now,
    touchedAt: now,
    closed: false,
    hostId: null,
    settings: normalizeSettings(settings),
    phase: 'lobby',
    deadline: null,
    start: 'ask',
    players: [],
    banned: [],
    game: null,
    final: null,
  };
}

export function newPlayer({ id, key, name, avatar, now, ahead = false, asks = false }) {
  return {
    id,
    key,
    name,
    avatar,
    joinedAt: now,
    connected: true,
    goneAt: null,
    ready: false,
    sending: null,
    photos: [],
    score: 0,
    streak: 0,
    onResults: false,
    ahead,
    asks,
  };
}

/** A game dealt with its plan: nothing played yet (`round` 0) until the 3-2-1 ends. */
export function newGame(plan) {
  return {
    plan, round: 0, mode: null, zoom: null, options: [], answers: {}, loaded: {}, waiting: false, shownAt: null, results: null,
    peeks: {}, flag: null, pausedAt: null, stats: { fastest: null, fooled: {} },
  };
}

/** A name reduced to plain letters, so "F.u_c k" or "fvck" style tricks are caught too. */
const lettersOf = (name) => name.toLowerCase()
  .replace(/[0@4]/g, (c) => ({ 0: 'o', '@': 'a', 4: 'a' }[c])).replace(/[1!]/g, 'i').replace(/3/g, 'e').replace(/[5$]/g, 's')
  .replace(/ß/g, 'ss').normalize('NFD').replace(/[^a-z]/g, '');

/**
 * Trimmed, control characters removed, cut to the limit; `''` if nothing is left. A name
 * with a blocked word (`BLOCKED_WORDS`) becomes "Player": the app stores' rules ask for a
 * filter on what players show each other.
 */
export function cleanName(value) {
  if (typeof value !== 'string') return '';
  const name = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, LIMITS.nameMax).trim();
  const letters = lettersOf(name);
  return name && BLOCKED_WORDS.some((w) => letters.includes(w)) ? 'Player' : name;
}

/**
 * The wanted avatar if no one else in the room has it, else a random free one. Avatars are
 * unique per room because they are how players tell each other apart in the small vote
 * markers (LIMITS.maxPlayers is below the number of avatars, so one is always free).
 */
export function freeAvatar(room, wanted, rng, exceptId = null) {
  const taken = new Set(room.players.filter((p) => p.id !== exceptId).map((p) => p.avatar));
  if (EMOJIS.includes(wanted) && !taken.has(wanted)) return wanted;
  const free = EMOJIS.filter((e) => !taken.has(e));
  return free[Math.floor(rng() * free.length)];
}

export const playerById = (room, id) => room.players.find((p) => p.id === id) || null;
export const playerByKey = (room, key) => room.players.find((p) => p.key === key) || null;
export const connectedPlayers = (room) => room.players.filter((p) => p.connected);

/** A round is on (its photo is stored and may be shown): guessing, the reveal, or the leaderboard after it. */
export const inGame = (room) => ['load', 'show', 'reveal', 'board'].includes(room.phase);

/** The plan entry of the round on screen, or null. */
export function currentEntry(room) {
  return room.game && inGame(room) ? room.game.plan[room.game.round - 1] || null : null;
}

/** The plan entry after the current one, or null (apps before the game's photos were loaded ahead preload its photo). */
export function nextEntry(room) {
  return room.game && inGame(room) ? room.game.plan[room.game.round] || null : null;
}

/**
 * The plan entries every phone may load now, in play order: from the deal on (the game's
 * start, right before its 3-2-1) all of them, during a game the round on screen and every
 * later one; else none.
 * The one answer to "which photos may reach the phones": the photo route serves exactly
 * these (`isServablePhoto`) and the view lists them (`view.upcoming`). All of them become
 * loadable at the same moment and in a random order, so nothing tells whose a photo is.
 */
export function upcomingEntries(room) {
  const g = room.game;
  if (!g || !(room.phase === 'countdown' || inGame(room))) return [];
  return g.plan.slice(Math.max(0, g.round - 1));
}

/** The answer time speed points and late answers are measured against (with no clock: a reference time). */
export function answerTimeMs(settings, untimedReferenceMs) {
  return settings.time ? settings.time * 1000 : untimedReferenceMs;
}

/**
 * The full length of the timer the players see in the room's phase (ms), or null when the
 * phase has none: the 3-2-1 (not while the start still waits for photos or phones), the
 * answer time (when there is a clock), the reveal, and the leaderboard (when the next round
 * comes by itself, and not while it waits for the phones' photos). The one place that says
 * how long each phase's timer runs: `rules.js` sets its deadlines from it, `view.js` hands
 * it to the apps as the timer bar's length.
 */
export function timerMs(room) {
  switch (room.phase) {
    case 'countdown': return room.game && !room.game.waiting ? TIMING.countdownMs : null;
    case 'show': return room.settings.time ? room.settings.time * 1000 : null;
    case 'reveal': return TIMING.revealMs;
    case 'board': return room.settings.auto && !room.game.waiting ? TIMING.boardMs : null;
    default: return null;
  }
}

/**
 * Every photo id the room still needs. Lobby and start: each ready player's chosen photos
 * (they are theirs until the game starts). During a game: the photo on screen and all
 * photos of later rounds (earlier ones are deleted as soon as their round is over). After
 * the game: none.
 */
export function referencedPhotoIds(room) {
  if (room.phase === 'lobby' || room.phase === 'countdown') return room.players.flatMap((p) => p.photos);
  if (!inGame(room)) return [];
  return room.game.plan.slice(room.game.round - 1).map((e) => e.photo).filter(Boolean);
}

/** A photo may be downloaded only while its game is dealt and its round is not over (`upcomingEntries`). */
export function isServablePhoto(room, photoId) {
  return Boolean(photoId) && upcomingEntries(room).some((e) => e.photo === photoId);
}

/**
 * Whether a player's phone holds what round `r` needs: its photo. An app that loads ahead
 * (`player.ahead`) says the round it is ready for (`game.loaded`); an app before that
 * reports only the photo on screen, during its round's `load`, so the room waits for it
 * only there. Past the last round there is nothing to hold.
 */
export function holdsRound(room, player, r) {
  const g = room.game;
  if (r > g.plan.length) return true;
  const mark = g.loaded[player.id] || 0;
  return player.ahead || room.phase === 'load' ? mark >= r : true;
}

/** How many of the connected phones hold what round `r` needs: `{ ready, of }`. Offline phones never count: they would hold up everyone. */
export function phonesReady(room, r) {
  const connected = connectedPlayers(room);
  return { ready: connected.filter((p) => holdsRound(room, p, r)).length, of: connected.length };
}

/**
 * While a game waits for the phones' photos, which round it waits for and how many phones
 * hold it: `{ round, ready, of }`, else null. It waits in `load` (for that round) and on a
 * leaderboard whose time is up (`game.waiting`, for the next round). The start's own wait
 * for the first photo is not counted to the apps: it is short, and every phone's report
 * would otherwise repaint every phone (`view.js`).
 */
export function photoWait(room) {
  const g = room.game;
  const r = room.phase === 'load' ? g.round : room.phase === 'board' && g.waiting ? g.round + 1 : null;
  return r === null ? null : { round: r, ...phonesReady(room, r) };
}

/** The player said "Yes" (or "Play without photos"): their photos are in, or on their way. */
export const saidYes = (p) => p.ready || Boolean(p.sending);

/**
 * The game may start: everyone (at least two) is here and said "Yes", and at least one
 * photo is in the game or on its way.
 */
export function everyoneSaidYes(room) {
  if (room.phase !== 'lobby' && room.phase !== 'countdown') return false;
  const ps = room.players;
  return ps.length >= LIMITS.minPlayers
    && ps.every((p) => p.connected && saidYes(p))
    && ps.some((p) => p.photos.length > 0 || p.sending);
}

/**
 * How the next game starts once everyone said "Yes" (`room.start`): it asks, or waits for
 * "Start now", only while some app here can show that (`player.asks`); a room of apps from
 * before them starts by itself, as they expect.
 */
export function startMode(room) {
  const mode = room.start || 'auto';
  return mode !== 'auto' && connectedPlayers(room).some((p) => p.asks) ? mode : 'auto';
}

/** Every photo is in: nobody's upload is still on its way, so the game can be dealt. */
export const photosIn = (room) => room.players.every((p) => !p.sending);

/**
 * While the start waits for photos still on their way: how many of the players who said
 * "Yes" have their photos in, `{ done, of }`; else null.
 */
export function uploadWait(room) {
  if (room.phase !== 'countdown' || room.game) return null;
  return { done: room.players.filter((p) => p.ready).length, of: room.players.length };
}

/**
 * An upload's id as the app makes it (`makeId`, `web/js/main.js` "Yes"): it only tells one
 * upload of this player from another, so it needs no secrecy (the player's key authorises
 * the upload).
 */
export const isUploadId = (value) => typeof value === 'string' && /^[a-z0-9]{8,32}$/.test(value);
