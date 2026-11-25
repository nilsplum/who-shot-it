/**
 * The small moves the app's stories are made of: a pause, a frame loop over a fixed time, and
 * the two easings of the design as the animation API takes them.
 *
 * Mechanisms: the stories that play over a screen in its final state import these
 * (`reveal.js`, `streak.js`, `board.js`, `podium.js`); the light they throw is the canvas of
 * `sparks.js`, their vibrations come from `phone.js`.
 *
 * Invariants: `EASE` repeats `--ease-bounce` of `styles/app.css` and the curve the theme's
 * `ease-out` animations use, so a scripted move and a class's animation feel alike; nothing
 * here touches the page.
 */

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The design's quick start with a soft landing (`out`) and its overshoot (`bounce`, `--ease-bounce`), as the animation API takes them. */
export const EASE = { out: 'cubic-bezier(0.2, 0.8, 0.2, 1)', bounce: 'cubic-bezier(0.3, 1.6, 0.5, 1)' };

/** The same curves for scripted motion (`tween`): k from 0 to 1. */
export const outCubic = (k) => 1 - (1 - k) ** 3;
export const inOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

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
