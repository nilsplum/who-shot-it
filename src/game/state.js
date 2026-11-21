/**
 * The shape of a room and the small questions every other game module asks about it.
 *
 * Mechanisms: part of the pure game logic (`src/game/`). The room's Durable Object
 * (`src/room.js`) keeps one such plain JSON object per room, persists it after every
 * change and hands it to `rules.js` with each event. Nothing here touches storage,
 * sockets or the clock: time and randomness always come in as arguments.
 *
 * Invariants:
 * - A player's `key` is the secret their browser proves its identity with. It never
 *   leaves the server: `view.js` builds what browsers see from an explicit list of fields.
 * - `players` stays in join order; the host role and ties always follow that order.
 * - No two players in a room share an avatar (`freeAvatar`).
 * - Photo ids in the state are the only references to stored photo blobs: whatever the
 *   state no longer references, the Durable Object deletes (`referencedPhotoIds`).
 *
 * Room shape:
 *   { code, createdAt, touchedAt, closed, hadPlayers, hostId, settings, phase, deadline,
 *     players: [Player], game: Game | null }
 *   phase: 'lobby' | 'countdown' | 'load' | 'show' | 'reveal' | 'end'
 *   Player: { id, key, name, avatar, joinedAt, connected, goneAt, ready, photos: [id],
 *             score, streak, pool: { token, count, done, at } }
 *   Game:   { plan: [{ owner, photo }], round, mode, zoom: { x, y }, options: [id],
 *             answers: { [id]: { pick, ms } }, loaded: [id], shownAt,
 *             results: { [id]: { pick, points } } | null,
 *             stats: { fastest: { id, ms } | null, fooled: { [id]: count } } }
 */

import { EMOJIS, LIMITS, normalizeSettings } from '../../web/shared/config.js';

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
    hadPlayers: false,
    hostId: null,
    settings: normalizeSettings(settings),
    phase: 'lobby',
    deadline: null,
    players: [],
    game: null,
  };
}

/** A fresh, empty iPhone pool. The token is the secret part of the shortcut's upload link. */
export function newPool(rng) {
  return { token: makeId(rng, 24), count: 0, done: false, at: null };
}

export function newPlayer({ id, key, name, avatar, now, rng }) {
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
    pool: newPool(rng),
  };
}

/** Trimmed, control characters removed, cut to the limit; `''` if nothing is left. */
export function cleanName(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, LIMITS.nameMax).trim();
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
export const playerByPoolToken = (room, token) => room.players.find((p) => p.pool.token === token) || null;
export const connectedPlayers = (room) => room.players.filter((p) => p.connected);

export const inGame = (room) => room.phase === 'load' || room.phase === 'show' || room.phase === 'reveal';

/** The plan entry of the round on screen, or null. */
export function currentEntry(room) {
  return room.game && inGame(room) ? room.game.plan[room.game.round - 1] || null : null;
}

/** The plan entry after the current one, or null (browsers preload its photo). */
export function nextEntry(room) {
  return room.game && inGame(room) ? room.game.plan[room.game.round] || null : null;
}

/** Answer time used for scoring and for the timer bar. */
export function answerTimeMs(settings, untimedReferenceMs) {
  return settings.time ? settings.time * 1000 : untimedReferenceMs;
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

/** Pool tokens whose uploaded photos must be kept (the pool has photos and has not expired). */
export function referencedPoolTokens(room) {
  return room.players.filter((p) => p.pool.count > 0).map((p) => p.pool.token);
}

export function canAddToPool(room, token) {
  const player = playerByPoolToken(room, token);
  return Boolean(player) && !player.pool.done && player.pool.count < LIMITS.poolMax;
}

/** Everyone (at least two) is here and ready, and at least one photo is in the game. */
export function canStart(room) {
  if (room.phase !== 'lobby' && room.phase !== 'countdown') return false;
  const ps = room.players;
  return ps.length >= LIMITS.minPlayers
    && ps.every((p) => p.connected && p.ready)
    && ps.some((p) => p.photos.length > 0);
}
