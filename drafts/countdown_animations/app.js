/**
 * Now, in the app: the 3-2-1 exactly as the app plays it, for comparison. The app's own
 * cover (views/overlays.js `startScreen`) painted with the app's painter on every frame from
 * the time left, as main.js `render` does; each new number is felt (`count`). When the time
 * is up the cover is gone at once and the photo is there, felt as a light tap (main.js
 * `moments`).
 */
import { createPainter } from '/js/render.js';
import { startScreen } from '/js/views/overlays.js';
import { LEAD, START, buzz } from './stage.js';

/** The cover alone before the first number, as in the other frames. */
const BLANK = { key: 'blank', layout: '<div class="fixed inset-0 z-50 bg-page"></div>', parts: {} };

export function now() {
  const root = document.createElement('div');
  document.body.append(root);
  const paint = createPainter(root);
  const view = { phase: 'countdown', me: { id: 'p2' } };
  const t0 = performance.now();
  paint(BLANK);
  const frame = () => {
    const t = performance.now() - t0;
    if (t >= START) {
      paint(null);
      buzz('tap');
      return;
    }
    if (t >= LEAD && paint(startScreen(view, START - t, null)).includes('count')) buzz('count');
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
