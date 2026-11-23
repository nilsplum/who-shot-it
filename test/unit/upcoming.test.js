/**
 * The pure parts of the game's photo queue (web/js/upcoming.js): which round a phone is
 * ready for, and its share of the loading bar; and the loader both photo stores run on
 * (web/js/loader.js): the most wanted job next, one per kind at a time.
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

test('the loader runs one job per kind at a time, the one wanted most, and a slow kind never holds up another', async () => {
  const wanted = { slow: ['s1', 's2'], quick: ['q1', 'q2'] };
  const ran = [];
  let finishSlow;
  const loader = createLoader((open) => {
    for (const kind of open) {
      const key = wanted[kind].shift();
      if (!key) continue;
      const run = key === 's1' ? () => new Promise((resolve) => { finishSlow = resolve; }).then(() => ran.push(key)) : async () => ran.push(key);
      return { key, kind, run };
    }
    return null;
  }, { slow: 1, quick: 1 });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  loader.wake();
  await settle();
  // The slow job still runs; the quick kind did all its work meanwhile.
  expect(ran).toEqual(['q1', 'q2']);
  expect(loader.running).toEqual(['s1']);
  // A newly urgent job is picked at once, not after what was listed before.
  wanted.quick.push('urgent');
  loader.wake();
  await settle();
  expect(ran).toEqual(['q1', 'q2', 'urgent']);
  finishSlow();
  await settle();
  expect(ran).toEqual(['q1', 'q2', 'urgent', 's1', 's2']);
  expect(loader.running).toEqual([]);
});
