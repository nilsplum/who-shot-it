/**
 * The 3-2-1 on the room's clock. The start's film leader (views/overlays.js `startScreen`)
 * first loads (its hand going round endlessly, until the room's 3-2-1 begins), then paints
 * each number as a new element whose hand goes round once and leaves its shadow
 * behind it: CSS animations of one second, which start when the number is painted. That is
 * not always on its second: the first number comes with a view over the network, a phone
 * may come back in the middle of one, and the paint loop runs only four times a second. So
 * `onTheClock` moves a number just painted as far into its round as its second is, and
 * `nextNumberIn` says when the next one is due, so main.js paints it right on its second.
 * Each round ends exactly on the room's second, and the 1's ends as the round begins. Then
 * `cut` ends the leader as a film does: one white frame, over the first photo.
 *
 * Mechanisms: main.js (`paintStart`) calls these as it paints the cover, with the time left
 * on the room's 3-2-1 (`clock.js`); the white frame is the sparks canvas's flash
 * (`sparks.js`). drafts/countdown_animations plays it the same way ("Film leader, in the
 * app"), beside the draft it was chosen from.
 *
 * Invariants: it only moves animations to the room's time and never changes markup (the
 * view paints every number as it is); it moves only the number's own animations, which play
 * once, never an endless one (the frame's weave, the loading's hand); with Reduce Motion the
 * leader has no animations to move and there is no white frame.
 */
import { flash } from './sparks.js';

/** One number of the 3-2-1: the room's TIMING.countdownMs (3 s) over its three numbers. */
const SECOND = 1000;
/** The white frame: how bright it starts, and how fast it fades (ms). */
const CUT = { strength: 0.75, ms: 260 };

/** The number the 3-2-1 shows with `left` ms to go (the 1 stays until the round begins). */
const numberAt = (left) => Math.max(1, Math.ceil(left / SECOND));

/** Starts the number just painted in `cover` as far into its round as `left` (ms left on the 3-2-1) says; the endless animations (the weave) stay as they are. */
export function onTheClock(cover, left) {
  const into = Math.min(SECOND, numberAt(left) * SECOND - left);
  for (const animation of cover.getAnimations({ subtree: true })) {
    if (animation.effect && animation.effect.getTiming().iterations === 1) animation.currentTime = into;
  }
}

/** Milliseconds until the 3-2-1 shows its next number, with `left` ms to go; null while the 1 is on. */
export function nextNumberIn(left) {
  if (left === null || left <= SECOND) return null;
  return left - (numberAt(left) - 1) * SECOND;
}

/** The leader's end as the round begins: one white frame over the first photo (none with Reduce Motion). */
export function cut() {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) flash(CUT.strength, CUT.ms);
}
