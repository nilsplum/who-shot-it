/**
 * Fireworks over the whole screen, the finale every podium animation ends with: a gold
 * salute right at the winner, then rockets from the bottom edge bursting all over the
 * screen (now and then two at once), a volley of five across its width, and three slow
 * golden willows to close.
 *
 * Mechanisms: made of fx.js's sparks, glows and rings. A shell bursts the way real ones do:
 * its stars fly out from a sphere seen from the side (so most of them show near its rim),
 * the air slows them and they fall. The kind of shell decides the look (SHELLS): peony
 * (round, plain stars, some crackling at the end), chrysanthemum (each star trails embers),
 * willow (gold, long-lived, hanging and drifting down), palm (a few heavy stars with thick
 * trails), ring (a tilted circle) and crossette (stars that split into four). Every bang
 * lights up the sky for a moment. The first few bangs are felt as light taps; the winner's
 * own thud belongs to the reveal before.
 *
 * Invariants: sizes are shares of the screen, so every phone sees the same show; colours
 * are the theme's (yellow, coral, green, blue, violet and the player colours).
 */
import { buzz, wait } from '/kit/screen.js';
import { colour, glow, ring, spark } from './fx.js';

const TINTS = ['yellow', 'coral', 'green', 'blue', 'violet', 'p3', 'p4', 'p5', 'p6', 'p8', 'p10'];
const between = (a, b) => a + Math.random() * (b - a);
const anyTint = () => colour(TINTS[Math.floor(Math.random() * TINTS.length)]);

/** A direction out of a sphere seen from the side: most stars of a real shell show near its rim. */
function sphere() {
  const z = between(-1, 1);
  const a = between(0, Math.PI * 2);
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a)];
}

/** How each kind of shell bursts: its stars, how the air slows them, how they fall, how long they live, how wide they are. */
const SHELLS = {
  peony: { stars: 110, drag: 2.4, gravity: 90, life: [1.1, 1.5], size: 2.9, crackle: 0.35 },
  chrysanthemum: { stars: 100, drag: 2.2, gravity: 80, life: [1.2, 1.7], size: 2.4, trail: 20 },
  willow: { stars: 90, drag: 1.5, gravity: 40, life: [2.6, 3.4], size: 2, trail: 26, gold: true },
  palm: { stars: 12, drag: 1.1, gravity: 120, life: [1.5, 1.9], size: 4.4, trail: 55 },
  ring: { stars: 64, drag: 2.4, gravity: 60, life: [1.1, 1.4], size: 2.8, ring: true },
  crossette: { stars: 18, drag: 1.6, gravity: 80, life: [0.6, 0.75], size: 3.2, split: true },
};

/** The end of a crackling star: a few tiny white flashes where it went out. */
function crackle(s) {
  for (let i = 0; i < 3; i += 1) spark({ x: s.x + between(-6, 6), y: s.y + between(-6, 6), life: between(0.08, 0.22), size: 1.6, tint: colour('white'), flicker: true });
}

/** A crossette star splits into four smaller stars at right angles, which crackle. */
function split(s) {
  const turn = between(0, Math.PI / 2);
  for (let i = 0; i < 4; i += 1) {
    const a = turn + (i * Math.PI) / 2;
    spark({ x: s.x, y: s.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, drag: 2.2, gravity: 80, life: between(0.45, 0.6), size: 2, tint: s.tint, hot: 0.15, then: crackle });
  }
}

let felt = 0;

/**
 * A shell bursting at (`x`, `y`), its stars reaching about `reach` px; `kind` one of SHELLS,
 * `tint` a theme colour (a random one by default, gold for a willow).
 */
export function burst(x, y, { kind = 'peony', reach = 150, tint } = {}) {
  const shell = SHELLS[kind];
  const c = tint || (shell.gold ? colour('yellow') : anyTint());
  // Under the air's drag a star flies about speed / drag before it stops.
  const speed = reach * shell.drag;
  glow({ x, y, tint: c, radius: reach * 2.4, life: 0.5, strength: 0.3 });
  glow({ x, y, tint: colour('white'), radius: reach * 0.45, life: 0.14, strength: 0.9 });
  if (felt < 6) {
    felt += 1;
    buzz('tap');
  }
  const tilt = between(0.35, 1);
  const turn = between(0, Math.PI);
  for (let i = 0; i < shell.stars; i += 1) {
    let dx;
    let dy;
    if (shell.ring) {
      const a = (i / shell.stars) * Math.PI * 2;
      dx = Math.cos(a) * Math.cos(turn) - Math.sin(a) * tilt * Math.sin(turn);
      dy = Math.cos(a) * Math.sin(turn) + Math.sin(a) * tilt * Math.cos(turn);
    } else [dx, dy] = sphere();
    const v = speed * between(0.9, 1.05);
    const end = shell.split ? split : shell.crackle && Math.random() < shell.crackle ? crackle : undefined;
    spark({ x, y, vx: dx * v, vy: dy * v, drag: shell.drag, gravity: shell.gravity, life: between(...shell.life), size: shell.size, tint: c, hot: 0.12, trail: shell.trail || 0, ember: shell.gold ? colour('p11') : undefined, flicker: Boolean(shell.gold), then: end });
  }
}

/** A rocket from the bottom edge up to (`x`, `y`), slowing as it rises, with a sparkling tail; it bursts as `shell` at the top. */
export function launch(x, y, shell) {
  const fromX = x + between(-30, 30);
  const fromY = innerHeight + 8;
  const time = between(0.8, 1.1);
  const rise = fromY - y;
  spark({ x: fromX, y: fromY, vx: (x - fromX) / time, vy: (-2 * rise) / time, gravity: (2 * rise) / (time * time), life: time, size: 2.4, tint: colour('p11'), trail: 70, ember: colour('p6'), then: (s) => burst(s.x, s.y, shell) });
}

/**
 * The show, from the winner's place `at` ({ x, y }): the gold salute there with a ring of
 * light, then a dozen rockets anywhere on the screen, the volley, and the willows. Resolves
 * when the last rocket is up; its sparks fall on for a few seconds.
 */
export async function show(at) {
  felt = 0;
  const W = innerWidth;
  const H = innerHeight;
  const big = Math.min(W, H);
  burst(at.x, at.y, { kind: 'chrysanthemum', reach: big * 0.5, tint: colour('yellow') });
  ring({ x: at.x, y: at.y, from: 10, to: big * 0.95, life: 0.9, width: 14, tint: colour('yellow'), strength: 0.8 });
  const reach = () => big * between(0.36, 0.56);
  await wait(300);
  // Two at once now and then, from both halves of the screen, so the sky is never empty.
  for (const kind of ['peony', 'ring', 'chrysanthemum', 'crossette', 'palm', 'peony', 'chrysanthemum', 'ring', 'peony', 'crossette', 'chrysanthemum', 'peony']) {
    const left = Math.random() < 0.5;
    launch((left ? between(0.1, 0.5) : between(0.5, 0.9)) * W, between(0.1, 0.5) * H, { kind, reach: reach() });
    if (Math.random() < 0.35) launch((left ? between(0.55, 0.9) : between(0.1, 0.45)) * W, between(0.12, 0.45) * H, { kind: 'peony', reach: reach() });
    await wait(between(240, 440));
  }
  for (let i = 0; i < 5; i += 1) launch(((i + 0.5) / 5) * W, between(0.12, 0.35) * H, { kind: i % 2 ? 'chrysanthemum' : 'peony', reach: reach() });
  await wait(900);
  for (let i = 0; i < 3; i += 1) {
    launch(((i + 0.5) / 3) * W, between(0.1, 0.22) * H, { kind: 'willow', reach: big * 0.42 });
    await wait(180);
  }
}
