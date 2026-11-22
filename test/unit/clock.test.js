/**
 * The countdown an app follows between the room's snapshots (web/js/clock.js): it never
 * jumps on network jitter, follows real changes, and stands still with the room.
 */
import { expect, test } from 'vitest';
import { TIMING } from '../../web/shared/config.js';
import { createClock } from '../../web/js/clock.js';

/** A clock on a fake time source that the test moves by hand. */
function clockAt(start = 1000) {
  const time = { now: start };
  return { time, clock: createClock(() => time.now) };
}

test('snapshots of the same timer that arrive a little late or early do not move it', () => {
  const { time, clock } = clockAt();
  clock.sync('show|1', 10000);
  time.now += 3000;
  expect(clock.left()).toBe(7000);
  // Someone answered: the next snapshot says 7200 left (it was 200 ms longer on the wire).
  clock.sync('show|1', 7200);
  expect(clock.left()).toBe(7000);
  clock.sync('show|1', 6900);
  expect(clock.left()).toBe(7000);
});

test('another timer, or a real difference, anchors it anew', () => {
  const { time, clock } = clockAt();
  clock.sync('show|1', 10000);
  time.now += 1000;
  clock.sync('reveal|1', TIMING.revealMs);
  expect(clock.left()).toBe(TIMING.revealMs);
  // The app slept for a while: the room's word wins.
  clock.sync('reveal|1', 1000);
  expect(clock.left()).toBe(1000);
});

test('it stands still with the room and runs on when the room lets go', () => {
  const { time, clock } = clockAt();
  clock.sync('board|2', 5000);
  time.now += 1000;
  clock.sync('board|2', 4000, true);
  time.now += 30000;
  expect(clock.left()).toBe(4000);
  clock.sync('board|2', 4000);
  time.now += 1500;
  expect(clock.left()).toBe(2500);
  time.now += 9999;
  expect(clock.left()).toBe(0);
});

test('a phase without a timer has none', () => {
  const { clock } = clockAt();
  clock.sync('load|1', null);
  expect(clock.left()).toBeNull();
});
