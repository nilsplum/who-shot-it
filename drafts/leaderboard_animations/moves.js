/**
 * The moves the leaderboard's story is made of: the app's easings, the same curves for
 * scripted motion, a frame loop over a fixed time, where an element is, the timer bar
 * running down, a burst of sparks, and a flight along an arc.
 *
 * Mechanisms: board.js imports these; its light comes from the
 * app's own canvas (web/js/sparks.js) and their vibrations and pauses from the kit
 * (/kit/screen.js).
 *
 * Invariant: every move is transform or opacity only (and the canvas), so the phone moves
 * them without laying out the page again.
 */
import { spark } from '/js/sparks.js';

/** The app's two easings (styles/app.css) and two more: a quick start with a soft landing, and a slow start. */
export const EASE = {
  bounce: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
  spring: 'cubic-bezier(0.3, 1.2, 0.5, 1)',
  out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  in: 'cubic-bezier(0.6, 0, 0.9, 0.4)',
};

/** The same curves for scripted motion (`tween`): k from 0 to 1. */
export const CURVE = {
  out: (k) => 1 - (1 - k) ** 3,
  in: (k) => k * k * k,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
};

/** The middle of an element on the screen, and its box. */
export function centre(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
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

/** The timer bar under the top bar (`#tbar`, web/js/ui.js `timerBar`) runs down over `ms`, as main.js shrinks it. */
export function runTimer(ms) {
  const bar = document.getElementById('tbar');
  if (bar) bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ms, fill: 'forwards' });
}

/**
 * Sparks bursting out of `at` in a theme colour (`tint`, read with sparks.js `colour`):
 * `count` of them, flying about `reach` px, falling a little.
 */
export function sparkle(at, tint, count, reach) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = reach * 3 * (0.6 + Math.random() * 0.5);
    spark({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, gravity: 160, life: 0.5 + Math.random() * 0.4, size: 2.2, tint, hot: 0.2 });
  }
}

/**
 * The point at `k` (0 to 1) on a curve from `a` to `b` that rises about `lift` px above
 * the higher of the two on its way and bulges `side` px to the right (a quadratic curve;
 * its control point lies twice as far, since such a curve reaches only half way to it).
 */
export function along(a, b, lift, k, side = 0) {
  const c = { x: (a.x + b.x) / 2 + 2 * side, y: Math.min(a.y, b.y) - 2 * lift };
  const u = 1 - k;
  return { x: u * u * a.x + 2 * u * k * c.x + k * k * b.x, y: u * u * a.y + 2 * u * k * c.y + k * k * b.y };
}
