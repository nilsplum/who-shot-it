/**
 * The server's clock on a phone (web/js/clock.js): learned from the fastest view, a timer
 * that ends at one moment on the server's clock, so a late view never moves a countdown,
 * while a restarted timer and a held round still show right away.
 */
import { expect, test } from 'vitest';
import { createClock } from '../../web/js/clock.js';

/**
 * A phone whose own clock reads 1000 when the server's reads 50000; the test moves time by
 * hand. `arrive(made, delay)` is a view made at the server's time `made` reaching the phone
 * `delay` ms later.
 */
function phone() {
  const time = { local: 1000, server: 50000 };
  const clock = createClock(() => time.local);
  const pass = (ms) => {
    time.local += ms;
    time.server += ms;
  };
  return { time, clock, pass };
}

test('a 3-2-1 whose views arrive late counts 3, 2, 1, never back up', () => {
  const { time, clock, pass } = phone();
  const shown = [];
  const paint = (timer) => {
    const n = Math.max(1, Math.ceil(clock.left(timer) / 1000));
    if (shown[shown.length - 1] !== n) shown.push(n);
  };
  // The 3-2-1 starts: its view arrives 50 ms after it was made, with 3000 ms left then.
  const start = time.server;
  pass(50);
  clock.heard(start);
  let timer = clock.timer(3000, start);
  for (let t = 0; t < 2900; t += 100) {
    pass(100);
    paint(timer);
    // Halfway, a view made 900 ms earlier arrives (a busy phone, a slow network): it says
    // more time is left than is true. The old clock jumped back to "3" here.
    if (t === 1400) {
      const made = time.server - 900;
      clock.heard(made);
      timer = clock.timer(3000 - (made - start), made);
    }
  }
  expect(shown).toEqual([3, 2, 1]);
});

test('the fastest view teaches the clock; slower ones never make it worse', () => {
  const { time, clock, pass } = phone();
  clock.heard(time.server - 300);
  const timer = clock.timer(10000, time.server);
  // Learned from a view 300 ms late, the clock thinks 300 ms more are left than are.
  expect(clock.left(timer)).toBe(10300);
  clock.heard(time.server - 20);
  expect(clock.left(timer)).toBe(10020);
  clock.heard(time.server - 900);
  expect(clock.left(timer)).toBe(10020);
  pass(4000);
  expect(clock.left(timer)).toBe(6020);
});

test('a restarted or extended timer shows at once; a held round stands still and runs on', () => {
  const { time, clock, pass } = phone();
  clock.heard(time.server);
  // A 3-2-1 that started over (a setting changed): its new view ends later, and that wins.
  let timer = clock.timer(1000, time.server);
  timer = clock.timer(3000, time.server);
  expect(clock.left(timer)).toBe(3000);
  // A leaderboard held with "Show again": the room sends its frozen time.
  timer = clock.timer(4000, time.server, true);
  pass(30000);
  expect(clock.left(timer)).toBe(4000);
  // Let go: the room's next view says the same 4000 left from now on.
  timer = clock.timer(4000, time.server);
  pass(1500);
  expect(clock.left(timer)).toBe(2500);
  pass(9999);
  expect(clock.left(timer)).toBe(0);
});

test('no timer, and a view without the server time (a server before it) anchors on arrival', () => {
  const { clock, pass } = phone();
  expect(clock.timer(null, 50000)).toBeNull();
  expect(clock.left(null)).toBeNull();
  const timer = clock.timer(5000, undefined);
  pass(1000);
  expect(clock.left(timer)).toBe(4000);
});
