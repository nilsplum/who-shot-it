/**
 * Who shot it?: the answer of a round, one step after the other. Time is up; for a blink the
 * cards still look as they did (my pick yellow). First the answer: the owner's card turns
 * green with its ✓ stamped on. Then, when I was wrong, my card turns red with its ✗ stamped
 * on and shakes. Then my own card pops with my result. Right (my card is the owner's): a
 * ring of green light and green sparks, gold coins spray out of it, my points rise off it,
 * one firm pulse. Wrong: a ring of red light and red sparks, and "Wrong" rises off it in
 * red, two pulses. Without an answer there is no card of mine: only the owner's turns green.
 *
 * Mechanisms: views.js paints the reveal in its final state; this holds the result back
 * (`data-playing` on the screen) and lets each card go (`data-go`), which plays its
 * entrance. The rings, the sparks and the coins are the app's canvas (web/js/sparks.js).
 *
 * Invariants: the answer always comes first and the pop last, on my own card, in the
 * colour of my result; every step lands on every phone at the same moment.
 */
import { colour, flash, ring, spark } from '/js/sparks.js';
import { buzz, wait } from '/kit/screen.js';
import { centre, runTimer, sparkle } from './moves.js';

/**
 * The result: the blink before it, the time between its steps (the green card, my red card,
 * the pop), the pop's sparks, the coins of a right guess, when the reactions come after the
 * pop, the reveal's time.
 */
const RESULT = { hold: 300, step: 400, sparks: 16, coins: 26, after: 650, revealMs: 3500 };

/** How my result pops: its light's colour, its word's colour (whole class names, so Tailwind builds them), its vibration. */
const POP = {
  right: { tint: 'green', word: 'text-yellow', felt: 'yes' },
  wrong: { tint: 'red', word: 'text-red', felt: 'no' },
};

/** My card pops: a ring of light and sparks in the result's colour, and `word` rising off it (my points, or "Wrong"). */
function pop(card, look, word) {
  const at = centre(card);
  const tint = colour(look.tint);
  ring({ x: at.x, y: at.y, from: 16, to: Math.max(at.r.width, at.r.height) * 0.9, life: 0.55, width: 10, tint, strength: 0.85 });
  sparkle(at, tint, RESULT.sparks, 70);
  const el = document.createElement('b');
  el.className = `pointer-events-none fixed z-25 font-display text-6xl leading-none font-extrabold animate-rv-rise ${look.word}`;
  el.style.cssText = `left:${at.x}px;top:${at.r.top}px`;
  el.textContent = word;
  document.body.append(el);
  // Over the card's middle, but never past the screen's edge (a card at the edge, a long word).
  const half = el.offsetWidth / 2 + 8;
  el.style.left = `${Math.min(Math.max(at.x, half), innerWidth - half)}px`;
  setTimeout(() => el.remove(), 1300);
  buzz(look.felt);
  return at;
}

/** Jackpot: gold coins spray up out of the card and fall. */
function coins(at) {
  for (let i = 0; i < RESULT.coins; i += 1) {
    spark({ x: at.x + (Math.random() - 0.5) * at.r.width * 0.6, y: at.y, vx: (Math.random() - 0.5) * 340, vy: -330 - Math.random() * 230, drag: 0.4, gravity: 1100, life: 0.75 + Math.random() * 0.3, size: 3.4, tint: colour(i % 3 ? 'yellow' : 'p11'), hot: 0.2 });
  }
}

export async function reveal(screen, g) {
  // In the same task as the paint: no frame shows the result first.
  screen.setAttribute('data-playing', '');
  const card = (id) => screen.querySelector(`[data-card="${id}"]`);
  const me = g.players.find((p) => p.id === g.me);
  runTimer(RESULT.revealMs);
  await wait(RESULT.hold);

  // First the answer: the owner's card turns green.
  card(g.owner).setAttribute('data-go', '');
  if (me.pick === g.owner) {
    // Right: then my card, the green one, pops.
    await wait(RESULT.step);
    coins(pop(card(g.owner), POP.right, `+${me.points}`));
    flash(0.18, 300);
  } else if (me.pick) {
    // Wrong: then my card turns red, then it pops.
    const mine = card(me.pick);
    await wait(RESULT.step);
    mine.setAttribute('data-go', '');
    await wait(RESULT.step);
    pop(mine, POP.wrong, 'Wrong');
  }
  await wait(RESULT.after);
  screen.querySelector('[data-after]').setAttribute('data-go', '');
  screen.removeAttribute('data-playing');
}
