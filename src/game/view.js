/**
 * What one player's app may see of a room: the only data that ever leaves the server
 * over the room's WebSocket.
 *
 * Mechanisms: part of the pure game logic; the room's Durable Object sends
 * `viewFor(room, playerId, now)` to a phone after every change that changes what that phone
 * sees, as a full snapshot (rooms are small, so there are no diffs to get out of sync after
 * a reconnect).
 *
 * Invariants (the game depends on them):
 * - Built from an explicit list of fields, never by copying a player or the room, so a
 *   player's secret `key` can never leak.
 * - The owner of the photo on screen stays hidden until the reveal, and so do the other
 *   players' picks: before that an app only learns who has answered, and its own pick.
 * - Who flagged a photo stays hidden: an app only learns that it is flagged, and whether
 *   by itself (`round.flag.mine`, so it shows the report sheet while the others wait).
 * - The phase's timer: `left` (ms) and `total` (its full length, from `timerMs`), with
 *   `now`, the server's time when the view was made. A phone never trusts its own clock's
 *   date: it learns how its clock differs from the server's (`web/js/clock.js`) and counts
 *   down to `now + left`, the timer's end on the server's clock, which is the same in every
 *   view of the same timer however late a view arrives. No app needs to know how long a
 *   phase lasts. `paused` says the round's clock stands still (someone holds the round), so
 *   apps stop counting down; `left` is then frozen at the moment it stopped.
 * - `now` and every `left` change by themselves as time passes (`CLOCK_FIELDS`); the room
 *   leaves them out when it decides whether a phone's view changed (`src/room.js`).
 * - A photo link is relative (`API.photo`); the app prefixes the server's origin.
 * - `upcoming` lists the links of the photos a phone may load now, in play order (from the
 *   deal on, during the start: the whole game; then from the round on screen; `null` for a
 *   deleted one), with nothing about their owners (`upcomingEntries`). `round.next` stays
 *   for apps that load only the next photo. While a game waits for the phones to be ready
 *   for a round, `waiting` says how many are (`photoWait`); `me.loaded` is the round this
 *   phone said it is ready for, so an app reports again when the room forgot it (a changed
 *   plan).
 * - A player's `ready` is their "Yes" (`saidYes`): their photos are in, or still on their
 *   way (`sending`, the upload runs in the background). While the start waits for photos
 *   still on their way, `uploads` says how many players have theirs in (`uploadWait`).
 */

import { API } from '../../web/shared/api.js';
import { currentEntry, inGame, nextEntry, photoWait, playerById, saidYes, timerMs, upcomingEntries, uploadWait } from './state.js';

/**
 * The fields of a view that change by themselves with time (the server's time, and the
 * time left on the phase's timer and on a flag), not with the game. Every other field
 * changes only when something happens in the room.
 */
export const CLOCK_FIELDS = ['now', 'left'];

/** The round's clock stands still (someone holds the round, `rules.js` `settleClock`). */
const isPaused = (room) => Boolean(room.game && room.game.pausedAt != null && inGame(room));

/**
 * The timer the app shows for the current phase: `{ left, total }` in ms, or nulls when the
 * phase has none. The answer time ends at the moment the players see, before the room's
 * own deadline (which waits a little longer for answers on the wire).
 */
function timer(room, now) {
  const total = timerMs(room);
  if (total === null || room.deadline === null) return { left: null, total: null };
  const at = isPaused(room) ? room.game.pausedAt : now;
  const end = room.phase === 'show' ? room.game.shownAt + total : room.deadline;
  return { left: Math.max(0, end - at), total };
}

function roundView(room, playerId, now) {
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
    // `left`: until the flagged photo is deleted by itself (the flagger's sheet counts it down).
    flag: g.flag ? { mine: g.flag.by === playerId, left: Math.max(0, g.flag.until - now) } : null,
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
  const g = room.game;
  const { left, total } = timer(room, now);
  const wait = g ? photoWait(room) : null;
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    settings: room.settings,
    me: me ? {
      id: me.id, ready: saidYes(me), sending: Boolean(me.sending), photoCount: me.photos.length, onResults: me.onResults, loaded: g ? g.loaded[me.id] || 0 : 0,
    } : null,
    players: room.players.map((p) => ({
      id: p.id, name: p.name, avatar: p.avatar, connected: p.connected, ready: saidYes(p), sending: Boolean(p.sending), photoCount: p.photos.length, score: p.score,
    })),
    now,
    left,
    total,
    paused: isPaused(room),
    upcoming: upcomingEntries(room).map((e) => (e.photo ? API.photo(room.code, e.photo) : null)),
    waiting: wait ? { ready: wait.ready, of: wait.of } : null,
    uploads: uploadWait(room),
    round: inGame(room) ? roundView(room, playerId, now) : null,
    final: room.final && (room.phase === 'end' || (me && me.onResults)) ? finalView(room.final) : null,
  };
}
