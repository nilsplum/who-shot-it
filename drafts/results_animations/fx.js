/**
 * One canvas over the whole screen for everything that glows and sparkles in the podium
 * animations: sparks (with embers trailing behind them), rings of light that spread, and
 * soft glows. The fireworks (fireworks.js) are made of these.
 *
 * Mechanisms: the animations call `spark`, `ring` and `glow`; the canvas is made on first
 * use, runs one frame loop while anything is alive and stops when nothing is. Movement is
 * in pixels per second over the real time between frames, so it looks the same at 60 and
 * 120 frames a second. Light adds up (`lighter`) the way light does: where sparks cross it
 * gets brighter. `freeze` stops every movement for a hit-stop (stage.js `freeze`).
 *
 * Invariants:
 * - Every colour is a theme colour read from the page's CSS variables (`colour`); the
 *   canvas never paints a background, so the screen shows through everywhere.
 * - At most MAX sparks live at once (new ones are dropped beyond), so a phone keeps its
 *   frame rate even in the finale.
 */

/** The most sparks alive at once. */
const MAX = 2600;

let canvas = null;
let ctx = null;
let W = 0;
let H = 0;
const sparks = [];
const rings = [];
const glows = [];
let looping = false;
let last = 0;
let frozen = false;
const named = new Map();

/** A theme colour by its name (`--color-<name>` in styles/app.css), as the canvas takes it. */
export function colour(name) {
  if (!named.has(name)) named.set(name, getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim());
  return named.get(name);
}

/** Makes the canvas on first use: the whole screen, sharp on a dense display (at most 2x, enough for light). */
function setup() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'pointer-events-none fixed inset-0 z-90 size-full';
  document.body.append(canvas);
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  addEventListener('resize', resize);
}

/**
 * A spark: where it is (`x`, `y`), how fast it flies (`vx`, `vy`, px/s), how quickly the air
 * slows it (`drag`, per second), how hard it falls (`gravity`, px/s²), how long it lives
 * (`life`, s), its width (`size`, px) and its `tint` (a theme colour). It glows white-hot
 * for the first `hot` share of its life; `flicker` makes it twinkle; `trail` (embers per
 * second) leaves glowing embers behind it, in `ember` or its own tint; `then(spark)` runs
 * where it dies (a rocket bursts, a crossette splits).
 */
export function spark(s) {
  if (sparks.length >= MAX) return;
  setup();
  sparks.push({ age: 0, vx: 0, vy: 0, drag: 0, gravity: 0, size: 2, hot: 0, flicker: false, trail: 0, ...s, ox: s.x, oy: s.y });
  run();
}

/** A ring of light spreading from (`x`, `y`), its radius from `from` to `to` px over `life` s, `width` px thick at first. */
export function ring(r) {
  setup();
  rings.push({ age: 0, width: 6, strength: 1, ...r });
  run();
}

/** A soft round light at (`x`, `y`), `radius` px, fading over `life` s; `strength` 0 to 1. */
export function glow(g) {
  setup();
  glows.push({ age: 0, strength: 0.5, ...g });
  run();
}

/** Stops (true) or restarts (false) every movement: the hit-stop before a release. What shines keeps shining. */
export function freeze(on) {
  frozen = on;
}

function run() {
  if (looping) return;
  looping = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

function frame(now) {
  // A frame's time can lie a moment before the clock read when the loop started: never step back.
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  if (!frozen) step(dt);
  draw();
  if (sparks.length || rings.length || glows.length) requestAnimationFrame(frame);
  else {
    looping = false;
    ctx.clearRect(0, 0, W, H);
  }
}

/**
 * Embers a spark leaves behind: short-lived, nearly still, twinkling, falling a little.
 * They give way first: past 70% of MAX none are added, so a new shell always gets its stars.
 */
function embers(s, dt) {
  if (sparks.length > MAX * 0.7) return;
  for (let n = s.trail * dt; n > 0; n -= 1) {
    if (Math.random() >= n) continue;
    spark({ x: s.x, y: s.y, vx: s.vx * 0.08 + (Math.random() - 0.5) * 24, vy: s.vy * 0.08 + (Math.random() - 0.5) * 24, drag: 3, gravity: 90, life: 0.3 + Math.random() * 0.45, size: Math.max(1, s.size * 0.55), tint: s.ember || s.tint, flicker: true });
  }
}

function step(dt) {
  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const s = sparks[i];
    s.age += dt;
    if (s.age >= s.life) {
      sparks[i] = sparks[sparks.length - 1];
      sparks.pop();
      if (s.then) s.then(s);
      continue;
    }
    s.ox = s.x;
    s.oy = s.y;
    const slow = Math.exp(-s.drag * dt);
    s.vx *= slow;
    s.vy = s.vy * slow + s.gravity * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.trail) embers(s, dt);
  }
  for (const list of [rings, glows]) {
    for (let i = list.length - 1; i >= 0; i -= 1) {
      list[i].age += dt;
      if (list[i].age >= list[i].life) list.splice(i, 1);
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  for (const g of glows) {
    const light = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.radius);
    light.addColorStop(0, g.tint);
    light.addColorStop(1, 'transparent');
    ctx.globalAlpha = g.strength * (1 - g.age / g.life) ** 2;
    ctx.fillStyle = light;
    ctx.fillRect(g.x - g.radius, g.y - g.radius, g.radius * 2, g.radius * 2);
  }
  for (const r of rings) {
    const t = r.age / r.life;
    ctx.globalAlpha = r.strength * (1 - t);
    ctx.strokeStyle = r.tint;
    ctx.lineWidth = Math.max(0.5, r.width * (1 - t));
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.from + (r.to - r.from) * (1 - (1 - t) ** 3), 0, Math.PI * 2);
    ctx.stroke();
  }
  // Each spark is drawn as a streak from where it was a frame ago: fast ones streak, slow ones are dots.
  ctx.lineCap = 'round';
  const hot = colour('white');
  for (const s of sparks) {
    const t = s.age / s.life;
    let alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    if (s.flicker) alpha *= 0.35 + Math.random() * 0.65;
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = t < s.hot ? hot : s.tint;
    ctx.lineWidth = s.size * (1 - 0.45 * t);
    ctx.beginPath();
    ctx.moveTo(s.ox, s.oy);
    ctx.lineTo(s.x + 0.1, s.y + 0.1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
