/**
 * The pure parts of the game's photo queue (web/js/upcoming.js): which round a phone is
 * ready for, and how far along it is for the loading bar; and the loader it runs on
 * (web/js/loader.js), which always takes the most wanted job next.
 */
import { expect, test } from 'vitest';
import { createLoader } from '../../web/js/loader.js';
import { readyFor, shareFor } from '../../web/js/upcoming.js';

const links = ['p1', 'p2', 'p3', 'p4', 'p5'];
const holding = (...ids) => (link) => link === null || ids.includes(link);

test('a phone is ready for a round once it holds that round\'s photo and every one before it', () => {
  // From round 1: nothing yet, then photo 1 (round 1), then 1 and 2 (round 2).
  expect(readyFor(1, links, holding())).toBe(0);
  expect(readyFor(1, links, holding('p1'))).toBe(1);
  expect(readyFor(1, links, holding('p1', 'p2'))).toBe(2);
  // A gap counts: photo 3 without photo 2 is no help yet.
  expect(readyFor(1, links, holding('p1', 'p3', 'p4'))).toBe(1);
  expect(readyFor(1, links, holding(...links))).toBe(5);
  // During round 4 the list starts there; a deleted photo (null) is never waited for.
  expect(readyFor(4, ['p4', null], holding('p4'))).toBe(5);
});

test('the loading bar counts whether this phone holds the waited-for round\'s photo', () => {
  expect(shareFor(1, links, 1, holding('p1'))).toBe(1);
  expect(shareFor(1, links, 2, holding('p1'))).toBe(0);
  // Past the last round there is nothing to hold.
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
