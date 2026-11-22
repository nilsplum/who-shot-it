/**
 * What one player's app may see of a room: the only data that ever leaves the server
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
 *   players' picks: before that an app only learns who has answered, and its own pick.
 * - Remaining times are relative (`left`, in ms), so a phone's wrong clock never matters;
 *   `paused` says the clock stands still ("Show again" held), so apps stop counting down.
 * - A photo link is relative (`API.photo`); the app prefixes the server's origin.
 */

import { API } from '../../web/shared/api.js';
import { currentEntry, inGame, nextEntry, playerById } from './state.js';

/** Milliseconds left on the timer the app shows for the current phase, or null. */
function msLeft(room, now) {
  const left = (t) => Math.max(0, t - now);
  if (room.phase === 'board' && room.game.paused !== null) return room.game.paused;
  if (room.phase === 'countdown' || room.phase === 'reveal' || room.phase === 'board') return room.deadline !== null ? left(room.deadline) : null;
  if (room.phase === 'show' && room.settings.time) return left(room.game.shownAt + room.settings.time * 1000);
  return null;
}

function roundView(room, playerId) {
  const g = room.game;
  const entry = currentEntry(room);
  const next = nextEntry(room);
  const revealed = room.phase === 'reveal' || room.phase === 'board';
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
    peek: room.phase === 'board' && Object.keys(g.peeks || {}).length > 0,
  };
}

/**
 * The last game's end screen: its players with their final scores, the fastest right
 * guess and the best fooler (most wrong guesses on their photos).
 */
function finalView(final) {
  const { fastest, fooled } = final.stats;
  let fooler = null;
  for (const p of final.players) {
    const count = fooled[p.id] || 0;
    if (count > 0 && (!fooler || count > fooler.count)) fooler = { id: p.id, count };
  }
  return {
    players: final.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score })),
    fastest: fastest && final.players.some((p) => p.id === fastest.id) ? { id: fastest.id, ms: fastest.ms } : null,
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
    me: me ? { id: me.id, ready: me.ready, photoCount: me.photos.length, onResults: me.onResults } : null,
    players: room.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, connected: p.connected, ready: p.ready, photoCount: p.photos.length, score: p.score,
    })),
    left: msLeft(room, now),
    paused: Boolean(room.game && room.phase === 'board' && room.game.paused !== null),
    round: inGame(room) ? roundView(room, playerId) : null,
    final: room.final && (room.phase === 'end' || (me && me.onResults)) ? finalView(room.final) : null,
  };
}
