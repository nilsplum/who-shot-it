/**
 * The podium's reveal at the end of a game: each place charges up like a power-up before
 * its player bursts out ("Supercharge", chosen from drafts/results_animations). Third
 * place, then second, then the winner, each bigger than the one before, and fireworks over
 * the whole screen for the winner.
 *
 * Mechanisms: main.js `startPodium` calls `playPodium` once per game end (`session.shown`),
 * in the same task as the end screen (views/end.js) is painted in its final state, so no
 * frame shows the end first. It covers every place (`data-covered`: an orb where its
 * player stands, the player hidden, its block dimmed) and hides the facts, the ranking and
 * "Play again" (`data-playing`). The orbs pop in, third first. Then each place in turn:
 * its orb fills in a few jumps (`--charge` turns its ring, `--fill` brightens its block),
 * faster and faster, while sparks rush into it (sparks.js `inflow`), it trembles harder
 * with every jump and the light taps come quicker. Full, it draws in for a moment, then
 * bursts: a ring of light, a spray of sparks, the player pops out (`data-go`), the block
 * glows, the screen jolts, a thud. The winner's orb also grows and cracks while the edges of
 * the screen darken, and its burst adds a white flash and the fireworks; then the facts,
 * the ranking and "Play again" fade in (`data-ended`).
 *
 * Invariants:
 * - Every position is measured once, before anything moves (an orb's middle is where its
 *   player's avatar will be), so no light lands beside its place while the screen jolts or
 *   a player pops in.
 * - Nothing stands still: each place's charge flows straight into its burst.
 * - Every step first checks that the end screen is still on (Play again or Leave replace
 *   it); main.js clears the sparks when the screen changes.
 * - With Reduce Motion main.js does not call it: the final state simply stays.
 */
import { wait } from './motion.js';
import { colour, fireworks, flash, inflow, middle, ring, shade, spray } from './sparks.js';

/**
 * The timing in ms and the size of each place's charge: how long it charges, in how many
 * jumps, how long it draws in when full, how hard it trembles at full charge (px), how far
 * its ring of light spreads (0: the whole screen), its sparks, the vibration of its burst,
 * how hard the screen jolts (px), how much the orb grows (the winner's), the pause after.
 */
const PODIUM = {
  arrive: 340,
  stagger: 155,
  settle: 510,
  darken: 255,
  ended: 1360,
  places: {
    3: { ms: 1275, jumps: 4, squeeze: 70, tremble: 3, wave: 120, sparks: 26, felt: 'yes', jolt: 0, grow: 0, after: 550 },
    2: { ms: 1870, jumps: 5, squeeze: 100, tremble: 4.5, wave: 190, sparks: 42, felt: 'land', jolt: 4, grow: 0.1, after: 720 },
    1: { ms: 3060, jumps: 5, squeeze: 160, tremble: 7, wave: 0, sparks: 90, felt: 'land', jolt: 10, grow: 0.55, after: 0 },
  },
};

/** The orb trembles, `px` at most, jumping between six spots ten times a second; returns the animation (to replace or cancel). */
function tremble(el, px) {
  const spots = [[-1, 0.4], [0.8, -0.9], [-0.5, -0.7], [0.9, 0.6], [-0.8, 0.9], [0.4, -0.5]];
  return el.animate(spots.map(([x, y]) => ({ translate: `${x * px}px ${y * px}px`, easing: 'steps(1, end)' })), { duration: 120, iterations: Infinity });
}

/** The screen jolts and settles: `px` at first, less and less. */
function jolt(el, px) {
  const steps = 8;
  el.animate(Array.from({ length: steps + 1 }, (_, i) => {
    const k = (1 - i / steps) ** 1.6;
    return { translate: i === steps ? 'none' : `${(i % 2 ? 1 : -1) * px * k}px ${((i % 3) - 1) * px * 0.6 * k}px` };
  }), { duration: 420 });
}

/**
 * One place charges and bursts. Returns false when the screen was left meanwhile.
 * `alive()` says whether the end screen is still on.
 */
async function charge(screen, place, spec, buzz, alive) {
  const winner = place.n === 1;
  const stream = inflow({ ...place.at, tint: place.tint, reach: winner ? 150 : 110, rate: 18 });
  let level = 0;
  let charging = true;
  // The taps follow the charge: slow at first, faster with every jump; the winner's full orb buzzes.
  (async () => {
    while (charging && alive()) {
      buzz(winner && level === 1 ? 'count' : 'tap');
      await wait(winner && level === 1 ? 130 : 240 - 190 * level ** 1.2);
    }
  })();
  let shaking = tremble(place.orb, 0);
  place.orb.style.setProperty('--grow', spec.grow);
  // The jumps come faster and faster: the i-th of n at (i/n)^0.8 of the time.
  let time = 0;
  for (let i = 1; i <= spec.jumps; i += 1) {
    const at = spec.ms * (i / spec.jumps) ** 0.8;
    await wait(at - time);
    time = at;
    if (!alive()) break;
    level = i / spec.jumps;
    place.orb.style.setProperty('--charge', level);
    place.li.style.setProperty('--fill', level);
    stream.rate = 18 + 170 * level;
    shaking.cancel();
    shaking = tremble(place.orb, spec.tremble * level ** 2);
    if (winner) {
      place.orb.toggleAttribute('data-crack', level >= 0.6);
      place.orb.toggleAttribute('data-split', level >= 0.8);
      shade(0.9 * level, 200);
    }
  }
  // Full: it draws in for a moment (the sparks keep rushing in), then bursts.
  place.orb.style.setProperty('--squeeze', 0.86);
  await wait(spec.squeeze);
  charging = false;
  stream.stop();
  shaking.cancel();
  if (!alive()) return false;
  const reach = spec.wave || Math.hypot(innerWidth, innerHeight);
  ring({ ...place.at, from: 14, to: reach, life: winner ? 0.9 : 0.55, width: winner ? 26 : 12, tint: place.tint, strength: 0.9 });
  if (winner) {
    ring({ ...place.at, from: 8, to: reach * 0.7, life: 0.7, width: 14, tint: colour('white'), strength: 0.8 });
    flash(1, 750);
  }
  spray(place.at, place.tint, spec.sparks, winner ? 170 : 95);
  // The burst on one frame: the orb goes, the player pops out, the block glows, the thud.
  place.li.removeAttribute('data-covered');
  place.who.setAttribute('data-go', '');
  buzz(spec.felt);
  if (spec.jolt) jolt(screen, spec.jolt);
  return true;
}

/**
 * Plays the podium's reveal over the end screen `screen` (its final state just painted);
 * `buzz(kind)` plays a vibration (`phone.buzz` in the app).
 */
export async function playPodium(screen, buzz) {
  const alive = () => screen.isConnected;
  const places = [3, 2, 1].map((n) => screen.querySelector(`[data-place="${n}"]`)).filter(Boolean).map((li) => ({
    li,
    n: Number(li.dataset.place),
    orb: li.querySelector('[data-cell="orb"]'),
    who: li.querySelector('[data-cell="who"]'),
    tint: getComputedStyle(li).getPropertyValue('--tone').trim(),
  }));
  if (!places.length) return;
  screen.setAttribute('data-playing', '');
  for (const place of places) place.li.setAttribute('data-covered', '');
  for (const place of places) place.at = middle(place.orb);
  // The orbs pop in, third first, each with a light tap.
  places.forEach((place, i) => {
    place.orb.animate([{ scale: 0, opacity: 0 }, { scale: 1, opacity: 1 }], { duration: PODIUM.arrive, delay: i * PODIUM.stagger, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)', fill: 'backwards' });
    setTimeout(() => alive() && buzz('tap'), i * PODIUM.stagger);
  });
  await wait(places.length * PODIUM.stagger + PODIUM.settle);
  for (const place of places) {
    if (!alive()) return;
    const spec = PODIUM.places[place.n];
    if (place.n === 1) await wait(PODIUM.darken);
    if (!(await charge(screen, place, spec, buzz, alive))) return;
    await wait(spec.after);
  }
  shade(0, 900);
  const winner = places.find((p) => p.n === 1);
  let bangs = 0;
  // The first few bangs of the fireworks are felt as light taps; the winner's thud came with the burst.
  fireworks(winner.at, { alive, bang: () => (bangs += 1) <= 6 && buzz('tap') });
  await wait(PODIUM.ended);
  if (!alive()) return;
  screen.removeAttribute('data-playing');
  screen.setAttribute('data-ended', '');
}
