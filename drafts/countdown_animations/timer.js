/**
 * Self-timer: a camera counting down to its own photo. Four corner brackets frame exactly
 * where the photo will appear, a little too wide, and pull in with each second like a
 * camera finding its focus. The red self-timer lamp in the frame's corner blinks once per
 * second, then faster and faster in the last one, as real self-timers do, and stays on at
 * the end. Late in 1 the focus locks: the brackets snap onto the frame and turn yellow, with
 * a light tap. On the start of the round the shutter snaps shut and open inside the frame,
 * the rest of the cover fading away meanwhile, and the photo is in the frame.
 *
 * Mechanisms: everything is on the cover, placed by the round's photo (stage.js
 * `photoBox`): the brackets (corners of borders), the lamp and the number in the frame's
 * middle. The shutter is two dark halves over the frame (above the cover), closing from its
 * top and bottom edge and opening again. `data-lock` on the cover turns the brackets yellow.
 *
 * Invariants: the lamp and the brackets follow the clock; the shutter is shut exactly at
 * the start of the round and open 0.2 s later.
 */
import { BEAT, EASE, LEAD, NUMBER, START, beginRound, buzz, clock, cover, make, photoBox } from './stage.js';

/** How far the brackets stand off the frame (px) before 3, at 3, at 2, at 1; how long a bracket arm is. */
const FOCUS = { off: [22, 14, 8, 4], arm: 28, lock: 2560 };
/** When the lamp blinks, after the lead (ms), and for how long each time; when it stays on. */
const LAMP = { blinks: [0, 1000, 2000, 2340, 2600, 2780, 2900], on: 90, steady: 2960 };
/** The shutter: closing before the start, opening after it; the flash's strength. */
const SHUTTER = { close: 80, open: 200, flash: 0.3 };

/** The four corners: where each sits on the frame and which way "too wide" is; whole class names for its two edges. */
const CORNERS = [
  { x: 0, y: 0, cls: 'border-t-3 border-l-3 rounded-tl-xl' },
  { x: 1, y: 0, cls: 'border-t-3 border-r-3 rounded-tr-xl' },
  { x: 0, y: 1, cls: 'border-b-3 border-l-3 rounded-bl-xl' },
  { x: 1, y: 1, cls: 'border-b-3 border-r-3 rounded-br-xl' },
];

export async function timer(screen) {
  const c = cover();
  const { r, x, y } = photoBox(screen);
  const arm = FOCUS.arm;
  const corners = CORNERS.map((k) => {
    const el = make(c, `<i class="absolute border-ink/70 transition-colors duration-150 in-data-lock:border-yellow ${k.cls}" style="left:${k.x ? r.right - arm : r.left}px;top:${k.y ? r.bottom - arm : r.top}px;width:${arm}px;height:${arm}px"></i>`);
    return { el, dx: k.x ? 1 : -1, dy: k.y ? 1 : -1 };
  });
  let off = FOCUS.off[0];
  /** The brackets pull in to `to` px off the frame, a little past it and back, like a lens finding focus. */
  const focus = (to, ms = 240) => {
    for (const k of corners) k.el.animate([{ translate: `${k.dx * off}px ${k.dy * off}px` }, { translate: `${k.dx * to}px ${k.dy * to}px` }], { duration: ms, easing: EASE.spring, fill: 'forwards' });
    off = to;
  };
  focus(off, 0);
  const lamp = make(c, `<i class="absolute size-3 rounded-full bg-coral opacity-20 shadow-[0_0_10px_2px_var(--color-coral)]" style="left:${r.left + 18}px;top:${r.top + 18}px"></i>`);
  const digits = make(c, `<div class="absolute grid -translate-1/2 place-items-center" style="left:${x}px;top:${y}px"></div>`);
  const time = clock();

  // The lamp keeps its own beat, faster at the end.
  for (const t of LAMP.blinks) {
    time.at(LEAD + t).then(() => lamp.animate([{ opacity: 1 }, { opacity: 1, offset: 0.7 }, { opacity: 0.2 }], { duration: t > 2000 ? LAMP.on * 0.8 : LAMP.on * 1.6 }));
  }
  time.at(LEAD + LAMP.steady).then(() => lamp.animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 40, fill: 'forwards' }));

  for (const [i, n] of [3, 2, 1].entries()) {
    await time.at(LEAD + i * BEAT);
    digits.innerHTML = `<span class="col-start-1 row-start-1 ${NUMBER} text-yellow">${n}</span>`;
    digits.firstElementChild.animate([{ opacity: 0, translate: '0 -10px' }, { opacity: 1, translate: '0 0' }], { duration: 160, easing: EASE.out });
    focus(FOCUS.off[i + 1]);
    buzz('count');
  }
  // The focus locks: onto the frame, yellow, blinking twice.
  await time.at(LEAD + FOCUS.lock);
  focus(0, 180);
  c.setAttribute('data-lock', '');
  for (const k of corners) k.el.animate([{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }], { duration: 260 });
  buzz('tap');

  // The shutter, inside the frame: shut on the start of the round, then open on the photo.
  const shutter = make(document.body, `<div class="pointer-events-none fixed z-50 overflow-hidden rounded-3xl" style="left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px">
    <i class="absolute inset-x-0 top-0 h-1/2 -translate-y-full border-b border-line-strong bg-stage" data-half></i><i class="absolute inset-x-0 bottom-0 h-1/2 translate-y-full border-t border-line-strong bg-stage" data-half></i></div>`);
  const halves = [...shutter.querySelectorAll('[data-half]')];
  const swing = (shut, ms, easing) => Promise.all(halves.map((h, i) => h.animate(
    shut ? [{ translate: `0 ${i ? 100 : -100}%` }, { translate: '0 0' }] : [{ translate: '0 0' }, { translate: `0 ${i ? 100 : -100}%` }],
    { duration: ms, easing, fill: 'forwards' },
  ).finished));
  await time.at(START - SHUTTER.close);
  await swing(true, SHUTTER.close, EASE.in);
  await time.at(START);
  buzz('yes');
  beginRound();
  // The number is behind the shut shutter now; gone, it cannot show through the fading cover.
  digits.remove();
  c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
  const flash = make(document.body, '<i class="pointer-events-none fixed inset-0 z-50 bg-white"></i>');
  flash.animate([{ opacity: SHUTTER.flash }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
  await swing(false, SHUTTER.open, EASE.out);
  for (const el of [c, shutter, flash]) el.remove();
}
