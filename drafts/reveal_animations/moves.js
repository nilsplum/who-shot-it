/**
 * The moves the reveal is made of: where an element is, the timer bar running down, and a
 * burst of sparks.
 *
 * Mechanisms: reveal.js imports these; its light comes from the app's own canvas
 * (web/js/sparks.js), its vibrations and pauses from the kit (/kit/screen.js).
 *
 * Invariant: every move is transform or opacity only (and the canvas), so the phone moves
 * them without laying out the page again.
 */
import { spark } from '/js/sparks.js';

/** The middle of an element on the screen, and its box. */
export function centre(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
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
