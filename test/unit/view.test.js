/**
 * What a browser may see (src/game/view.js): no secrets, no spoilers.
 */
import { expect, test } from 'vitest';
import { TIMING } from '../../web/shared/config.js';
import { apply } from '../../src/game/rules.js';
import { CLOCK_FIELDS, viewFor } from '../../src/game/view.js';
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
  for (const p of room.players) room = apply(room, { type: 'answer', playerId: p.id, pick: owner }, now + 2000, rng);
  const revealed = viewFor(room, idOf(room, 'Ben'), now + 2000);
  expect(revealed.round.owner).toBe(owner);
  expect(revealed.round.results[ann].pick).toBe(owner);
  // Every result carries the player's streak and what it earned, for the badge and its story.
  expect(revealed.round.results[ann]).toMatchObject({ streak: expect.any(Number), bonus: expect.any(Number) });
});

test('the leaderboard: everyone sees who holds "Show again" as a shared flag, and the frozen time', () => {
  let room = inShow();
  const now = T0 + TIMING.countdownMs;
  for (const p of room.players) room = apply(room, { type: 'answer', playerId: p.id, pick: p.id }, now, rng);
  room = apply(room, { type: 'tick' }, now + TIMING.revealMs, rng);
  room = apply(room, { type: 'peek', playerId: idOf(room, 'Ben'), on: true }, now + TIMING.revealMs + 2000, rng);
  const view = viewFor(room, idOf(room, 'Cleo'), now + TIMING.revealMs + 9000);
  expect(view).toMatchObject({ phase: 'board', paused: true, left: TIMING.boardMs - 2000, total: TIMING.boardMs });
  expect(view.round.peek).toBe(true);
  expect(view.round.results).toBeTruthy();
  expect(JSON.stringify(view)).not.toContain('peeks');
});

test('timers carry the server time, what is left and their full length; photo links point at the photo on screen and the next one', () => {
  const room = inShow();
  const shownAt = T0 + TIMING.countdownMs;
  const view = viewFor(room, idOf(room, 'Ann'), shownAt + 4000);
  // The answer time the players see ends before the room's deadline (its grace for late answers);
  // `now + left` is that end on the server's clock, the same in every view of this timer.
  expect(view).toMatchObject({ now: shownAt + 4000, left: room.settings.time * 1000 - 4000, total: room.settings.time * 1000, paused: false });
  expect(viewFor(room, idOf(room, 'Ann'), shownAt + 7000)).toMatchObject({ now: shownAt + 7000, left: room.settings.time * 1000 - 7000 });
  // Only the time fields change by themselves: the room compares views without them.
  const timeless = (v) => JSON.stringify(v, (key, value) => (CLOCK_FIELDS.includes(key) ? undefined : value));
  expect(timeless(viewFor(room, idOf(room, 'Ann'), shownAt + 7000))).toBe(timeless(view));
  let revealed = room;
  for (const p of room.players) revealed = apply(revealed, { type: 'answer', playerId: p.id, pick: p.id }, shownAt + 5000, rng);
  expect(viewFor(revealed, idOf(room, 'Ann'), shownAt + 6000)).toMatchObject({ left: TIMING.revealMs - 1000, total: TIMING.revealMs });
  // Without a clock the answer time has no timer at all.
  expect(viewFor({ ...room, settings: { ...room.settings, time: 0 } }, idOf(room, 'Ann'), shownAt + 4000)).toMatchObject({ left: null, total: null });
  expect(view.round.photo).toBe(`/api/rooms/ABCD/photos/${room.game.plan[0].photo}`);
  expect(view.round.next).toBe(`/api/rooms/ABCD/photos/${room.game.plan[1].photo}`);
});

test('a flag: the others learn only that the photo is flagged, the flagger also how long it waits', () => {
  let room = inShow();
  const now = T0 + TIMING.countdownMs;
  room = apply(room, { type: 'flag', playerId: idOf(room, 'Ben'), round: 1, on: true }, now, rng);
  expect(viewFor(room, idOf(room, 'Ben'), now + 4000).round.flag).toEqual({ mine: true, left: TIMING.flagMs - 4000 });
  const other = viewFor(room, idOf(room, 'Ann'), now + 4000);
  expect(other).toMatchObject({ paused: true, round: { flag: { mine: false } } });
  // Who flagged it is never in a view.
  expect(Object.keys(other.round.flag).sort()).toEqual(['left', 'mine']);
});

test('a "Yes" shows as ready at once, and the start says how many have their photos in', () => {
  let room = roomWith(['Ann', 'Ben']);
  const [ann, ben] = room.players.map((p) => p.id);
  room = apply(room, { type: 'sending', playerId: ann, upload: 'annupload01' }, T0, rng);
  expect(viewFor(room, ben, T0)).toMatchObject({ phase: 'lobby', uploads: null, players: [{ ready: true, sending: true, photoCount: 0 }, { ready: false, sending: false }] });
  // Everyone said Yes, Ann's photos are still on their way: the start waits, without a 3-2-1 yet.
  room = apply(room, { type: 'ready', playerId: ben, photos: [] }, T0, rng);
  expect(viewFor(room, ann, T0)).toMatchObject({ phase: 'countdown', uploads: { done: 1, of: 2 }, me: { ready: true, sending: true }, left: null, upcoming: [] });
  // Her photos are in: dealt, and (her phone does not load ahead) the 3-2-1 runs.
  room = apply(room, { type: 'ready', playerId: ann, photos: ['a1'], upload: 'annupload01' }, T0 + 1000, rng);
  expect(viewFor(room, ann, T0 + 1000)).toMatchObject({ phase: 'countdown', uploads: null, me: { ready: true, sending: false }, total: TIMING.countdownMs });
});

test('the photos a phone may load: the whole game from the deal on, then from the round on screen, and nothing about owners', () => {
  let room = roomWith(['Ann', 'Ben', 'Cleo'], { ahead: true });
  room.players.forEach((p, i) => {
    room = apply(room, { type: 'ready', playerId: p.id, photos: [`p${i}`] }, T0, rng);
  });
  const link = (e) => `/api/rooms/ABCD/photos/${e.photo}`;
  const dealt = viewFor(room, idOf(room, 'Ann'), T0);
  // The start's wait for the first photo is not counted to the apps (every report would repaint every phone).
  expect(dealt).toMatchObject({ phase: 'countdown', upcoming: room.game.plan.map(link), waiting: null, left: null, me: { loaded: 0 } });
  // Only Ann gets the first photo: the start waits the load limit, then the 3-2-1, then round 1
  // waits for the phones, and Ann is ready for it.
  room = apply(room, { type: 'loaded', playerId: idOf(room, 'Ann'), round: 1 }, T0, rng);
  room = apply(room, { type: 'tick' }, T0 + TIMING.loadMaxMs, rng);
  const start = T0 + TIMING.loadMaxMs + TIMING.countdownMs;
  room = apply(room, { type: 'tick' }, start, rng);
  const ann = viewFor(room, idOf(room, 'Ann'), start);
  expect(ann).toMatchObject({ phase: 'load', waiting: { ready: 1, of: 3 }, me: { loaded: 1 } });
  // Round 1's photo is deleted: the list starts at round 2, the deleted one is gone from it.
  room = apply(room, { type: 'report', playerId: idOf(room, 'Ben') }, start, rng);
  expect(viewFor(room, idOf(room, 'Ann'), start).upcoming).toEqual(room.game.plan.slice(1).map(link));
  expect(JSON.stringify(ann.upcoming)).not.toContain(idOf(room, 'Ann'));
});

test('the lobby says how the game will start: the question once everyone said Yes, after a No "Start now"', () => {
  let room = roomWith(['Ann', 'Ben'], { asks: true });
  const [ann, ben] = room.players.map((p) => p.id);
  expect(viewFor(room, ann, T0).start).toEqual({ mode: 'ask', everyone: false });
  room = apply(room, { type: 'ready', playerId: ann, photos: ['a1'] }, T0, rng);
  room = apply(room, { type: 'ready', playerId: ben, photos: [] }, T0, rng);
  expect(viewFor(room, ben, T0).start).toEqual({ mode: 'ask', everyone: true });
  room = apply(room, { type: 'start', playerId: ben, go: false }, T0, rng);
  expect(viewFor(room, ann, T0).start).toEqual({ mode: 'button', everyone: true });
  room = apply(room, { type: 'start', playerId: ann, go: true }, T0, rng);
  expect(viewFor(room, ann, T0)).toMatchObject({ phase: 'countdown', start: null });
});
