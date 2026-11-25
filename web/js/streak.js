/**
 * The story of a streak on the reveal ("Tower", chosen from drafts/streak_animations): when my
 * right answer earned a streak bonus, my points do not rise off my card and fade. They settle
 * just above the streak's badge at the bottom of the photo, slide aside, and to their right a
 * second number appears, the bonus, under a tower of blocks. A block drops in for every
 * number of the streak, 2, 3, 4 and on, each a little later and a little more lively than the
 * one before, and shows what that number adds (+100, "MAX" once the bonus is capped); the
 * bonus counts up with every block, in a colour that warms with the streak. When the tower is
 * done, the bonus slides into my points, which count up with a pop, a ring of light and a few
 * coins; the badge ticks to the new number. Then the total pulses once and fades out where it
 * stands.
 *
 * Mechanisms: `reveal.js` calls `playStreak` at the pop of my card (the same moment its rising
 * word would start), with what the room said (`results[me]`: `points`, `streak`, `bonus`; the
 * app never recomputes a rule, it only scales the steps of `streakBonus` to the bonus it was
 * told, which is smaller when the "Own photo" share cut it). The numbers and the tower are
 * elements of a layer over the screen (`fixed`, inside the screen, so they go with it); a
 * number is a pin whose wrapper moves and whose text is counted and scaled, so counting never
 * moves it. The badge is `ui.js` `streakBadge`, painted by `views/game.js` in its slot, swapped
 * here for the number it had before the round until the bonus arrives. The light is the
 * sparks canvas (`sparks.js`).
 *
 * Invariants:
 * - The story takes `storyMs(streak)` from the pop on, and `streakExtraMs` (`web/shared/config.js`)
 *   gives the reveal the time it needs, which `test/unit/streak.test.js` holds for every streak.
 * - It adds nothing the room did not say: the bonus ends exactly on `bonus`, the total on
 *   `points`, whatever the cap or the "Own photo" share did.
 * - Nothing leaves the photo: the numbers stand above the badge, a block never starts its fall
 *   above the photo, the tower is drawn smaller on a small phone (`u`) and has at most BLOCKS
 *   blocks, however long the streak is.
 * - Every step first checks that the screen is still on; the story always ends with its layer
 *   gone and the badge at my streak.
 * - With Reduce Motion `reveal.js` does not call it: the result simply stays.
 */
import { SCORING, streakBonus } from '../shared/config.js';
import { EASE, outCubic, tween, wait } from './motion.js';
import { coins, colour, flash, inflow, middle, ring, spray } from './sparks.js';
import { streakBadge, streakLook } from './ui.js';

/** The streak number where the bonus is capped: the numbers up to it each get a block (then, for a longer streak, the streak's own number). */
const CAP_AT = SCORING.streakMax / SCORING.streakStep + 1;
/** The most blocks standing at once, the distance between two (px, before the phone's scale) and the time a block takes to land (ms). */
const BLOCKS = 4;
const PITCH = 31;
const LAND = 220;
/** The story's other times (ms): my points settling, the beat after the last block, the tower being swallowed, the bonus sliding into my points, their count, the total's stay and its fade. */
const SETTLE = 280;
const BEAT = 160;
const SWALLOW = 160;
const SLIDE = 300;
const COUNT = 360;
const HOLD = 240;
const FADE = 300;
/** A block's colour by its number, written out whole so Tailwind builds them. */
const FILLS = ['bg-green', 'bg-yellow', 'bg-p6', 'bg-coral', 'bg-p8', 'bg-violet'];

/** How lively the number `k` is, 0 to 1: a streak of 2 is a small thing, from 7 on the story is at its liveliest. */
const drama = (k) => Math.min(1, 0.15 + 0.17 * (k - 2));

/** The blocks of a streak of `streak`: each with its number, how lively it is and the pause before it drops (it grows). */
function blocksFor(streak) {
  const upTo = Math.min(streak, CAP_AT);
  const numbers = Array.from({ length: upTo - 1 }, (_, i) => i + 2);
  if (streak > upTo) numbers.push(streak);
  return numbers.map((k, i) => ({ k, drama: drama(k), gap: i ? 60 + 30 * i : 80 }));
}

/** How long the story takes from the pop of my card on (ms), for a streak of `streak`. */
export const storyMs = (streak) => SETTLE + blocksFor(streak).reduce((sum, b) => sum + b.gap + LAND, 0) + BEAT + SWALLOW + SLIDE + COUNT + HOLD + FADE;

/** A number of the line over the photo: its text is what is counted and scaled, its wrapper (the pin) is what moves. */
const figure = (text, look) => `<b class="absolute -translate-x-1/2 -translate-y-full font-display text-5xl leading-none font-extrabold tabular-nums streak-points ${look}">${text}</b>`;

/** An element that sits at `to` (the screen's pixels) in `parent`; its `translate` moves it and what it holds is laid out around that point. */
function pin(parent, html, to) {
  const el = document.createElement('div');
  el.className = 'absolute top-0 left-0';
  el.style.translate = `${to.x}px ${to.y}px`;
  el.innerHTML = html;
  parent.append(el);
  return el;
}

/** Moves a pin from `from` to `to` over `ms`; its place afterwards is `to`. */
function glide(el, from, to, ms, easing) {
  el.style.translate = `${to.x}px ${to.y}px`;
  return el.animate([{ translate: `${from.x}px ${from.y}px` }, { translate: `${to.x}px ${to.y}px` }], { duration: ms, easing }).finished;
}

/**
 * How far `el` has to move, in the units of its group (drawn at `u` of its size), to have its
 * middle at `to` (the screen's pixels).
 */
function toward(el, to, u) {
  const at = middle(el);
  return { x: (to.x - at.x) / u, y: (to.y - at.y) / u };
}

/**
 * A tower of blocks in `grp` (a pin drawn at `u`), with `room` of photo above its foot (in its
 * own units). `drop` puts the next block on top and returns after it has landed, `swallow`
 * lets the number below take the whole tower.
 */
function tower(grp, u, room, label) {
  const blocks = [];
  /** Where block number `i` stands: a little off the middle, one way then the other. */
  const spot = (i) => ({ x: i % 2 ? 4 : -4, y: -i * PITCH });
  const place = (i) => `${spot(i).x}px ${spot(i).y}px`;
  const sway = (amount) => grp.animate([{ rotate: '0deg' }, { rotate: `${-amount}deg` }, { rotate: `${amount * 0.6}deg` }, { rotate: `${-amount * 0.25}deg` }, { rotate: '0deg' }], { duration: 520, easing: EASE.out });

  /** A block for the number `k`: the number and what it adds ("MAX" when nothing), a crown once the bonus is capped. */
  function block(k) {
    const step = label(k);
    const crown = (k - 1) * SCORING.streakStep >= SCORING.streakMax ? '<i class="absolute -top-3 right-2 text-sm leading-none not-italic" aria-hidden="true">👑</i>' : '';
    return `<div class="absolute -mt-7 -ml-12 flex h-7 w-24 items-center justify-between rounded-lg ${FILLS[(k - 2) % FILLS.length]} px-2.5 font-display font-extrabold text-navy streak-edge"><span class="text-xl leading-none">${k}</span><span class="text-base leading-none tabular-nums">${step ? `+${step}` : 'MAX'}</span>${crown}</div>`;
  }

  /** Block `k` drops in on top, `lively` (0 to 1) deciding how high it falls and how hard it squashes; the lowest block of a full tower is knocked out sideways. */
  async function drop(k, lively, last) {
    if (blocks.length === BLOCKS) {
      const lowest = blocks.shift();
      const side = k % 2 ? 120 : -120;
      lowest.animate([{ translate: lowest.style.translate, rotate: lowest.style.rotate, opacity: 1 }, { translate: `${side}px 16px`, rotate: `${side / 3}deg`, opacity: 0 }], { duration: 300, easing: 'ease-in' }).finished.then(() => lowest.remove());
      blocks.forEach((b, i) => {
        b.animate([{ translate: b.style.translate }, { translate: place(i) }], { duration: 200, easing: EASE.out });
        b.style.translate = place(i);
      });
    }
    const i = blocks.length;
    const holder = document.createElement('div');
    holder.innerHTML = block(k);
    const piece = holder.firstElementChild;
    piece.style.translate = place(i);
    piece.style.rotate = `${i % 2 ? 1.2 : -1.2}deg`;
    grp.append(piece);
    blocks.push(piece);
    // As high as the story wants, but never above the top of the photo (a block is 28 tall).
    const height = Math.max(36, Math.min(110 + 60 * lively, room + spot(i).y - 28));
    const squash = 1.06 + 0.14 * lively;
    piece.animate([{ translate: `${spot(i).x}px ${spot(i).y - height}px` }, { translate: place(i), offset: 0.72, easing: EASE.out }, { translate: place(i) }], { duration: LAND, easing: 'ease-in' });
    piece.animate([{ scale: '1' }, { scale: '1', offset: 0.72 }, { scale: `${squash} ${2 - squash}`, offset: 0.8 }, { scale: `${2 - squash * 0.9} ${squash * 0.92}`, offset: 0.9 }, { scale: last ? '1.08' : '1' }], { duration: LAND, fill: 'forwards' });
    setTimeout(() => sway(0.5 + 0.8 * lively + 0.2 * blocks.length), LAND * 0.78);
    await wait(LAND);
  }

  /** The tower is swallowed by `target` (a point of the screen): its blocks shrink into it, lowest first. */
  function swallow(target) {
    return Promise.all(blocks.map((b, i) => {
      const d = toward(b, target, u);
      return b.animate([{ translate: place(i), opacity: 1 }, { translate: `${spot(i).x + d.x}px ${spot(i).y + d.y}px`, scale: 0.25, rotate: `${i % 2 ? 40 : -40}deg`, opacity: 0 }], { duration: 300, delay: i * 40, easing: 'ease-in', fill: 'forwards' }).finished;
    }));
  }

  return { drop, swallow };
}

/**
 * Tells my streak's story over `screen`, the reveal just painted in its final state, from the
 * pop of my card (`at`, `box`: its middle and its box). `base` is my points without the
 * streak, `bonus` what the streak earned, `streak` how long it is (2 or more, `bonus` above 0);
 * `buzz` (phone.js) makes the tower's landings and the bonus's arrival felt.
 */
export async function playStreak(screen, { at, box, base, bonus, streak }, buzz) {
  const alive = () => screen.isConnected;
  const stage = screen.querySelector('[data-part="stage"]').getBoundingClientRect();
  const slot = screen.querySelector('[data-streak-slot]');
  const layer = document.createElement('div');
  layer.className = 'pointer-events-none fixed inset-0 z-25 overflow-hidden';
  layer.setAttribute('aria-hidden', 'true');
  screen.append(layer);
  // The badge shows the streak I had before this round until the bonus is added.
  if (slot) slot.innerHTML = streak > 2 ? streakBadge(streak - 1) : '';
  try {
    const look = streakLook(streak);
    const u = Math.min(1, stage.height / 360);
    // The line of numbers stands right above the badge's slot (at the bottom of the photo when there is none).
    const restY = (slot ? slot.getBoundingClientRect().top : stage.bottom - 40) - 6;
    const figures = pin(layer, figure(`+${base}`, 'text-yellow'), { x: at.x, y: box.top + 2 });
    const bonusFigure = pin(layer, figure('+500', 'streak-bonus'), { x: 0, y: restY });
    const baseText = figures.firstElementChild;
    const bonusText = bonusFigure.firstElementChild;
    const baseW = baseText.offsetWidth;
    const lineH = baseText.offsetHeight;
    // My points and the bonus side by side around X, which keeps both and the tower on the screen.
    const apart = (baseW + bonusText.offsetWidth) / 2 + 14;
    const room = Math.max(bonusText.offsetWidth / 2, 50 * u);
    const lo = 8 + apart / 2 + baseW / 2;
    const hi = innerWidth - 8 - apart / 2 - room;
    const X = lo < hi ? Math.min(Math.max(at.x, lo), hi) : innerWidth / 2;
    const centre = { x: X, y: restY };
    const left = { x: X - apart / 2, y: restY };
    const right = { x: X + apart / 2, y: restY };
    glide(figures, { x: at.x, y: box.top + 2 }, centre, SETTLE, EASE.out);
    baseText.animate([{ scale: 0.5, opacity: 0 }, { scale: 1.12, opacity: 1, offset: 0.4 }, { scale: 1 }], { duration: 440, easing: EASE.out });
    bonusFigure.style.translate = `${right.x}px ${right.y}px`;
    bonusFigure.style.opacity = '0';
    bonusText.textContent = '+0';

    const foot = restY - lineH - 10;
    const grp = pin(layer, '', { x: right.x, y: foot });
    grp.style.scale = String(u);
    // What the room paid is what is told: the steps of the formula, scaled to the bonus it said (less than the formula's when "Own photo" cut it).
    const scale = bonus / streakBonus(streak);
    const told = (k) => (k >= streak ? bonus : Math.round(streakBonus(k) * scale));
    // Past the cap a block adds nothing ("MAX"), whatever rounding the share left in the last count.
    const step = (k) => (k > CAP_AT ? 0 : Math.max(0, told(k) - (k > 2 ? told(k - 1) : 0)));
    const stack = tower(grp, u, (foot - stage.top) / u, step);
    let shown = 0;
    /** The bonus counts up to `to` in the colour of the number `k`'s tier. */
    const count = (to, k) => {
      const from = shown;
      shown = to;
      bonusText.style.setProperty('--tone', `var(--color-${streakLook(k).tint})`);
      return tween(260, (t) => {
        bonusText.textContent = `+${Math.round(from + (to - from) * t)}`;
      }, outCubic);
    };

    // The tower grows block by block, each later and livelier, the bonus counting up with it.
    await wait(SETTLE);
    const blocks = blocksFor(streak);
    for (const [i, b] of blocks.entries()) {
      await wait(b.gap);
      if (!alive()) return;
      const last = i === blocks.length - 1;
      const landing = stack.drop(b.k, b.drama, last);
      if (!i) {
        // My points make room, and the bonus appears under the tower.
        glide(figures, centre, left, 260, EASE.out);
        bonusFigure.style.opacity = '';
        bonusFigure.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 });
      }
      await landing;
      if (!alive()) return;
      const d = b.drama;
      const hit = middle(bonusText);
      const tint = colour(streakLook(b.k).tint);
      count(told(b.k), b.k);
      bonusText.animate([{ scale: 1.08 + 0.25 * d }, { scale: 1 }], { duration: 320, easing: EASE.bounce });
      ring({ ...hit, from: 8, to: 36 + 60 * d, life: 0.3 + 0.15 * d, width: 3 + 4 * d, tint, strength: 0.4 + 0.3 * d });
      spray(hit, tint, 3 + Math.round(12 * d), 45 + 35 * d);
      // A light tap for the first block and every second one after it, and for the last.
      if (i % 2 === 0 || last) buzz('tap');
    }
    await wait(BEAT);
    if (!alive()) return;

    // The tower is swallowed by the bonus, which slides into my points; they meet in the middle and the points count up.
    const tint = colour(look.tint);
    const swallowed = stack.swallow(middle(bonusText));
    await wait(SWALLOW);
    const stream = inflow({ x: X, y: restY - lineH / 2, tint, reach: 110, rate: 50 });
    bonusText.animate([{ scale: 1, opacity: 1 }, { scale: 0.6, opacity: 0 }], { duration: SLIDE, easing: 'ease-in', fill: 'forwards' });
    glide(bonusFigure, right, centre, SLIDE, 'ease-in');
    await glide(figures, left, centre, SLIDE, 'ease-in');
    stream.stop();
    await swallowed;
    const there = { x: X, y: restY - lineH / 2 };
    baseText.animate([{ scale: 1.3 }, { scale: 1 }], { duration: 420, easing: EASE.bounce });
    ring({ ...there, from: 10, to: 80, life: 0.45, width: 7, tint, strength: 0.7 });
    spray(there, tint, 6 + 4 * look.level, 75);
    coins(there, 80, 8 + 3 * look.level);
    if (look.level >= 3) flash(0.08, 240);
    buzz(look.level >= 3 ? 'land' : 'yes');
    if (slot) {
      slot.innerHTML = streakBadge(streak);
      slot.firstElementChild.animate([{ scale: 1.5 }, { scale: 1 }], { duration: 400, easing: EASE.bounce });
    }
    await tween(COUNT, (t) => {
      baseText.textContent = `+${Math.round(base + bonus * t)}`;
    }, outCubic);
    await wait(HOLD);
    if (!alive()) return;

    // The total pulses once and fades out where it stands.
    await figures.animate([{ translate: `${X}px ${restY}px`, opacity: 1, scale: 1 }, { translate: `${X}px ${restY}px`, opacity: 1, scale: 1.1, offset: 0.25 }, { translate: `${X}px ${restY - 16}px`, opacity: 0, scale: 0.85 }], { duration: FADE, easing: 'ease-in', fill: 'forwards' }).finished;
  } finally {
    layer.remove();
    if (slot) slot.innerHTML = streakBadge(streak);
  }
}
