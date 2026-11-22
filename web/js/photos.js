/**
 * The player's photo choice, and the bucket that keeps it instant: n random photos from the
 * phone, shown with "Play with these?" No/Yes without waiting, sharp when held, and ready to
 * upload on Yes.
 *
 * Mechanisms:
 * - The bucket: as soon as the app may read photos (`startPhotos`: from the app's start and
 *   whenever it comes back, on every screen, in and out of games) it fills by itself with up
 *   to LIMITS.bucketPreviews previews (`phone.randomPhotos`). Each one is checked once (the
 *   phone marks screenshots, `textcheck.js` counts its lines of text) and kept while it fits
 *   the current "Which photos" (the room's, or this phone's own setting outside a game,
 *   `setFilter`). The first LIMITS.bucketFulls of them also get their big version
 *   (`phone.photo`, the upload size) ahead, from photos stored on the phone only.
 * - One queue does all of the phone's work, in two lanes on `loader.js`. The now lane does
 *   what a player waits for: the photo being held, then the set on screen's big versions
 *   (iCloud downloads allowed: these may be uploaded), then previews for a set being dealt.
 *   The ahead lane (big versions, then previews) starts a job only while the now lane has
 *   nothing more to do, so at most one job of each runs at a time.
 * - `roll` deals a set from the front of the bucket, so its big versions are usually there
 *   already; `swap` replaces one photo with the bucket's next (the tile turns over, its old
 *   preview as the back face until the turn is done) or counts a refusal; `holdPhoto` puts
 *   a photo's big version first (the view shows the preview until it is there, then the
 *   sharp one above it); `chosenBlobs` waits for the set's big versions for "Yes", counting
 *   them.
 *
 * Invariants:
 * - Nothing leaves the phone before "Yes": previews and big versions are Blobs in this
 *   page's memory. Only the photos of the set on screen are uploaded; one the phone cannot
 *   hand over is left out, never replaced by one the player did not see.
 * - A set prefers photos not shown yet (`seen`, for as long as the app runs); only when the
 *   phone has none left do earlier ones come back, never the set on screen if there are
 *   others.
 * - A newer roll wins over an older one still waiting (`rollId`); a new "Which photos"
 *   drops from the bucket what no longer fits; lost photo access drops everything.
 * - No job holds anything across its wait: it re-reads the state after every answer from the
 *   phone and drops a result nobody wants any more (a skipped set, a changed filter).
 * - Nothing here blocks a tap or a repaint: the work waits on the phone between steps, and
 *   the text check takes a few milliseconds per preview.
 */

import { LIMITS } from '../shared/config.js';
import { createLoader } from './loader.js';
import { photo, randomPhotos } from './phone.js';
import { grayOf, textLines } from './textcheck.js';

export const photos = {
  /**
   * The set on screen: the bucket's own entries, each with { url (the preview as a link),
   * fullUrl (the big version as a link, once there), anim ('in' | 'flip' while it is dealt
   * or swapped in), from (while it turns in: the preview it replaced, as a link) } added.
   */
  chosen: [],
  /** Swaps left in this set. */
  swaps: 0,
  /** Swaps refused so far (it only grows): each one is a new number, so the count's shake plays again (`views/lobby.js`). */
  refusals: 0,
  /** The set size and the "Which photos" value the set on screen was dealt for (`main.js` compares, to deal anew). */
  size: 0,
  filter: null,
  /** True once the set was played, so the next lobby draws a fresh one. */
  spent: false,
  /** True while a roll waits for previews. */
  rolling: false,
  /** True when the phone had no photo to give at all (none, or none that fit "Which photos"). */
  empty: false,
  rollId: 0,
};

/**
 * Checked previews that fit the current filter, in draw order: { id, blob, screenshot,
 * lines, full (the big version, a Blob, once there), pending (being fetched), failed
 * ('ahead': not stored on the phone, tried again with the download once on screen; true:
 * it will not come) }.
 */
let bucket = [];
/** The "Which photos" the bucket gathers for (`setFilter`); the set on screen keeps its own (`photos.filter`). */
let gathering = null;
/** Ids that do not fit `gathering`: the phone is not asked for them again until it changes. */
let unfit = new Set();
/** Ids already dealt in this run of the app. */
let seen = new Set();
/** The phone had no photo left that is not seen, in the bucket or unfit. */
let exhausted = false;
/** Answers in a row the phone did not give (three count as having none left). */
let failures = 0;
/** May the app read photos now (`startPhotos`). */
let readable = false;
/** The id of the photo held big, whose big version comes first. */
let heldId = null;
/** How many previews the set being dealt needs (the latest roll's size), or 0. */
let dealing = 0;
/** Promises waiting for a state, re-checked after every job (`until`). */
const waiters = new Set();
let changed = () => {};

// ---------- The bucket's checks ----------

/** Lines of text on a preview (decoded upright, as the browser shows it); null if it cannot be decoded. */
async function linesOf(blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const { width, height } = bitmap;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    return textLines(grayOf(context.getImageData(0, 0, width, height).data), width, height);
  } catch {
    return null;
  }
}

/** Whether a checked preview fits "Which photos" (SETTINGS in config.js); one the browser cannot decode never does. */
function fits(entry, filter) {
  if (entry.lines === null) return false;
  if (filter === 'all') return true;
  if (filter === 'no-screenshots' && entry.screenshot) return false;
  return entry.lines < LIMITS.textLines;
}

// ---------- The two lanes ----------

/** A big version the now lane should fetch (download allowed), or null: the held photo, then the set on screen. */
function fullWanted() {
  const missing = (c) => c && !c.full && !c.pending && c.failed !== true;
  const held = photos.chosen.find((c) => c.id === heldId);
  if (missing(held)) return held;
  return photos.chosen.find(missing) || null;
}

/** Whether a set being dealt needs more previews than the bucket holds. */
const previewsWanted = () => bucket.length < dealing && !exhausted && readable;

function pickNow() {
  const c = fullWanted();
  if (c) return { key: `full:${c.id}`, run: () => fetchFull(c, true) };
  if (previewsWanted()) return { key: 'previews', run: () => fetchPreviews(6) };
  return null;
}

/**
 * The ahead lane's next job, only while the now lane has nothing more to do (its last job may
 * still be running: waiting for it to end too would need a second wake-up, and an ahead job
 * beside it costs nothing a player waits for).
 */
function pickAhead() {
  if (!readable || pickNow()) return null;
  const entry = bucket.slice(0, LIMITS.bucketFulls).find((e) => !e.full && !e.pending && !e.failed);
  if (entry) return { key: `full:${entry.id}`, run: () => fetchFull(entry, false) };
  if (bucket.length < LIMITS.bucketPreviews && !exhausted) return { key: 'previews', run: () => fetchPreviews(6) };
  return null;
}

const now = createLoader(pickNow);
const ahead = createLoader(pickAhead);

/** Something changed: both lanes look again, waiting promises are checked, the view repaints. */
function poke() {
  for (const w of [...waiters]) {
    if (!w.check()) continue;
    waiters.delete(w);
    w.resolve();
  }
  now.wake();
  ahead.wake();
  changed();
}

/** A promise that resolves once `check()` holds (re-checked after every job). */
function until(check) {
  if (check()) return Promise.resolve();
  return new Promise((resolve) => waiters.add({ check, resolve }));
}

/**
 * A photo's big version. Ahead of time only from what the phone stores (`download` false:
 * an iCloud original would cost mobile data for a photo that may never be shown); for the
 * set on screen also from iCloud. A failure ahead of time is tried again with the download
 * once the photo is on screen; a failure then is final (the photo is left out of the upload).
 */
async function fetchFull(entry, download) {
  entry.pending = true;
  const blob = await photo(entry.id, { download }).catch(() => null);
  entry.pending = false;
  if (blob) entry.full = blob;
  else entry.failed = download ? true : 'ahead';
  // Dealt meanwhile: the set on screen shows it sharp when held.
  if (blob && photos.chosen.includes(entry) && !entry.fullUrl) entry.fullUrl = URL.createObjectURL(blob);
  poke();
}

/** One batch of previews, each checked once; the ones that fit go to the end of the bucket. */
async function fetchPreviews(count) {
  let batch;
  try {
    // The set on screen is in `seen`; only `roll`'s last pass (nothing else left) lets it come back.
    const exclude = [...seen, ...unfit, ...bucket.map((e) => e.id)];
    batch = await randomPhotos(count, exclude);
    failures = 0;
  } catch {
    failures += 1;
    batch = failures < 3 ? null : [];
  }
  if (batch && !batch.length) exhausted = true;
  for (const preview of batch || []) {
    const entry = { ...preview, lines: await linesOf(preview.blob), full: null, failed: false };
    // The filter may have changed while the phone answered: the entry is sorted by today's.
    if (!readable || seen.has(entry.id) || bucket.some((e) => e.id === entry.id)) continue;
    if (fits(entry, gathering)) bucket.push(entry);
    else unfit.add(entry.id);
  }
  poke();
}

// ---------- The set on screen ----------

function release(set) {
  for (const c of set) {
    for (const url of [c.url, c.fullUrl, c.from]) if (url) URL.revokeObjectURL(url);
  }
}

/**
 * A bucket entry joins the set on screen (`anim` is its entrance): the same object, so a big
 * version still being fetched for it lands in the set too. One not stored on the phone may
 * now be downloaded.
 */
function slot(entry, anim) {
  return Object.assign(entry, {
    url: URL.createObjectURL(entry.blob), fullUrl: entry.full ? URL.createObjectURL(entry.full) : null,
    failed: entry.failed === true, anim, from: null,
  });
}

/**
 * How long a photo's entrance takes on screen: the deal's fade (0.3 s) and the swap's turn
 * (0.5 s), the `deal` and `flip` animations in styles/app.css, plus a little slack.
 */
const ENTRANCE_MS = { in: 400, flip: 600 };

/**
 * Ends a photo's entrance once it has played: its mark goes and, after a turn, the old face's
 * preview is let go (it had to stay loaded while it was visible). Then repaints.
 */
function settleLater(c) {
  setTimeout(() => {
    if (c.from) URL.revokeObjectURL(c.from);
    Object.assign(c, { anim: null, from: null });
    changed();
  }, ENTRANCE_MS[c.anim]);
}

// ---------- What main.js calls ----------

/**
 * Starts (or stops) filling the bucket: `canRead` is whether the app may read photos now
 * (`main.js` drops everything first, `resetPhotos`, when the access changed).
 */
export function startPhotos(canRead, onChange) {
  changed = onChange;
  readable = canRead;
  exhausted = false;
  poke();
}

/**
 * The "Which photos" the bucket gathers for: the room's, or this phone's own setting outside
 * a game. A new one drops what no longer fits (from the checks already made) and lets the
 * phone offer what the old one left out.
 */
export function setFilter(filter) {
  if (filter === gathering) return;
  gathering = filter;
  unfit = new Set();
  const kept = [];
  for (const e of bucket) {
    if (fits(e, filter)) kept.push(e);
    else unfit.add(e.id);
  }
  bucket = kept;
  exhausted = false;
  poke();
}

/** Forgets the set on screen (leaving a room); the bucket stays for the next game. */
export function leaveSet() {
  release(photos.chosen);
  photos.chosen = [];
  heldId = null;
  dealing = 0;
  Object.assign(photos, { size: 0, filter: null, swaps: 0, spent: false, rolling: false, empty: false });
  photos.rollId += 1;
}

/** Forgets everything: the set, the bucket and what was seen (photo access changed). */
export function resetPhotos() {
  leaveSet();
  bucket = [];
  unfit = new Set();
  seen = new Set();
  exhausted = false;
  failures = 0;
}

/**
 * Shows a new set of `size` photos that fit `filter` (the room's "Which photos"), right away
 * when the bucket has them. The set on screen stays until the new one is there; a phone with
 * fewer fitting photos gives a smaller set.
 */
export async function roll(size, filter, onChange) {
  changed = onChange;
  const id = ++photos.rollId;
  setFilter(filter);
  const onScreen = photos.chosen.map((c) => c.id);
  Object.assign(photos, { size, filter, spent: false, rolling: true });
  dealing = size;
  changed();
  // Unseen photos first; once the phone has none left, earlier ones (`seen` then holds only
  // the set on screen); and only then the set on screen again. Waits only when the bucket
  // is short, so "No" with a full bucket is instant.
  for (const reuse of [null, onScreen, []]) {
    if (reuse) {
      seen = new Set(reuse);
      exhausted = false;
    }
    poke();
    await until(() => id !== photos.rollId || bucket.length >= size || exhausted || !readable);
    if (id !== photos.rollId) return;
    if (bucket.length >= size || !exhausted) break;
  }
  dealing = 0;
  const set = bucket.splice(0, size);
  set.forEach((e) => seen.add(e.id));
  const old = photos.chosen;
  photos.chosen = set.map((e) => slot(e, 'in'));
  release(old);
  heldId = null;
  Object.assign(photos, { rolling: false, empty: set.length === 0, swaps: LIMITS.swapsPerSet });
  photos.chosen.forEach(settleLater);
  poke();
}

/**
 * Replaces photo `index` of the set on screen with the bucket's next one, at once: it turns
 * in over the old one, whose preview stays loaded as the back face until the turn is done
 * (`from`). Returns false when it is refused (no swaps left, or no photo ready), counted in
 * `photos.refusals`.
 */
export function swap(index, onChange) {
  changed = onChange;
  const old = photos.chosen[index];
  if (!old || photos.rolling) return false;
  if (photos.swaps <= 0 || !bucket.length) {
    photos.refusals += 1;
    changed();
    return false;
  }
  const next = bucket.shift();
  seen.add(next.id);
  const c = Object.assign(slot(next, 'flip'), { from: old.url });
  photos.chosen = photos.chosen.map((x, i) => (i === index ? c : x));
  // The old photo's big version goes now; its preview with the turn (`settleLater`), and a
  // turn it was still in the middle of ends by its own timer.
  if (old.fullUrl) URL.revokeObjectURL(old.fullUrl);
  photos.swaps -= 1;
  settleLater(c);
  poke();
  return true;
}

/** Photo `index` of the set is held big: its big version comes first; null lets go. */
export function holdPhoto(index) {
  const c = index === null ? null : photos.chosen[index];
  heldId = c ? c.id : null;
  poke();
}

/** What a held photo shows, bottom layer first: its preview, and its big version above it once there. */
export function heldLayers(index) {
  const c = photos.chosen[index];
  return c ? [c.url, c.fullUrl].filter(Boolean) : [];
}

/**
 * The big versions of the set on screen, for "Yes": waits for the ones still coming,
 * telling `onProgress` how many are there (0 to 1). Throws when none of them could be read.
 */
export async function chosenBlobs(onProgress = () => {}) {
  const set = photos.chosen;
  const settled = () => set.filter((c) => c.full || c.failed).length;
  onProgress(set.length ? settled() / set.length : 1);
  await until(() => {
    onProgress(set.length ? settled() / set.length : 1);
    return settled() === set.length || photos.chosen !== set;
  });
  const blobs = set.map((c) => c.full).filter(Boolean);
  if (set.length && !blobs.length) throw new Error('unreadable');
  return blobs;
}
