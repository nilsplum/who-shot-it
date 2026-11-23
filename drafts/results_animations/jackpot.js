/**
 * Jackpot: every place on the podium is a slot reel of all the players, framed by chasing
 * light bulbs. All three spin; third place slows down and stops first (each avatar that
 * passes is a light tap, so the ticks slow down with the reel), second stops one player
 * too early, holds, and clicks on to the right one. The winner's reel spins on alone while
 * its bulbs race; it slows almost to nothing and stops on the closest player not on the
 * podium yet. The bulbs go out. Nothing moves. Then the reel creeps, and clicks one
 * further: the winner. The frame bursts into light and the fireworks go up.
 *
 * Mechanisms: one frame loop moves every reel: spinning at a speed, or stopping along an
 * ease-out curve whose start speed matches the spin, so a reel never jerks. A reel's strip
 * is the players repeated in a shuffled order (each reel its own), long enough to spin for
 * the whole animation; the player before the target in that order is the near miss. The
 * faster a reel turns, the more it blurs. The bulbs are CSS (style.css, `jp-`);
 * `data-steady` and `data-off` on the reel stop them.
 *
 * Invariants: a reel stops only on whole players; the first reel to stop is third place,
 * the last the winner. A near miss is always someone who could still be it (not on the
 * podium already); for the winner the best of them, fourth place (only with three players
 * or fewer, when nobody else is left, the runner-up).
 */
import { avatar } from '/js/ui.js';
import { colour, ring, spark } from './fx.js';
import { CURVE, buzz, centre, finale, flash, freeze, light, rays, reveal, shake, sparkle, tween, vignette, wait } from './stage.js';

/** One player's height on a reel, the reel's window, and its top speed (players a second). */
const ITEM = 60;
const WINDOW = { w: 66, h: 88 };
const SPIN = 13;
const shuffle = (list) => list.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x);

/** The bulbs around the window: `n` points along its rounded edge, a little outside it. */
function bulbs(n = 14) {
  const pad = 7;
  const w = WINDOW.w + pad * 2;
  const h = WINDOW.h + pad * 2;
  const along = (t) => {
    const d = t * 2 * (w + h);
    if (d < w) return [d, 0];
    if (d < w + h) return [w, d - w];
    if (d < 2 * w + h) return [w - (d - w - h), h];
    return [0, h - (d - 2 * w - h)];
  };
  return Array.from({ length: n }, (_, i) => {
    const [x, y] = along((i + 0.5) / n);
    return `<i class="jp-bulb" style="left:${x - pad - 2.5}px;top:${y - pad - 2.5}px;--i:${i}"></i>`;
  }).join('');
}

/**
 * A reel over a place: the players in a shuffled order where `before` comes right before
 * the place's player (the near miss), repeated; spinning slowly at first.
 */
function reel(sc, place, before) {
  const others = shuffle(sc.players.filter((p) => p.id !== place.player.id && p.id !== before.id));
  const order = before.id === place.player.id ? [place.player, ...others] : [...others, before, place.player];
  const seq = Array.from({ length: Math.ceil(260 / order.length) }, () => order).flat();
  const at = centre(place.avatar);
  const el = document.createElement('div');
  el.className = 'jp-reel pointer-events-none fixed z-40';
  el.style.cssText = `left:${at.x - WINDOW.w / 2}px;top:${at.y - WINDOW.h / 2}px;width:${WINDOW.w}px;height:${WINDOW.h}px;--tone:var(--color-${place.tone})`;
  el.innerHTML = `<div class="jp-window"><div class="jp-strip">${seq.map((p) => `<div class="jp-item">${avatar(p, 'xl')}</div>`).join('')}</div></div>${bulbs()}`;
  document.body.append(el);
  return { place, before, el, strip: el.querySelector('.jp-strip'), seq, p: Math.floor(Math.random() * order.length), v: 0, plan: null, last: null, at };
}

/** Where the reel stands: the player at `p` in the middle of the window, blurred by its speed. */
function paint(r) {
  r.strip.style.transform = `translateY(${-r.p * ITEM + (WINDOW.h - ITEM) / 2}px)`;
  r.strip.style.filter = r.v > 4 ? `blur(${Math.min(2.4, (r.v - 4) / 4)}px)` : 'none';
  const shown = Math.round(r.p);
  if (shown !== r.last) {
    r.last = shown;
    // Each player passing the middle is a tick while the reel stops and is slow enough to follow.
    if (r.plan && r.v > 0.2 && r.v < 12) buzz('tap');
  }
}

/** The one loop: spinning reels move at their speed, stopping ones along their plan. Returns what ends it. */
function run(reels) {
  let last = performance.now();
  let on = true;
  const frame = (now) => {
    if (!on) return;
    const dt = Math.max(0, (now - last) / 1000);
    last = now;
    for (const r of reels) {
      if (r.plan && now >= r.plan.t0) {
        if (r.plan.from === null) r.plan.from = r.p;
        const k = Math.min(1, Math.max(0, (now - r.plan.t0) / r.plan.ms));
        const before = r.p;
        r.p = r.plan.from + (r.plan.to - r.plan.from) * r.plan.curve(k);
        r.v = dt > 0 ? (r.p - before) / dt : 0;
        if (k >= 1) {
          r.v = 0;
          const done = r.plan.done;
          r.plan = null;
          done();
        }
      } else r.p += r.v * dt;
      paint(r);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => (on = false);
}

/** The reel's first position (a whole number) at least `ahead` players on where `who` is in the middle. */
function next(r, who, ahead) {
  let q = Math.ceil(r.p + ahead);
  while (q < r.seq.length - 1 && r.seq[q].id !== who.id) q += 1;
  return q;
}

/**
 * Stops the reel on `who`: an ease-out of power `power` over `ms`, starting at the spin's
 * speed. Such a stop covers a fixed distance (speed × time / power), so the reel spins on
 * until `who` is exactly that far away (at most one more turn of its players) and only
 * then starts to slow: every stop takes the time it was given, with any number of players.
 */
function stop(r, who, ms, power) {
  const distance = (r.v * ms) / 1000 / power;
  const to = next(r, who, distance);
  const wait = ((to - distance - r.p) / r.v) * 1000;
  return new Promise((done) => {
    r.plan = { from: null, to, ms, t0: performance.now() + wait, curve: (k) => 1 - (1 - k) ** power, done };
  });
}

/** Moves a stopped reel by `by` players in `ms` along `curve` (the click to the right player, the creep). */
function nudge(r, by, ms, curve) {
  return new Promise((done) => {
    r.plan = { from: r.p, to: r.p + by, ms, t0: performance.now(), curve, done };
  });
}

/** The reel has its player: the bulbs shine steady, the window glows, then the podium's player takes its place. */
async function settle(sc, r, { felt, px = 0, sparks = 26 }) {
  r.el.setAttribute('data-steady', '');
  r.el.animate([{ scale: 1.12 }, { scale: 1 }], { duration: 300, easing: 'ease-out' });
  buzz(felt);
  sparkle(r.at, r.place.tone, sparks, 80);
  if (px) shake(sc.screen, px);
  await wait(450);
  r.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'forwards' });
  reveal(r.place, 1.15, 420);
  light(r.place);
}

export async function jackpot(sc) {
  sc.screen.setAttribute('data-dim', '');
  // The near misses: someone not on the podium yet when the reel stops (third stops first).
  const closest = sc.ranked[3] || sc.ranked[1] || sc.ranked[0];
  const reels = sc.places.map((place) => {
    const open = sc.players.filter((p) => sc.ranked.indexOf(p) < place.n - 1 || sc.ranked.indexOf(p) >= 3);
    const others = open.filter((p) => p.id !== place.player.id);
    const before = place.n === 1 ? closest : others[Math.floor(Math.random() * others.length)] || closest;
    return reel(sc, place, before);
  });
  const end = run(reels);
  for (const r of reels) r.el.animate([{ opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1 }], { duration: 450, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' });
  buzz('tap');
  await wait(300);
  await tween(500, (k) => reels.forEach((r) => (r.v = SPIN * k)));
  await wait(900);

  const byPlace = (n) => reels.find((r) => r.place.n === n);
  const third = byPlace(3);
  if (third) {
    await stop(third, third.place.player, 1500, 3);
    await settle(sc, third, { felt: 'yes' });
    await wait(500);
  }
  const second = byPlace(2);
  if (second) {
    // It stops one player early (the one before its player on the reel), holds, and clicks on.
    await stop(second, second.before, 2000, 3);
    await wait(380);
    await nudge(second, 1, 300, CURVE.back);
    await settle(sc, second, { felt: 'land', px: 4, sparks: 40 });
    await wait(600);
  }

  // The winner's reel, alone: the edges darken, the bulbs race, and it slows almost to nothing.
  const win = byPlace(1);
  const dark = vignette();
  dark.to(0.85, 800);
  win.el.style.setProperty('--bulb-ms', '240ms');
  await wait(900);
  await stop(win, win.before, 3800, 4);
  // It stopped one too early, on someone who could have been it. The bulbs go out; nothing moves.
  win.el.setAttribute('data-off', '');
  await wait(1100);
  buzz('tap');
  await nudge(win, 0.38, 750, CURVE.in);
  await nudge(win, 0.62, 220, CURVE.back);
  await freeze(140);
  // Jackpot: the frame bursts into light.
  flash(0.95, 650);
  win.el.removeAttribute('data-off');
  for (const bulb of win.el.querySelectorAll('.jp-bulb')) {
    const b = centre(bulb);
    const a = Math.atan2(b.y - win.at.y, b.x - win.at.x);
    for (let i = 0; i < 4; i += 1) spark({ x: b.x, y: b.y, vx: Math.cos(a + (Math.random() - 0.5) * 0.6) * 380, vy: Math.sin(a + (Math.random() - 0.5) * 0.6) * 380, drag: 2.6, gravity: 200, life: 0.9, size: 2.6, tint: colour('yellow'), hot: 0.3 });
  }
  ring({ x: win.at.x, y: win.at.y, from: 30, to: 280, life: 0.7, width: 12, tint: colour('yellow') });
  win.el.animate([{ scale: 1, opacity: 1 }, { scale: 1.7, opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' });
  reveal(win.place, 1.5);
  light(win.place);
  buzz('land');
  shake(sc.screen, 10);
  dark.to(0, 900);
  rays(centre(win.place.avatar), 'yellow');
  const finished = finale(sc);
  // The reels have faded out: the loop and their elements can go.
  await wait(400);
  end();
  for (const r of reels) r.el.remove();
  await finished;
}
