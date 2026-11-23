/**
 * The player's photo choice, and the bucket that keeps it instant: n random photos from the
 * phone, shown with "Play with these?" No/Yes without waiting, sharp when held, and ready to
 * send on Yes.
 *
 * Mechanisms:
 * - The bucket: whenever the app may read photos (`startPhotos`: from the app's start and
 *   whenever it comes back) it fills by itself with up to LIMITS.bucketPreviews previews
 *   (`phone.randomPhotos`). Each one is checked once (the phone marks screenshots,
 *   `textcheck.js` counts its lines of text) and kept while it fits the current "Which
 *   photos". The next set, the front of the bucket, also gets its big versions ahead
 *   (`phone.photo`, the upload size), from photos stored on the phone only. The bucket
 *   gathers for the room's "Which photos" and "Photos per player", or this phone's own
 *   settings outside a game, and rests from the start until the end screen, when the game's
 *   photos need the phone and nobody chooses (`setNeeds`).
 * - One list of work, in the order of what a player waits for (`pick`), done by one worker
 *   per kind of work on `loader.js`, so a slow job never holds up a quick one of another kind:
 *   1. `held`: the big version of the photo a finger holds (downloaded if needed);
 *   2. `deal`: previews whenever the bucket holds fewer than a set being dealt ("No", the
 *      first set) or, outside a game, than LIMITS.readySets sets behind the one on screen,
 *      so "No" is instant however often it is tapped (`previewsShort`);
 *   3. `sharp`: the big versions of the set on screen, for "Yes": each first from the phone
 *      alone (quick, and a photo kept only in iCloud says so at once), then the iCloud ones
 *      downloaded; not for a set being replaced;
 *   4. `fill`, only while nothing of 1 to 3 waits and no game runs: the next set's big
 *      versions (from the phone only), then previews up to LIMITS.bucketPreviews.
 * - `roll` deals a set from the front of the bucket, so its big versions are usually there
 *   already; `swap` replaces one photo with the bucket's next (the tile turns over, its old
 *   preview as the back face until the turn is done) or counts a refusal; `holdPhoto` puts
 *   a photo's big version first and makes it paintable (decoded, `loader.paintable`) before
 *   the view lays it over the preview; `chosenBlobs` gives "Yes" the big versions that are
 *   there first, waiting only while fewer than it sends are ready.
 *
 * Invariants:
 * - Nothing leaves the phone before "Yes": previews and big versions are Blobs in this
 *   page's memory. Only photos of the set on screen are sent, at most as many as the game
 *   can show of this player; one the phone cannot hand over is left out, never replaced by
 *   one the player did not see.
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
import { createLoader, paintable } from './loader.js';
import { photo, randomPhotos } from './phone.js';
import { grayOf, textLines } from './textcheck.js';

export const photos = {
  /**
   * The set on screen: the bucket's own entries, each with { url (the preview as a link),
   * sharp (the big version as a decoded link, made when the photo is held), anim ('in' |
   * 'flip' while it is dealt or swapped in), from (while it turns in: the preview it
   * replaced, as a link) } added.
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

/** How many previews the phone is asked for at once: a few, so results keep flowing. */
const BATCH = 6;

/**
 * Checked previews that fit the current filter, in draw order: { id, blob, screenshot,
 * lines, full (the big version, a Blob, once there), pending (being fetched), failed
 * ('ahead': not stored on the phone, tried again with the download once on screen; true:
 * it will not come) }.
 */
let bucket = [];
/** What the bucket gathers for: "Which photos", the set size, and whether it rests (a game runs). */
const needs = { filter: null, size: 0, paused: false };
/** Ids that do not fit `needs.filter`: the phone is not asked for them again until it changes. */
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

// ---------- The list of work ----------

/** A photo still needs its big version: none there, none on its way, and it has not failed for good. */
const needsFull = (e) => Boolean(e) && !e.full && !e.pending && e.failed !== true;

/**
 * The bucket holds fewer previews than a player may need without waiting: the set being
 * dealt and, outside a game, LIMITS.readySets sets behind the one on screen, so "No" is
 * instant however often it is tapped. Each "No" spends a set of this reserve, and the
 * reserve is filled again at once, by its own worker (`deal`) next to the big versions of
 * the set on screen. Behind them it starved: those take seconds when a photo is kept only
 * in iCloud, so a player tapping "No" again and again had used up the bucket after about
 * fifteen sets and then waited at every "No".
 */
const previewsShort = () => readable && !exhausted && bucket.length < (needs.paused ? dealing : Math.max(dealing, needs.size * LIMITS.readySets));

/**
 * The next job for a free worker (`open`: the kinds with a free slot), in the order of what
 * a player waits for; see the header. Background work (`fill`) starts only while nothing a
 * player waits for is left to start, so it never takes the phone's time from them.
 */
function pick(open) {
  const free = (kind) => open.includes(kind);
  const held = photos.chosen.find((c) => c.id === heldId);
  if (free('held') && needsFull(held)) return { key: `full:${held.id}`, kind: 'held', run: () => fetchFull(held, true) };
  if (free('deal') && previewsShort()) return { key: 'deal', kind: 'deal', run: () => fetchPreviews() };
  // The set on screen, unless it is being replaced. Every photo is first asked for from the
  // phone alone, which is quick (one kept only in iCloud says so at once and becomes
  // `failed: 'ahead'`); only then do those download. So the photos on the phone are ready
  // for "Yes" within moments, whatever order the set is in.
  const set = dealing ? [] : photos.chosen;
  const local = set.find((c) => needsFull(c) && !c.failed);
  const next = local || set.find(needsFull);
  if (free('sharp') && next) return { key: `full:${next.id}`, kind: 'sharp', run: () => fetchFull(next, !local) };
  if (!free('fill') || !readable || needs.paused || needsFull(held) || previewsShort() || next) return null;
  const ahead = bucket.slice(0, needs.size).find((e) => needsFull(e) && !e.failed);
  if (ahead) return { key: `full:${ahead.id}`, kind: 'fill', run: () => fetchFull(ahead, false) };
  if (bucket.length < LIMITS.bucketPreviews && !exhausted) return { key: 'fill', kind: 'fill', run: () => fetchPreviews() };
  return null;
}

const worker = createLoader(pick, { held: 1, deal: 1, sharp: 1, fill: 1 });

/** Something changed: the workers look again, waiting promises are checked, the view repaints. */
function poke() {
  for (const w of [...waiters]) {
    if (!w.check()) continue;
    waiters.delete(w);
    w.resolve();
  }
  worker.wake();
  changed();
}

/** A promise that resolves once `check()` holds (re-checked after every job). */
function until(check) {
  if (check()) return Promise.resolve();
  return new Promise((resolve) => waiters.add({ check, resolve }));
}

/**
 * A held photo's sharp layer: its big version, decoded before the view shows it, so it
 * appears at once over the preview instead of a blank frame. Made once per photo of the set.
 */
function showSharp(c) {
  if (!c.full || c.sharp || c.sharpening) return;
  c.sharpening = true;
  paintable(c.full).then((url) => {
    c.sharpening = false;
    if (photos.chosen.includes(c)) c.sharp = url;
    else URL.revokeObjectURL(url);
    changed();
  }, () => {
    c.sharpening = false;
  });
}

/**
 * A photo's big version. Without `download` only from what the phone stores (quick, and no
 * mobile data for a photo that may never be shown): ahead of time, and first for the set on
 * screen too. A failure without the download is tried again with it once the photo is on
 * screen; a failure then is final (the photo is left out of the upload).
 */
async function fetchFull(entry, download) {
  entry.pending = true;
  const blob = await photo(entry.id, { download }).catch(() => null);
  entry.pending = false;
  if (blob) entry.full = blob;
  else entry.failed = download ? true : 'ahead';
  if (blob && entry.id === heldId && photos.chosen.includes(entry)) showSharp(entry);
  poke();
}

/** One batch of previews, each checked once; the ones that fit go to the end of the bucket. */
async function fetchPreviews() {
  let batch;
  try {
    // The set on screen is in `seen`; only `roll`'s last pass (nothing else left) lets it come back.
    const exclude = [...seen, ...unfit, ...bucket.map((e) => e.id)];
    batch = await randomPhotos(BATCH, exclude);
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
    if (fits(entry, needs.filter)) bucket.push(entry);
    else unfit.add(entry.id);
  }
  poke();
}

// ---------- The set on screen ----------

function release(set) {
  for (const c of set) {
    for (const url of [c.url, c.sharp, c.from]) if (url) URL.revokeObjectURL(url);
  }
}

/**
 * A bucket entry joins the set on screen (`anim` is its entrance): the same object, so a big
 * version still being fetched for it lands in the set too. One not stored on the phone
 * (`failed: 'ahead'`) may now be downloaded.
 */
function slot(entry, anim) {
  return Object.assign(entry, { url: URL.createObjectURL(entry.blob), sharp: null, anim, from: null });
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
 * What the bucket gathers for: `filter` ("Which photos") and `size` ("Photos per player",
 * the next set's size) of the room, or this phone's own settings outside a game; `paused`
 * while a game runs. Any of them may be left out. A new filter drops what no longer fits
 * (from the checks already made) and lets the phone offer what the old one left out.
 */
export function setNeeds(next) {
  const filter = next.filter ?? needs.filter;
  const size = next.size ?? needs.size;
  const paused = next.paused ?? needs.paused;
  if (filter === needs.filter && size === needs.size && paused === needs.paused) return;
  if (filter !== needs.filter) {
    unfit = new Set();
    const kept = [];
    for (const e of bucket) {
      if (fits(e, filter)) kept.push(e);
      else unfit.add(e.id);
    }
    bucket = kept;
    exhausted = false;
  }
  Object.assign(needs, { filter, size, paused });
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
  setNeeds({ filter, size });
  const onScreen = photos.chosen.map((c) => c.id);
  Object.assign(photos, { size, filter, spent: false, rolling: true });
  dealing = size;
  changed();
  // Unseen photos first; once the phone has none left, earlier ones (`seen` then holds only
  // the set on screen); and only then the set on screen again. Waits only when the bucket
  // is short, so "No" with the bucket's ready sets is instant.
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
  // The old photo's sharp layer goes now; its preview with the turn (`settleLater`), and a
  // turn it was still in the middle of ends by its own timer.
  if (old.sharp) URL.revokeObjectURL(old.sharp);
  photos.swaps -= 1;
  settleLater(c);
  poke();
  return true;
}

/** Photo `index` of the set is held big: its big version comes first (and is made paintable); null lets go. */
export function holdPhoto(index) {
  const c = index === null ? null : photos.chosen[index];
  heldId = c ? c.id : null;
  if (c) showSharp(c);
  poke();
}

/** What a held photo shows, bottom layer first: its preview, and its decoded big version above it once there. */
export function heldLayers(index) {
  const c = photos.chosen[index];
  return c ? [c.url, c.sharp].filter(Boolean) : [];
}

/**
 * The big versions "Yes" sends: `count` of the set on screen (at most as many as the game
 * can show of this player, `main.js`), those already there first, in the set's order. Waits
 * only while fewer than that are ready and more may come (the player sees "✓ Ready"
 * meanwhile: the upload runs in the background). Throws when none of them could be read.
 */
export async function chosenBlobs(count) {
  const set = photos.chosen;
  const want = Math.min(count, set.length);
  const ready = () => set.filter((c) => c.full);
  const settled = () => set.filter((c) => c.full || c.failed === true).length;
  await until(() => ready().length >= want || settled() === set.length || photos.chosen !== set);
  const blobs = ready().slice(0, want).map((c) => c.full);
  if (want && !blobs.length) throw new Error('unreadable');
  return blobs;
}
