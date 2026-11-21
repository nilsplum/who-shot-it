/**
 * The game's state machine: every event a room can receive, and every timer it runs.
 *
 * Mechanisms: part of the pure game logic. The room's Durable Object (`src/room.js`) turns
 * each app message, upload and alarm into an event, calls `apply`, persists the new
 * room, deletes photos it no longer references, sends every player their view and sets
 * its one alarm to `nextWake`. The server is the only authority over phases, timers,
 * scores, the round plan and the host role; apps only render what `view.js` sends.
 *
 * Invariants:
 * - `apply` is pure: it never mutates the room it gets (it works on a clone) and takes
 *   time and randomness as arguments, so every rule is testable without a runtime.
 * - After every event, `settle` runs all due timers and derived transitions until the room
 *   is stable, so no state can wait for a timer that already passed. Consequently
 *   `nextWake` never returns a time in the past for a room `apply` returned.
 * - Host-only events (settings, resolve, next, again, kick) are ignored from anyone else.
 * - Any player may report the photo on screen: it is removed for everyone at once (the
 *   app store and EU content rules ask for a report and a block mechanism; the host's
 *   "Remove" is the block, and a removed player's key cannot rejoin the room).
 * - Phases: lobby -> countdown -> (load -> show -> reveal) per round -> end -> lobby.
 *   A countdown falls back to the lobby whenever "everyone is ready" stops being true.
 */

import { EFFECTS, LIMITS, TIMING, normalizeSetting } from '../../web/shared/config.js';
import { buildPlan, shuffle } from './plan.js';
import { pointsFor } from './score.js';
import {
  answerTimeMs, canStart, cleanName, connectedPlayers, currentEntry, freeAvatar, inGame, makeId,
  newPlayer, playerById, playerByKey,
} from './state.js';

const inLobby = (room) => room.phase === 'lobby' || room.phase === 'countdown';
const isHost = (room, playerId) => Boolean(playerId) && room.hostId === playerId;

// ---------- Phase transitions ----------

function toLobby(room, now) {
  room.phase = 'lobby';
  room.deadline = null;
  room.game = null;
  for (const p of room.players) {
    p.ready = false;
    p.photos = [];
    p.score = 0;
    p.streak = 0;
    // Players still offline get a fresh grace period in the new lobby.
    if (!p.connected) p.goneAt = now;
  }
}

function startGame(room, now, rng) {
  const plan = buildPlan(room.players, room.settings, rng);
  if (!plan.length) {
    room.phase = 'lobby';
    room.deadline = null;
    return;
  }
  // The chosen photos now belong to the plan; readiness is spent for this game.
  for (const p of room.players) {
    p.ready = false;
    p.photos = [];
    p.score = 0;
    p.streak = 0;
  }
  room.game = {
    plan, round: 0, mode: null, zoom: null, options: [], answers: {}, loaded: [], shownAt: null, results: null,
    stats: { fastest: null, fooled: {} },
  };
  startRound(room, 1, now, rng);
}

/** Owner plus everyone else, or owner plus 3 random others with "Answers: Only 4". */
function answerOptions(room, owner, rng) {
  const ids = room.players.map((p) => p.id);
  const limit = room.settings.answers;
  if (!limit) return shuffle(ids, rng);
  const others = shuffle(ids.filter((id) => id !== owner), rng).slice(0, limit - 1);
  return shuffle([owner, ...others], rng);
}

function startRound(room, n, now, rng) {
  const g = room.game;
  if (n > g.plan.length) {
    endGame(room);
    return;
  }
  const entry = g.plan[n - 1];
  const mode = room.settings.mode;
  g.round = n;
  g.mode = mode === 'mix' ? EFFECTS[Math.floor(rng() * EFFECTS.length)] : mode;
  // Zoom starts on a random point away from the edges.
  g.zoom = { x: 20 + Math.round(rng() * 60), y: 20 + Math.round(rng() * 60) };
  g.options = answerOptions(room, entry.owner, rng);
  g.answers = {};
  g.loaded = [];
  g.shownAt = null;
  g.results = null;
  room.phase = 'load';
  room.deadline = now + TIMING.loadMaxMs;
}

function show(room, now) {
  const s = room.settings;
  room.phase = 'show';
  room.game.shownAt = now;
  room.deadline = s.time ? now + s.time * 1000 + TIMING.answerGraceMs : null;
}

function reveal(room, now) {
  const g = room.game;
  const s = room.settings;
  const owner = g.plan[g.round - 1].owner;
  const results = {};
  let wrong = 0;
  for (const p of room.players) {
    const a = g.answers[p.id];
    if (!a) {
      p.streak = 0;
      results[p.id] = { pick: null, points: 0 };
      continue;
    }
    const correct = a.pick === owner;
    p.streak = correct ? p.streak + 1 : 0;
    const points = pointsFor({ correct, ms: a.ms, streak: p.streak }, s);
    p.score += points;
    results[p.id] = { pick: a.pick, points };
    // Stats only count other people's guesses: the owner knows their own photo.
    if (p.id !== owner) {
      if (correct && (!g.stats.fastest || a.ms < g.stats.fastest.ms)) g.stats.fastest = { id: p.id, ms: a.ms };
      if (!correct) wrong += 1;
    }
  }
  g.stats.fooled[owner] = (g.stats.fooled[owner] || 0) + wrong;
  g.results = results;
  room.phase = 'reveal';
  room.deadline = s.auto ? now + TIMING.revealMs : null;
}

function nextRound(room, now, rng) {
  startRound(room, room.game.round + 1, now, rng);
}

function endGame(room) {
  room.phase = 'end';
  room.deadline = null;
}

/**
 * Removes a player for good: their photos go at once (the round on screen moves on if it
 * was theirs and still being guessed), and so do their answers.
 */
function removePlayer(room, playerId, now, rng) {
  if (!playerById(room, playerId)) return;
  room.players = room.players.filter((p) => p.id !== playerId);
  const g = room.game;
  if (!g || !inGame(room)) return;
  const current = g.round - 1;
  const entry = g.plan[current];
  g.plan = g.plan.filter((e, i) => i <= current || e.owner !== playerId);
  delete g.answers[playerId];
  g.loaded = g.loaded.filter((id) => id !== playerId);
  if (entry && entry.owner === playerId) {
    entry.photo = null;
    if (room.phase !== 'reveal') nextRound(room, now, rng);
  }
}

// ---------- Events ----------

const HANDLERS = {
  /** First message of every socket: joins the room, or resumes the player with this key. */
  join(room, { key, name, avatar }, now, rng) {
    const clean = cleanName(name);
    if (!clean || typeof key !== 'string' || !key || room.banned.includes(key)) return;
    const existing = playerByKey(room, key);
    if (existing) {
      existing.connected = true;
      existing.goneAt = null;
      // Name and avatar only change in the lobby, so nobody is renamed mid-game.
      if (inLobby(room)) {
        existing.name = clean;
        if (freeAvatar(room, avatar, rng, existing.id) === avatar) existing.avatar = avatar;
      }
      return;
    }
    if (room.players.length >= LIMITS.maxPlayers) return;
    const id = makeId(rng);
    room.players.push(newPlayer({ id, key, name: clean, avatar: freeAvatar(room, avatar, rng), now }));
    room.hadPlayers = true;
    if (!room.hostId) room.hostId = id;
  },

  disconnect(room, { playerId }, now) {
    const p = playerById(room, playerId);
    if (!p) return;
    p.connected = false;
    p.goneAt = now;
  },

  leave(room, { playerId }, now, rng) {
    removePlayer(room, playerId, now, rng);
  },

  /** The player's chosen photos are stored; zero photos means "just guess". */
  ready(room, { playerId, photos }) {
    const p = playerById(room, playerId);
    if (!p || !inLobby(room) || !Array.isArray(photos)) return;
    p.ready = true;
    p.photos = photos.filter((id) => typeof id === 'string').slice(0, room.settings.photos);
  },

  unready(room, { playerId }) {
    const p = playerById(room, playerId);
    if (!p || !inLobby(room)) return;
    p.ready = false;
    p.photos = [];
  },

  setting(room, { playerId, key, value }) {
    if (!isHost(room, playerId) || !inLobby(room)) return;
    const v = normalizeSetting(key, value);
    if (v === undefined || room.settings[key] === v) return;
    room.settings[key] = v;
    // Everyone chose a set of the old size, so a new size asks everyone to choose again.
    if (key === 'photos') {
      for (const p of room.players) {
        p.ready = false;
        p.photos = [];
      }
    }
    // Any change restarts a running countdown, so nobody starts with settings they missed.
    if (room.phase === 'countdown') {
      room.phase = 'lobby';
      room.deadline = null;
    }
  },

  loaded(room, { playerId, round }) {
    const g = room.game;
    if (room.phase !== 'load' || !g || round !== g.round || !playerById(room, playerId) || g.loaded.includes(playerId)) return;
    g.loaded.push(playerId);
  },

  answer(room, { playerId, pick }, now) {
    const g = room.game;
    if (room.phase !== 'show' || !playerById(room, playerId) || g.answers[playerId] || !g.options.includes(pick)) return;
    const total = answerTimeMs(room.settings, TIMING.untimedReferenceMs);
    if (room.settings.time && now > g.shownAt + total + TIMING.answerGraceMs) return;
    g.answers[playerId] = { pick, ms: Math.min(total, Math.max(0, now - g.shownAt)) };
  },

  resolve(room, { playerId }, now) {
    if (isHost(room, playerId) && room.phase === 'show') reveal(room, now);
  },

  next(room, { playerId }, now, rng) {
    if (isHost(room, playerId) && room.phase === 'reveal') nextRound(room, now, rng);
  },

  again(room, { playerId }, now) {
    if (isHost(room, playerId) && room.phase === 'end') toLobby(room, now);
  },

  /**
   * A player reports the photo on screen. It is deleted at once, for everyone: while it is
   * still being guessed the game moves on to the next photo (nobody scores), during the
   * reveal it just disappears.
   */
  report(room, { playerId }, now, rng) {
    const entry = currentEntry(room);
    if (!playerById(room, playerId) || !entry || !entry.photo) return;
    entry.photo = null;
    if (room.phase !== 'reveal') nextRound(room, now, rng);
  },

  /** The host removes a player (and all their photos) and keeps them out of this room. */
  kick(room, { playerId, target }, now, rng) {
    const p = playerById(room, target);
    if (!isHost(room, playerId) || !p || target === playerId) return;
    room.banned.push(p.key);
    removePlayer(room, target, now, rng);
  },

  tick() {},
};

// ---------- Timers and derived transitions ----------

/** Runs at most one phase transition; returns whether one happened. */
function transition(room, now, rng) {
  if (inGame(room) && room.players.length < LIMITS.minPlayers) {
    endGame(room);
    return true;
  }
  const g = room.game;
  const due = room.deadline !== null && now >= room.deadline;
  const connected = connectedPlayers(room);
  switch (room.phase) {
    case 'lobby':
      if (canStart(room)) {
        room.phase = 'countdown';
        room.deadline = now + TIMING.countdownMs;
        return true;
      }
      return false;
    case 'countdown':
      if (!canStart(room)) {
        room.phase = 'lobby';
        room.deadline = null;
        return true;
      }
      if (due) {
        startGame(room, now, rng);
        return true;
      }
      return false;
    case 'load':
      if (due || (connected.length > 0 && connected.every((p) => g.loaded.includes(p.id)))) {
        show(room, now);
        return true;
      }
      return false;
    case 'show':
      if (due || (connected.length > 0 && connected.every((p) => g.answers[p.id]))) {
        reveal(room, now);
        return true;
      }
      return false;
    case 'reveal':
      if (due) {
        nextRound(room, now, rng);
        return true;
      }
      return false;
    default:
      return false;
  }
}

/** Applies every due timer and transition until the room is stable. */
function settle(room, now, rng) {
  if (now >= room.touchedAt + TIMING.roomIdleMs) {
    room.closed = true;
    return;
  }
  if (inLobby(room)) {
    for (const p of room.players.slice()) {
      if (!p.connected && p.goneAt !== null && now >= p.goneAt + TIMING.lobbyDropMs) removePlayer(room, p.id, now, rng);
    }
  }
  // The last player is gone: the room and everything in it is deleted. A new room that
  // nobody has joined yet stays until it idles out.
  if (room.hadPlayers && room.players.length === 0) {
    room.closed = true;
    return;
  }

  // The host role: always held by a player, handed on in join order when the host leaves.
  // During a game (and on the end screen) the host is needed for "Next" and "Play again",
  // so an offline host also hands over after a short grace while someone else is here. In
  // the lobby the host keeps the role until dropped, so a short trip to the phone's
  // settings (photo access) never costs it.
  const host = playerById(room, room.hostId);
  const firstConnected = connectedPlayers(room)[0] || null;
  if (!host) room.hostId = (firstConnected || room.players[0] || {}).id || null;
  else if (!inLobby(room) && !host.connected && firstConnected && now >= host.goneAt + TIMING.hostGraceMs) room.hostId = firstConnected.id;

  for (let i = 0; i < 100 && transition(room, now, rng); i++);
}

/**
 * Applies one event and returns the new room (the given room is never mutated).
 * @param event { type, playerId?, ... } as built by the Durable Object
 */
export function apply(room, event, now, rng) {
  if (!room || room.closed) return room;
  const handler = HANDLERS[event.type];
  if (!handler) return room;
  const next = structuredClone(room);
  // Activity keeps a room alive; timers and lost connections are not activity.
  if (event.type !== 'tick' && event.type !== 'disconnect') next.touchedAt = now;
  handler(next, event, now, rng);
  settle(next, now, rng);
  return next;
}

/** When the room next needs a `tick`, or null for a closed room. */
export function nextWake(room) {
  if (!room || room.closed) return null;
  const times = [room.touchedAt + TIMING.roomIdleMs];
  if (room.deadline !== null) times.push(room.deadline);
  const someoneHere = connectedPlayers(room).length > 0;
  for (const p of room.players) {
    if (p.connected || p.goneAt === null) continue;
    if (inLobby(room)) times.push(p.goneAt + TIMING.lobbyDropMs);
    else if (p.id === room.hostId && someoneHere) times.push(p.goneAt + TIMING.hostGraceMs);
  }
  return Math.min(...times);
}
