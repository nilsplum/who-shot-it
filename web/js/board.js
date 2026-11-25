/**
 * The leaderboard's story between two photos, cause before effect ("Leaderboard", chosen
 * from drafts/leaderboard_animations). Every row first stands where it stood before this
 * round, with its old rank and total, and the old leaders wear the gold medal. The round's
 * points pop in, top to bottom, and each throws a gold coin in a little arc into its total,
 * which bumps and rolls up like a slot machine (each digit a reel, the last one spinning
 * fastest, the reels stopping from left to right). The first coin to land is a light tap.
 * Then the rows slide to their new places, the ones moving up lifted over the others, and
 * the changed ranks pop. Last the medals: each hops off the old leader, flies in an arc to
 * the new one, spinning and trailing sparks, and lands with a bounce, a ring of light and a
 * firm pulse. A leader who stays sends theirs on a little loop of its own; when nobody led
 * before (the first points of the game) it drops in from above; when nobody leads now (no
 * points yet) there is none. The board after the second-to-last photo is FINAL ROUND
 * instead: no ranking, the words fall onto the screen, which shakes and thuds as they land.
 *
 * Mechanisms: main.js `startBoard` calls `playBoard` once per board (`session.shown`), in
 * the same task as the board is painted in its final state (views/board.js), so no frame
 * shows the end first. The view carries what the start needs in `data-*` (`data-shift`,
 * `data-was`, `data-from`) and the rows glide home with their own transition (`--shift`,
 * `data-lift`, 0.7 s: the slide step's time below); this puts the start state over the
 * markup and lets each piece go with `data-go`, and holds the medals back with
 * `data-playing` on the screen until they land. A coin, a medal in flight and a total's
 * reels are elements of the screen (they go with it) that exist only while they move; the
 * sparks are the canvas (sparks.js), the medal's flight runs with the frame loop and
 * everything else is transform, scale and opacity.
 *
 * Invariants:
 * - Every variant ends exactly `TIMING.boardStoryMs` after it started (a shorter story waits
 *   at its end), so the room's board time (the story, then a pause: `TIMING.boardMs`) leaves
 *   the same rest on every phone and every table. The steps add up to `STORY_MS`, which
 *   `test/unit/board.test.js` holds within that time.
 * - The totals have settled before the rows overtake: the coins' spacing shrinks with the
 *   number of players so the last one lands in time (`COIN.window`).
 * - Every step first checks that its rows are still on the screen (a repaint after someone
 *   left replaced them: those rows are painted final) and the story always lets go of the
 *   screen (`data-playing`), so a replaced board shows its medals.
 * - With Reduce Motion main.js does not call it: the final state simply stays.
 */
import { TIMING } from '../shared/config.js';
import { EASE, inOut, tween, wait } from './motion.js';
import { colour, middle, ring, spark, spray } from './sparks.js';

/**
 * When each step starts (ms): the points chips, the coins, the slide (the rows' own 0.7 s)
 * and the ranks with the medals.
 */
const STEPS = { chips: 300, coins: 600, slide: 1900, medal: 2600 };
/**
 * The coins: how far apart they are thrown at most, the time all of them are thrown within
 * (a big table packs them closer), one's flight (ms) and how high it arcs (px).
 */
const COIN = { stagger: 35, window: 240, ms: 320, lift: 24 };
/** A total's roll: its time, how much later each next reel stops, the most digits a reel turns through. */
const ROLL = { ms: 520, stagger: 50, items: 12 };
/**
 * A medal's hop off its old place, its flight, how far it arcs up and out to the right over
 * the names (px), its trail of sparks a second, how long its landing bounce takes (the
 * `lb-medal` animation) and how far above its place it starts when it had no old one (px).
 */
const MEDAL = { hop: 150, ms: 680, lift: 28, side: 46, trail: 70, land: 500, drop: 120 };
/** When FINAL ROUND hits the screen: 45% into its 0.6 s `smash` (styles/app.css). */
const SMASH_LANDS_MS = 270;
/** What the steps add up to: the story's own length, before it waits for `TIMING.boardStoryMs`. */
export const STORY_MS = STEPS.medal + MEDAL.hop + MEDAL.ms + MEDAL.land;

/**
 * The point at `k` (0 to 1) on a curve from `a` to `b` that rises about `lift` px above the
 * higher of the two on its way and bulges `side` px to the right (a quadratic curve; its
 * control point lies twice as far, since such a curve reaches only half way to it).
 */
function along(a, b, lift, k, side = 0) {
  const c = { x: (a.x + b.x) / 2 + 2 * side, y: Math.min(a.y, b.y) - 2 * lift };
  const u = 1 - k;
  return { x: u * u * a.x + 2 * u * k * c.x + k * k * b.x, y: u * u * a.y + 2 * u * k * c.y + k * k * b.y };
}

/**
 * Rolls `cell` from `from` up to `to`: one reel of digits per place of `to`, each turning
 * from its old digit through the ones in between (at most ROLL.items) to its new one, all
 * stopping on the final number. A place the old total did not have yet starts blank. The
 * number is put back as plain text when it has stopped.
 */
function roll(cell, from, to) {
  const text = String(to);
  const places = text.length;
  const blank = places - String(from).length;
  const reels = [...text].map((_, i) => {
    const unit = 10 ** (places - 1 - i);
    const a = Math.floor(from / unit);
    const b = Math.floor(to / unit);
    const turns = Math.min(b - a, ROLL.items - 1);
    return [a, ...Array.from({ length: turns }, (_, k) => b - turns + 1 + k)].map((v, k) => (k === 0 && i < blank ? '&nbsp;' : String(v % 10)));
  });
  cell.innerHTML = `<span class="lb-odo">${reels.map((r) => `<span class="lb-reel" data-reel>${r.map((d) => `<i>${d}</i>`).join('')}</span>`).join('')}</span>`;
  const stops = [...cell.querySelectorAll('[data-reel]')].map((reel, i) => reel.animate(
    [{ transform: 'none' }, { transform: `translateY(${-(reels[i].length - 1) * 1.2}em)` }],
    { duration: ROLL.ms + i * ROLL.stagger, easing: EASE.out, fill: 'forwards' },
  ).finished);
  return Promise.all(stops).then(() => {
    cell.textContent = text;
  });
}

/** A gold coin from the row's points chip into its total, in a little arc; resolves where it lands. */
function throwCoin(screen, r) {
  const a = middle(r.gain);
  const b = middle(r.total);
  const coin = document.createElement('i');
  coin.className = 'lb-coin';
  screen.append(coin);
  const frames = Array.from({ length: 9 }, (_, i) => {
    const p = along(a, b, COIN.lift, inOut(i / 8), 0);
    return { translate: `${p.x}px ${p.y}px`, scale: String(1 - 0.3 * (i / 8)) };
  });
  return coin.animate(frames, { duration: COIN.ms }).finished.then(() => {
    coin.remove();
    return b;
  });
}

/** A medal like the one the view paints, for the old leader (the story takes it off again). */
function oldMedal() {
  const el = document.createElement('span');
  el.className = 'lb-medal';
  el.setAttribute('aria-hidden', 'true');
  el.textContent = '🥇';
  return el;
}

/**
 * The medal of row `to` (waiting hidden on its avatar) arrives: it flies from `from`'s old
 * one (hopping off it first; `from` is `to` itself for a leader who stays) or, without one,
 * drops in from above. It spins and trails sparks, and lands with a ring of light. Returns
 * false when the rows were replaced meanwhile.
 */
async function fly(screen, from, to, alive) {
  if (from) await from.old.animate([{ scale: 1, translate: '0 0' }, { scale: 1.35, translate: '0 -8px' }], { duration: MEDAL.hop, easing: EASE.out, fill: 'forwards' }).finished;
  if (!alive()) return false;
  const b = middle(to.medal);
  const a = from ? middle(from.old) : { x: b.x, y: b.y - MEDAL.drop };
  if (from) from.old.remove();
  const flyer = document.createElement('span');
  flyer.className = 'lb-flyer';
  flyer.textContent = '🥇';
  screen.append(flyer);
  const tint = colour('yellow');
  let owed = 0;
  let before = performance.now();
  await tween(MEDAL.ms, (k) => {
    const p = along(a, b, MEDAL.lift, k, MEDAL.side);
    flyer.style.translate = `${p.x}px ${p.y}px`;
    flyer.style.rotate = `${-22 + 360 * k}deg`;
    flyer.style.scale = String(1.35 + 0.5 * Math.sin(Math.PI * k));
    const now = performance.now();
    owed += ((now - before) / 1000) * MEDAL.trail;
    before = now;
    for (; owed >= 1; owed -= 1) spark({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.3) * 50, drag: 2, gravity: 60, life: 0.35 + Math.random() * 0.25, size: 2, tint, flicker: true });
  }, inOut);
  flyer.remove();
  if (!alive()) return false;
  to.medal.setAttribute('data-go', '');
  ring({ x: b.x, y: b.y, from: 8, to: 60, life: 0.45, width: 6, tint, strength: 0.9 });
  spray(b, tint, 12, 45);
  return true;
}

/**
 * Plays the story over `screen`, the board just painted in its final state; `buzz`
 * (phone.js) makes the first coin (a light tap), the medal's landing (a firm pulse) and
 * FINAL ROUND's landing felt.
 */
export async function playBoard(screen, buzz) {
  const part = screen.querySelector('[data-part="board"]');
  const final = part.querySelector('[data-cell="final"]');
  if (final) {
    final.toggleAttribute('data-go', true);
    setTimeout(() => {
      if (!final.isConnected) return;
      screen.toggleAttribute('data-go', true);
      buzz('land');
    }, SMASH_LANDS_MS);
    return;
  }
  const started = performance.now();
  const cell = (row, name) => row.querySelector(`[data-cell="${name}"]`);
  const rows = [...part.querySelectorAll('[data-rank]')].map((row) => ({
    row, rank: cell(row, 'rank'), total: cell(row, 'total'), gain: cell(row, 'gain'), who: cell(row, 'who'), old: null,
    from: Number(cell(row, 'total').dataset.from), to: Number(cell(row, 'total').textContent),
  }));
  for (const r of rows) r.medal = r.who.querySelector('[data-medal]');
  const alive = () => rows.every((r) => r.row.isConnected);
  const pause = async (ms) => {
    await wait(ms);
    return alive();
  };
  screen.setAttribute('data-playing', '');
  try {
    // The start state, in the same task as the paint: every row where it stood, the old leaders wearing the medal.
    for (const r of rows) {
      r.row.style.setProperty('--shift', r.row.dataset.shift);
      r.rank.textContent = r.row.dataset.was;
      r.total.textContent = r.from;
      if (r.gain) r.gain.style.visibility = 'hidden';
      if (r.row.dataset.was === '1' && r.from > 0) r.who.append((r.old = oldMedal()));
    }
    const gaining = rows.filter((r) => r.gain);
    const stagger = Math.min(COIN.stagger, COIN.window / Math.max(1, gaining.length));
    if (!(await pause(STEPS.chips))) return;
    gaining.forEach((r, i) => setTimeout(() => {
      r.gain.style.visibility = '';
      r.gain.toggleAttribute('data-go', true);
    }, i * stagger));
    if (!(await pause(STEPS.coins - STEPS.chips))) return;
    let felt = false;
    gaining.forEach((r, i) => setTimeout(async () => {
      if (!alive()) return;
      const at = await throwCoin(screen, r);
      if (!alive()) return;
      if (!felt) buzz('tap');
      felt = true;
      spray(at, colour('yellow'), 5, 22);
      r.total.toggleAttribute('data-go', true);
      roll(r.total, r.from, r.to);
    }, i * stagger));

    if (!(await pause(STEPS.slide - STEPS.coins))) return;
    for (const r of rows) {
      r.row.toggleAttribute('data-lift', Number(r.row.dataset.shift) > 0);
      r.row.style.setProperty('--shift', 0);
    }
    if (!(await pause(STEPS.medal - STEPS.slide))) return;
    for (const r of rows) {
      r.row.removeAttribute('data-lift');
      if (r.row.dataset.was === r.row.dataset.rank) continue;
      r.rank.textContent = r.row.dataset.rank;
      r.rank.toggleAttribute('data-go', true);
    }
    // Every leader now gets a medal: the one it already wore, else one a lost leader gives up, else a new one drops in.
    const lost = rows.filter((r) => r.old && !r.medal);
    let landed = false;
    const flights = rows.filter((r) => r.medal).map((r) => fly(screen, r.old ? r : lost.shift(), r, alive).then((ok) => {
      if (ok && !landed) buzz('yes');
      landed = landed || ok;
    }));
    // A medal nobody takes over goes out.
    for (const r of lost) r.old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: MEDAL.hop }).finished.then(() => r.old.remove());
    await Promise.all(flights);
    if (!(await pause(MEDAL.land))) return;
    await wait(TIMING.boardStoryMs - (performance.now() - started));
  } finally {
    screen.removeAttribute('data-playing');
  }
}
