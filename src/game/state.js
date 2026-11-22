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
 *   { code, createdAt, touchedAt, closed, hostId, settings, phase, deadline,
 *     players: [Player], banned: [key], game: Game | null, final: Final | null }
 *   phase: 'lobby' | 'countdown' | 'load' | 'show' | 'reveal' | 'board' | 'end'
 *   Player: { id, key, name, avatar, joinedAt, connected, goneAt, ready, photos: [id],
 *             score, streak, onResults }   (onResults: still on the last game's end screen)
 *   Final:  { players: [{ id, name, avatar, score }], stats: Game.stats }
 *   Game:   { plan: [{ owner, photo }], round, mode, zoom: { x, y }, options: [id],
 *             answers: { [id]: { pick, ms } }, loaded: [id], shownAt,
 *             results: { [id]: { pick, points } } | null,
 *             peeks: { [id]: until }, flag: { by, until } | null, pausedAt: ms | null,
 *             stats: { fastest: { id, ms } | null, fooled: { [id]: count } } }
 *   (`peeks`: who holds "Show again" and until when; `flag`: who flagged the photo on
 *   screen and when it is deleted unless they cancel. While either holds the round, its
 *   clock stands still: `pausedAt` says since when, `rules.js` `settleClock`.)
 */

import { BLOCKED_WORDS, EMOJIS, LIMITS, TIMING, normalizeSettings } from '../../web/shared/config.js';

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** A random id from `rng` (the server passes a crypto-backed one, so ids are unguessable). */
export function makeId(rng, length = 12) {
  let id = '';
  for (let i = 0; i < length; i++) id += ID_ALPHABET[Math.floor(rng() * ID_ALPHABET.length)];
  return id;
}

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
    players: [],
    banned: [],
    game: null,
    final: null,
  };
}

export function newPlayer({ id, key, name, avatar, now }) {
  return {
    id,
    key,
    name,
    avatar,
    joinedAt: now,
    connected: true,
    goneAt: null,
    ready: false,
    photos: [],
    score: 0,
    streak: 0,
    onResults: false,
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

/** The plan entry after the current one, or null (apps preload its photo). */
export function nextEntry(room) {
  return room.game && inGame(room) ? room.game.plan[room.game.round] || null : null;
}

/** The answer time speed points and late answers are measured against (with no clock: a reference time). */
export function answerTimeMs(settings, untimedReferenceMs) {
  return settings.time ? settings.time * 1000 : untimedReferenceMs;
}

/**
 * The full length of the timer the players see in the room's phase (ms), or null when the
 * phase has none: the 3-2-1, the answer time (when there is a clock), the reveal, and the
 * leaderboard (when the next round comes by itself). The one place that says how long each
 * phase's timer runs: `rules.js` sets its deadlines from it, `view.js` hands it to the apps
 * as the timer bar's length.
 */
export function timerMs(room) {
  switch (room.phase) {
    case 'countdown': return TIMING.countdownMs;
    case 'show': return room.settings.time ? room.settings.time * 1000 : null;
    case 'reveal': return TIMING.revealMs;
    case 'board': return room.settings.auto ? TIMING.boardMs : null;
    default: return null;
  }
}

/**
 * Every photo id the room still needs. Lobby: each ready player's chosen photos. During a
 * game: the photo on screen and all photos of later rounds (earlier ones are deleted as
 * soon as their round is over). After the game: none.
 */
export function referencedPhotoIds(room) {
  if (room.phase === 'lobby' || room.phase === 'countdown') return room.players.flatMap((p) => p.photos);
  if (!inGame(room)) return [];
  return room.game.plan.slice(room.game.round - 1).map((e) => e.photo).filter(Boolean);
}

/** A photo may be downloaded only while it is on screen or next in line. */
export function isServablePhoto(room, photoId) {
  const current = currentEntry(room);
  const next = nextEntry(room);
  return Boolean(photoId) && ((current && current.photo === photoId) || (next && next.photo === photoId));
}

/** Everyone (at least two) is here and ready, and at least one photo is in the game. */
export function canStart(room) {
  if (room.phase !== 'lobby' && room.phase !== 'countdown') return false;
  const ps = room.players;
  return ps.length >= LIMITS.minPlayers
    && ps.every((p) => p.connected && p.ready)
    && ps.some((p) => p.photos.length > 0);
}
