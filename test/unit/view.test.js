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

test('timers are relative and photo links point at the current and next photo', () => {
  const room = inShow();
  const shownAt = T0 + TIMING.countdownMs;
  const view = viewFor(room, idOf(room, 'Ann'), shownAt + 4000);
  expect(view.left).toBe(room.settings.time * 1000 - 4000);
  expect(view.round.photo).toBe(`/api/rooms/ABCD/photos/${room.game.plan[0].photo}`);
  expect(view.round.next).toBe(`/api/rooms/ABCD/photos/${room.game.plan[1].photo}`);
});
