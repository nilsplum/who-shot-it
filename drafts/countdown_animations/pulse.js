/**
 * Pulse: a heartbeat. Where the photo will appear, a warm light glows behind the number.
 * Each number thumps on its second (it lands a little too big and settles), a ring ripples
 * out of it, and the light grows warmer: each beat a little stronger than the last. Late in
 * 1 everything draws in, like a breath. On the start of the round the breath goes out: the
 * number swells and fades, and a soft wave runs out from the middle, opening the screen
 * onto the photo, with the last ring riding its edge.
 *
 * Mechanisms: the light (style.css `cd-glow`), the rings and the number are elements on the
 * cover, placed by the round's photo (stage.js `photoBox`), moved with scale and opacity;
 * the wave is the cover's round hole with a soft edge (stage.js `open`), and its ring lies
 * over the cover (the hole would cut it away).
 *
 * Invariants: the thumps are on the clock; the breath fills the last fifth of 1, so the
 * release is the start of the round.
 */
import { BEAT, CURVE, EASE, LEAD, NUMBER, START, beginRound, buzz, clock, cover, make, open, photoBox } from './stage.js';

/** Per beat (3, 2, 1): how bright the light gets, how far its ring spreads (times its size). */
const BEATS = [{ light: 0.35, spread: 2 }, { light: 0.55, spread: 2.5 }, { light: 0.8, spread: 3 }];
/** A ring's size (px) and life; the breath before the release; the wave (its time and soft edge, px). */
const RING = { size: 176, ms: 900 };
const RELEASE = { breath: 220, wave: 480, soft: 40 };

export async function pulse(screen) {
  const c = cover();
  const { x, y } = photoBox(screen);
  const at = (cls, html = '') => make(c, `<div class="absolute -translate-1/2 ${cls}" style="left:${x}px;top:${y}px">${html}</div>`);
  const light = at('size-[26rem] rounded-full opacity-0 cd-glow');
  const digits = at('grid place-items-center');
  const ring = () => at('size-44 rounded-full border-3 border-yellow opacity-0');
  const time = clock();
  let shown = null;
  for (const [i, n] of [3, 2, 1].entries()) {
    await time.at(LEAD + i * BEAT);
    if (shown) {
      const gone = shown;
      gone.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: 'forwards' }).finished.then(() => gone.remove());
    }
    shown = make(digits, `<span class="col-start-1 row-start-1 ${NUMBER} text-yellow">${n}</span>`);
    shown.animate([{ scale: 1.16 }, { scale: 1 }], { duration: 260, easing: EASE.out });
    light.animate([{ scale: 0.88 }, { scale: 1, opacity: BEATS[i].light }], { duration: 320, easing: EASE.out, fill: 'forwards' });
    const wave = ring();
    wave.animate([{ scale: 0.9, opacity: 0.7 }, { scale: BEATS[i].spread, opacity: 0 }], { duration: RING.ms, easing: EASE.out }).finished.then(() => wave.remove());
    buzz('count');
  }
  // The breath in.
  await time.at(START - RELEASE.breath);
  for (const el of [digits, light]) el.animate([{ scale: 1 }, { scale: 0.9 }], { duration: RELEASE.breath, easing: EASE.in, fill: 'forwards' });
  await time.at(START);

  // The release: the round begins, the number swells away, and the wave opens the screen.
  buzz('yes');
  beginRound();
  digits.animate([{ scale: 0.9, opacity: 1 }, { scale: 1.8, opacity: 0 }], { duration: 300, easing: EASE.out, fill: 'forwards' });
  light.animate([{ scale: 0.9 }, { scale: 2.4, opacity: 0 }], { duration: 420, easing: EASE.out, fill: 'forwards' });
  // The last ring rides the wave's soft edge; it lies over the cover, which the wave cuts away.
  const edge = make(document.body, `<div class="pointer-events-none fixed z-50 size-44 -translate-1/2 rounded-full border-3 border-yellow" style="left:${x}px;top:${y}px;opacity:0.8"></div>`);
  await open(c, { x, y }, {
    ms: RELEASE.wave,
    curve: CURVE.out,
    soft: RELEASE.soft,
    each: (r) => {
      edge.style.scale = String((2 * (r + RELEASE.soft / 2)) / RING.size);
      edge.style.opacity = String(Math.max(0, 0.8 - r / 500));
    },
  });
  c.remove();
  edge.remove();
}
