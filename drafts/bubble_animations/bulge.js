/**
 * Text that bulges as if printed on a ball ("ss SS ss"), shared by the three bubbles: the
 * line is cut into rows here, each character gets a size by its place in its row (biggest
 * in the middle, smaller towards the ends) and each row by its place among the rows (the
 * middle row a little bigger), and the whole text is then sized once to fit its bubble.
 *
 * Mechanisms: `bulgeHtml` returns the rows as markup, a span per character with its size
 * factor as `--k` (the `bulge` utility in style.css turns it into a font size, and gives
 * every character the fat outline and the shadow its bubble names, `--fat` and
 * `--letter-shadow`, measured in that character's own size). `fitBox` and `fitCircle`
 * measure the text once at a known size and scale it, so the longest row always fits.
 *
 * Invariants:
 * - Rows are cut here, not by the browser, because the bulge needs to know each row. A row
 *   holds at most `max` characters; a word longer than that is broken (after a hyphen where
 *   it has one), so a 16-letter name never overflows.
 * - Characters are graphemes (`Intl.Segmenter`): an emoji or an accented letter stays whole.
 * - Every character passes through `esc`; the sizes are rounded, so the markup of a line is
 *   always the same and a repaint changes nothing.
 * - An emoji is sized like the letters around it but drawn in its own colours: an outline
 *   in the text's colour would turn it into a hollow shape.
 */
import { esc } from '/js/ui.js';

const SEGMENTER = new Intl.Segmenter('en', { granularity: 'grapheme' });
const graphemes = (text) => [...SEGMENTER.segment(text)].map((s) => s.segment);

/** A word as pieces of at most `max` characters, broken after its last hyphen that fits, else hard. */
function pieces(word, max) {
  const rest = graphemes(word);
  const out = [];
  while (rest.length > max) {
    const hyphen = rest.slice(0, max).lastIndexOf('-');
    out.push(rest.splice(0, hyphen > 0 ? hyphen + 1 : max));
  }
  out.push(rest);
  return out;
}

/** The tokens filled into rows of at most `limit` characters, each row as full as it gets. */
function fill(tokens, limit) {
  const out = [];
  let row = [];
  for (const t of tokens) {
    const gap = row.length && !t.glued ? [' '] : [];
    if (row.length && row.length + gap.length + t.g.length > limit) {
      out.push(row);
      row = [...t.g];
    } else row.push(...gap, ...t.g);
  }
  if (row.length) out.push(row);
  return out;
}

/**
 * `text` as rows of characters, at most `max` each and as even as they can be: the fewest
 * rows the text fits in, then the narrowest width that still gives that many, so no word is
 * left alone on the last row when it need not be (the pieces of a broken word follow each
 * other without a space). A line has a few dozen characters, so trying the widths is cheap.
 */
export function rows(text, max) {
  const tokens = text.split(' ').filter(Boolean).flatMap((word) => pieces(word, max).map((g, i) => ({ g, glued: i > 0 })));
  const total = tokens.reduce((n, t, i) => n + t.g.length + (i && !t.glued ? 1 : 0), 0);
  for (let count = Math.ceil(total / max); count <= tokens.length; count += 1) {
    for (let limit = Math.ceil(total / count); limit <= max; limit += 1) {
      const out = fill(tokens, limit);
      if (out.length <= count) return out;
    }
  }
  return fill(tokens, max);
}

/** An emoji keeps its own colours: no outline, no shadow (`data-emoji`, the `bulge` utility). */
const EMOJI = /\p{Extended_Pictographic}/u;

/** A smooth hump from `lo` at both ends (x 0 and 1) to `hi` in the middle. */
const hump = ([lo, hi], x) => lo + (hi - lo) * Math.sin(Math.PI * x);

/**
 * The rows of `text` as markup: each character a `bulge` span with its size factor, the
 * product of its place in its row (`across`, ends to middle) and its row's place among the
 * rows (`down`, a single row stays at 1).
 */
export function bulgeHtml(text, { max = 13, across = [0.76, 1.24], down = [0.92, 1.07] } = {}) {
  const lines = rows(text, max);
  return lines.map((row, r) => {
    const v = lines.length === 1 ? 1 : hump(down, (r + 0.5) / lines.length);
    const chars = row.map((ch, i) => `<span class="bulge" style="--k:${(hump(across, (i + 0.5) / row.length) * v).toFixed(2)}"${EMOJI.test(ch) ? ' data-emoji' : ''}>${esc(ch)}</span>`);
    return `<span class="block whitespace-nowrap">${chars.join('')}</span>`;
  }).join('');
}

/** The size the text is measured at before it is scaled to fit. */
const PROBE = 20;

function measure(text) {
  text.style.fontSize = `${PROBE}px`;
  return [text.offsetWidth, text.offsetHeight];
}

/** Sizes `text` (a `w-max` block of rows) so it fits `width` x `height`, at most `max` px. */
export function fitBox(text, width, height, max) {
  const [w, h] = measure(text);
  text.style.fontSize = `${Math.min(max, PROBE * Math.min(width / w, height / h)).toFixed(1)}px`;
}

/** Sizes `text` so its box fits a circle of `diameter` (its corners on the circle), at most `max` px. */
export function fitCircle(text, diameter, max) {
  const [w, h] = measure(text);
  text.style.fontSize = `${Math.min(max, (PROBE * diameter) / Math.hypot(w, h)).toFixed(1)}px`;
}
