/**
 * Counts the lines of text in a photo, so the game can leave out photos full of text
 * (chats, emails, documents) when the host's "Which photos" setting asks for it.
 *
 * Mechanisms: `photos.js` runs it on every preview the phone hands over (`phone.js`,
 * `randomPhotos`: at most LIMITS.previewSide pixels on the longest side) and treats a photo
 * with LIMITS.textLines lines or more as full of text. It runs on the phone only, on the
 * small preview, and nothing about it leaves the phone.
 *
 * How it works: text is rows of thin, sharp strokes. Every pixel whose brightness jumps
 * strongly to its right neighbour is a stroke edge; closing the small gaps between edges on
 * each pixel row joins the letters of a line into one long, low, filled band. Bands of the
 * right shape (not taller than a line of text, much wider than tall, mostly filled) are
 * counted. Photos have edges too (leaves, gravel, windows, faces), but they join into
 * blobs that are too tall, too short or too ragged, so even busy photos count 0 to 4 lines,
 * while a screenshot of a chat or an email counts 15 or more
 * (`test/unit/textcheck.test.js`, with real photos and drawn screenshots).
 *
 * Invariants:
 * - Pure: pixels in, a number out. No DOM, so it runs the same in the unit tests.
 * - The shape limits scale with the preview's width, because screenshots (the typical case)
 *   scale their text with the screen's width.
 * - Horizontal text only; that is what screens and most documents show.
 */

/** A brightness jump (0 to 255) between neighbouring pixels that counts as a stroke edge. */
const EDGE = 25;
/** Gaps up to this share of the width are closed: letters and words join into a line. */
const GAP = 1 / 70;
/** A line is at most this share of the width tall (taller bands are objects, not text). */
const LINE_HEIGHT = 0.06;
/** A line is at least this share of the width long, and this many times longer than tall. */
const LINE_LENGTH = 0.08;
const LINE_ASPECT = 3;
/** A line's band is at least this full once its gaps are closed (ragged blobs are not text). */
const LINE_FILL = 0.4;

/** Brightness per pixel (0 to 255) from RGBA pixels, as a canvas or a decoder gives them. */
export function grayOf(rgba) {
  const gray = new Uint8Array(rgba.length / 4);
  for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (rgba[i] * 77 + rgba[i + 1] * 150 + rgba[i + 2] * 29) >> 8;
  return gray;
}

/** The number of lines of text in a `width` x `height` image given as brightness per pixel. */
export function textLines(gray, width, height) {
  const size = width * height;
  const gap = Math.max(2, Math.round(width * GAP));
  const maxHeight = Math.max(6, Math.round(width * LINE_HEIGHT));

  // Stroke edges, with the small gaps between them closed on each pixel row.
  const band = new Uint8Array(size);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let last = -Infinity;
    for (let x = 0; x < width - 1; x++) {
      if (Math.abs(gray[row + x + 1] - gray[row + x]) < EDGE) continue;
      if (x - last <= gap) band.fill(1, row + last + 1, row + x);
      band[row + x] = 1;
      last = x;
    }
  }

  // Each connected band (4 neighbours, flood fill with an explicit stack): its box and how
  // full it is decide whether it is a line of text.
  const seen = new Uint8Array(size);
  const stack = new Int32Array(size);
  let lines = 0;
  for (let start = 0; start < size; start++) {
    if (!band[start] || seen[start]) continue;
    let top = 0;
    let count = 0;
    let x0 = width, x1 = 0, y0 = height, y1 = 0;
    stack[top++] = start;
    seen[start] = 1;
    while (top) {
      const p = stack[--top];
      const x = p % width;
      const y = (p - x) / width;
      count++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x > 0 && band[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; stack[top++] = p - 1; }
      if (x < width - 1 && band[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; stack[top++] = p + 1; }
      if (y > 0 && band[p - width] && !seen[p - width]) { seen[p - width] = 1; stack[top++] = p - width; }
      if (y < height - 1 && band[p + width] && !seen[p + width]) { seen[p + width] = 1; stack[top++] = p + width; }
    }
    const w = x1 - x0 + 1;
    const h = y1 - y0 + 1;
    if (h >= 2 && h <= maxHeight && w >= LINE_ASPECT * h && w >= width * LINE_LENGTH && count >= LINE_FILL * w * h) lines++;
  }
  return lines;
}
