/**
 * Points for one answer (src/game/score.js).
 */
import { expect, test } from 'vitest';
import { SCORING, TIMING } from '../../web/shared/config.js';
import { pointsFor } from '../../src/game/score.js';

const s = (over) => ({ time: 10, points: 'speed', streak: true, ...over });

test('speed points fall linearly from max to min over the answer time', () => {
  expect(pointsFor({ correct: true, ms: 0, streak: 1 }, s())).toBe(SCORING.max);
  expect(pointsFor({ correct: true, ms: 5000, streak: 1 }, s())).toBe((SCORING.max + SCORING.min) / 2);
  expect(pointsFor({ correct: true, ms: 99999, streak: 1 }, s())).toBe(SCORING.min);
});

test('fixed points ignore speed; wrong answers score nothing', () => {
  expect(pointsFor({ correct: true, ms: 9000, streak: 1 }, s({ points: 'fixed' }))).toBe(SCORING.fixed);
  expect(pointsFor({ correct: false, ms: 0, streak: 0 }, s())).toBe(0);
});

test('without a timer, speed is measured against the reference time', () => {
  const half = TIMING.untimedReferenceMs / 2;
  expect(pointsFor({ correct: true, ms: half, streak: 1 }, s({ time: 0 }))).toBe((SCORING.max + SCORING.min) / 2);
});

test('the streak bonus grows per right answer in a row and is capped', () => {
  const fixed = s({ points: 'fixed' });
  expect(pointsFor({ correct: true, ms: 0, streak: 2 }, fixed)).toBe(SCORING.fixed + SCORING.streakStep);
  expect(pointsFor({ correct: true, ms: 0, streak: 50 }, fixed)).toBe(SCORING.fixed + SCORING.streakMax);
  expect(pointsFor({ correct: true, ms: 0, streak: 5 }, { ...fixed, streak: false })).toBe(SCORING.fixed);
});
