/**
 * A background worker that does one job at a time, always the one most wanted right now.
 *
 * Mechanisms: the app's photo queues are built on it: the game's photos from the server
 * (`upcoming.js`) and, on the phone, the previews and big versions of the photo choice
 * (`photos.js`). Each owner gives it `pick`, a function that looks at the owner's current
 * state and returns the next job (`{ key, run }`) or null when nothing is left to do. The
 * loader runs that job, then asks `pick` again; `wake()` asks too, when something changed
 * (a new round, a photo held, "No").
 *
 * Invariants:
 * - Priority is never stored: `pick` decides afresh after every job, from the state as it
 *   is then, so a newly urgent job simply comes next and nothing goes stale in a queue.
 * - One job at a time, so a queue never floods the server or the phone; a job that is no
 *   longer wanted when it finishes is for its owner to drop (its `run` checks).
 * - A job never throws out of here: a failed job is the owner's to record (so `pick` does
 *   not choose it forever), and the loader goes on with the next one.
 */

/** A worker over `pick() -> { key, run: () => Promise } | null`. */
export function createLoader(pick) {
  let running = null;
  function wake() {
    if (running) return;
    const job = pick();
    if (!job) return;
    running = job;
    Promise.resolve()
      .then(job.run)
      .catch(() => {})
      .finally(() => {
        running = null;
        wake();
      });
  }
  return {
    wake,
    /** The key of the job running now, or null. */
    get running() {
      return running ? running.key : null;
    },
  };
}
