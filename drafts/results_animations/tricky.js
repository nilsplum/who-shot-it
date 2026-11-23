/**
 * Tricky: the podium played like the game's own Tricky mode. Each place shows its player as
 * a dark, pixelated shape in a little frame, with their name scrambled under it. Step by
 * step the pixels get finer and letters of the name settle, every step a light tap, the
 * pauses growing, so the table starts shouting guesses. Then the colour floods in and the
 * player is there. Third place takes a few steps, second more and a pause before the last.
 * The winner's frame rises into the free middle of the screen, twice as big, the edges
 * darkening, and beats like a heart (a double tap with each beat, faster and faster) while
 * it sharpens; before the last step everything holds still, one letter still scrambling.
 * Then the colour, a white flash, the fireworks, and the winner drops onto the podium.
 *
 * Mechanisms: the avatar is drawn on a small canvas from its emoji (a silhouette in a
 * quiet theme colour, then in colour), shrunk to a few pixels and blown up without
 * smoothing, like the game's pixel effect (web/js/effects.js) does with a photo. The frame
 * and its name are fixed layers over the place (style.css, `tr-`).
 *
 * Invariants: until the last step the shape stays a silhouette (only its outline is a
 * clue), and the name's last letter settles only with the colour.
 */
import { colour } from './fx.js';
import { CURVE, buzz, centre, finale, flash, light, rays, reveal, shake, sparkle, tween, vignette, wait } from './stage.js';

/** The frame's canvas size in px, and the letters a scrambled name flickers through. */
const SIZE = 56;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Each place's steps: the pixel size at each one and the pause after it (the last is the colour). */
const STEPS = {
  3: { px: [14, 9, 6, 4, 3], pause: [260, 260, 300, 340, 420] },
  2: { px: [16, 12, 8, 6, 4, 3, 2], pause: [230, 250, 280, 320, 380, 460, 700] },
  1: { px: [20, 16, 12, 9, 7, 5, 4, 3, 2], beat: [860, 800, 740, 680, 620, 570, 530, 500, 480] },
};

/** The emoji drawn at `size` px: in colour, or as a flat shape in the theme's quiet colour. */
function sprite(emoji, size, shape) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${Math.round(size * 0.8)}px system-ui, sans-serif`;
  g.fillText(emoji, size / 2, size / 2 + size * 0.05);
  if (shape) {
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = colour('muted');
    g.fillRect(0, 0, size, size);
  }
  return c;
}

/** A place's frame: the canvas, the scrambled name under it; `draw(px, shape)` paints a step. */
function frame(place) {
  const at = centre(place.avatar);
  const nameBox = centre(place.who.children[1]);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const el = document.createElement('div');
  el.className = 'tr-frame pointer-events-none fixed z-40';
  el.style.cssText = `left:${at.x}px;top:${at.y}px;--tone:var(--color-${place.tone})`;
  el.innerHTML = `<div class="tr-tile"><canvas width="${SIZE * dpr}" height="${SIZE * dpr}"></canvas></div><b class="tr-name" style="top:${nameBox.y - at.y}px"></b>`;
  document.body.append(el);
  const canvas = el.querySelector('canvas');
  const g = canvas.getContext('2d');
  const full = SIZE * dpr;
  const colourSprite = sprite(place.player.avatar, full, false);
  const shapeSprite = sprite(place.player.avatar, full, true);
  const small = document.createElement('canvas');
  const draw = (px, shape = true) => {
    const n = Math.max(1, Math.round(SIZE / px));
    small.width = n;
    small.height = n;
    const s = small.getContext('2d');
    s.clearRect(0, 0, n, n);
    s.drawImage(shape ? shapeSprite : colourSprite, 0, 0, n, n);
    g.clearRect(0, 0, full, full);
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, full, full);
  };
  return { el, draw, name: el.querySelector('.tr-name'), tile: el.querySelector('.tr-tile'), at };
}

/**
 * The name, `settled` of its letters in their place (in a scattered order fixed per name),
 * the rest flickering through random letters every few frames until `stop()`.
 */
function scramble(nameEl, name) {
  const order = [...name].map((_, i) => i).sort(() => Math.random() - 0.5);
  const state = { settled: 0, on: true };
  const tick = () => {
    // Stopped meanwhile (the name is settled): a tick already on its way must not scramble it again.
    if (!state.on) return;
    const fixed = new Set(order.slice(0, state.settled));
    nameEl.textContent = [...name].map((ch, i) => (fixed.has(i) ? ch : LETTERS[Math.floor(Math.random() * LETTERS.length)])).join('');
    setTimeout(tick, 70);
  };
  tick();
  return state;
}

/** The frame jolts a little: a step has been taken. */
const jolt = (el, size = 1.08) => el.animate([{ scale: 1 }, { scale: size }, { scale: 1 }], { duration: 160, easing: 'ease-out' });

/** Third or second place: the steps, then the colour, and the podium's player takes the frame's place. */
async function sharpen(sc, place) {
  const f = frame(place);
  const steps = STEPS[place.n];
  const name = scramble(f.name, place.player.name);
  f.draw(steps.px[0]);
  f.el.animate([{ opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1 }], { duration: 350, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' });
  await wait(450);
  for (let i = 1; i < steps.px.length; i += 1) {
    f.draw(steps.px[i]);
    jolt(f.tile);
    buzz('tap');
    name.settled = Math.floor((place.player.name.length - 1) * (i / (steps.px.length - 1)));
    await wait(steps.pause[i]);
  }
  name.on = false;
  f.draw(1, false);
  f.name.textContent = place.player.name;
  jolt(f.tile, 1.2);
  sparkle(f.at, place.tone, place.n === 3 ? 26 : 44, 90);
  buzz(place.n === 3 ? 'yes' : 'land');
  if (place.n === 2) shake(sc.screen, 4);
  await wait(380);
  f.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' });
  reveal(place, 1.12, 380);
  light(place);
}

/** The winner: up to the middle, a heartbeat while it sharpens, a held breath, then the colour. */
async function winnerReveal(sc, place) {
  const f = frame(place);
  const steps = STEPS[1];
  const name = scramble(f.name, place.player.name);
  f.draw(steps.px[0]);
  // The middle of the free space under the podium (where the ranking comes later), the rest darkened.
  const below = sc.podium.getBoundingClientRect().bottom;
  const middle = { x: innerWidth / 2, y: below + Math.min(150, (innerHeight - below) * 0.4) };
  const BIG = 2.3;
  const dark = vignette();
  dark.to(0.75, 900);
  f.el.style.zIndex = '60';
  f.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
  await tween(800, (k) => {
    f.el.style.translate = `${(middle.x - f.at.x) * k}px ${(middle.y - f.at.y) * k}px`;
    f.el.style.scale = String(1 + (BIG - 1) * k);
  }, CURVE.inOut);
  for (let i = 1; i < steps.px.length; i += 1) {
    // A heartbeat: lub (the step, a tap), then dub (a smaller pulse, a tap).
    f.draw(steps.px[i]);
    jolt(f.tile, 1.1);
    buzz('tap');
    name.settled = Math.min(place.player.name.length - 1, Math.floor(place.player.name.length * (i / steps.px.length)));
    await wait(150);
    jolt(f.tile, 1.05);
    buzz('tap');
    await wait(steps.beat[i] - 150);
  }
  // Held breath: no beat, nothing moves but one last letter.
  await wait(1000);
  name.on = false;
  f.draw(1, false);
  f.name.textContent = place.player.name;
  f.el.setAttribute('data-lit', '');
  flash(1, 750);
  dark.to(0, 900);
  jolt(f.tile, 1.25);
  buzz('land');
  shake(sc.screen, 9);
  const ray = rays(middle, 'yellow', 420);
  sparkle(middle, 'yellow', 90, 170);
  finale(sc, middle, 2600);
  await wait(1300);
  // Down onto the top of the podium, where the player takes the frame's place.
  ray.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 500, fill: 'forwards' });
  await tween(650, (k) => {
    f.el.style.translate = `${(middle.x - f.at.x) * (1 - k)}px ${(middle.y - f.at.y) * (1 - k)}px`;
    f.el.style.scale = String(BIG - (BIG - 1) * k);
  }, CURVE.inOut);
  f.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
  reveal(place, 1.3, 420);
  light(place);
  buzz('tap');
  rays(centre(place.avatar), 'yellow');
}

export async function tricky(sc) {
  sc.screen.setAttribute('data-dim', '');
  await wait(500);
  for (const place of sc.places.filter((p) => p.n !== 1)) {
    await sharpen(sc, place);
    await wait(place.n === 3 ? 600 : 900);
  }
  await winnerReveal(sc, sc.places.find((p) => p.n === 1));
}
