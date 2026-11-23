/**
 * The server's clock on this phone: every timer the room runs (the 3-2-1, the answer time,
 * the reveal, the leaderboard, a flag's automatic deletion) ends at a moment on the server's
 * clock, and the phone counts down to that moment. The timer bar, the 3-2-1, the photo
 * effects, "time is up" and the flag's countdown all read it.
 *
 * Mechanisms: every view carries the server's time when it was made (`view.now`,
 * `src/game/view.js`) next to the time a timer still has (`left`). `main.js` hands each
 * arriving view's `now` to `heard`, and so the phone learns how far its own clock is from
 * the server's. A view always arrives a little late (the network, a busy phone), never
 * early, so the view that shows the largest difference is the most exact one, and the clock
 * keeps it: the usual way a game client follows its server's clock. A timer (`timer`) then
 * ends at `now + left` on the server's clock: the same moment in every view of the same
 * timer, however late a view arrives, while a restarted or extended timer ends at another.
 *
 * Invariants:
 * - A late view never moves a countdown: it neither changes a timer's end (exact on the
 *   server) nor the clock's difference (only an earlier, better view does). So the 3-2-1
 *   counts 3, 2, 1 and the timer bar only runs down.
 * - While the room's clock stands still (`paused`), a timer shows its frozen time.
 * - Pure apart from the time source it is given (`performance.now` in the app, which never
 *   jumps), so the unit tests drive it with a fake one. A view without `now` (a server
 *   before it) anchors its timer on arrival instead.
 */

/** The server's clock; `local` is this phone's monotonic time in ms. */
export function createClock(local = () => performance.now()) {
  /** The server's time minus this phone's, from the fastest view heard; null before the first. */
  let offset = null;
  /** The server's time now, as best known (this phone's own time before any view). */
  const serverNow = () => local() + (offset ?? 0);
  return {
    /** A view made at the server's time `now` arrived just now. */
    heard(now) {
      if (typeof now !== 'number') return;
      const difference = now - local();
      if (offset === null || difference > offset) offset = difference;
    },
    /**
     * A view's timer: `left` ms remained when the view was made at the server's time `now`.
     * `{ ends }` on the server's clock, `{ frozen }` while the room holds it, or null for none.
     */
    timer(left, now, paused = false) {
      if (left === null || left === undefined) return null;
      if (paused) return { frozen: left };
      return { ends: (typeof now === 'number' ? now : serverNow()) + left };
    },
    /** Milliseconds left on `timer` now, or null without one. */
    left(timer) {
      if (!timer) return null;
      if (timer.frozen !== undefined) return timer.frozen;
      return Math.max(0, timer.ends - serverNow());
    },
  };
}
