/**
 * What the countdowns share: one clock for all of them, the cover they are drawn on, where
 * the round's photo is, the easings, a frame loop, and the round opening that lets the
 * photo through.
 *
 * Mechanisms: screen.js paints the round (round.js) and starts a countdown, which first
 * lays its cover over the round, in the same task, so no frame shows the photo early. The
 * clock counts from that moment: a short lead (LEAD, the cover alone), then the numbers on
 * the room's seconds (BEAT), then the release at START, the moment the app's round begins.
 *
 * Invariants: every time is measured from the clock's start, never from the step before,
 * so a late timer never pushes the beats; the cover is the app's (`fixed inset-0 z-50
 * bg-page`, views/overlays.js), and it is gone when a countdown ends.
 */
import { buzz } from '/kit/screen.js';

export { buzz };

/** The cover alone before the first number; one number's time (TIMING.countdownMs over three); when the round begins. */
export const LEAD = 300;
export const BEAT = 1000;
export const START = LEAD + 3 * BEAT;
/** How long the round's answer time is in the stand-in game (the timer bar runs down from the start). */
const ANSWER_MS = 20000;

/** The app's two easings (styles/app.css) and three more: a soft landing, a slow start, and slow at both ends. */
export const EASE = {
  bounce: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
  spring: 'cubic-bezier(0.3, 1.2, 0.5, 1)',
  out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
  in: 'cubic-bezier(0.6, 0, 0.9, 0.4)',
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
};
/** The same curves for scripted motion (`tween`): k from 0 to 1. */
export const CURVE = {
  out: (k) => 1 - (1 - k) ** 3,
  inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2),
};

/** The clock: `at(ms)` resolves `ms` after the start (at once if that is past). */
export function clock() {
  const t0 = performance.now();
  return { at: (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, t0 + ms - performance.now()))) };
}

/** The cover the countdown is drawn on, over everything, on the page's own background. */
export function cover() {
  const el = document.createElement('div');
  el.className = 'fixed inset-0 z-50 overflow-hidden bg-page';
  document.body.append(el);
  return el;
}

/** Where the round's photo is: its box, and its middle. */
export function photoBox(screen) {
  const r = screen.querySelector('[data-part="stage"]').getBoundingClientRect();
  return { r, x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Makes an element from markup (one root) and puts it into `parent`. */
export function make(parent, html) {
  const box = document.createElement('div');
  box.innerHTML = html.trim();
  const el = box.firstElementChild;
  parent.append(el);
  return el;
}

/** Runs `each(k)` every frame for `ms`, k from 0 to 1 along `curve`; resolves at the end. */
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

/** How far the farthest corner of the screen is from `at`: an opening this big shows all of it. */
export const farthest = (at) => Math.hypot(Math.max(at.x, innerWidth - at.x), Math.max(at.y, innerHeight - at.y));

/** Cuts a round hole of radius `r` px around `at` out of `el` (the cover), with `soft` px of soft edge: its mask. */
export function hole(el, at, r, soft = 1.5) {
  const mask = `radial-gradient(circle at ${at.x}px ${at.y}px, transparent ${r}px, black ${r + soft}px)`;
  el.style.maskImage = mask;
  el.style.webkitMaskImage = mask;
}

/**
 * Opens the hole in `el` (the cover) around `at` from `from` px to the whole screen, over
 * `ms` along `curve`; `soft` px of soft edge; `each(r)` hears the radius every frame. The
 * mask is rewritten each frame: one element repaints, for a moment.
 */
export function open(el, at, { from = 0, ms, curve = CURVE.inOut, soft = 1.5, each } = {}) {
  const to = farthest(at) + soft;
  const step = (r) => {
    hole(el, at, r, soft);
    if (each) each(r);
  };
  step(from);
  return tween(ms, (k) => step(from + (to - from) * k), curve);
}

/** The round has begun: its timer bar (`#tbar`, web/js/ui.js `timerBar`) runs down, as main.js shrinks it. */
export function beginRound() {
  const bar = document.getElementById('tbar');
  if (bar) bar.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: ANSWER_MS, fill: 'forwards' });
}

/** A number of the 3-2-1 as the app writes it (views/overlays.js): the display font, big, bold; `cls` adds its colour and place. */
export const NUMBER = 'font-display text-9xl leading-none font-extrabold';
