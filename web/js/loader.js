/**
 * The app's background photo work: a few workers, each doing one job at a time, always the
 * one most wanted right now; and the one way a loaded photo becomes paintable.
 *
 * Mechanisms: both of the app's photo stores are built on it: the game's photos from the
 * server (`upcoming.js`) and the player's own photos on the phone (`photos.js`). Each owner
 * gives it `pick`, which looks at the owner's state as it is now and returns the next job
 * (`{ key, kind, run }`) or null, and `slots`: how many jobs of each kind may run at once.
 * The loader starts what it may and asks `pick` again after every job and on `wake()`, when
 * something changed (a new round, a photo held, "No").
 *
 * Invariants:
 * - Priority is never stored: `pick` decides afresh each time, from the state as it is then,
 *   so whatever became urgent simply comes next and nothing goes stale in a queue.
 * - Each kind of work has its own slots, so a slow job (a download from iCloud) never holds
 *   up a quick one of another kind (the previews "No" waits for), and no owner floods the
 *   phone or the server. `pick` is told which kinds have a free slot; a job whose key is
 *   running already is never started twice.
 * - A job's `run` starts at once, before the next `pick`, so it can mark what it took; it
 *   never throws out of here: a failed job is the owner's to record, and the loader goes on.
 */

/** Workers over `pick(openKinds) -> { key, kind, run: () => Promise } | null`, `slots` per kind. */
export function createLoader(pick, slots) {
  const running = new Map();
  const open = () => Object.keys(slots).filter((kind) => [...running.values()].filter((job) => job.kind === kind).length < slots[kind]);
  function wake() {
    for (;;) {
      const kinds = open();
      if (!kinds.length) return;
      const job = pick(kinds);
      if (!job || running.has(job.key) || !kinds.includes(job.kind)) return;
      running.set(job.key, job);
      new Promise((resolve) => resolve(job.run()))
        .catch(() => {})
        .finally(() => {
          running.delete(job.key);
          wake();
        });
    }
  }
  return {
    wake,
    /** The keys of the jobs running now. */
    get running() {
      return [...running.keys()];
    },
  };
}

/**
 * A photo Blob as a link the page paints at once: decoded first, so it never shows half
 * drawn or as a blank frame when it appears. Throws (and lets go of the link) when it cannot
 * be decoded; the link is the caller's to release (`URL.revokeObjectURL`).
 */
export async function paintable(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return url;
}
