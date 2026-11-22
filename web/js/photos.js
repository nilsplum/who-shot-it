/**
 * The player's photo choice in the lobby: n random photos from the phone, shown with
 * "Play with these?" No/Yes, without waiting.
 *
 * Mechanisms:
 * - `main.js` calls `roll(size, filter, onChange)` when the lobby needs a set: a new game,
 *   a new "Photos per player" or "Which photos", or "No".
 * - A deck of checked previews stays ready beyond the set on screen (LIMITS.setsAhead
 *   sets). The phone hands previews over in batches (`phone.randomPhotos`); each is checked
 *   against the room's "Which photos" setting (the phone marks screenshots, and
 *   `textcheck.js` counts the lines of text on the preview's pixels). So "No" shows the
 *   next set at once, and the deck refills in the background.
 * - The set on screen shows the previews. Its photos for upload (`phone.photo`) are
 *   prepared one by one right away, so "Yes" (`chosenBlobs`) usually uploads at once.
 *
 * Invariants:
 * - Nothing leaves the phone before "Yes": previews and photos are local Blobs. Only the
 *   photos of the set on screen are uploaded; one the phone cannot hand over in time is
 *   left out, never replaced by one the player did not see.
 * - A set prefers photos not shown yet (`seen`); only when the phone has none left do
 *   earlier ones come back, never the set on screen if there are others.
 * - A newer roll wins over an older one still waiting (`rollId`), and changing "Which
 *   photos" or leaving drops the deck; a refill still running for the old deck notices
 *   (`generation`) and throws its results away.
 * - Nothing here blocks a tap or a repaint: the work waits on the phone between steps, and
 *   the text check takes a few milliseconds per preview.
 */

import { LIMITS } from '../shared/config.js';
import { photo, randomPhotos } from './phone.js';
import { grayOf, textLines } from './textcheck.js';

export const photos = {
  /** The set on screen: { id, url, full } per photo; `full` is the upload, once asked for. */
  chosen: [],
  /** The set size and the "Which photos" value the current set and deck were made for. */
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

/** Checked previews waiting for a set: { id, blob, screenshot }. */
let deck = [];
/** Ids the filter left out: the phone is not asked for them again until "Which photos" changes. */
let left = new Set();
/** Ids already shown in this lobby. */
let seen = new Set();
/** True when the phone had no photo left that is not shown, waiting or left out. */
let exhausted = false;
let generation = 0;
/** The running refill, the deck it fills and how many previews it aims for. */
let filling = null;
let wanted = 0;

function release(set) {
  set.forEach((c) => URL.revokeObjectURL(c.url));
}

function dropDeck(filter) {
  deck = [];
  left = new Set();
  exhausted = false;
  generation += 1;
  photos.filter = filter;
}

/** Forgets the set, the deck and everything seen (leaving the room, or photo access changed). */
export function resetPhotos() {
  release(photos.chosen);
  photos.chosen = [];
  dropDeck(null);
  seen = new Set();
  Object.assign(photos, { size: 0, spent: false, rolling: false, empty: false });
  photos.rollId += 1;
}

/** Lines of text on a preview (decoded upright, as the browser shows it). */
async function linesOf(blob) {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return textLines(grayOf(context.getImageData(0, 0, width, height).data), width, height);
}

/** Whether a preview fits "Which photos" (see SETTINGS in config.js). */
async function fits(preview, filter) {
  if (filter === 'all') return true;
  if (filter === 'no-screenshots' && preview.screenshot) return false;
  try {
    return (await linesOf(preview.blob)) < LIMITS.textLines;
  } catch {
    // A preview the browser cannot decode could not be shown either.
    return false;
  }
}

/**
 * Asks the phone for previews until the deck holds `target`, or the phone has none left.
 * One refill runs at a time; a call while one runs sets its target. Holds nothing while it
 * waits: the deck and the target are re-read after every answer. A phone that does not
 * answer three times in a row counts as having none left, so a roll never waits forever.
 */
function refill(target) {
  wanted = target;
  if (filling && filling.generation === generation) return filling.promise;
  const gen = generation;
  const filter = photos.filter;
  // Registered before it starts: a refill with nothing to do ends at once, and its end
  // must find itself here to clear it.
  const run = { generation: gen, promise: null };
  filling = run;
  run.promise = (async () => {
    let failures = 0;
    try {
      while (gen === generation && deck.length < wanted && !exhausted) {
        let batch;
        try {
          batch = await randomPhotos(Math.min(6, Math.max(3, wanted - deck.length)), [...seen, ...left, ...deck.map((c) => c.id)]);
          failures = 0;
        } catch {
          failures += 1;
          batch = failures < 3 ? null : [];
        }
        if (gen !== generation) return;
        if (!batch) continue;
        if (!batch.length) exhausted = true;
        for (const preview of batch) {
          const ok = await fits(preview, filter);
          if (gen !== generation) return;
          if (ok) deck.push(preview);
          else left.add(preview.id);
        }
      }
    } finally {
      if (filling === run) filling = null;
    }
  })();
  return run.promise;
}

/** Starts preparing the uploads of the set on screen, one photo at a time. */
async function prepare(id) {
  for (const c of photos.chosen) {
    if (id !== photos.rollId) return;
    if (!c.full) c.full = photo(c.id).catch(() => null);
    await c.full;
  }
}

/**
 * Shows a new set of `size` photos that fit `filter` (the room's "Which photos"), right away
 * when the deck has them. The set on screen stays until the new one is there; a phone with
 * fewer fitting photos gives a smaller set.
 */
export async function roll(size, filter, onChange) {
  const id = ++photos.rollId;
  if (filter !== photos.filter) dropDeck(filter);
  const onScreen = photos.chosen.map((c) => c.id);
  Object.assign(photos, { size, spent: false, rolling: true });
  onChange();
  // Unseen photos first; once the phone has none left, earlier ones (`seen` then holds only
  // the set on screen); and only then the set on screen again. Waits only when the deck
  // is short, so "No" with a full deck is instant.
  for (const reuse of [null, onScreen, []]) {
    if (reuse) {
      seen = new Set(reuse);
      exhausted = false;
    }
    if (deck.length < size) await refill(size).catch(() => {});
    if (id !== photos.rollId) return;
    if (deck.length >= size || !exhausted) break;
  }
  const set = deck.splice(0, size);
  set.forEach((c) => seen.add(c.id));
  const old = photos.chosen;
  photos.chosen = set.map((c) => ({ id: c.id, url: URL.createObjectURL(c.blob), full: null }));
  release(old);
  Object.assign(photos, { rolling: false, empty: set.length === 0 });
  onChange();
  prepare(id);
  refill(size * LIMITS.setsAhead).catch(() => {});
}

/**
 * The uploads of the set on screen, for "Yes": waits for the ones still being prepared.
 * Throws when none of them could be read.
 */
export async function chosenBlobs() {
  const set = photos.chosen;
  set.forEach((c) => { if (!c.full) c.full = photo(c.id).catch(() => null); });
  const blobs = (await Promise.all(set.map((c) => c.full))).filter(Boolean);
  if (set.length && !blobs.length) throw new Error('unreadable');
  return blobs;
}
