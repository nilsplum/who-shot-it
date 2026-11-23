/**
 * Who shot it?: the answer of a round, at once. Time is up; for a blink the cards still look
 * as they did (my pick yellow), then the result lands: the owner's card turns green with
 * its ✓ stamped on, and my own card pops with my result. Right (my card is the owner's): a
 * ring of green light and green sparks, gold coins spray out of it, my points rise off it,
 * one firm pulse. Wrong: my card turns red with its ✗ stamped on and shakes, a ring of red
 * light and red sparks, and "+0" rises off it in red, two pulses. Without an answer there is
 * no card of mine: only the owner's turns green.
 *
 * Mechanisms: views.js paints the reveal in its final state; this holds the result back
 * (`data-playing` on the screen) and lets each card go (`data-go`), which plays its
 * entrance. The rings, the sparks and the coins are the app's canvas (web/js/sparks.js).
 *
 * Invariants: the pop is always on my own card, in the colour of my result, so the phone
 * first says how I did; the result lands on every phone at the same moment.
 */
import { colour, flash, ring, spark } from '/js/sparks.js';
import { buzz, wait } from '/kit/screen.js';
import { centre, runTimer, sparkle } from './moves.js';

/** The result: the blink before it, the pop's sparks, the coins of a right guess, when the reactions come, the reveal's time. */
const RESULT = { hold: 300, sparks: 16, coins: 26, after: 650, revealMs: 3500 };

/** How my result pops: its light's colour, its number's (whole class names, so Tailwind builds them), its vibration. */
const POP = {
  right: { tint: 'green', number: 'text-yellow', felt: 'yes' },
  wrong: { tint: 'red', number: 'text-red', felt: 'no' },
};

/** My card pops: a ring of light and sparks in the result's colour, and the points it won rising off it. */
function pop(card, look, points) {
  const at = centre(card);
  const tint = colour(look.tint);
  ring({ x: at.x, y: at.y, from: 16, to: Math.max(at.r.width, at.r.height) * 0.9, life: 0.55, width: 10, tint, strength: 0.85 });
  sparkle(at, tint, RESULT.sparks, 70);
  const el = document.createElement('b');
  el.className = `pointer-events-none fixed z-25 font-display text-6xl leading-none font-extrabold animate-rv-rise ${look.number}`;
  el.style.cssText = `left:${at.x}px;top:${at.r.top}px`;
  el.textContent = `+${points}`;
  document.body.append(el);
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

  // The result: the owner's card turns green, and mine pops in my result's colour.
  card(g.owner).setAttribute('data-go', '');
  if (me.pick === g.owner) {
    coins(pop(card(g.owner), POP.right, me.points));
    flash(0.18, 300);
  } else if (me.pick) {
    const mine = card(me.pick);
    mine.setAttribute('data-go', '');
    pop(mine, POP.wrong, 0);
  }
  await wait(RESULT.after);
  screen.querySelector('[data-after]').setAttribute('data-go', '');
  screen.removeAttribute('data-playing');
}
