/**
 * The reveal of a round, one step after the other ("Who shot it?", chosen from
 * drafts/reveal_animations). For a blink the cards still look as they did in the round (my
 * pick yellow). First the answer: the owner's card turns green and pops, its ✓ stamped on.
 * Then, when I was wrong, my card turns red with its ✗ and shakes. Then my own card pops in
 * my result's colour: right, a ring of green light and green sparks, gold coins spraying out
 * of it, a soft flash, and my points rising off it; wrong, a ring of red light, red sparks
 * and "Wrong" rising off it. The verdict is felt with the pop: one firm pulse right, two for
 * anything else (also without an answer, when there is no card of mine to pop). Then the
 * reactions come. When my right answer earned a streak bonus, my points do not rise off my
 * card: they stay, and the story of my streak is told with them (`streak.js`); until then my
 * streak's badge shows what it was before this round, from the first frame on, so it changes
 * only once, as the bonus arrives.
 *
 * Mechanisms: main.js `startReveal` calls `playReveal` once per round's reveal
 * (`session.shown`), in the same task as the reveal is painted in its final state
 * (views/game.js), so no frame shows the result first. It holds the result back with
 * `data-playing` on the screen (the `reveal-` utilities in styles/app.css) and lets each
 * piece go with `data-go`, which plays its entrance. The light is the sparks canvas
 * (sparks.js); the rising word is an element of the screen, so it goes with the screen. The
 * streak's story starts at the pop (`POP_MS` into the reveal) and runs on by itself, past
 * the reactions, for as long as it takes (`streak.storyMs`); the room gives the reveal the
 * time for it (`streakExtraMs`, `src/game/state.js` `timerMs`).
 *
 * Invariants:
 * - The answer comes first and the pop last, the same on every phone (they all get the
 *   reveal at once), and all of it about 1.8 s at most: well inside the reveal's 3.5 s
 *   (TIMING.revealMs); only a streak's story runs longer, within the time the room adds.
 * - Every step finds its card anew and first checks that the screen is still on (the
 *   leaderboard or a left game replace it): a card repainted meanwhile (someone left) shows
 *   its final state when the story ends, which always lets go of the screen.
 * - With Reduce Motion main.js does not call it: the result simply stays, and main.js makes
 *   the verdict felt at once.
 */
import { wait } from './motion.js';
import { playStreak, showStreak } from './streak.js';
import { coins, colour, flash, ring, spray } from './sparks.js';

/** The steps' times (ms): the blink before the answer, between the answer, my red card and the pop, and from the pop to the reactions. */
const STEPS = { hold: 300, step: 400, after: 650 };
/** When my card pops when I was right, from the start of the reveal: the streak's story starts then. */
export const POP_MS = STEPS.hold + STEPS.step;
/** The pop: its sparks, a right guess's coins, the soft flash's strength and time. */
const POP = { sparks: 16, coins: 26, flash: 0.18, flashMs: 300 };
/** How my result pops: its light's colour and its word's (whole class names, so Tailwind builds them). */
const LOOKS = {
  right: { tint: 'green', word: 'text-yellow' },
  wrong: { tint: 'red', word: 'text-red' },
};

/**
 * `card` pops: a ring of light and sparks in the result's colour, and `word` rising off it
 * (none when my streak's story tells the points instead), over its middle but never past the
 * screen's edge (a card at the edge, a long word). Returns where the card is.
 */
function pop(screen, card, look, word) {
  const box = card.getBoundingClientRect();
  const at = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  const tint = colour(look.tint);
  ring({ ...at, from: 16, to: Math.max(box.width, box.height) * 0.9, life: 0.55, width: 10, tint, strength: 0.85 });
  spray(at, tint, POP.sparks, 70);
  if (word) {
    const el = document.createElement('b');
    el.className = `pointer-events-none fixed z-25 font-display text-6xl leading-none font-extrabold animate-result ${look.word}`;
    el.style.top = `${box.top}px`;
    el.textContent = word;
    screen.append(el);
    const half = el.offsetWidth / 2 + 8;
    el.style.left = `${Math.min(Math.max(at.x, half), innerWidth - half)}px`;
    el.addEventListener('animationend', () => el.remove());
  }
  return { at, box };
}

/**
 * Plays the reveal over `screen`, the round's screen just painted in its final state.
 * `verdict` is 'right', 'wrong' or 'none' (no answer), `points` what my answer won, `streak`
 * and `bonus` my streak after it and the part of the points it earned (0: none, as the room
 * said); `buzz` (phone.js) makes the verdict felt as my card pops.
 */
export async function playReveal(screen, { verdict, points, streak = 0, bonus = 0 }, buzz) {
  const alive = () => screen.isConnected;
  const card = (name) => screen.querySelector(`[data-card="${name}"]`);
  screen.setAttribute('data-playing', '');
  // A streak's story to come: its badge shows the streak before this round until the bonus arrives (none before a first streak).
  if (bonus > 0) showStreak(screen, streak - 1);
  try {
    await wait(STEPS.hold);
    if (!alive()) return;
    // First the answer.
    const owner = card('owner');
    if (owner) owner.setAttribute('data-go', '');
    await wait(STEPS.step);
    if (!alive()) return;
    if (verdict === 'wrong') {
      // Then my card turns red, and a step later it pops.
      const mine = card('mine');
      if (mine) mine.setAttribute('data-go', '');
      await wait(STEPS.step);
      if (!alive()) return;
      const now = card('mine');
      if (now) pop(screen, now, LOOKS.wrong, 'Wrong');
    } else if (verdict === 'right') {
      // My card is the green one: it pops.
      const now = card('owner');
      if (now) {
        const popped = pop(screen, now, LOOKS.right, bonus > 0 ? null : `+${points}`);
        coins(popped.at, popped.box.width, POP.coins);
        flash(POP.flash, POP.flashMs);
        // A streak that earned a bonus: my points stay and its story is told with them, on its own.
        if (bonus > 0) playStreak(screen, { ...popped, base: points - bonus, bonus, streak }, buzz);
      } else if (bonus > 0) showStreak(screen, streak);
    }
    buzz(verdict === 'right' ? 'yes' : 'no');
    await wait(STEPS.after);
    if (!alive()) return;
    const reactions = screen.querySelector('[data-after]');
    if (reactions) reactions.setAttribute('data-go', '');
  } finally {
    screen.removeAttribute('data-playing');
  }
}
