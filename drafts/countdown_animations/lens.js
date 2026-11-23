/**
 * Lens: the fuse's idea (a ring that runs once per second, then a shutter) made calm. The
 * number sits in a lens where the photo will be: a fine rim with a scale of ticks, and a
 * ring inside it that fills once per second, evenly, like a clock hand. Each number lands
 * on its second, a little bigger than the last, and when a second's ring closes it glows
 * once. Over the last fifth of 1 an iris closes inside the lens, over the number. On the
 * start of the round it clicks: the light blooms, the iris opens onto the photo, and the
 * opening keeps growing, carrying the yellow ring outwards, until it is the whole screen.
 *
 * Mechanisms: the rim is one SVG on the cover (the rim, the ticks, the ring's track and the
 * ring, its dash running out once per second). The round window with the number and the
 * iris (six blades, style.css `cd-blade`, turned 60° apart and pushed in or out along their
 * own axis) lies over the cover, so the cover can already be open behind the shut iris: at
 * the click its round hole (stage.js `hole`, `open`) is as big as the window, the iris opens onto
 * the photo, then the hole grows, the rim scaled with it so the ring rides its edge.
 *
 * Invariants: the ring is the clock, it never speeds up; the iris is shut exactly as the
 * last ring closes, so the click is the start of the round.
 */
import { BEAT, CURVE, EASE, LEAD, NUMBER, START, beginRound, buzz, clock, cover, hole, make, open, photoBox } from './stage.js';

/**
 * The lens's sizes in px (its box, the rim, where the ticks start, the ring and its width,
 * the window with the number and the iris), and how much bigger each second makes it.
 */
const LENS = { box: 240, rim: 112, ticks: 103, ring: 94, line: 5, window: 88, grow: 0.03 };
/** The shot (ms): the iris closing and opening, the opening growing to the whole screen, the bloom. */
const SHOT = { close: 200, open: 140, widen: 360, bloom: 460 };

/** The rim on the cover: a fine circle, a tick every 15° (every 90° a longer one), the ring's track and the ring. */
function rim(parent, at) {
  const c = LENS.box / 2;
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 15 * Math.PI) / 180;
    const from = i % 6 ? LENS.ticks : LENS.ticks - 6;
    const xy = (r) => `${(c + Math.sin(a) * r).toFixed(1)} ${(c - Math.cos(a) * r).toFixed(1)}`;
    return `M${xy(from)} L${xy(LENS.rim - 4)}`;
  }).join(' ');
  const length = 2 * Math.PI * LENS.ring;
  const circle = (r, cls, more = '') => `<circle cx="${c}" cy="${c}" r="${r}" class="fill-none ${cls}" ${more}/>`;
  const el = make(parent, `<svg class="absolute origin-center overflow-visible" style="left:${at.x - c}px;top:${at.y - c}px;width:${LENS.box}px;height:${LENS.box}px" viewBox="0 0 ${LENS.box} ${LENS.box}" aria-hidden="true">
    ${circle(LENS.rim, 'stroke-line', 'stroke-width="1.5"')}
    <path d="${ticks}" class="stroke-line-strong" stroke-width="2" stroke-linecap="round"/>
    ${circle(LENS.ring, 'stroke-raised', `stroke-width="${LENS.line}"`)}
    <g transform="rotate(-90 ${c} ${c})">
      ${circle(LENS.ring, 'stroke-yellow', `stroke-width="${LENS.line * 2.6}" opacity="0" data-glow`)}
      ${circle(LENS.ring, 'stroke-yellow', `stroke-width="${LENS.line}" stroke-linecap="round" stroke-dasharray="${length}" stroke-dashoffset="${length}" data-ring`)}
    </g>
  </svg>`);
  return { el, ring: el.querySelector('[data-ring]'), glow: el.querySelector('[data-glow]'), length };
}

/** The round window over the cover, holding the number and the six blades of the iris. */
function window_(at) {
  const r = LENS.window;
  const el = make(document.body, `<div class="pointer-events-none fixed z-50 grid place-items-center overflow-hidden rounded-full" style="left:${at.x - r}px;top:${at.y - r}px;width:${2 * r}px;height:${2 * r}px">${'<i class="cd-blade" data-blade></i>'.repeat(6)}</div>`);
  return { el, blades: [...el.querySelectorAll('[data-blade]')] };
}

/** The iris: every blade turned `turn`° past its own 60° step, its edge `edge` px from the middle (beyond the window: open). */
const iris = (w, from, to, ms, easing) => Promise.all(w.blades.map((b, i) => b.animate(
  [{ transform: `rotate(${i * 60 + from.turn}deg) translateY(${-from.edge}px)` }, { transform: `rotate(${i * 60 + to.turn}deg) translateY(${-to.edge}px)` }],
  { duration: ms, easing, fill: 'forwards' },
).finished));
const OPEN = { turn: 0, edge: LENS.window + 4 };
const SHUT = { turn: 30, edge: 0 };

export async function lens(screen) {
  const c = cover();
  const at = photoBox(screen);
  const r = rim(c, at);
  const w = window_(at);
  iris(w, OPEN, OPEN, 0);
  const time = clock();
  let shown = null;
  for (const [i, n] of [3, 2, 1].entries()) {
    await time.at(LEAD + i * BEAT);
    if (shown) {
      const gone = shown;
      gone.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.85 }], { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished.then(() => gone.remove());
      // The second before has closed its ring: it glows once.
      r.glow.animate([{ opacity: 0.35 }, { opacity: 0 }], { duration: 380, easing: 'ease-out' });
    }
    // Behind the blades, which close over it at the end.
    shown = make(w.el, `<span class="col-start-1 row-start-1 ${NUMBER} text-yellow">${n}</span>`);
    w.el.prepend(shown);
    shown.animate([{ opacity: 0, scale: 1.22 }, { opacity: 1, scale: 1 }], { duration: 220, easing: EASE.out });
    r.ring.animate([{ strokeDashoffset: r.length }, { strokeDashoffset: 0 }], { duration: BEAT, fill: 'forwards' });
    for (const el of [r.el, w.el]) el.animate([{ scale: 1 + LENS.grow * Math.max(0, i - 1) }, { scale: 1 + LENS.grow * i }], { duration: 300, easing: EASE.out, fill: 'forwards' });
    buzz('count');
  }
  // The iris closes over the number as the last ring closes.
  await time.at(START - SHOT.close);
  iris(w, OPEN, SHUT, SHOT.close, EASE.in);
  await time.at(START);

  // The click: the round begins. Behind the shut iris the cover opens as wide as the window;
  // the light blooms, the iris opens onto the photo, and the opening grows to the whole screen.
  buzz('yes');
  beginRound();
  shown.remove();
  const lensR = LENS.window * (1 + LENS.grow * 2);
  hole(c, at, lensR);
  const bloom = make(document.body, `<i class="pointer-events-none fixed z-50 rounded-full cd-bloom" style="left:${at.x - LENS.box / 2}px;top:${at.y - LENS.box / 2}px;width:${LENS.box}px;height:${LENS.box}px"></i>`);
  bloom.animate([{ opacity: 0.8, scale: 0.4 }, { opacity: 0, scale: 1.7 }], { duration: SHOT.bloom, easing: EASE.out, fill: 'forwards' });
  await iris(w, SHUT, { turn: 60, edge: OPEN.edge }, SHOT.open, EASE.out);
  w.el.remove();
  r.el.getAnimations().forEach((a) => a.cancel());
  await open(c, at, {
    from: lensR,
    ms: SHOT.widen,
    curve: CURVE.inOut,
    each: (radius) => {
      const k = radius / LENS.window;
      r.el.style.scale = String(k);
      r.el.style.opacity = String(Math.max(0, 1 - (k - 1) / 2.2));
    },
  });
  c.remove();
  bloom.remove();
}
