/**
 * Shared test helpers: a deterministic random source and a quick way to build rooms
 * through the real event rules (never by hand-writing state), so tests exercise the same
 * paths as production.
 */
import { apply } from '../src/game/rules.js';
import { newRoom } from '../src/game/state.js';

/** Deterministic pseudo-random numbers in [0, 1) (mulberry32). */
export function seededRandom(seed = 42) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const T0 = Date.UTC(2026, 10, 21, 12, 0, 0);

/**
 * A room where `names` have joined in order (keys are `key-<name>`), at time `now`.
 * `ahead`: their apps load the game's photos ahead (today's apps); without it they join
 * like an app that reports only the photo on screen.
 */
export function roomWith(names, { now = T0, settings = {}, rng = seededRandom(), ahead = false } = {}) {
  let room = newRoom('ABCD', now, settings);
  for (const name of names) room = apply(room, { type: 'join', key: `key-${name}-0000000000`, name, avatar: '🦊', ahead }, now, rng);
  return room;
}

export const idOf = (room, name) => room.players.find((p) => p.name === name).id;
