/**
 * The round plan (src/game/plan.js): how many rounds, whose photos, in which order; and the
 * one shuffle it deals with (web/shared/random.js).
 */
import { describe, expect, test } from 'vitest';
import { arrange, buildPlan } from '../../src/game/plan.js';
import { shuffle } from '../../web/shared/random.js';
import { seededRandom } from '../helpers.js';

test('shuffle reaches every order and never changes what it is given', () => {
  const items = [1, 2, 3];
  const orders = new Set();
  const rng = seededRandom(9);
  for (let i = 0; i < 200; i++) orders.add(shuffle(items, rng).join(''));
  expect(orders.size).toBe(6);
  expect(items).toEqual([1, 2, 3]);
});

const players = (counts) => Object.entries(counts).map(([id, n]) => ({ id, photos: Array.from({ length: n }, (_, i) => `${id}${i}`) }));
const settings = (s) => ({ rounds: 0, fair: true, ...s });

describe('buildPlan', () => {
  test('"All" plays every photo exactly once', () => {
    const plan = buildPlan(players({ a: 3, b: 3, c: 0 }), settings({}), seededRandom(1));
    expect(plan).toHaveLength(6);
    expect(new Set(plan.map((e) => e.photo)).size).toBe(6);
    expect(plan.every((e) => e.photo.startsWith(e.owner))).toBe(true);
  });

  test('rounds are capped by the photos available', () => {
    expect(buildPlan(players({ a: 2, b: 1 }), settings({ rounds: 10 }), seededRandom(2))).toHaveLength(3);
  });

  test('"Balanced" gives everyone 60% to 140% of an equal share, drawn anew each game', () => {
    // 15 rounds, 4 players: an equal share is 3.75, so 2 to 5 photos each.
    const seen = new Set();
    for (let seed = 1; seed <= 60; seed++) {
      const plan = buildPlan(players({ a: 10, b: 10, c: 10, d: 10 }), settings({ rounds: 15 }), seededRandom(seed));
      const counts = ['a', 'b', 'c', 'd'].map((id) => plan.filter((e) => e.owner === id).length);
      expect(plan).toHaveLength(15);
      for (const n of counts) {
        expect(n).toBeGreaterThanOrEqual(2);
        expect(n).toBeLessThanOrEqual(5);
      }
      seen.add(counts.join());
    }
    // Not a fixed split: counting photos must not tell whose comes next.
    expect(seen.size).toBeGreaterThan(5);
  });

  test('"Balanced" still fills every round when some players brought only a few photos', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const plan = buildPlan(players({ a: 1, b: 2, c: 30 }), settings({ rounds: 15 }), seededRandom(seed));
      const per = (id) => plan.filter((e) => e.owner === id).length;
      expect(plan).toHaveLength(15);
      expect([per('a'), per('b'), per('c')]).toEqual([1, 2, 12]);
    }
    // More players than rounds: still exactly the rounds, nobody twice.
    const few = buildPlan(players({ a: 3, b: 3, c: 3, d: 3, e: 3 }), settings({ rounds: 4 }), seededRandom(3));
    expect(few).toHaveLength(4);
    expect(new Set(few.map((e) => e.owner)).size).toBe(4);
  });

  test('"Random" can take anyone\'s photos', () => {
    const counts = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      const plan = buildPlan(players({ a: 10, b: 10 }), settings({ rounds: 4, fair: false }), seededRandom(seed));
      counts.add(plan.filter((e) => e.owner === 'a').length);
    }
    expect(counts.size).toBeGreaterThan(2);
  });

  test('the same owner never comes twice in a row when it can be avoided', () => {
    for (const counts of [{ a: 3, b: 3, c: 3 }, { a: 5, b: 4 }, { a: 4, b: 2, c: 1 }, { a: 10, b: 3, c: 3, d: 3 }]) {
      for (let seed = 1; seed <= 40; seed++) {
        const plan = buildPlan(players(counts), settings({}), seededRandom(seed));
        for (let i = 1; i < plan.length; i++) expect(plan[i].owner).not.toBe(plan[i - 1].owner);
      }
    }
  });

  test('when a repeat cannot be avoided, every photo is still played', () => {
    const entries = [{ owner: 'a', photo: 1 }, { owner: 'a', photo: 2 }, { owner: 'a', photo: 3 }, { owner: 'b', photo: 4 }];
    const order = arrange(entries, seededRandom(5));
    expect(order.map((e) => e.photo).sort()).toEqual([1, 2, 3, 4]);
    expect(order[0].owner).toBe('a');
  });

  test('the order is not predictable from who is left', () => {
    const third = new Set();
    for (let seed = 1; seed <= 40; seed++) third.add(buildPlan(players({ a: 3, b: 3, c: 3 }), settings({}), seededRandom(seed))[2].owner);
    expect(third.size).toBe(3);
  });
});
