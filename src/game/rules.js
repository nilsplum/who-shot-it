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
 * - Host-only events (settings, next, kick) are ignored from anyone else.
 * - "Play again" (`again`) is anyone's and idempotent: the first one on the end screen
 *   opens a new game under the same code (the lobby) and keeps the final standings
 *   (`final`) for everyone else, who stay on their results (`onResults`) until they tap it
 *   too (they join) or leave; the new game waits for them like for anyone not ready.
 * - A room is never closed by its players leaving: an empty room goes back to an empty
 *   lobby (no host, no game) and keeps its code until it idles out (TIMING.roomIdleMs).
 * - The round's clock stands still while anyone holds the round ("Show again" on the
 *   board, `peeks`; a flag on the photo, `flag`): nothing moves the round on by itself
 *   meanwhile, and when it is let go the clock runs on from where it stood (`settleClock`).
 *   Every hold ends by itself (a peek TIMING.peekHoldMs after its last renewal, a flag after
 *   TIMING.flagMs), so neither a lost connection nor a player can stop a game.
 * - How long each phase's timer runs comes from one place, `timerMs` (`state.js`), which
 *   the view also hands to the apps.
 * - Any player may flag the photo on screen (`flag`): the others stop seeing it and the
 *   round waits while the flagger decides; Delete (`report`) removes it for everyone at
 *   once, Cancel lets the round go on, and a flag that ends any other way (time, the
 *   flagger gone) deletes it. The app store and EU content rules ask for a report and a
 *   block mechanism; the host's "Remove" is the block, and a removed player's key cannot
 *   rejoin the room. `flag` and `report` name the round they mean, so a late tap never hits
 *   the next photo.
 * - Phases: lobby -> countdown -> (load -> show -> reveal -> board) per round -> end ->
 *   lobby ("Play again"). The reveal is always timed; the board (the leaderboard between
 *   the photos) is timed when "Next round" is automatic and waits for the host's "Next"
 *   otherwise. The last round has no board: its reveal ends the game, so the final
 *   standings stay secret until the podium (the board before it is the apps' "FINAL
 *   ROUND", `views/board.js`). "Last" is the plan as it is then: a player who left took
 *   their later rounds with them.
 * - The game is dealt when the 3-2-1 starts (`deal`: which photos, in which order), so the
 *   phones load its photos during the countdown. The countdown runs only while its deal
 *   holds: everyone is ready and every dealt photo is still in its owner's hands
 *   (`dealHolds`); anything else (someone unreadies, leaves, is removed, a setting changes)
 *   returns to the lobby, and the next 3-2-1 deals afresh.
 * - The photos never make a round wait mid-way: round 1 shows once every connected phone is
 *   ready for it, and a leaderboard whose time is up waits (`game.waiting`) until every
 *   connected phone is ready for the next round; both at most TIMING.loadMaxMs.
 */

import { EFFECTS, LIMITS, TIMING, normalizeSetting, normalizeSettings } from '../../web/shared/config.js';
import { shuffle } from '../../web/shared/random.js';
import { buildPlan } from './plan.js';
import { pointsFor } from './score.js';
import {
  answerTimeMs, canStart, cleanName, connectedPlayers, currentEntry, freeAvatar, inGame, makeId,
  newGame, newPlayer, phonesReady, playerById, playerByKey, timerMs,
} from './state.js';

const inLobby = (room) => room.phase === 'lobby' || room.phase === 'countdown';
/** The round's photo is no longer being guessed (its reveal or its leaderboard). */
const afterGuessing = (room) => room.phase === 'reveal' || room.phase === 'board';
const isHost = (room, playerId) => Boolean(playerId) && room.hostId === playerId;
/** Someone holds the round, so its clock stands still: "Show again" on the leaderboard, or a flag on the photo. */
const held = (g) => Boolean(g && (g.flag || Object.keys(g.peeks || {}).length));
/** The round's clock stands still (`settleClock`); a game saved before `pausedAt` existed has none. */
const stopped = (g) => Boolean(g && g.pausedAt != null);
/** `now` plus the phase's timer, or null when the phase has none (`timerMs`). */
const timerEnd = (room, now, extra = 0) => {
  const ms = timerMs(room);
  return ms === null ? null : now + ms + extra;
};

// ---------- Phase transitions ----------

/** Back to the lobby with everyone's readiness kept (a 3-2-1 that stops); its deal is dropped. */
function backToLobby(room) {
  room.phase = 'lobby';
  room.deadline = null;
  room.game = null;
}

/**
 * Everyone is ready: the game is dealt now (which photos come up, in which random order)
 * and the 3-2-1 starts, so every phone loads the photos during the countdown. The players
 * keep their photos until it ends (`startGame`).
 */
function deal(room, now, rng) {
  room.game = newGame(buildPlan(room.players, room.settings, rng));
  room.phase = 'countdown';
  room.deadline = timerEnd(room, now);
}

/** The 3-2-1's deal still holds: every dealt photo is still in its owner's hands. */
function dealHolds(room) {
  return room.game.plan.every((e) => {
    const owner = playerById(room, e.owner);
    return Boolean(owner && owner.photos.includes(e.photo));
  });
}

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

/** The 3-2-1 is over: the dealt photos now belong to the game, and readiness is spent for it. */
function startGame(room, now, rng) {
  for (const p of room.players) {
    p.ready = false;
    p.photos = [];
    p.score = 0;
    p.streak = 0;
  }
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
  g.waiting = false;
  g.shownAt = null;
  g.results = null;
  g.peeks = {};
  g.flag = null;
  g.pausedAt = null;
  room.phase = 'load';
  room.deadline = now + TIMING.loadMaxMs;
}

function show(room, now) {
  room.phase = 'show';
  room.game.shownAt = now;
  // Answers still on the wire when the time is up count: the room waits a little longer.
  room.deadline = timerEnd(room, now, TIMING.answerGraceMs);
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
    const points = pointsFor({ correct, ms: a.ms, streak: p.streak, own: p.id === owner }, s);
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
  room.deadline = timerEnd(room, now);
}

/** The leaderboard between the photos; the round's photo stays for "Show again". */
function board(room, now) {
  room.phase = 'board';
  room.deadline = timerEnd(room, now);
}

/** Ends expired "Show again" holds and those of players who are gone. */
function settlePeeks(room, now) {
  const g = room.game;
  if (!g || !g.peeks) return;
  for (const [id, until] of Object.entries(g.peeks)) {
    if (until <= now || !playerById(room, id)) delete g.peeks[id];
  }
}

/**
 * Deletes the photo on screen for everyone, as a report (Delete) or a flag that ended
 * without Cancel does: while it is still being guessed the game moves on to the next photo
 * (nobody scores), during the reveal and the leaderboard it just disappears (and with it
 * any "Show again").
 */
function deletePhoto(room, now, rng) {
  const g = room.game;
  currentEntry(room).photo = null;
  g.flag = null;
  g.peeks = {};
  if (!afterGuessing(room)) nextRound(room, now, rng);
}

/** A flag ends by itself: after TIMING.flagMs, or when its player is gone; either way the photo is deleted. */
function settleFlag(room, now, rng) {
  const g = room.game;
  if (!g || !g.flag) return;
  if (!inGame(room)) g.flag = null;
  else if (now >= g.flag.until || !playerById(room, g.flag.by)) deletePhoto(room, now, rng);
}

/**
 * A game saved by the previous server version gets today's shape once: a held board's
 * remaining time (`paused`, with no deadline) becomes a clock that stopped now with that
 * much left; the list of phones that had the photo on screen (`loaded`) becomes their mark
 * for that round; a missing `waiting` means none.
 */
function upgradeGame(room, now) {
  const g = room.game;
  if (!g) return;
  if (g.paused !== undefined) {
    if (g.paused !== null) {
      room.deadline = now + g.paused;
      g.pausedAt = now;
    }
    delete g.paused;
  }
  if (Array.isArray(g.loaded)) g.loaded = Object.fromEntries(g.loaded.map((id) => [id, g.round]));
  if (g.waiting === undefined) g.waiting = false;
}

/**
 * The round's clock follows whether the round is held: it stops when someone takes hold
 * (`pausedAt` notes when) and, once everyone has let go, runs on from where it stood: the
 * deadline and the moment the photo was shown move by the time it stood still, so the answer
 * time and the speed points stay exactly as they were. A new round starts with a running clock.
 */
function settleClock(room, now) {
  const g = room.game;
  if (!g) return;
  const hold = held(g) && inGame(room);
  if (hold && !stopped(g)) g.pausedAt = now;
  else if (!hold && stopped(g)) {
    const stood = now - g.pausedAt;
    if (room.deadline !== null) room.deadline += stood;
    if (g.shownAt !== null) g.shownAt += stood;
    g.pausedAt = null;
  }
}

function nextRound(room, now, rng) {
  startRound(room, room.game.round + 1, now, rng);
}

function endGame(room) {
  room.phase = 'end';
  room.deadline = null;
  // The final standings outlive the game: whoever is still on the end screen after
  // someone opened the next game keeps seeing them.
  room.final = {
    players: room.players.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, score: p.score })),
    stats: room.game ? room.game.stats : { fastest: null, fooled: {} },
  };
}

/**
 * Removes a player for good: their photos go at once (the round on screen moves on if it
 * was theirs and still being guessed), and so do their answers. Their later rounds leave the
 * plan, which renumbers the rounds after the current one, so the phones' readiness marks
 * start over (the apps report again, `view.me.loaded`). During the 3-2-1 the deal no longer
 * holds and the countdown starts over (`dealHolds`).
 */
function removePlayer(room, playerId, now, rng) {
  if (!playerById(room, playerId)) return;
  room.players = room.players.filter((p) => p.id !== playerId);
  const g = room.game;
  if (!g || !inGame(room)) return;
  const current = g.round - 1;
  const entry = g.plan[current];
  const before = g.plan.length;
  g.plan = g.plan.filter((e, i) => i <= current || e.owner !== playerId);
  if (g.plan.length !== before) g.loaded = {};
  delete g.answers[playerId];
  delete g.loaded[playerId];
  if (entry && entry.owner === playerId) {
    entry.photo = null;
    if (!afterGuessing(room)) nextRound(room, now, rng);
  }
}

// ---------- Events ----------

const HANDLERS = {
  /**
   * First message of every socket: joins the room, or resumes the player with this key.
   * `ahead` says the app loads the game's photos ahead (`holdsRound`); an app that was
   * updated meanwhile says so on its next connection.
   */
  join(room, { key, name, avatar, ahead }, now, rng) {
    const clean = cleanName(name);
    if (!clean || typeof key !== 'string' || !key || room.banned.includes(key)) return;
    const existing = playerByKey(room, key);
    if (existing) {
      existing.connected = true;
      existing.goneAt = null;
      existing.ahead = ahead === true;
      // Name and avatar only change in the lobby, so nobody is renamed mid-game.
      if (inLobby(room)) {
        existing.name = clean;
        if (freeAvatar(room, avatar, rng, existing.id) === avatar) existing.avatar = avatar;
      }
      return;
    }
    if (room.players.length >= LIMITS.maxPlayers) return;
    const id = makeId(rng);
    room.players.push(newPlayer({ id, key, name: clean, avatar: freeAvatar(room, avatar, rng), now, ahead: ahead === true }));
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
    // Any change restarts a running countdown (and its deal), so nobody starts with settings they missed.
    if (room.phase === 'countdown') backToLobby(room);
  },

  /**
   * A phone is ready for `round` (it holds that round's photo and the next
   * LIMITS.readyAhead). Marks only grow; from the 3-2-1 on, for any round of the plan.
   */
  loaded(room, { playerId, round }) {
    const g = room.game;
    if (!g || !(room.phase === 'countdown' || inGame(room)) || !playerById(room, playerId) || !Number.isInteger(round) || round < 1) return;
    g.loaded[playerId] = Math.max(g.loaded[playerId] || 0, Math.min(round, g.plan.length));
  },

  /** An answer counts with the time it took; while the round's clock stands still, as of the moment it stopped. */
  answer(room, { playerId, pick }, now) {
    const g = room.game;
    if (room.phase !== 'show' || !playerById(room, playerId) || g.answers[playerId] || !g.options.includes(pick)) return;
    const at = stopped(g) ? g.pausedAt : now;
    const total = answerTimeMs(room.settings, TIMING.untimedReferenceMs);
    if (room.settings.time && at > g.shownAt + total + TIMING.answerGraceMs) return;
    g.answers[playerId] = { pick, ms: Math.min(total, Math.max(0, at - g.shownAt)) };
  },

  next(room, { playerId }, now, rng) {
    if (isHost(room, playerId) && room.phase === 'board') nextRound(room, now, rng);
  },

  /**
   * "Show again" on the leaderboard: while any player holds it (their app renews the hold
   * every TIMING.peekRenewMs), everyone sees the round's photo and the round is held, so its
   * clock stands still (`settleClock`).
   */
  peek(room, { playerId, on }, now) {
    const g = room.game;
    const entry = currentEntry(room);
    if (room.phase !== 'board' || !playerById(room, playerId) || !entry || !entry.photo) return;
    if (on) g.peeks[playerId] = now + TIMING.peekHoldMs;
    else delete g.peeks[playerId];
  },

  /** "Play again": opens the next game for everyone, or joins it when it is open already. */
  again(room, { playerId }, now) {
    const p = playerById(room, playerId);
    if (!p) return;
    if (room.phase === 'end') {
      toLobby(room, now);
      for (const q of room.players) q.onResults = q.id !== p.id;
    } else if (inLobby(room)) p.onResults = false;
  },

  /**
   * ⚑ on the photo, while it is guessed or revealed: `on` flags it (the others stop seeing
   * it, the round is held), `on: false` from the flagger cancels. One flag at a time; who
   * flagged stays hidden from the others (`view.js`).
   */
  flag(room, { playerId, round, on }, now) {
    const g = room.game;
    const entry = currentEntry(room);
    if (!playerById(room, playerId) || !entry || !entry.photo || round !== g.round) return;
    if (!on) {
      if (g.flag && g.flag.by === playerId) g.flag = null;
    } else if (!g.flag && (room.phase === 'show' || room.phase === 'reveal')) {
      g.flag = { by: playerId, until: now + TIMING.flagMs };
    }
  },

  /**
   * Delete on a flagged photo (or a report from an app before the flag, which sends no
   * round): the photo on screen is deleted for everyone at once (`deletePhoto`).
   */
  report(room, { playerId, round }, now, rng) {
    const entry = currentEntry(room);
    if (!playerById(room, playerId) || !entry || !entry.photo || (round !== undefined && round !== room.game.round)) return;
    deletePhoto(room, now, rng);
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
  // A held round does not move on by itself: its clock stands still until it is let go.
  if (inGame(room) && stopped(g)) return false;
  const due = room.deadline !== null && now >= room.deadline;
  const connected = connectedPlayers(room);
  switch (room.phase) {
    case 'lobby':
      if (canStart(room)) {
        deal(room, now, rng);
        return true;
      }
      return false;
    case 'countdown':
      if (!canStart(room) || !dealHolds(room)) {
        backToLobby(room);
        return true;
      }
      if (due) {
        startGame(room, now, rng);
        return true;
      }
      return false;
    case 'load':
      if (due || everyoneHolds(room, g.round)) {
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
        if (g.round >= g.plan.length) endGame(room);
        else board(room, now);
        return true;
      }
      return false;
    case 'board':
      // Its time is up: the next round comes once every phone is ready for it; meanwhile the
      // board waits, at most TIMING.loadMaxMs (a phone still loading then catches up).
      if (g.waiting ? due || everyoneHolds(room, g.round + 1) : due && everyoneHolds(room, g.round + 1)) {
        nextRound(room, now, rng);
        return true;
      }
      if (due) {
        g.waiting = true;
        room.deadline = now + TIMING.loadMaxMs;
        return true;
      }
      return false;
    default:
      return false;
  }
}

/** Every connected phone holds what round `r` needs (`phonesReady`); with nobody connected, the wait's own limit decides. */
function everyoneHolds(room, r) {
  const { ready, of } = phonesReady(room, r);
  return of > 0 && ready === of;
}

/** Applies every due timer and transition until the room is stable. */
function settle(room, now, rng) {
  if (now >= room.touchedAt + TIMING.roomIdleMs) {
    room.closed = true;
    return;
  }
  upgradeGame(room, now);
  if (inLobby(room)) {
    for (const p of room.players.slice()) {
      if (!p.connected && p.goneAt !== null && now >= p.goneAt + TIMING.lobbyDropMs) removePlayer(room, p.id, now, rng);
    }
  }
  // The last player is gone: an empty lobby keeps the code for whoever comes back with it.
  if (!room.players.length && (room.phase !== 'lobby' || room.hostId || room.final)) {
    toLobby(room, now);
    room.hostId = null;
    room.final = null;
  }
  // The final standings go once nobody looks at them any more.
  if (room.final && room.phase !== 'end' && !room.players.some((p) => p.onResults)) room.final = null;

  // The host role: always held by a player, handed on in join order when the host leaves.
  // During a game (and on the end screen) the host is needed for "Next" (and the settings
  // of the next game), so an offline host also hands over after a short grace while
  // someone else is here. In
  // the lobby the host keeps the role until dropped, so a short trip to the phone's
  // settings (photo access) never costs it.
  const host = playerById(room, room.hostId);
  const firstConnected = connectedPlayers(room)[0] || null;
  if (!host) room.hostId = (firstConnected || room.players[0] || {}).id || null;
  else if (!inLobby(room) && !host.connected && firstConnected && now >= host.goneAt + TIMING.hostGraceMs) room.hostId = firstConnected.id;

  settlePeeks(room, now);
  settleFlag(room, now, rng);
  settleClock(room, now);
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
  // A room saved by an earlier server version may lack a setting added since; normalizing
  // gives it every current setting (its default), so no rule ever reads an undefined one.
  next.settings = normalizeSettings(next.settings);
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
  // A stopped clock's deadline means nothing until the round is let go; the holds' own
  // ends (below) wake the room for that.
  if (room.deadline !== null && !stopped(room.game)) times.push(room.deadline);
  if (room.game && room.game.peeks) times.push(...Object.values(room.game.peeks));
  if (room.game && room.game.flag) times.push(room.game.flag.until);
  const someoneHere = connectedPlayers(room).length > 0;
  for (const p of room.players) {
    if (p.connected || p.goneAt === null) continue;
    if (inLobby(room)) times.push(p.goneAt + TIMING.lobbyDropMs);
    else if (p.id === room.hostId && someoneHere) times.push(p.goneAt + TIMING.hostGraceMs);
  }
  return Math.min(...times);
}
