/**
 * Who shot it?: the answer of a round, played like a jackpot. Time is up, the cards look
 * alike (my pick still yellow), and a frame of white light jumps from card to card, fast at
 * first, then slower and slower; the last hops tick. It stops one card too early: on my
 * pick when I was wrong (a moment of hope), on someone else when I was right. The light
 * goes out, nothing moves; then it creeps on and clicks onto the owner. A blink of
 * stillness, and the result: the owner's card turns green with a ring of light and its ✓
 * stamped on. Right: jackpot, gold coins spray out of my card, my points rise off it, one
 * firm pulse. Wrong: my card turns red and shakes, two pulses.
 *
 * Mechanisms: views.js paints the reveal in its final state; this holds the result back
 * (`data-playing` on the screen) and lets each card go (`data-go`), which plays its
 * entrance. The light is one element (style.css `rv-seek`) moved with `translate`; the
 * ring, the sparks and the coins are the app's canvas (web/js/sparks.js).
 *
 * Invariants:
 * - The rhythm is the same for everyone (each phone stops one card early, on its own near
 *   miss), so all phones show the owner at the same moment.
 * - The light never stops on the owner before the end, and never comes to the near miss
 *   from the owner, so the stop cannot give the answer away.
 * - It takes about 1.5 s of the reveal's 3.5 s (TIMING.revealMs), so in the app the
 *   reveal would get a second more.
 */
import { colour, flash, ring, spark } from '/js/sparks.js';
import { buzz, wait } from '/kit/screen.js';
import { EASE, centre, runTimer, sparkle } from './moves.js';

/**
 * The search: hops up to the stop, the first and the last gap between two hops (ms), how
 * many of the last hops tick, the moment it rests on the near miss before going out, how
 * long it then holds, its creep (a share of the way) and its click on to the owner (ms),
 * and the blink of stillness before the result: about 1.5 s in all.
 */
const SEARCH = { hops: 8, first: 50, last: 200, ticks: 4, settle: 90, hold: 260, creep: 160, creepShare: 0.28, click: 130, still: 60 };
/** The result: the owner's sparks, the coins of a right guess, when the reactions come, the reveal's time. */
const RESULT = { sparks: 16, coins: 26, after: 650, revealMs: 3500 };

/** The light's path: random cards, never the same twice in a row, ending on the near miss, coming to it from neither it nor the owner. */
function route(count, near, owner) {
  const seq = new Array(SEARCH.hops);
  seq[SEARCH.hops - 1] = near;
  const pick = (ok) => {
    const options = [...Array(count).keys()].filter(ok);
    return options[Math.floor(Math.random() * options.length)];
  };
  seq[SEARCH.hops - 2] = pick((i) => i !== near && i !== owner);
  for (let h = SEARCH.hops - 3; h >= 0; h -= 1) seq[h] = pick((i) => i !== seq[h + 1]);
  return seq;
}

/** The light over the cards, as big as one (a little bigger), with the cards' rounding; `to(i, ms, easing)` moves it onto card `i`. */
function light(cards) {
  const spots = cards.map((c) => c.getBoundingClientRect());
  const pad = 3;
  const el = document.createElement('i');
  el.className = 'rv-seek';
  const round = parseFloat(getComputedStyle(cards[0]).borderTopLeftRadius) || 0;
  el.style.cssText = `width:${spots[0].width + 2 * pad}px;height:${spots[0].height + 2 * pad}px;border-radius:${round + pad}px`;
  document.body.append(el);
  let at = null;
  const place = (x, y, ms, easing) => {
    const next = `${x - pad}px ${y - pad}px`;
    const move = at && ms ? el.animate([{ translate: at }, { translate: next }], { duration: ms, easing }).finished : Promise.resolve();
    el.style.translate = next;
    at = next;
    return move;
  };
  return {
    el,
    to: (i, ms = 0, easing = EASE.out) => place(spots[i].left, spots[i].top, ms, easing),
    /** A share `k` of the way from card `i` to card `j`. */
    toward: (i, j, k, ms, easing) => place(spots[i].left + (spots[j].left - spots[i].left) * k, spots[i].top + (spots[j].top - spots[i].top) * k, ms, easing),
  };
}

/** Jackpot: gold coins spray up out of the card and fall, and the points rise off it. */
function jackpot(at, points) {
  for (let i = 0; i < RESULT.coins; i += 1) {
    spark({ x: at.x + (Math.random() - 0.5) * at.r.width * 0.6, y: at.y, vx: (Math.random() - 0.5) * 340, vy: -330 - Math.random() * 230, drag: 0.4, gravity: 1100, life: 0.75 + Math.random() * 0.3, size: 3.4, tint: colour(i % 3 ? 'yellow' : 'p11'), hot: 0.2 });
  }
  const el = document.createElement('b');
  el.className = 'pointer-events-none fixed z-25 font-display text-6xl leading-none font-extrabold text-yellow animate-rv-rise';
  el.style.cssText = `left:${at.x}px;top:${at.r.top}px`;
  el.textContent = `+${points}`;
  document.body.append(el);
  setTimeout(() => el.remove(), 1300);
}

export async function reveal(screen, g) {
  // In the same task as the paint: no frame shows the result first.
  screen.setAttribute('data-playing', '');
  const cards = [...screen.querySelectorAll('[data-card]')];
  const index = (id) => cards.findIndex((c) => c.dataset.card === id);
  const me = g.players.find((p) => p.id === g.me);
  const owner = index(g.owner);
  const right = me.pick === g.owner;
  // The near miss: my pick when I was wrong; else anyone but the owner.
  const others = cards.map((_, i) => i).filter((i) => i !== owner);
  const near = !right && me.pick ? index(me.pick) : others[Math.floor(Math.random() * others.length)];
  runTimer(RESULT.revealMs);

  const seek = light(cards);
  const path = route(cards.length, near, owner);
  seek.to(path[0]);
  seek.el.animate([{ opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 }], { duration: 140, easing: EASE.out });
  for (let h = 1; h < SEARCH.hops; h += 1) {
    const gap = SEARCH.first + (SEARCH.last - SEARCH.first) * (h / (SEARCH.hops - 1)) ** 1.6;
    await wait(gap);
    seek.to(path[h], Math.min(90, gap * 0.7));
    if (h >= SEARCH.hops - SEARCH.ticks) buzz('tap');
  }
  // One card too early: the light goes out and nothing moves; then it creeps on, and clicks onto the owner.
  await wait(SEARCH.settle);
  seek.el.setAttribute('data-off', '');
  await wait(SEARCH.hold);
  await seek.toward(near, owner, SEARCH.creepShare, SEARCH.creep, EASE.in);
  seek.el.removeAttribute('data-off');
  await seek.to(owner, SEARCH.click, EASE.bounce);
  await wait(SEARCH.still);

  // The result.
  seek.el.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 1.18 }], { duration: 300, easing: 'ease-out', fill: 'forwards' }).finished.then(() => seek.el.remove());
  const card = cards[owner];
  card.setAttribute('data-go', '');
  const at = centre(card);
  ring({ x: at.x, y: at.y, from: 16, to: Math.max(at.r.width, at.r.height) * 0.9, life: 0.55, width: 10, tint: colour('green'), strength: 0.85 });
  sparkle(at, colour('green'), RESULT.sparks, 70);
  if (right) {
    jackpot(at, me.points);
    flash(0.18, 300);
    buzz('yes');
  } else {
    if (me.pick) cards[index(me.pick)].setAttribute('data-go', '');
    buzz('no');
  }
  await wait(RESULT.after);
  screen.querySelector('[data-after]').setAttribute('data-go', '');
  screen.removeAttribute('data-playing');
}
