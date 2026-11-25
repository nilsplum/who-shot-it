/**
 * When the app asks the phone for the store's own rating window (web/js/review.js): only at
 * the end of a close game, from the group's 3rd game in its room on, and at most once while
 * the app runs. When it asks (after the podium's story, on the same end screen) is main.js's
 * and a browser's matter; the end-to-end test checks that a first game never asks.
 */
import { expect, test } from 'vitest';
import { RATING, closeGame, rateNow } from '../../web/js/review.js';
import { SCORING } from '../../web/shared/config.js';

/** A game's final standings (`view.final`) with these scores. */
const final = (...scores) => ({ players: scores.map((score, i) => ({ id: `p${i}`, name: `P${i}`, avatar: '🦊', score })) });

test('a close game: the winner ahead by less than one fast right answer, a tie too; never alone or without points', () => {
  expect(closeGame(final(4200, 3500))).toBe(true);
  // The standings may come in any order; only first and second place count.
  expect(closeGame(final(800, 4200, 3500))).toBe(true);
  expect(closeGame(final(3000, 3000))).toBe(true);
  expect(closeGame(final(4000 + SCORING.max, 4000))).toBe(false);
  expect(closeGame(final(9000, 2000))).toBe(false);
  expect(closeGame(final(2000))).toBe(false);
  expect(closeGame(final(0, 0))).toBe(false);
  expect(closeGame(null)).toBe(false);
});

test('the moment: a close end from the group\'s 3rd game, and only once while the app runs', () => {
  const close = final(4200, 3500);
  expect(rateNow({ games: RATING.fromGame - 1, final: close })).toBe(false);
  expect(rateNow({ games: RATING.fromGame, final: final(9000, 2000) })).toBe(false);
  expect(rateNow({ games: RATING.fromGame, final: null })).toBe(false);
  expect(rateNow({ games: RATING.fromGame, final: close })).toBe(true);
  // Asked once: the next close game in the same app start asks no more.
  expect(rateNow({ games: RATING.fromGame + 1, final: close })).toBe(false);
});
