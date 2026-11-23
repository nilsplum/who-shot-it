/**
 * One canvas over the whole screen for everything that glows and sparkles at the end of a
 * game: sparks (some trailing embers), rings of light that spread, soft glows, the
 * darkening edge of the screen (`shade`), a white flash, a stream of sparks rushing into a
 * point (`inflow`) and the fireworks (`fireworks`).
 *
 * Mechanisms: `podium.js` calls these while it reveals the podium. The canvas is made on
 * first use (a sibling of #app, so a jolt of the screen never moves the light) and removed
 * again as soon as nothing shines, and one frame loop runs only meanwhile. Movement is in
 * pixels per second over the real time between frames, so it looks the same at 60 and 120
 * frames a second. Light adds up (`lighter`) the way light does.
 *
 * Invariants:
 * - Every colour is a theme colour read from the page's CSS variables (`colour`); the canvas
 *   paints no background of its own, only light, the shade and the flash.
 * - It stays light on a phone: at most MAX sparks live at once (embers give way first, so a
 *   new shell always gets its stars), and sparks of the same colour, brightness and width are
 *   drawn as one path, a few dozen strokes a frame instead of one per spark.
 * - `clearSparks` ends everything at once (main.js calls it when the screen changes).
 */

/** The most sparks alive at once; embers stop being added beyond EMBERS of it. */
const MAX = 1600;
const EMBERS = 0.6;

let canvas = null;
let ctx = null;
let W = 0;
let H = 0;
const sparks = [];
const rings = [];
const glows = [];
const streams = [];
/** The darkening edge (a level that glides to `to`) and the white flash. */
const dark = { from: 0, to: 0, t0: 0, ms: 1 };
let blink = null;
let looping = false;
let last = 0;
const named = new Map();

/** A theme colour by its name (`--color-<name>` in styles/app.css), as the canvas takes it. */
export function colour(name) {
  if (!named.has(name)) named.set(name, getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim());
  return named.get(name);
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth;
  H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Makes the canvas on first use: the whole screen, above the screens and below the sheets. */
function setup() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'pointer-events-none fixed inset-0 z-30 size-full';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
  resize();
  addEventListener('resize', resize);
}

/**
 * A spark: where it is (`x`, `y`), how fast it flies (`vx`, `vy`, px/s), how quickly the air
 * slows it (`drag`, per second), how hard it falls (`gravity`, px/s²), how long it lives
 * (`life`, s), its width (`size`, px) and `tint` (a theme colour). It glows white-hot for the
 * first `hot` share of its life; `flicker` makes it twinkle; `trail` (embers per second)
 * leaves embers behind, in `ember` or its own tint; `then(spark)` runs where it dies.
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

/** The edges of the screen darken towards `level` (0 to 1) over `ms`: the world narrows to what matters. */
export function shade(level, ms = 300) {
  setup();
  Object.assign(dark, { from: shadeNow(), to: level, t0: performance.now(), ms });
  run();
}

/** A white flash over the whole screen, `strength` 0 to 1, fading over `ms`. */
export function flash(strength = 1, ms = 750) {
  setup();
  blink = { strength, t0: performance.now(), ms };
  run();
}

/**
 * Sparks rushing into (`x`, `y`) from all around, up to `reach` px away, `rate` a second
 * (change it on the returned stream; `stop()` ends it).
 */
export function inflow({ x, y, tint, reach, rate = 20 }) {
  const stream = {
    x, y, tint, reach, rate, owed: 0,
    stop() {
      const i = streams.indexOf(stream);
      if (i >= 0) streams.splice(i, 1);
    },
  };
  streams.push(stream);
  setup();
  run();
  return stream;
}

/** Ends every light at once and removes the canvas. */
export function clearSparks() {
  sparks.length = 0;
  rings.length = 0;
  glows.length = 0;
  streams.length = 0;
  Object.assign(dark, { from: 0, to: 0 });
  blink = null;
}

function shadeNow(now = performance.now()) {
  const k = Math.min(1, Math.max(0, (now - dark.t0) / dark.ms));
  return dark.from + (dark.to - dark.from) * k;
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
  step(dt);
  const shading = shadeNow(now) > 0.005 || dark.to > 0;
  if (blink && now - blink.t0 > blink.ms) blink = null;
  if (sparks.length || rings.length || glows.length || streams.length || shading || blink) {
    draw(now);
    requestAnimationFrame(frame);
  } else {
    looping = false;
    removeEventListener('resize', resize);
    canvas.remove();
    canvas = null;
  }
}

/** Embers a spark leaves behind: short-lived, nearly still, twinkling, falling a little. */
function embers(s, dt) {
  if (sparks.length > MAX * EMBERS) return;
  for (let n = s.trail * dt; n > 0; n -= 1) {
    if (Math.random() >= n) continue;
    spark({ x: s.x, y: s.y, vx: s.vx * 0.08 + (Math.random() - 0.5) * 24, vy: s.vy * 0.08 + (Math.random() - 0.5) * 24, drag: 3, gravity: 90, life: 0.3 + Math.random() * 0.45, size: Math.max(1, s.size * 0.55), tint: s.ember || s.tint, flicker: true });
  }
}

function step(dt) {
  for (const s of streams) {
    for (s.owed += s.rate * dt; s.owed >= 1; s.owed -= 1) {
      const a = Math.random() * Math.PI * 2;
      const d = s.reach * (0.6 + Math.random() * 0.6);
      const life = 0.32 + Math.random() * 0.2;
      spark({ x: s.x + Math.cos(a) * d, y: s.y + Math.sin(a) * d, vx: (-Math.cos(a) * d) / life, vy: (-Math.sin(a) * d) / life, life, size: 1.8, tint: s.tint, flicker: true });
    }
  }
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

/** The darkening edge: an ellipse the shape of the screen, clear in its middle, the page's darkest blue at the corners. */
function drawShade(level) {
  ctx.save();
  ctx.translate(W / 2, H * 0.45);
  ctx.scale(W / H, 1);
  const reach = H * 0.75;
  const edge = ctx.createRadialGradient(0, 0, 0, 0, 0, reach);
  edge.addColorStop(0.25, 'transparent');
  edge.addColorStop(0.75, colour('stage'));
  edge.addColorStop(1, colour('stage'));
  ctx.globalAlpha = 0.92 * level;
  ctx.fillStyle = edge;
  ctx.fillRect(-reach * (H / W), -reach, reach * 2 * (H / W), reach * 2);
  ctx.restore();
}

function draw(now) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, W, H);
  const level = shadeNow(now);
  if (level > 0.005) drawShade(level);
  if (blink) {
    ctx.globalAlpha = blink.strength * (1 - Math.min(1, (now - blink.t0) / blink.ms)) ** 2;
    ctx.fillStyle = colour('white');
    ctx.fillRect(0, 0, W, H);
  }
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
  // Each spark is a streak from where it was a frame ago (fast ones streak, slow ones are
  // dots), gathered by colour, brightness (five steps) and width into one path each.
  const paths = new Map();
  const hot = colour('white');
  for (const s of sparks) {
    const t = s.age / s.life;
    let alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    if (s.flicker) alpha *= 0.35 + Math.random() * 0.65;
    const bright = Math.ceil(alpha * 5);
    if (!bright) continue;
    const key = `${t < s.hot ? hot : s.tint}|${bright}|${Math.max(1, Math.round(s.size * (1 - 0.45 * t)))}`;
    let path = paths.get(key);
    if (!path) paths.set(key, (path = new Path2D()));
    path.moveTo(s.ox, s.oy);
    path.lineTo(s.x + 0.1, s.y + 0.1);
  }
  ctx.lineCap = 'round';
  for (const [key, path] of paths) {
    const [tint, bright, width] = key.split('|');
    ctx.globalAlpha = bright / 5;
    ctx.strokeStyle = tint;
    ctx.lineWidth = Number(width);
    ctx.stroke(path);
  }
}

// ---------- Fireworks ----------

const between = (a, b) => a + Math.random() * (b - a);
const TINTS = ['yellow', 'coral', 'green', 'blue', 'violet', 'p3', 'p4', 'p5', 'p6', 'p8', 'p10'];
const anyTint = () => colour(TINTS[Math.floor(Math.random() * TINTS.length)]);

/** A direction out of a sphere seen from the side: most stars of a real shell show near its rim. */
function sphere() {
  const z = between(-1, 1);
  const a = between(0, Math.PI * 2);
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), r * Math.sin(a)];
}

/**
 * How each kind of shell bursts, like real ones: peony (round, plain stars, some crackling at
 * the end), chrysanthemum (each star trails embers), willow (gold, long-lived, drifting down),
 * palm (a few heavy stars with thick trails), ring (a tilted circle) and crossette (stars
 * that split into four). Stars, how the air slows them, how they fall, their life and width.
 */
const SHELLS = {
  peony: { stars: 95, drag: 2.4, gravity: 90, life: [1.1, 1.5], size: 2.9, crackle: 0.35 },
  chrysanthemum: { stars: 85, drag: 2.2, gravity: 80, life: [1.2, 1.7], size: 2.4, trail: 18 },
  willow: { stars: 76, drag: 1.5, gravity: 40, life: [2.6, 3.4], size: 2, trail: 22, gold: true },
  palm: { stars: 11, drag: 1.1, gravity: 120, life: [1.5, 1.9], size: 4.4, trail: 50 },
  ring: { stars: 56, drag: 2.4, gravity: 60, life: [1.1, 1.4], size: 2.8, ring: true },
  crossette: { stars: 16, drag: 1.6, gravity: 80, life: [0.6, 0.75], size: 3.2, split: true },
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

/**
 * A shell bursting at (`x`, `y`), its stars reaching about `reach` px; `kind` one of SHELLS,
 * `tint` a theme colour (a random one by default, gold for a willow); `bang()` runs as it bursts.
 */
function burst(x, y, { kind = 'peony', reach = 150, tint, bang }) {
  const shell = SHELLS[kind];
  const c = tint || (shell.gold ? colour('yellow') : anyTint());
  // Under the air's drag a star flies about speed / drag before it stops.
  const speed = reach * shell.drag;
  glow({ x, y, tint: c, radius: reach * 2.4, life: 0.5, strength: 0.3 });
  glow({ x, y, tint: colour('white'), radius: reach * 0.45, life: 0.14, strength: 0.9 });
  if (bang) bang();
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
function launch(x, y, shell) {
  const fromX = x + between(-30, 30);
  const fromY = innerHeight + 8;
  const time = between(0.8, 1.1);
  const rise = fromY - y;
  spark({ x: fromX, y: fromY, vx: (x - fromX) / time, vy: (-2 * rise) / time, gravity: (2 * rise) / (time * time), life: time, size: 2.4, tint: colour('p11'), trail: 60, ember: colour('p6'), then: (s) => burst(s.x, s.y, shell) });
}

/**
 * The fireworks, from the winner's place `at` ({ x, y }): a gold salute there with a ring of
 * light, a dozen rockets all over the screen (now and then two at once), a volley of five
 * across its width, and three slow golden willows to close. `bang()` runs with each burst;
 * `alive()` false stops the launches (the screen was left). Sizes are shares of the screen,
 * so every phone sees the same show.
 */
export async function fireworks(at, { bang, alive = () => true } = {}) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const big = Math.min(innerWidth, innerHeight);
  const reach = () => big * between(0.36, 0.56);
  burst(at.x, at.y, { kind: 'chrysanthemum', reach: big * 0.5, tint: colour('yellow'), bang });
  ring({ x: at.x, y: at.y, from: 10, to: big * 0.95, life: 0.9, width: 14, tint: colour('yellow'), strength: 0.8 });
  await wait(300);
  for (const kind of ['peony', 'ring', 'chrysanthemum', 'crossette', 'palm', 'peony', 'chrysanthemum', 'ring', 'peony', 'crossette', 'chrysanthemum', 'peony']) {
    if (!alive()) return;
    const left = Math.random() < 0.5;
    launch((left ? between(0.1, 0.5) : between(0.5, 0.9)) * innerWidth, between(0.1, 0.5) * innerHeight, { kind, reach: reach(), bang });
    if (Math.random() < 0.35) launch((left ? between(0.55, 0.9) : between(0.1, 0.45)) * innerWidth, between(0.12, 0.45) * innerHeight, { kind: 'peony', reach: reach(), bang });
    await wait(between(240, 440));
  }
  if (!alive()) return;
  for (let i = 0; i < 5; i += 1) launch(((i + 0.5) / 5) * innerWidth, between(0.12, 0.35) * innerHeight, { kind: i % 2 ? 'chrysanthemum' : 'peony', reach: reach(), bang });
  await wait(900);
  for (let i = 0; i < 3 && alive(); i += 1) {
    launch(((i + 0.5) / 3) * innerWidth, between(0.1, 0.22) * innerHeight, { kind: 'willow', reach: big * 0.42, bang });
    await wait(180);
  }
}
