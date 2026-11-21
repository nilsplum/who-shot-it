/**
 * What one player's browser may see of a room: the only data that ever leaves the server
 * over the room's WebSocket.
 *
 * Mechanisms: part of the pure game logic; the room's Durable Object sends
 * `viewFor(room, playerId, now)` to every socket after every change, as a full snapshot
 * (rooms are small, so there are no diffs to get out of sync after a reconnect).
 *
 * Invariants (the game depends on them):
 * - Built from an explicit list of fields, never by copying a player or the room, so a
 *   player's secret `key` can never leak.
 * - The owner of the photo on screen stays hidden until the reveal, and so do the other
 *   players' picks: before that a browser only learns who has answered, and its own pick.
 * - Remaining times are relative (`left`, in ms), so a browser's wrong clock never matters.
 */

import { API } from '../../web/shared/api.js';
import { currentEntry, inGame, nextEntry, playerById } from './state.js';

/** Milliseconds left on the timer the browser shows for the current phase, or null. */
function msLeft(room, now) {
  const left = (t) => Math.max(0, t - now);
  if (room.phase === 'countdown' || room.phase === 'reveal') return room.deadline !== null ? left(room.deadline) : null;
  if (room.phase === 'show' && room.settings.time) return left(room.game.shownAt + room.settings.time * 1000);
  return null;
}

function roundView(room, playerId) {
  const g = room.game;
  const entry = currentEntry(room);
  const next = nextEntry(room);
  const revealed = room.phase === 'reveal';
  return {
    n: g.round,
    total: g.plan.length,
    photo: entry.photo ? API.photo(room.code, entry.photo) : null,
    next: next && next.photo ? API.photo(room.code, next.photo) : null,
    mode: g.mode,
    zoom: g.zoom,
    options: g.options.filter((id) => playerById(room, id)),
    answered: Object.keys(g.answers),
    myPick: g.answers[playerId] ? g.answers[playerId].pick : null,
    owner: revealed ? entry.owner : null,
    results: revealed ? g.results : null,
  };
}

/** Fastest right guess and best fooler (most wrong guesses on their photos) of the game. */
function statsView(room) {
  const { fastest, fooled } = room.game.stats;
  let fooler = null;
  for (const p of room.players) {
    const count = fooled[p.id] || 0;
    if (count > 0 && (!fooler || count > fooler.count)) fooler = { id: p.id, count };
  }
  return {
    fastest: fastest && playerById(room, fastest.id) ? { id: fastest.id, ms: fastest.ms } : null,
    fooler,
  };
}

export function viewFor(room, playerId, now) {
  const me = playerById(room, playerId);
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    settings: room.settings,
    me: me
      ? { id: me.id, ready: me.ready, photoCount: me.photos.length, pool: { token: me.pool.token, count: me.pool.count, done: me.pool.done } }
      : null,
    players: room.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, connected: p.connected, ready: p.ready, photoCount: p.photos.length, score: p.score,
    })),
    left: msLeft(room, now),
    round: inGame(room) ? roundView(room, playerId) : null,
    stats: room.phase === 'end' && room.game ? statsView(room) : null,
  };
}
