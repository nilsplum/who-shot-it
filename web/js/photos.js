/**
 * The player's photo choice in the lobby: n random photos from the phone, shown with
 * "Play with these?" No/Yes.
 *
 * Mechanisms: `main.js` calls `roll` when the lobby needs a set (a new game, a new
 * "Photos per player", or "No"). Each slot asks the phone for one random photo
 * (`phone.randomPhoto`), so the grid fills in photo by photo; "Yes" uploads exactly these
 * JPEGs (`api.uploadPhotos`).
 *
 * Invariants:
 * - Nothing leaves the phone before "Yes": the set is local Blobs (already shrunk and
 *   re-encoded on the phone, see `phone.js`).
 * - A roll prefers photos not shown yet (`seen`); only when the phone has none left do
 *   earlier ones come back, never the set on screen if there are others.
 * - A newer roll cancels an older one still running (`rollId`).
 */

import { randomPhoto } from './phone.js';

export const photos = {
  /** The set on screen: { id, blob, url } per slot; a slot still loading has no url. */
  chosen: [],
  /** Phone photo ids already shown in this lobby. */
  seen: new Set(),
  /** The set size the current roll was made for (the "Photos per player" setting). */
  size: 0,
  /** True once the set was played, so the next lobby draws a fresh one. */
  spent: false,
  /** True while a roll is running. */
  rolling: false,
  /** True when the phone had no photo to give at all (an empty or fully hidden library). */
  empty: false,
  rollId: 0,
};

function release() {
  photos.chosen.forEach((c) => c.url && URL.revokeObjectURL(c.url));
  photos.chosen = [];
}

/** Forgets the set and everything seen (leaving the room, or photo access changed). */
export function resetPhotos() {
  release();
  photos.seen = new Set();
  photos.size = 0;
  photos.spent = false;
  photos.rolling = false;
  photos.empty = false;
  photos.rollId += 1;
}

export const readyBlobs = () => photos.chosen.filter((c) => c.blob).map((c) => c.blob);

/** One new photo, starting over (but not with the set on screen) once all were seen. */
async function draw(onScreen) {
  let photo = await randomPhoto([...photos.seen]);
  if (!photo && photos.seen.size) {
    photos.seen = new Set(onScreen);
    photo = await randomPhoto([...photos.seen]);
    if (!photo && onScreen.length) {
      photos.seen = new Set();
      photo = await randomPhoto([]);
    }
  }
  if (photo) photos.seen.add(photo.id);
  return photo;
}

/**
 * Draws `size` random photos one by one, calling `onChange` after each, so the grid
 * fills in as they arrive. A photo the phone cannot hand over in time is replaced by
 * another; a phone with fewer photos than `size` gives a smaller set.
 */
export async function roll(size, onChange) {
  const id = ++photos.rollId;
  const onScreen = photos.chosen.map((c) => c.id).filter(Boolean);
  release();
  Object.assign(photos, { size, spent: false, rolling: true, empty: false });
  photos.chosen = Array.from({ length: size }, () => ({ id: null, blob: null, url: null }));
  onChange();
  for (const slot of photos.chosen) {
    let photo = null;
    for (let attempt = 0; attempt < 3 && !photo; attempt++) {
      try {
        photo = await draw(onScreen);
        if (!photo) break;
      } catch {
        // Too slow (an iCloud original that does not arrive): try another photo.
      }
    }
    if (id !== photos.rollId) return;
    if (!photo) break;
    Object.assign(slot, { id: photo.id, blob: photo.blob, url: URL.createObjectURL(photo.blob) });
    onChange();
  }
  photos.chosen = photos.chosen.filter((c) => c.blob);
  photos.rolling = false;
  photos.empty = photos.chosen.length === 0;
  onChange();
}
