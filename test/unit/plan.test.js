/**
 * The round plan (src/game/plan.js): how many rounds, whose photos, in which order.
 */
import { describe, expect, test } from 'vitest';
import { arrange, buildPlan } from '../../src/game/plan.js';
import { seededRandom } from '../helpers.js';

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

  test('"Fair" gives every player an equal share when not all photos are played', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const plan = buildPlan(players({ a: 10, b: 10, c: 2 }), settings({ rounds: 10 }), seededRandom(seed));
      const per = (id) => plan.filter((e) => e.owner === id).length;
      expect(plan).toHaveLength(10);
      expect(per('c')).toBe(2);
      expect(Math.abs(per('a') - per('b'))).toBeLessThanOrEqual(1);
    }
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
