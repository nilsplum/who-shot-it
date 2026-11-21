/**
 * The player's photo choice in the lobby: candidates on the device, the random set of n
 * shown with No/Yes, and shrinking each photo before it may leave the phone.
 *
 * Mechanisms: candidates come from one of three sources, all ending in `setCandidates`:
 * the folder picker ("All photos" on Android and computers), the photo picker ("Choose
 * photos"), or the iPhone shortcut's pool (`api.takePool`). `roll` draws n random photos
 * and shrinks them; "No" rolls again, "Yes" uploads exactly these shrunk JPEGs
 * (`api.uploadPhotos`).
 *
 * Invariants:
 * - Nothing leaves the device before "Yes": candidates are local File/Blob objects.
 * - Uploads are always the re-encoded canvas JPEGs (at most LIMITS.photoMaxSide on the
 *   longest side, at most LIMITS.photoMaxBytes), which also strips location data.
 * - A roll prefers photos not shown yet; only when the candidates run out do earlier
 *   ones come back (never the set on screen, if there are enough others).
 * - A newer roll cancels an older one still shrinking (`rollId`).
 */

import { LIMITS } from '../shared/config.js';

export const photos = {
  /** Local File/Blob candidates. */
  candidates: [],
  /** Indexes of candidates already shown. */
  seen: new Set(),
  /** The set on screen: { index, blob, url, bad }. */
  chosen: [],
  /** The set size the current roll was made for (the "Photos per player" setting). */
  size: 0,
  /** True once the set was played, so the next lobby draws a fresh one. */
  spent: false,
  rollId: 0,
};

export const isImageFile = (file) => /^image\//.test(file.type) || /\.(jpe?g|png|heic|heif|webp|gif|avif)$/i.test(file.name || '');

/** Pure: which candidate indexes the next roll shows. */
export function pickIndexes(total, size, seen, current, rng = Math.random) {
  const all = [...Array(total).keys()];
  let pool = all.filter((i) => !seen.has(i));
  if (pool.length < size) {
    // Start over, but keep the set on screen out if there are enough others.
    seen.clear();
    current.forEach((i) => seen.add(i));
    pool = all.filter((i) => !seen.has(i));
    if (pool.length < size) pool = all;
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, size);
}

function releaseChosen() {
  photos.chosen.forEach((c) => c.url && URL.revokeObjectURL(c.url));
  photos.chosen = [];
}

export function setCandidates(list) {
  releaseChosen();
  photos.candidates = list.filter(isImageFile);
  photos.seen = new Set();
  photos.size = 0;
  photos.spent = false;
  photos.rollId += 1;
}

export function clearPhotos() {
  setCandidates([]);
}

export const isRolling = () => photos.chosen.some((c) => !c.blob && !c.bad);
export const readyBlobs = () => photos.chosen.filter((c) => c.blob).map((c) => c.blob);

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** The photo re-encoded as a JPEG small enough to upload, or null if it cannot be read. */
export async function shrink(file) {
  const src = await decode(file);
  const w0 = src.width || src.naturalWidth;
  const h0 = src.height || src.naturalHeight;
  if (!w0 || !h0) return null;
  const scale = Math.min(1, LIMITS.photoMaxSide / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w0 * scale));
  canvas.height = Math.max(1, Math.round(h0 * scale));
  const ctx = canvas.getContext('2d');
  // JPEG has no transparency: transparent parts of a PNG become black, not random noise.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  if (src.close) src.close();
  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= LIMITS.photoMaxBytes) return blob;
  }
  return null;
}

/**
 * Draws `size` random photos and shrinks them one by one, calling `onChange` after each,
 * so the grid fills in as they become ready. Unreadable photos are replaced by others.
 */
export async function roll(size, onChange) {
  const id = ++photos.rollId;
  const total = photos.candidates.length;
  const n = Math.min(size, total);
  const current = photos.chosen.map((c) => c.index);
  releaseChosen();
  photos.size = size;
  photos.spent = false;
  const indexes = pickIndexes(total, n, photos.seen, current);
  indexes.forEach((i) => photos.seen.add(i));
  photos.chosen = indexes.map((index) => ({ index, blob: null, url: null, bad: false }));
  onChange();
  const spare = [...Array(total).keys()].filter((i) => !photos.seen.has(i));
  for (let k = 0; k < photos.chosen.length; k++) {
    const slot = photos.chosen[k];
    for (;;) {
      let blob = null;
      try {
        blob = await shrink(photos.candidates[slot.index]);
      } catch {}
      if (id !== photos.rollId) return;
      if (blob) {
        slot.blob = blob;
        slot.url = URL.createObjectURL(blob);
        break;
      }
      // Unreadable (for example a format this browser cannot decode): try another one.
      if (!spare.length) {
        slot.bad = true;
        break;
      }
      slot.index = spare.splice(Math.floor(Math.random() * spare.length), 1)[0];
      photos.seen.add(slot.index);
    }
    onChange();
  }
  photos.chosen = photos.chosen.filter((c) => !c.bad);
  onChange();
}
