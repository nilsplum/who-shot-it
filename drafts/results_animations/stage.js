/**
 * What the five podium animations share: the end screen's podium as a scene (its places
 * from third to first, with their players and colours), the moves every reveal is made of
 * (light taps that speed up, a hit-stop, a flash, a jolt, a pop, turning rays of light, a
 * darkening edge, a smooth tween), and the finale: the fireworks, then the rest of the end
 * screen.
 *
 * Mechanisms: screen.js paints the app's real end screen (web/js/views/end.js) in its final
 * state and hands it here as a scene; an animation hides what is not revealed yet and plays
 * its story over it, the way the app plays its entrances (main.js `startPodium`). The app's
 * own `data-playing` keeps the facts, the ranking and "Play again" hidden until `finale`
 * sets `data-ended`, which fades them in. An animation's own elements (spotlights, reels,
 * orbs) live in fixed layers over the screen; the sparks are fx.js's.
 *
 * Invariants:
 * - The same escalation in all five: third place short and quiet (bronze), second longer
 *   (silver), the winner longest and loudest (gold, a flash, rays, the fireworks).
 * - A release lands on one frame: the pop, the light, the jolt and the thud together.
 * - What stays on screen at the end is exactly the app's end screen.
 */
import { buzz, wait } from '/kit/screen.js';
import { colour, freeze as freezeSparks, spark } from './fx.js';
import { show } from './fireworks.js';

export { buzz, wait };

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
  back: (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2,
};

/** Each place's theme colour: from cool and quiet to gold. */
export const TONES = { 3: 'bronze', 2: 'silver', 1: 'yellow' };

/**
 * The end screen as a scene: the screen element, its places from third to first (only
 * those there are), each with its list item, the player's part (`who`, hidden until
 * revealed), the avatar in it, the block under it, its player and colour; the players in
 * join order and ranked. Hides the players and marks the screen as playing, in the same
 * task as the paint, so no frame shows the end first.
 */
export function scene(screen, final) {
  const ranked = final.players.slice().sort((a, b) => b.score - a.score);
  const places = [3, 2, 1].map((n) => {
    const li = screen.querySelector(`[data-place="${n}"]`);
    if (!li) return null;
    const who = li.querySelector('[data-cell="who"]');
    who.setAttribute('data-hidden', '');
    li.style.setProperty('--tone', `var(--color-${TONES[n]})`);
    return { n, li, who, avatar: who.firstElementChild, block: li.lastElementChild, player: ranked[n - 1], tone: TONES[n] };
  }).filter(Boolean);
  screen.setAttribute('data-playing', '');
  return { screen, places, players: final.players, ranked, podium: screen.querySelector('[aria-label="Podium"]') };
}

/** The middle of an element on the screen, and its box. */
export function centre(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}

/** A layer of the animation's own over the screen (pointer-events off); `cls` adds its classes. */
export function layer(cls = '') {
  const el = document.createElement('div');
  el.className = `pointer-events-none fixed ${cls}`;
  document.body.append(el);
  return el;
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

/**
 * Light taps that speed up: one every `from` ms at first, one every `to` ms at the end,
 * for `ms` in all; `each(k)` runs with every tap, so the eye gets the same beat. Resolves
 * when done.
 */
export async function ticks(ms, { from = 260, to = 70, each } = {}) {
  for (let t = 0; t < ms;) {
    buzz('tap');
    if (each) each(t / ms);
    const gap = from + (to - from) * Math.min(1, t / ms) ** 1.3;
    await wait(gap);
    t += gap;
  }
}

/** Everything stands still for `ms` (a hit-stop): the CSS and scripted animations pause, the sparks too. */
export async function freeze(ms) {
  const moving = document.getAnimations().filter((a) => a.playState === 'running');
  for (const a of moving) a.pause();
  freezeSparks(true);
  await wait(ms);
  for (const a of moving) a.play();
  freezeSparks(false);
}

/** A flash of white light over the whole screen, `strength` 0 to 1, fading over `ms`. */
export function flash(strength = 0.9, ms = 500) {
  const el = layer('inset-0 z-80 bg-white');
  el.animate([{ opacity: strength }, { opacity: 0 }], { duration: ms, easing: 'ease-out', fill: 'forwards' }).finished.then(() => el.remove());
}

/** `el` jolts and settles: `px` at first, less and less over `ms`. */
export function shake(el, px = 6, ms = 420) {
  const steps = 8;
  const frames = Array.from({ length: steps + 1 }, (_, i) => {
    const k = (1 - i / steps) ** 1.6;
    return { transform: i === steps ? 'none' : `translate(${(i % 2 ? 1 : -1) * px * k}px, ${((i % 3) - 1) * px * 0.6 * k}px)` };
  });
  return el.animate(frames, { duration: ms });
}

/** A place's player appears where they stand on the podium: small, then a little too big, then their size. */
export function reveal(place, scale = 1.25, ms = 560) {
  place.who.removeAttribute('data-hidden');
  return place.who.animate([{ transform: 'scale(0.2)', opacity: 0 }, { transform: `scale(${scale})`, opacity: 1, offset: 0.5 }, { transform: 'none', opacity: 1 }], { duration: ms, easing: EASE.out });
}

/** A place's block lights up in its colour (until then the blocks wait dimmed, `data-dim` on the screen). */
export function light(place) {
  place.li.setAttribute('data-lit', '');
}

/** Rays of light in `tone` turning slowly behind the point `at`, `size` px across; fade in, stay. */
export function rays(at, tone, size = 340) {
  const el = layer('-z-1 ra-rays');
  el.style.cssText = `left:${at.x - size / 2}px;top:${at.y - size / 2}px;width:${size}px;height:${size}px;--tone:var(--color-${tone})`;
  el.animate([{ opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1 }], { duration: 700, easing: EASE.out });
  return el;
}

/** The edges of the screen darken (`to` 0 to 1) over `ms`: the world narrows to what matters. */
export function vignette() {
  const el = layer('inset-0 z-40 ra-vignette');
  el.style.opacity = '0';
  return { el, to: (opacity, ms = 600) => el.animate([{ opacity: el.style.opacity }, { opacity }], { duration: ms, fill: 'forwards' }).finished.then(() => (el.style.opacity = String(opacity))) };
}

/** Sparks of light bursting out of `at` in a place's colour: `count` of them, flying about `reach` px. */
export function sparkle(at, tone, count = 30, reach = 90) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const v = reach * 3 * (0.6 + Math.random() * 0.5);
    spark({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, gravity: 160, life: 0.6 + Math.random() * 0.5, size: 2.4, tint: colour(tone), hot: 0.2 });
  }
}

/**
 * The finale: the fireworks from the winner on (or from `at`), then, after `ms`, the rest
 * of the end screen fades in (the app's own `data-ended`: the facts, the ranking, "Play
 * again").
 */
export async function finale(sc, at = null, ms = 1600) {
  const winner = sc.places.find((p) => p.n === 1);
  show(at || centre(winner.avatar));
  await wait(ms);
  sc.screen.removeAttribute('data-playing');
  sc.screen.setAttribute('data-ended', '');
}
