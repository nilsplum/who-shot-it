/**
 * Film leader: the countdown at the head of a film reel, as in a cinema. In the frame
 * where the photo will appear: crosshairs, two circles, and the number in their middle; a
 * hand sweeps round once per second, leaving its shadow behind it, and the number changes
 * with a cut, the way film does. The whole picture weaves a tiny bit, like film running
 * through a projector. On the start of the round: one white frame, and a cut to the photo.
 *
 * Mechanisms: the frame, the crosshairs and the circles are plain lines on the cover,
 * placed by the round's photo (stage.js `photoBox`); the shadow is an SVG circle whose dash
 * runs out once per second (a circle half as wide as its stroke draws a filled pie), the
 * hand a line turned by the browser; the weave is a stepped animation (style.css
 * `animate-cd-weave`), so the browser moves it on its own.
 *
 * Invariants: the sweep is the clock, even all round; the cut to the photo is exactly the
 * start of the round.
 */
import { BEAT, LEAD, NUMBER, START, beginRound, buzz, clock, cover, make, photoBox } from './stage.js';

/** The dial's box and radii (px): the outer and inner circle; how bright the one white frame is, and how long it lasts. */
const DIAL = { box: 240, outer: 112, inner: 98 };
const CUT = { white: 0.75, ms: 220 };

export async function leader(screen) {
  const c = cover();
  const { r } = photoBox(screen);
  const half = DIAL.box / 2;
  const pie = DIAL.inner / 2;
  const length = 2 * Math.PI * pie;
  const film = make(c, `<div class="absolute animate-cd-weave" style="left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px">
    <i class="absolute inset-0 rounded-3xl border-2 border-line"></i>
    <i class="absolute inset-y-0 left-1/2 w-px bg-line-strong"></i><i class="absolute inset-x-0 top-1/2 h-px bg-line-strong"></i>
    <div class="absolute top-1/2 left-1/2 grid -translate-1/2 place-items-center" style="width:${DIAL.box}px;height:${DIAL.box}px">
      <svg class="col-start-1 row-start-1 size-full" viewBox="0 0 ${DIAL.box} ${DIAL.box}" aria-hidden="true">
        <circle cx="${half}" cy="${half}" r="${pie}" class="fill-none stroke-raised" stroke-width="${DIAL.inner}" stroke-dasharray="${length}" stroke-dashoffset="${length}" transform="rotate(-90 ${half} ${half})" data-shadow/>
        <circle cx="${half}" cy="${half}" r="${DIAL.outer}" class="fill-none stroke-ink/40" stroke-width="2"/>
        <circle cx="${half}" cy="${half}" r="${DIAL.inner}" class="fill-none stroke-ink/40" stroke-width="2"/>
      </svg>
      <i class="absolute bottom-1/2 left-1/2 -ml-px w-0.5 origin-bottom bg-ink/80" style="height:${DIAL.inner}px" data-hand></i>
      <span class="col-start-1 row-start-1 ${NUMBER} text-ink" data-number></span>
    </div>
  </div>`);
  const shadow = film.querySelector('[data-shadow]');
  const hand = film.querySelector('[data-hand]');
  const number = film.querySelector('[data-number]');
  const time = clock();
  for (const [i, n] of [3, 2, 1].entries()) {
    await time.at(LEAD + i * BEAT);
    number.textContent = String(n);
    shadow.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: BEAT, fill: 'forwards' });
    hand.animate([{ rotate: '0deg' }, { rotate: '360deg' }], { duration: BEAT });
    buzz('count');
  }
  await time.at(START);
  // One white frame, and the cut.
  buzz('yes');
  beginRound();
  c.remove();
  const white = make(document.body, '<i class="pointer-events-none fixed inset-0 z-50 bg-white"></i>');
  await white.animate([{ opacity: CUT.white }, { opacity: CUT.white, offset: 0.25 }, { opacity: 0 }], { duration: CUT.ms, easing: 'ease-out', fill: 'forwards' }).finished;
  white.remove();
}
