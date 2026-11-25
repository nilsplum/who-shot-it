/**
 * What the three bubbles share besides the bulging text: the lines, how long each stays
 * when they come one after another, and the few moves every story makes.
 *
 * Mechanisms: each bubble's module paints its final state into the layer over the photo
 * area (`paint`) and, on Play, plays its story (`play`) with these helpers. A story works
 * the way the app plays an entrance: the markup is the final state; `data-playing` on the
 * scene hides what has not arrived yet, `data-go` lets a piece arrive (its entrance), and
 * `data-live` starts the endless moves (each on its own element, so no two animations ever
 * fight over one property). A new line replaces only the text and replays one move
 * (`replay`), as the app would repaint only the bubble's part.
 *
 * Invariants: everything moves with `transform`, `translate`, `rotate`, `scale` and
 * `opacity`, which the phone's graphics chip animates by itself; nothing animates a shadow,
 * a filter, a gradient or a size.
 */
import { wait } from '/kit/screen.js';

/** The three tiers of lines (the plan, section 3.3), one of each; `{name}` is the last player's name. */
export const LINES = ['It’s always {name}…', 'What is {name} hiding? 👀', '{name}, the whole table is staring at you.'];

/** How long a line stays before the next one pops in, when they come one after another (the app: 8 s; shorter here, to see it). */
export const LINE_MS = 4200;

/**
 * The name on the small bubbles: a long name (over 10 characters) by its first part, before
 * a space or a hyphen ("Maximilian" for "Maximilian-Alexa"), when that part is a real name
 * (3 characters or more), so it stays big enough to read on a small bubble; the big bubble
 * always says the whole name.
 */
export function shortName(name) {
  const length = (text) => [...new Intl.Segmenter().segment(text)].length;
  const first = name.split(/[\s-]/)[0];
  return length(name) > 10 && length(first) >= 3 ? first : name;
}

/** Restarts the one-shot animation that `attr` turns on, in the same task (no frame without it). */
export function replay(el, attr) {
  el.removeAttribute(attr);
  void el.offsetWidth;
  el.setAttribute(attr, '');
}

/**
 * The lines after the first, one every LINE_MS: `show(text)` puts each into the bubble.
 * Stops when the scene left the page (a choice reloads the frame).
 */
export async function nextLines(scene, lines, show) {
  for (const text of lines.slice(1)) {
    await wait(LINE_MS);
    if (!scene.isConnected) return;
    show(text);
  }
}
