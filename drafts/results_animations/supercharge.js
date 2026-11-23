/**
 * Supercharge: each place charges up like a power-up before it releases its player. Over
 * its place a dark orb appears; sparks rush into it from all around, faster and faster, a
 * ring around it fills, the orb trembles harder and its block glows brighter from below,
 * while the light taps speed up. Full: everything stops for a beat, then the orb bursts in
 * a shockwave and the player is there. Third place charges for a short while, second
 * longer and harder. The winner's orb grows as it charges, cracks open, the edges of the
 * screen close in, the taps become a buzz, and time stands still for half a second with
 * the sparks hanging in the air. Then a white blast, a shockwave across the whole screen,
 * and the fireworks.
 *
 * Mechanisms: the orb is CSS (style.css, `sc-`) driven by custom properties set every
 * frame: `--charge` (the ring, the glow), `--jx`/`--jy` (the tremble), `--grow`, and the
 * block's `--fill` (its brightness). The rushing sparks and the shockwaves are fx.js's.
 * The pause before each release is a real hit-stop (stage.js `freeze`): the sparks stop
 * where they are.
 *
 * Invariants: the charge always speeds up towards the end (anticipation), and every
 * release is bigger than the one before.
 */
import { colour, ring, spark } from './fx.js';
import { buzz, centre, finale, flash, freeze, light, rays, reveal, shake, sparkle, tween, vignette, wait } from './stage.js';

/** Per place: how long it charges, how hard it trembles, the stand-still, how far its shockwave goes, its sparks, the release felt. */
const CHARGE = {
  3: { ms: 1500, tremble: 3, stop: 80, wave: 120, sparks: 30, felt: 'yes', px: 0, grow: 0 },
  2: { ms: 2200, tremble: 4.5, stop: 120, wave: 190, sparks: 50, felt: 'land', px: 4, grow: 0.1 },
  1: { ms: 3600, tremble: 7, stop: 520, wave: 0, sparks: 110, felt: 'land', px: 10, grow: 0.55 },
};

/** The orb over a place's avatar: a ring that fills, a glowing core, and (for the winner) cracks. */
function orb(place) {
  const at = centre(place.avatar);
  const el = document.createElement('div');
  el.className = 'sc-orb pointer-events-none fixed z-40';
  el.style.cssText = `left:${at.x}px;top:${at.y}px;--tone:var(--color-${place.tone})`;
  el.innerHTML = `<i class="sc-ring"></i><i class="sc-core"></i>${place.n === 1 ? '<svg class="sc-cracks" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 L29 18 L35 24 L30 33"/><path d="M58 30 L46 31 L41 38 L34 36"/><path d="M12 48 L22 42 L24 34 L30 33"/><path d="M44 56 L40 46 L34 44 L33 37"/></svg>' : ''}`;
  document.body.append(el);
  return { el, at };
}

/** A spark rushing into the orb from somewhere around it, arriving at its middle. */
function inward(at, tone, reach) {
  const a = Math.random() * Math.PI * 2;
  const d = reach * (0.6 + Math.random() * 0.6);
  const life = 0.32 + Math.random() * 0.2;
  spark({ x: at.x + Math.cos(a) * d, y: at.y + Math.sin(a) * d, vx: (-Math.cos(a) * d) / life, vy: (-Math.sin(a) * d) / life, life, size: 1.8, tint: colour(tone), flicker: true });
}

/** One place charges and releases its player. */
async function charge(sc, place, o, spec, dark) {
  const winner = place.n === 1;
  let level = 0;
  let charging = true;
  // The taps follow the charge: slow at first, then faster and faster; the winner's end in a buzz.
  (async () => {
    while (charging) {
      if (winner && level > 0.9) {
        buzz('count');
        await wait(130);
      } else {
        buzz('tap');
        await wait(240 - 190 * level ** 1.2);
      }
    }
  })();
  let rushed = 0;
  let lastAt = performance.now();
  await tween(spec.ms, (k) => {
    level = k ** 1.5;
    const now = performance.now();
    const dt = (now - lastAt) / 1000;
    lastAt = now;
    const amp = spec.tremble * level ** 2;
    o.el.style.setProperty('--charge', level.toFixed(3));
    o.el.style.setProperty('--jx', `${(Math.random() - 0.5) * 2 * amp}px`);
    o.el.style.setProperty('--jy', `${(Math.random() - 0.5) * 2 * amp}px`);
    o.el.style.setProperty('--grow', (1 + spec.grow * level).toFixed(3));
    place.li.style.setProperty('--fill', level.toFixed(3));
    if (winner) {
      o.el.toggleAttribute('data-crack', level > 0.6);
      o.el.toggleAttribute('data-split', level > 0.85);
      if (dark) dark.el.style.opacity = String(0.9 * level);
    }
    for (rushed += dt * (18 + 170 * level); rushed >= 1; rushed -= 1) inward(o.at, place.tone, winner ? 150 : 110);
  });
  charging = false;
  // Full: everything stands still (the winner's: half a second, the sparks hanging in the air).
  o.el.style.setProperty('--jx', '0px');
  o.el.style.setProperty('--jy', '0px');
  await freeze(spec.stop);
  o.el.remove();
  const { x, y } = o.at;
  ring({ x, y, from: 14, to: spec.wave || Math.hypot(innerWidth, innerHeight), life: winner ? 0.9 : 0.55, width: winner ? 26 : 12, tint: colour(place.tone), strength: 0.9 });
  if (winner) {
    ring({ x, y, from: 8, to: Math.hypot(innerWidth, innerHeight) * 0.7, life: 0.7, width: 14, tint: colour('white'), strength: 0.8 });
    flash(1, 750);
  }
  sparkle(o.at, place.tone, spec.sparks, winner ? 170 : 95);
  reveal(place, winner ? 1.55 : 1.3);
  light(place);
  buzz(spec.felt);
  if (spec.px) shake(sc.screen, spec.px);
}

export async function supercharge(sc) {
  sc.screen.setAttribute('data-dim', '');
  const orbs = new Map(sc.places.map((place) => [place, orb(place)]));
  // The orbs arrive one by one, dark and empty.
  for (const [, o] of orbs) {
    o.el.animate([{ scale: 0, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: 400, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' });
    buzz('tap');
    await wait(180);
  }
  await wait(600);
  for (const place of sc.places.filter((p) => p.n !== 1)) {
    await charge(sc, place, orbs.get(place), CHARGE[place.n]);
    await wait(place.n === 3 ? 650 : 850);
  }
  const winner = sc.places.find((p) => p.n === 1);
  const dark = vignette();
  await wait(300);
  await charge(sc, winner, orbs.get(winner), CHARGE[1], dark);
  dark.to(0, 900);
  rays(centre(winner.avatar), 'yellow');
  await finale(sc);
}
