/**
 * What a browser may see (src/game/view.js): no secrets, no spoilers.
 */
import { expect, test } from 'vitest';
import { TIMING } from '../../web/shared/config.js';
import { apply } from '../../src/game/rules.js';
import { viewFor } from '../../src/game/view.js';
import { T0, idOf, roomWith, seededRandom } from '../helpers.js';

const rng = seededRandom(3);

function inShow() {
  let room = roomWith(['Ann', 'Ben', 'Cleo']);
  for (const p of room.players) room = apply(room, { type: 'ready', playerId: p.id, photos: [`${p.name}-photo`] }, T0, rng);
  room = apply(room, { type: 'tick' }, T0 + TIMING.countdownMs, rng);
  for (const p of room.players) room = apply(room, { type: 'loaded', playerId: p.id, round: 1 }, T0 + TIMING.countdownMs, rng);
  return room;
}

test("no player key, not even the viewer's own or a removed player's, appears in a view", () => {
  let room = inShow();
  room = apply(room, { type: 'kick', playerId: idOf(room, 'Ann'), target: idOf(room, 'Cleo') }, T0 + TIMING.countdownMs, rng);
  expect(room.banned).toHaveLength(1);
  const view = JSON.stringify(viewFor(room, idOf(room, 'Ann'), T0));
  for (const key of [...room.players.map((p) => p.key), ...room.banned]) expect(view).not.toContain(key);
  expect(view).not.toContain('banned');
});

test('the owner and the picks stay hidden until the reveal', () => {
  let room = inShow();
  const now = T0 + TIMING.countdownMs;
  const owner = room.game.plan[0].owner;
  const ann = idOf(room, 'Ann');
  room = apply(room, { type: 'answer', playerId: ann, pick: owner }, now + 1000, rng);
  const view = viewFor(room, idOf(room, 'Ben'), now + 1000);
  expect(view.round.owner).toBeNull();
  expect(view.round.results).toBeNull();
  expect(view.round.answered).toEqual([ann]);
  expect(view.round.myPick).toBeNull();
  expect(viewFor(room, ann, now + 1000).round.myPick).toBe(owner);
  expect(JSON.stringify(view)).not.toContain(`"pick"`);
  room = apply(room, { type: 'resolve', playerId: ann }, now + 2000, rng);
  const revealed = viewFor(room, idOf(room, 'Ben'), now + 2000);
  expect(revealed.round.owner).toBe(owner);
  expect(revealed.round.results[ann].pick).toBe(owner);
});

test('the leaderboard: everyone sees who holds "Show again" as a shared flag, and the frozen time', () => {
  let room = inShow();
  const now = T0 + TIMING.countdownMs;
  room = apply(room, { type: 'resolve', playerId: idOf(room, 'Ann') }, now, rng);
  room = apply(room, { type: 'tick' }, now + TIMING.revealMs, rng);
  room = apply(room, { type: 'peek', playerId: idOf(room, 'Ben'), on: true }, now + TIMING.revealMs + 2000, rng);
  const view = viewFor(room, idOf(room, 'Cleo'), now + TIMING.revealMs + 9000);
  expect(view).toMatchObject({ phase: 'board', paused: true, left: TIMING.boardMs - 2000, total: TIMING.boardMs });
  expect(view.round.peek).toBe(true);
  expect(view.round.results).toBeTruthy();
  expect(JSON.stringify(view)).not.toContain('peeks');
});

test('timers are relative and carry their full length; photo links point at the current and next photo', () => {
  const room = inShow();
  const shownAt = T0 + TIMING.countdownMs;
  const view = viewFor(room, idOf(room, 'Ann'), shownAt + 4000);
  // The answer time the players see ends before the room's deadline (its grace for late answers).
  expect(view).toMatchObject({ left: room.settings.time * 1000 - 4000, total: room.settings.time * 1000, paused: false });
  const revealed = apply(room, { type: 'resolve', playerId: idOf(room, 'Ann') }, shownAt + 5000, rng);
  expect(viewFor(revealed, idOf(room, 'Ann'), shownAt + 6000)).toMatchObject({ left: TIMING.revealMs - 1000, total: TIMING.revealMs });
  // Without a clock the answer time has no timer at all.
  expect(viewFor({ ...room, settings: { ...room.settings, time: 0 } }, idOf(room, 'Ann'), shownAt + 4000)).toMatchObject({ left: null, total: null });
  expect(view.round.photo).toBe(`/api/rooms/ABCD/photos/${room.game.plan[0].photo}`);
  expect(view.round.next).toBe(`/api/rooms/ABCD/photos/${room.game.plan[1].photo}`);
});
