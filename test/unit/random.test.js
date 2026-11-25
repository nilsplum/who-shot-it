/**
 * The shared random helpers (web/shared/random.js): `seeded` gives every phone the same
 * numbers from the same text (the lobby's bubble, web/js/nudge.js, depends on it), and a
 * shuffle with it keeps every item.
 */
import { expect, test } from 'vitest';
import { seeded, shuffle } from '../../web/shared/random.js';

const take = (rng, n) => Array.from({ length: n }, () => rng());

test('the same text gives the same numbers on every phone, another text others, all from 0 to 1', () => {
  const a = take(seeded('ABCD|0|p1'), 50);
  expect(take(seeded('ABCD|0|p1'), 50)).toEqual(a);
  expect(take(seeded('ABCD|1|p1'), 50)).not.toEqual(a);
  expect(a.every((x) => x >= 0 && x < 1)).toBe(true);
  // Not stuck on a few values.
  expect(new Set(a).size).toBe(50);
});

test('a shuffle with a seeded source is the same order for the same text, and keeps every item', () => {
  const items = Array.from({ length: 14 }, (_, i) => i);
  const order = shuffle(items, seeded('ABCD|0|p1|0'));
  expect(shuffle(items, seeded('ABCD|0|p1|0'))).toEqual(order);
  expect([...order].sort((x, y) => x - y)).toEqual(items);
  expect(order).not.toEqual(items);
});
