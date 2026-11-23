/**
 * Spotlight: the podium as a stage. The lights go down, every player stands in a lineup
 * under the podium, and a spotlight searches them: it jumps from one to the next, slower
 * and slower, wavers between two, and stops. The one it found leaps up onto their place.
 * Third place is a short search, second a longer one with more wavering. For the winner
 * the lights go out completely for a breath; two spotlights race over everyone left, then
 * each stops on one player ("which of these two?"), the second one slides over to the
 * first, everything stands still, and the stage turns white: the winner leaps to the top
 * and the fireworks go up.
 *
 * Mechanisms: the darkness is a canvas of its own over the screen (fx.js stays above it),
 * with a hole of light for every spotlight: a soft pool, and a faint beam from the top
 * edge, so it reads as a lamp. A revealed place keeps a pool of its own. The lineup and the
 * leaping avatar use the app's `avatar`. Every jump of the light is a light tap, so the
 * searching is felt as it slows; each release is a thud (third: a firm pulse).
 *
 * Invariants: the light never stops on the target first, so its first stop gives nothing
 * away; nobody in the lineup is dimmed or hinted before their place is revealed.
 */
import { avatar } from '/js/ui.js';
import { colour, ring } from './fx.js';
import { CURVE, buzz, centre, finale, flash, freeze, light, rays, reveal, shake, sparkle, ticks, tween, wait } from './stage.js';

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * The darkness over the screen with its lights: `level` how dark (0 to 1), `lights` the
 * pools of light ({ x, y, r, a: how bright 0 to 1, lean: where the beam comes from }).
 * Drawn every frame while `on`.
 */
function darkness() {
  const canvas = document.createElement('canvas');
  canvas.className = 'pointer-events-none fixed inset-0 z-50 size-full';
  document.body.append(canvas);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = innerWidth;
  const H = innerHeight;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const state = { level: 0, lights: [], on: true, canvas };
  const draw = () => {
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, W, H);
    g.globalAlpha = state.level;
    g.fillStyle = colour('stage');
    g.fillRect(0, 0, W, H);
    for (const l of state.lights) {
      if (l.a <= 0.01) continue;
      // The beam from a lamp above: it cuts a faint cone out of the dark, then lights it a little.
      const beam = new Path2D();
      beam.moveTo(l.x + l.lean - 10, -10);
      beam.lineTo(l.x + l.lean + 10, -10);
      beam.lineTo(l.x + l.r * 0.9, l.y);
      beam.lineTo(l.x - l.r * 0.9, l.y);
      beam.closePath();
      const fade = g.createLinearGradient(0, 0, 0, l.y);
      fade.addColorStop(0, 'transparent');
      fade.addColorStop(1, colour('white'));
      g.globalCompositeOperation = 'destination-out';
      g.globalAlpha = l.a * 0.3;
      g.fillStyle = fade;
      g.fill(beam);
      // The pool: a round hole, soft at its edge.
      const pool = g.createRadialGradient(l.x, l.y, l.r * 0.3, l.x, l.y, l.r);
      pool.addColorStop(0, colour('white'));
      pool.addColorStop(1, 'transparent');
      g.globalAlpha = l.a;
      g.fillStyle = pool;
      g.beginPath();
      g.arc(l.x, l.y, l.r, 0, Math.PI * 2);
      g.fill();
      // A little light in the air: the beam and the pool glow faintly over what they light.
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = l.a * 0.07;
      g.fillStyle = fade;
      g.fill(beam);
    }
    if (state.on) requestAnimationFrame(draw);
    else canvas.remove();
  };
  requestAnimationFrame(draw);
  return state;
}

/** Everyone in a row under the podium, in join order, the app's avatars: { id: { el, x, y } }. */
function lineup(sc) {
  const podium = sc.podium.getBoundingClientRect();
  const row = document.createElement('div');
  row.className = 'pointer-events-none fixed inset-x-4 z-40 flex flex-wrap justify-center gap-2.5';
  row.style.top = `${podium.bottom + 34}px`;
  const size = sc.players.length > 8 ? 'md' : 'lg';
  row.innerHTML = sc.players.map((p) => `<span class="inline-block" data-id="${p.id}">${avatar(p, size)}</span>`).join('');
  document.body.append(row);
  const spots = {};
  for (const el of row.children) spots[el.dataset.id] = { el, ...centre(el) };
  return { row, spots };
}

/** Moves a light to a spot (its centre) in `ms`, gliding in and out. */
function glide(lamp, spot, ms) {
  const from = { x: lamp.x, y: lamp.y };
  return tween(ms, (k) => {
    lamp.x = from.x + (spot.x - from.x) * k;
    lamp.y = from.y + (spot.y - from.y) * k;
  }, CURVE.inOut);
}

/** The player under the light jumps a little: found for a moment. */
const bob = (spot) => spot.el.animate([{ transform: 'none' }, { transform: 'translateY(-5px) scale(1.12)' }, { transform: 'none' }], { duration: 260, easing: 'ease-out' });

/**
 * The light searches: `hops` jumps between the candidates (never twice the same, never the
 * target first), each slower than the one before, a tap and a bob at every stop; then it
 * wavers `waver` times between someone else and the target, and ends on the target.
 */
async function search(lamp, spots, candidates, target, { hops, fast, slow, waver }) {
  const others = candidates.filter((id) => id !== target);
  let at = null;
  for (let i = 0; i < hops; i += 1) {
    const options = candidates.filter((id) => id !== at && (i > 0 || id !== target));
    at = pick(options.length ? options : candidates);
    await glide(lamp, spots[at], fast + (slow - fast) * (i / hops) ** 1.4);
    buzz('tap');
    bob(spots[at]);
  }
  for (let i = 0; i < waver; i += 1) {
    const other = others.length ? pick(others) : target;
    await glide(lamp, spots[other], slow * 1.1);
    buzz('tap');
    await glide(lamp, spots[target], slow * 1.25);
    buzz('tap');
  }
  if (at !== target && !waver) await glide(lamp, spots[target], slow * 1.2);
}

/**
 * The found player leaps from the lineup onto their place: up in an arc and down, growing
 * to the podium's avatar size; their light follows. Resolves on landing.
 */
async function leap(spot, place, lamp, height) {
  const from = spot.el.getBoundingClientRect();
  const to = centre(place.avatar);
  const flyer = spot.el.cloneNode(true);
  flyer.className = 'pointer-events-none fixed z-60';
  flyer.style.cssText = `left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px`;
  document.body.append(flyer);
  spot.el.style.visibility = 'hidden';
  const dx = to.x - (from.left + from.width / 2);
  const dy = to.y - (from.top + from.height / 2);
  const grow = to.r.width / from.width;
  const start = { x: lamp.x, y: lamp.y };
  await tween(560, (k) => {
    const lift = 4 * height * k * (1 - k);
    flyer.style.transform = `translate(${dx * k}px, ${dy * k - lift}px) scale(${1 + (grow - 1) * k + 0.35 * Math.sin(Math.PI * k)})`;
    lamp.x = start.x + (to.x - start.x) * k;
    lamp.y = start.y + (to.y - start.y) * k - lift;
  }, CURVE.inOut);
  flyer.remove();
}

/** A release on the podium: the player appears, the block lights up, sparks, a ring, the vibration and (if `px`) a jolt. */
function land(sc, place, { felt, px = 0, sparks = 30 }) {
  const at = centre(place.avatar);
  reveal(place, place.n === 1 ? 1.5 : 1.3);
  light(place);
  sparkle(at, place.tone, sparks, place.n === 1 ? 150 : 90);
  ring({ x: at.x, y: at.y, from: 20, to: place.n === 1 ? 260 : 120, life: 0.6, width: 8, tint: colour(place.tone), strength: 0.8 });
  buzz(felt);
  if (px) shake(sc.screen, px);
}

export async function spotlight(sc) {
  sc.screen.setAttribute('data-dim', '');
  const stage = darkness();
  const { row, spots } = lineup(sc);
  const left = { x: -60, y: Object.values(spots)[0].y };
  const placed = new Set();
  await tween(800, (k) => (stage.level = 0.93 * k));
  await wait(400);

  for (const place of sc.places.filter((p) => p.n !== 1)) {
    const candidates = sc.players.map((p) => p.id).filter((id) => !placed.has(id));
    const lamp = { ...left, r: 44, a: 0, lean: -40 };
    stage.lights.push(lamp);
    await tween(250, (k) => (lamp.a = k));
    buzz('tap');
    const third = place.n === 3;
    await search(lamp, spots, candidates, place.player.id, third ? { hops: 4, fast: 150, slow: 320, waver: 1 } : { hops: 6, fast: 140, slow: 380, waver: 1 });
    // Found: a moment of stillness while the light grows on them.
    await tween(third ? 380 : 600, (k) => (lamp.r = 44 + 12 * k));
    if (!third) await freeze(90);
    await leap(spots[place.player.id], place, lamp, third ? 70 : 90);
    placed.add(place.player.id);
    land(sc, place, third ? { felt: 'yes' } : { felt: 'land', px: 4, sparks: 45 });
    tween(400, (k) => (lamp.r = 56 + 6 * k));
    await wait(third ? 700 : 900);
  }

  // The winner: darker than ever, a breath of nothing.
  const winner = sc.places.find((p) => p.n === 1);
  const kept = stage.lights.map((l) => ({ l, a: l.a }));
  await tween(600, (k) => {
    stage.level = 0.93 + 0.05 * k;
    for (const { l, a } of kept) l.a = a * (1 - 0.65 * k);
  });
  await wait(500);
  const candidates = sc.players.map((p) => p.id).filter((id) => !placed.has(id));
  const xs = candidates.map((id) => spots[id].x);
  const y = spots[candidates[0]].y;
  const a = { x: -60, y, r: 42, a: 0, lean: -60 };
  const b = { x: innerWidth + 60, y, r: 42, a: 0, lean: 60 };
  stage.lights.push(a, b);
  tween(200, (k) => (a.a = b.a = k));
  // Two lights race criss-cross over everyone left, faster and faster.
  let racing = true;
  const span = [Math.min(...xs) - 30, Math.max(...xs) + 30];
  const race = async (lamp) => {
    for (let ms = 300; racing; ms = Math.max(110, ms * 0.9)) await glide(lamp, { x: span[0] + Math.random() * (span[1] - span[0]), y: y + (Math.random() - 0.5) * 30 }, ms);
  };
  race(a);
  race(b);
  await ticks(2300, { from: 230, to: 60 });
  racing = false;
  await wait(300);
  // The final two: each light stops on one player, then the second slides over to the first.
  const rival = candidates.filter((id) => id !== winner.player.id);
  const second = rival.length ? pick(rival) : winner.player.id;
  const [onWinner, onRival] = Math.random() < 0.5 ? [a, b] : [b, a];
  await Promise.all([glide(onWinner, spots[winner.player.id], 500), glide(onRival, spots[second], 500)]);
  buzz('tap');
  await wait(1000);
  buzz('tap');
  await glide(onRival, spots[winner.player.id], 850);
  await freeze(160);
  await tween(500, (k) => (onWinner.r = onRival.r = 42 + 26 * k));
  // The release: the stage turns white, the lights come up, the winner leaps to the top.
  flash(0.95, 700);
  tween(900, (k) => (stage.level = 0.98 * (1 - k))).then(() => (stage.on = false));
  row.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
  await leap(spots[winner.player.id], winner, onWinner, 120);
  land(sc, winner, { felt: 'land', px: 9, sparks: 70 });
  rays(centre(winner.avatar), 'yellow');
  await finale(sc);
}
