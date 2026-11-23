/**
 * Film leader, in the app: the 3-2-1 exactly as the app plays it, beside the draft it was
 * chosen from (leader.js). The app's own cover (views/overlays.js `startScreen`, its film
 * leader) painted with the app's painter from the time left, and kept on the clock and cut
 * to the photo by the app's own web/js/countdown.js, as main.js `paintStart` does; each new
 * number is felt (`count`), the first photo as a light tap (main.js `moments`). This frame
 * paints on every frame, so each number comes on its second by itself (the app's paint
 * loop needs `nextNumberIn` for that).
 *
 * Unlike the draft, the app's leader fills the screen: its cover is drawn over the lobby,
 * which does not know where the round's photo will be.
 */
import { cut, onTheClock } from '/js/countdown.js';
import { createPainter } from '/js/render.js';
import { startScreen } from '/js/views/overlays.js';
import { LEAD, START, beginRound, buzz } from './stage.js';

/** The cover alone before the first number, as in the other frames. */
const BLANK = { key: 'blank', layout: '<div class="fixed inset-0 z-50 bg-page"></div>', parts: {} };

export function inApp() {
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
      beginRound();
      cut();
      buzz('tap');
      return;
    }
    if (t >= LEAD) {
      const left = START - t;
      if (paint(startScreen(view, left, null)).includes('count')) {
        buzz('count');
        onTheClock(root, left);
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
