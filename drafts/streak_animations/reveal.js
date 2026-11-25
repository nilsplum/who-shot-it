/**
 * The reveal of a round with my streak, one step after the other, as the app plays it
 * (web/js/reveal.js) with one change: my points do not rise off my card and fade at once.
 * The owner's card turns green and pops, a ring of green light, green sparks and gold coins
 * leave it, and my points, "+520", pop up and settle just above the badge at the bottom of
 * the photo. Then the streak grows out of them: the points slide to the left, and to their
 * right a second number appears, "+400", the bonus, under a tower of blocks. A block for every
 * number of the streak, 2, 3, 4 and on, drops in on the tower, each a little later and a
 * little more dramatic than the one before (higher, harder, more sparks, the screen jolting,
 * from the middle of the streak a flash), and the bonus counts up by what the block adds, 100,
 * 200, 300 and on, in a colour that heats up. When the tower is done the bonus slides into the
 * points, which count up with a pop, a ring, a stream of sparks and coins (the streak's tier
 * sets how big); the badge at the bottom of the photo ticks to the new number. Then the total
 * pulses once and fades out where it stands. The reactions come as in the app. Without a
 * streak the points settle, stay a moment and fade out the same way.
 *
 * Mechanisms: screen.js calls `playReveal` on Play. The numbers and the tower are elements of a
 * layer over the screen (moves.js `layer`); a number is a pin (moves.js) whose wrapper is
 * moved and whose text is scaled and counted, so a count never moves it. The light is the app's
 * canvas (web/js/sparks.js). The tower is tower.js.
 *
 * Invariants: the numbers never overlap the badge (they stand above it); the story takes
 * about 1.5 s of the reveal's 3.5 s for a streak of 2 and up to about 4 s more for the longest
 * (the reveal's time, TIMING.revealMs, has to grow with it); it ends with the layer gone and the
 * badge at my streak, also when the screen is left meanwhile.
 */
import { colour, flash, inflow, middle, ring, spark, spray } from '/js/sparks.js';
import { badge } from './badge.js';
import { EASE, bonusOf, buzz, dramaOf, jolt, layer, lookOf, pin, tween, wait } from './moves.js';
import { badgeSlot } from './round.js';
import { LAND, tower } from './tower.js';

/** The reveal's steps (ms), as web/js/reveal.js has them: the blink before the answer, then the answer, and from the pop to the reactions. */
const STEPS = { hold: 300, step: 400, after: 650 };
/** The streak numbers that get a block: 2 up to this one (where the bonus is capped), then the streak's own number. */
const CAP_AT = 6;

const outCubic = (k) => 1 - (1 - k) ** 3;

/** A number of the line over the photo: its text is what is counted and scaled, its wrapper (the pin) is what moves. */
const figure = (text, look) => `<b class="absolute -translate-x-1/2 -translate-y-full font-display text-6xl leading-none font-extrabold tabular-nums streak-points ${look}">${text}</b>`;

/** Moves a pin from `from` to `to` (screen pixels) over `ms`; its place afterwards is `to`. */
function glide(el, from, to, ms, easing) {
  el.style.translate = `${to.x}px ${to.y}px`;
  return el.animate([{ translate: `${from.x}px ${from.y}px` }, { translate: `${to.x}px ${to.y}px` }], { duration: ms, easing }).finished;
}

/** Gold coins spraying up out of a point and falling, as the app's pop has them. */
function coins(at, width) {
  for (let i = 0; i < 26; i += 1) {
    spark({ x: at.x + (Math.random() - 0.5) * width * 0.6, y: at.y, vx: (Math.random() - 0.5) * 340, vy: -330 - Math.random() * 230, drag: 0.4, gravity: 1100, life: 0.75 + Math.random() * 0.3, size: 3.4, tint: colour(i % 3 ? 'yellow' : 'p11'), hot: 0.2 });
  }
}

/** The blocks of a streak of `n`: each with its number, how dramatic it is and the pause before it drops (it grows). */
function blocksFor(n) {
  const upTo = Math.min(n, CAP_AT);
  const numbers = Array.from({ length: upTo - 1 }, (_, i) => i + 2);
  if (n > upTo) numbers.push(n);
  return numbers.map((k, i) => ({ k, drama: dramaOf(k), gap: i ? 90 + 45 * i : 120 }));
}

/** Plays the reveal over `screen` for `g`: the tower of its streak when my streak is 2 or more. */
export async function playReveal(screen, g) {
  const alive = () => screen.isConnected;
  const n = g.streak;
  const card = screen.querySelector('[data-card="owner"]');
  const stage = screen.querySelector('[data-part="stage"]').getBoundingClientRect();
  const slot = badgeSlot(screen);
  const top = layer();
  screen.setAttribute('data-playing', '');
  // The badge shows the streak I had before this round until the new number is added.
  if (n > 1) slot.innerHTML = n > 2 ? badge(n - 1) : '';
  try {
    await wait(STEPS.hold);
    if (!alive()) return;
    card.setAttribute('data-go', '');
    await wait(STEPS.step);
    if (!alive()) return;

    // The pop, as the app's: a ring, sparks and coins out of my card, and my points settling above the badge.
    const box = card.getBoundingClientRect();
    const at = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const green = colour('green');
    ring({ ...at, from: 16, to: Math.max(box.width, box.height) * 0.9, life: 0.55, width: 10, tint: green, strength: 0.85 });
    spray(at, green, 16, 70);
    coins(at, box.width);
    flash(0.18, 300);
    buzz('yes');
    setTimeout(() => alive() && screen.querySelector('[data-after]').setAttribute('data-go', ''), STEPS.after);

    const u = Math.min(1, stage.height / 360);
    const restY = stage.bottom - 52;
    const base = pin(top, figure(`+${g.base}`, 'text-yellow'), { x: at.x, y: box.top + 2 });
    const bonus = n > 1 ? pin(top, figure('+500', 'streak-bonus'), { x: 0, y: restY }) : null;
    const baseText = base.firstElementChild;
    const bonusText = bonus && bonus.firstElementChild;
    // Where the line stands: my points and the bonus side by side, around X, which keeps both and the tower on the screen.
    const baseW = baseText.offsetWidth;
    const lineH = baseText.offsetHeight;
    const gap = bonus ? (baseW + bonusText.offsetWidth) / 2 + 18 : 0;
    const room = bonus ? Math.max(bonusText.offsetWidth / 2, 62 * u) : 0;
    const lo = 8 + gap / 2 + baseW / 2;
    const hi = innerWidth - 8 - gap / 2 - room;
    const X = bonus ? (lo < hi ? Math.min(Math.max(at.x, lo), hi) : innerWidth / 2) : Math.min(Math.max(at.x, baseW / 2 + 8), innerWidth - baseW / 2 - 8);
    const centre = { x: X, y: restY };
    glide(base, { x: at.x, y: box.top + 2 }, centre, 320, EASE.out);
    baseText.animate([{ scale: 0.5, opacity: 0 }, { scale: 1.15, opacity: 1, offset: 0.4 }, { scale: 1 }], { duration: 520, easing: EASE.out });

    if (bonus) {
      const left = { x: X - gap / 2, y: restY };
      const right = { x: X + gap / 2, y: restY };
      bonus.style.translate = `${right.x}px ${right.y}px`;
      bonus.style.opacity = '0';
      bonusText.textContent = '+0';
      const foot = restY - lineH - 12;
      const grp = pin(top, '', { x: right.x, y: foot });
      grp.style.scale = String(u);
      const tw = tower({ grp, u, room: (foot - stage.top) / u });
      let shown = 0;
      /** The bonus counts up to `to` in the colour of the number `k`'s tier. */
      const count = (to, k) => {
        const from = shown;
        shown = to;
        bonusText.style.setProperty('--tone', `var(--color-${lookOf(k).tint})`);
        return tween(280, (t) => {
          bonusText.textContent = `+${Math.round(from + (to - from) * t)}`;
        }, outCubic);
      };

      // The tower grows block by block, each later and more dramatic, the bonus counting up with it.
      await wait(320);
      for (const [i, s] of blocksFor(n).entries()) {
        await wait(s.gap);
        if (!alive()) return;
        tw.drop(s.k, s.drama, s.k === n);
        if (!i) {
          // My points make room, and the bonus appears under the tower.
          glide(base, centre, left, 300, EASE.out);
          bonus.style.opacity = '';
          bonus.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
        }
        await wait(LAND);
        if (!alive()) return;
        const d = s.drama;
        const hit = middle(bonusText);
        const tint = colour(lookOf(s.k).tint);
        count(bonusOf(s.k), s.k);
        bonusText.animate([{ scale: 1.12 + 0.45 * d }, { scale: 1 }], { duration: 360, easing: EASE.bounce });
        ring({ ...hit, from: 10, to: 55 + 110 * d, life: 0.35 + 0.2 * d, width: 4 + 8 * d, tint, strength: 0.5 + 0.4 * d });
        spray(hit, tint, 4 + Math.round(28 * d), 60 + 60 * d);
        if (d > 0.3) jolt([screen, top], 0.5 + 6 * d);
        if (d > 0.6) flash(0.06 + 0.2 * d, 240);
        buzz(d < 0.35 ? 'tap' : d < 0.8 ? 'yes' : 'land');
      }
      await wait(260);
      if (!alive()) return;

      // The tower is swallowed by the bonus, which slides into my points; they meet in the middle and the points count up.
      const look = lookOf(n);
      const tint = colour(look.tint);
      const swallowed = tw.swallow(middle(bonusText));
      await wait(220);
      const stream = inflow({ ...middle(baseText), x: X, y: restY - lineH / 2, tint, reach: 150, rate: 90 });
      bonusText.animate([{ scale: 1, opacity: 1 }, { scale: 0.55, opacity: 0 }], { duration: 380, easing: 'ease-in', fill: 'forwards' });
      glide(bonus, right, centre, 380, 'ease-in');
      await glide(base, left, centre, 380, 'ease-in');
      stream.stop();
      await swallowed;
      const there = { x: X, y: restY - lineH / 2 };
      baseText.animate([{ scale: 1.45 }, { scale: 1 }], { duration: 480, easing: EASE.bounce });
      ring({ ...there, from: 14, to: 130, life: 0.55, width: 10, tint, strength: 0.9 });
      spray(there, tint, look.sparks, 120);
      coins(there, 110);
      if (look.flash) flash(look.flash, 280);
      jolt([screen, top], look.shake);
      buzz(look.felt);
      slot.innerHTML = badge(n);
      slot.firstElementChild.animate([{ scale: 1.7 }, { scale: 1 }], { duration: 440, easing: EASE.bounce });
      await tween(460, (t) => {
        baseText.textContent = `+${Math.round(g.base + g.bonus * t)}`;
      }, outCubic);
      await wait(380);
    } else await wait(600);
    if (!alive()) return;

    // The total pulses once and fades out where it stands.
    const last = { x: X, y: restY };
    await base.animate([{ translate: `${last.x}px ${last.y}px`, opacity: 1, scale: 1 }, { translate: `${last.x}px ${last.y}px`, opacity: 1, scale: 1.12, offset: 0.25 }, { translate: `${last.x}px ${last.y - 20}px`, opacity: 0, scale: 0.82 }], { duration: 420, easing: 'ease-in', fill: 'forwards' }).finished;
  } finally {
    top.remove();
    if (n > 1) slot.innerHTML = badge(n);
    screen.removeAttribute('data-playing');
  }
}
