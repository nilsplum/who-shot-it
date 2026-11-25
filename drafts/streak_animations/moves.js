/**
 * What the streak's reveal is made of: what a streak is worth (the bonus of each number and
 * what each step adds, how the tiers look, how dramatic a step is), a layer for what flies
 * over the screen, a count, a flight and a jolt.
 *
 * Mechanisms: tower.js, badge.js and reveal.js import these; the light comes from
 * the app's canvas (web/js/sparks.js), vibrations and pauses from the kit (/kit/screen.js),
 * and the bonus from the app's scoring (`SCORING` in web/shared/config.js), so no number here
 * is a second copy of one the game decides.
 *
 * Invariants: every move is transform, scale, rotate or opacity (and the canvas), so a phone
 * moves them without laying the page out again; every element a story makes lives in its
 * layer, which the story removes when it ends.
 */
import { SCORING } from '/shared/config.js';
import { middle } from '/js/sparks.js';
import { buzz, wait } from '/kit/screen.js';

export { buzz, middle, wait };

/** The app's two easings (styles/app.css) as the animation API takes them. */
export const EASE = { out: 'cubic-bezier(0.2, 0.8, 0.2, 1)', bounce: 'cubic-bezier(0.3, 1.6, 0.5, 1)' };

/**
 * What the game pays for a streak of `k` right answers in a row, on top of the answer's own
 * points: the room's rule (`src/game/score.js`): `SCORING.streakStep` for every answer beyond
 * the first, at most `SCORING.streakMax`.
 */
export const bonusOf = (k) => Math.min(SCORING.streakMax, (k - 1) * SCORING.streakStep);
/** What the number `k` adds to the bonus: the step (+100), nothing once the cap is reached. */
export const stepOf = (k) => bonusOf(k) - bonusOf(k - 1);
/** Whether the bonus of a streak of `k` has reached its cap, so a longer streak earns no more. */
export const capped = (k) => (k - 1) * SCORING.streakStep >= SCORING.streakMax;

/** How dramatic the number `k` is, 0 to 1: a streak of 2 is a small thing, from 7 on nothing is held back. */
export const dramaOf = (k) => Math.min(1, 0.15 + 0.17 * (k - 2));

/**
 * The tiers of a streak, from which number on: its colour as the light's theme name (`tint`)
 * and as whole class names (written out so Tailwind builds them): a fill with its text (`fill`,
 * `ink`), a text on white (`onWhite`) and a border (`band`); how many sparks the merge throws,
 * how hard the screen jolts (px), the white flash (0: none), and the vibration. Each tier is
 * louder than the one before, so a long streak feels crazy high.
 */
const TIERS = [
  { from: 2, tint: 'yellow', fill: 'bg-yellow', ink: 'text-navy', onWhite: 'text-p6', band: 'border-yellow', sparks: 16, shake: 2, flash: 0, felt: 'yes' },
  { from: 4, tint: 'p6', fill: 'bg-p6', ink: 'text-navy', onWhite: 'text-coral', band: 'border-p6', sparks: 24, shake: 4, flash: 0, felt: 'yes' },
  { from: 7, tint: 'coral', fill: 'bg-coral', ink: 'text-white', onWhite: 'text-red', band: 'border-coral', sparks: 34, shake: 6, flash: 0.14, felt: 'land' },
  { from: 10, tint: 'p8', fill: 'bg-p8', ink: 'text-white', onWhite: 'text-p8', band: 'border-p8', sparks: 46, shake: 8, flash: 0.22, felt: 'land' },
  { from: 15, tint: 'violet', fill: 'bg-violet', ink: 'text-white', onWhite: 'text-violet', band: 'border-violet', sparks: 60, shake: 10, flash: 0.3, felt: 'land' },
];

/** The look of a streak of `k` right answers in a row, and the tier's number (`level`, 1 to 5). */
export function lookOf(k) {
  const level = Math.max(1, TIERS.filter((t) => k >= t.from).length);
  return { level, ...TIERS[level - 1] };
}

/** Runs `each(k)` every frame for `ms` milliseconds, k from 0 to 1 along `curve`; resolves at the end. */
export function tween(ms, each, curve = (k) => k) {
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now) => {
      const k = Math.min(1, Math.max(0, (now - start) / ms));
      each(curve(k));
      if (k < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

/** The layer a story plays in: the whole screen, above it, never taking a tap; a sibling of the screen, so a jolt of the screen never moves what a story measured. */
export function layer() {
  const el = document.createElement('div');
  el.className = 'pointer-events-none fixed inset-0 z-25 overflow-hidden';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  return el;
}

/** An element that sits at `at` (the screen's pixels) in `parent`; `translate`, `scale` and `rotate` move it, and what it holds is laid out around it. */
export function pin(parent, html, at) {
  const el = document.createElement('div');
  el.className = 'absolute top-0 left-0';
  el.style.translate = `${at.x}px ${at.y}px`;
  el.innerHTML = html;
  parent.append(el);
  return el;
}

/**
 * How far `el` has to move, in the units of its group `grp` (which may be drawn smaller, `u`),
 * to have its middle at `to` (the screen's pixels): the `translate` a flight into the points needs.
 */
export function toward(el, to, u) {
  const at = middle(el);
  return { x: (to.x - at.x) / u, y: (to.y - at.y) / u };
}

/** Every element shakes and settles: `px` at first, less and less (the screen's jolt, as podium.js has it). */
export function jolt(els, px) {
  const steps = 8;
  for (const el of els) {
    el.animate(Array.from({ length: steps + 1 }, (_, i) => {
      const k = (1 - i / steps) ** 1.6;
      return { translate: i === steps ? 'none' : `${(i % 2 ? 1 : -1) * px * k}px ${((i % 3) - 1) * px * 0.6 * k}px` };
    }), { duration: 420 });
  }
}

/** The reveal's timer bar (`#tbar`, web/js/ui.js `timerBar`) runs down over `ms`, as main.js shrinks it. */
export function runTimer(ms) {
  const bar = document.getElementById('tbar');
  if (bar) bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, fill: 'forwards' });
}
