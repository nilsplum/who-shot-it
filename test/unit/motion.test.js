/**
 * The stories' pace for what is felt (web/js/motion.js `atMostEvery`): the podium's fireworks
 * feel every bang, but bangs that pile up share one tap instead of blurring into a buzz.
 */
import { expect, test } from 'vitest';
import { atMostEvery } from '../../web/js/motion.js';

test('runs at most once every so often, and again as soon as that has passed', () => {
  let t = 0;
  const ran = [];
  const tap = atMostEvery(90, (n) => ran.push(n), () => t);
  for (const [at, n] of [[0, 1], [40, 2], [89, 3], [90, 4], [150, 5], [400, 6], [401, 7]]) {
    t = at;
    tap(n);
  }
  expect(ran).toEqual([1, 4, 6]);
});
