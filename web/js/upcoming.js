/**
 * The game's photos on this phone: loaded from the server ahead of their rounds, in play
 * order, and kept in memory only.
 *
 * Mechanisms: from the 3-2-1 on, every view lists the photos this phone may load now
 * (`view.upcoming`: the whole game during the 3-2-1, then from the round on screen;
 * `src/game/view.js`). `syncUpcoming` takes that list; one loader (`loader.js`) fetches the
 * photos one at a time in play order, so the photo on screen and the next LIMITS.loadAhead
 * come first by being first, and the rest follow without a break. Each one becomes an
 * object URL that the stage, the photo effects and "Show again" paint from (`photoUrl`).
 * `readyFor` says which round this phone holds what it needs for (its photo and the next
 * LIMITS.readyAhead); `main.js` reports that to the room (`loaded`), which starts round 1
 * and ends a leaderboard only when every phone is ready.
 *
 * Invariants:
 * - Memory only: photos are fetched with `cache: 'no-store'` (the server says `no-store`
 *   too) and kept as Blobs behind object URLs. A photo that leaves the list (its round is
 *   over, it was deleted, the game ended, the 3-2-1 stopped) is aborted or dropped and its
 *   URL revoked at once, so a phone never keeps a photo longer than its round.
 * - Every fetch has a time limit (TIMING.photoFetchMs) and a second try; a photo that still
 *   fails counts as done, so it never holds up the room (the stage says it could not load).
 *   A photo the server no longer serves (404: deleted meanwhile) is not tried again.
 * - Nothing here tells whose a photo is: the list comes in play order, which is random.
 */

import { LIMITS, TIMING } from '../shared/config.js';
import { serverUrl } from './api.js';
import { createLoader } from './loader.js';

/** The photos by link: { state: 'loading' | 'retry' | 'ok' | 'error', url, abort, tries }. */
const photos = new Map();
/** The links of the list, in play order (deleted photos left out). */
let wanted = [];
/** Called whenever a photo arrived or failed (`main.js` reports and repaints). */
let changed = () => {};

const loader = createLoader(() => {
  const link = wanted.find((l) => !photos.has(l) || photos.get(l).state === 'retry');
  return link ? { key: link, run: () => load(link) } : null;
});

/** Fetches one photo into memory; holds nothing across its waits but its own entry (checked after each). */
async function load(link) {
  const entry = { state: 'loading', url: null, abort: null, tries: ((photos.get(link) || {}).tries || 0) + 1 };
  const controller = new AbortController();
  entry.abort = () => controller.abort();
  photos.set(link, entry);
  const timer = setTimeout(() => controller.abort(), TIMING.photoFetchMs);
  const current = () => photos.get(link) === entry;
  try {
    const res = await fetch(serverUrl(link), { cache: 'no-store', signal: controller.signal });
    if (res.status === 404) entry.tries = Infinity;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const url = URL.createObjectURL(await res.blob());
    // Decoded before it counts as there, so the stage shows it at once when its round comes.
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!current()) {
      URL.revokeObjectURL(url);
      return;
    }
    Object.assign(entry, { state: 'ok', url, abort: null });
  } catch {
    if (!current()) return;
    Object.assign(entry, { state: entry.tries < 2 ? 'retry' : 'error', abort: null });
  } finally {
    clearTimeout(timer);
  }
  changed();
}

/**
 * Takes the view's list of photos (`view.upcoming`, links or null) and keeps exactly those:
 * what left it is aborted or dropped, what is new is loaded in play order. `onChange` is
 * called whenever a photo arrives or fails.
 */
export function syncUpcoming(links, onChange) {
  changed = onChange;
  wanted = links.filter(Boolean);
  for (const [link, p] of photos) {
    if (wanted.includes(link)) continue;
    if (p.abort) p.abort();
    if (p.url) URL.revokeObjectURL(p.url);
    photos.delete(link);
  }
  loader.wake();
}

/** The photo at `link` as an object URL once it is in memory, else null. */
export const photoUrl = (link) => (photos.has(link) && photos.get(link).state === 'ok' ? photos.get(link).url : null);

/** This phone's copy of a photo: 'ok', 'error' (it will not come) or 'loading'. */
export function photoState(link) {
  const p = photos.get(link);
  return p && (p.state === 'ok' || p.state === 'error') ? p.state : 'loading';
}

/** The photo is done: here, or failed for good (it then never holds up the room). */
const done = (link) => link === null || photoState(link) !== 'loading';

/**
 * The highest round this phone is ready for: it holds that round's photo and the next
 * LIMITS.readyAhead (or every one that is left), counted along `links` from `base`, the
 * round of its first link. Less than `base` when it is not even ready for the first.
 * `holds` says whether a link is done (here: in memory or failed for good).
 */
export function readyFor(base, links, holds = done) {
  let n = 0;
  while (n < links.length && holds(links[n])) n += 1;
  return n === links.length ? base + links.length - 1 : base + n - 1 - LIMITS.readyAhead;
}

/** How much of what round `round` needs this phone holds, 0 to 1 (for the loading bar). */
export function shareFor(base, links, round, holds = done) {
  const needed = links.slice(round - base, round - base + 1 + LIMITS.readyAhead);
  return needed.length ? needed.filter(holds).length / needed.length : 1;
}
