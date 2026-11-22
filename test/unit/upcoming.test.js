/**
 * The pure parts of the game's photo queue (web/js/upcoming.js): which round a phone is
 * ready for, and how far along it is for the loading bar; and the loader it runs on
 * (web/js/loader.js), which always takes the most wanted job next.
 */
import { expect, test } from 'vitest';
import { LIMITS } from '../../web/shared/config.js';
import { createLoader } from '../../web/js/loader.js';
import { readyFor, shareFor } from '../../web/js/upcoming.js';

const links = ['p1', 'p2', 'p3', 'p4', 'p5'];
const holding = (...ids) => (link) => link === null || ids.includes(link);

test('a phone is ready for a round once it holds its photo and the next ones in a row', () => {
  expect(LIMITS.readyAhead).toBe(2);
  // From round 1: nothing yet, then photos 1 to 3 (round 1), then 1 to 4 (round 2).
  expect(readyFor(1, links, holding())).toBeLessThan(1);
  expect(readyFor(1, links, holding('p1', 'p2'))).toBeLessThan(1);
  expect(readyFor(1, links, holding('p1', 'p2', 'p3'))).toBe(1);
  expect(readyFor(1, links, holding('p1', 'p2', 'p3', 'p4'))).toBe(2);
  // A gap counts: photo 4 without photo 3 is no help yet.
  expect(readyFor(1, links, holding('p1', 'p2', 'p4', 'p5'))).toBeLessThan(1);
  // Everything that is left: ready for the last round.
  expect(readyFor(1, links, holding(...links))).toBe(5);
  // During round 4 the list starts there; a deleted photo (null) is never waited for.
  expect(readyFor(4, ['p4', null], holding('p4'))).toBe(5);
});

test('the loading bar counts what the waited-for round needs', () => {
  expect(shareFor(1, links, 1, holding('p1'))).toBeCloseTo(1 / 3);
  expect(shareFor(1, links, 2, holding('p2', 'p3', 'p4'))).toBe(1);
  expect(shareFor(3, ['p3'], 4, holding())).toBe(1);
});

test('the loader runs one job at a time, always the one wanted most when it asks', async () => {
  const wanted = ['b', 'a'];
  const ran = [];
  const loader = createLoader(() => {
    const key = wanted.shift();
    return key ? { key, run: async () => ran.push(key) } : null;
  });
  loader.wake();
  // A newly urgent job jumps the queue: it is picked next, not after what was listed before.
  wanted.unshift('urgent');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(ran).toEqual(['b', 'urgent', 'a']);
  expect(loader.running).toBeNull();
});
