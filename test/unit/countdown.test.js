/**
 * The 3-2-1 on the room's clock (web/js/countdown.js): the paint loop runs only four times a
 * second, so main.js paints each next number on a timer of its own, due right on the room's
 * second. The rest of the module moves animations and draws light, which only a browser
 * shows (the end-to-end tests count the numbers as painted and what the phone feels).
 */
import { expect, test } from 'vitest';
import { nextNumberIn } from '../../web/js/countdown.js';

test('the next number of the 3-2-1 is due right on its second, and the 1 waits for the round', () => {
  // The 3 just came: the 2 in a second. It came late (over the network): the 2 still on its second.
  expect(nextNumberIn(3000)).toBe(1000);
  expect(nextNumberIn(2734)).toBe(734);
  expect(nextNumberIn(2000)).toBe(1000);
  expect(nextNumberIn(1001)).toBe(1);
  // The 1 is on: it stays until the round's own view ends the 3-2-1.
  expect(nextNumberIn(1000)).toBe(null);
  expect(nextNumberIn(0)).toBe(null);
  expect(nextNumberIn(null)).toBe(null);
});
