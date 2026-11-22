/**
 * A countdown the room runs, followed on this phone between the room's snapshots: the
 * timer bar, the 3-2-1, the photo effects and "time is up" all read it.
 *
 * Mechanisms: `main.js` keeps one clock for the round's timer and syncs it with every
 * snapshot (`left`, `paused` from `src/game/view.js`); `left()` counts down from there with
 * the phone's own monotonic time. The room owns the time: a phone's wrong clock never
 * matters, because a snapshot only says how much is left.
 *
 * Invariants:
 * - A snapshot moves the countdown only when it describes another timer (its `key` changed:
 *   another phase or round) or disagrees by more than TIMING.clockSlackMs. Every snapshot
 *   arrives with a slightly different network delay; following each one made the timer bar
 *   jump whenever someone answered. A real change (a round let go after being held, an app
 *   that slept) is always far more than the slack.
 * - While the room's clock stands still (`stopped`), the countdown shows the frozen time;
 *   when it runs again the next snapshot anchors it anew.
 * - Pure apart from the time source it is given, so the unit tests drive it with a fake one.
 */

import { TIMING } from '../shared/config.js';

/** A countdown; `now` is the phone's monotonic time in ms (`performance.now` in the app). */
export function createClock(now = () => performance.now()) {
  let key = null;
  /** When the timer ends, in `now`'s time, or null while stopped or without a timer. */
  let end = null;
  /** The frozen time while the room's clock stands still, else null. */
  let frozen = null;
  return {
    /** Takes a snapshot's timer: `left` ms (null: no timer), named by `nextKey`. */
    sync(nextKey, left, stopped = false) {
      if (left === null || stopped) {
        key = nextKey;
        end = null;
        frozen = stopped ? left : null;
        return;
      }
      const estimate = now() + left;
      if (nextKey !== key || end === null || Math.abs(estimate - end) > TIMING.clockSlackMs) {
        key = nextKey;
        end = estimate;
        frozen = null;
      }
    },
    /** Milliseconds left, or null when there is no timer. */
    left() {
      if (frozen !== null) return frozen;
      return end === null ? null : Math.max(0, end - now());
    },
  };
}
