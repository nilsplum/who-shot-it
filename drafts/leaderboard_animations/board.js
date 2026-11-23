/**
 * Leaderboard: cause before effect, as the app plays it now (main.js `startBoard`), with
 * more to feel. Every row first stands where it stood before this round, with its old rank
 * and total, and the old leader wears the gold medal. The round's points pop in, top to
 * bottom, and each throws a gold coin in a little arc into its total, which bumps and rolls
 * up like a slot machine (each digit a reel, the last one spinning fastest, the reels
 * stopping from left to right). The first coin to land is a light tap. Then the rows slide
 * to their new places, the ones moving up lifted over the others, and the changed ranks pop.
 * Last the medal: it hops off the old leader, flies in an arc to the new one, spinning and
 * trailing sparks, and lands with a bounce, a ring of light and a firm pulse. When the
 * leader stays, the medal only shines up.
 *
 * Mechanisms: views.js paints the board in its final state (new order, ranks, totals, the
 * medal on the leader); this puts the start state over it in the same task, as main.js
 * does, and plays the story with `data-*`: `--shift` and `data-lift` (the rows' own
 * transition), `data-go` (the chips, the ranks, the totals' bump, the medal's landing). The
 * coins and the medal in flight are elements of their own, moved with `translate`; a
 * total's reels exist only while it rolls. The sparks are the app's canvas.
 *
 * Invariants: what stays is exactly the painted board; the totals have settled before the
 * rows overtake; the whole story takes about 3.5 s of the board's 5 (TIMING.boardMs).
 */
import { colour, ring, spark } from '/js/sparks.js';
import { buzz, wait } from '/kit/screen.js';
import { CURVE, EASE, along, centre, runTimer, sparkle, tween } from './moves.js';

/** When each step starts (ms): the chips, the coins, the slide (the rows' own 0.7 s), the ranks and the medal. */
const STEPS = { chips: 300, coins: 600, slide: 1750, medal: 2500 };
/** The chips pop in and their coins fly one row after another (ms apart); a coin's flight and how high it arcs (px). */
const COIN = { stagger: 35, ms: 320, lift: 24 };
/** A total's roll: its time, how much later each next reel stops, the most digits a reel turns through. */
const ROLL = { ms: 520, stagger: 50, items: 12 };
/** The medal's hop off, its flight, how far it arcs up and out to the right over the names (px), its trail of sparks a second. */
const MEDAL = { hop: 150, ms: 680, lift: 28, side: 46, trail: 70 };
const BOARD_MS = 5000;

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

/** A gold coin from the row's points chip into its total, in a little arc; resolves as it lands. */
function throwCoin(r) {
  const a = centre(r.gain);
  const b = centre(r.total);
  const coin = document.createElement('i');
  coin.className = 'lb-coin';
  document.body.append(coin);
  const frames = Array.from({ length: 9 }, (_, i) => {
    const p = along(a, b, COIN.lift, CURVE.inOut(i / 8));
    return { translate: `${p.x}px ${p.y}px`, scale: String(1 - 0.3 * (i / 8)) };
  });
  return coin.animate(frames, { duration: COIN.ms }).finished.then(() => {
    coin.remove();
    return b;
  });
}

/** The medal flies from `old` (the old leader's) to `final` (the new leader's, waiting hidden), spinning and trailing sparks, and lands. */
async function steal(old, final) {
  await old.animate([{ scale: 1, translate: '0 0' }, { scale: 1.35, translate: '0 -8px' }], { duration: MEDAL.hop, easing: EASE.out, fill: 'forwards' }).finished;
  const a = centre(old);
  const b = centre(final);
  old.remove();
  const flyer = document.createElement('span');
  flyer.className = 'lb-flyer';
  flyer.textContent = '🥇';
  document.body.append(flyer);
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
  }, CURVE.inOut);
  flyer.remove();
  final.setAttribute('data-go', '');
  ring({ x: b.x, y: b.y, from: 8, to: 60, life: 0.45, width: 6, tint, strength: 0.9 });
  sparkle(b, tint, 12, 45);
  buzz('yes');
}

export async function board(screen) {
  // The start state, in the same task as the paint: no frame shows the end first.
  screen.setAttribute('data-playing', '');
  const cell = (row, name) => row.querySelector(`[data-cell="${name}"]`);
  const rows = [...screen.querySelectorAll('[data-rank]')].map((row) => ({
    row, rank: cell(row, 'rank'), total: cell(row, 'total'), gain: cell(row, 'gain'), who: cell(row, 'who'),
    from: Number(cell(row, 'total').dataset.from), to: Number(cell(row, 'total').textContent),
  }));
  for (const r of rows) {
    r.row.style.setProperty('--shift', r.row.dataset.shift);
    r.rank.textContent = r.row.dataset.was;
    r.total.textContent = r.from;
    if (r.gain) r.gain.style.visibility = 'hidden';
  }
  // The old leader wears the medal until it is taken.
  const was = rows.find((r) => r.row.dataset.was === '1');
  const old = document.createElement('span');
  old.className = 'lb-medal';
  old.setAttribute('aria-hidden', 'true');
  old.textContent = '🥇';
  was.who.append(old);
  runTimer(BOARD_MS);

  const gaining = rows.filter((r) => r.gain);
  await wait(STEPS.chips);
  gaining.forEach((r, i) => setTimeout(() => {
    r.gain.style.visibility = '';
    r.gain.setAttribute('data-go', '');
  }, i * COIN.stagger));
  await wait(STEPS.coins - STEPS.chips);
  let felt = false;
  gaining.forEach((r, i) => setTimeout(() => throwCoin(r).then((at) => {
    if (!felt) buzz('tap');
    felt = true;
    sparkle(at, colour('yellow'), 5, 22);
    r.total.setAttribute('data-go', '');
    roll(r.total, r.from, r.to);
  }), i * COIN.stagger));

  await wait(STEPS.slide - STEPS.coins);
  for (const r of rows) {
    r.row.toggleAttribute('data-lift', Number(r.row.dataset.shift) > 0);
    r.row.style.setProperty('--shift', 0);
  }
  await wait(STEPS.medal - STEPS.slide);
  for (const r of rows) {
    r.row.removeAttribute('data-lift');
    if (r.row.dataset.was === r.row.dataset.rank) continue;
    r.rank.textContent = r.row.dataset.rank;
    r.rank.setAttribute('data-go', '');
  }
  const final = screen.querySelector('[data-medal]');
  if (final.closest('[data-rank]') === was.row) {
    // The leader stays: the medal shines up where it is.
    old.remove();
    final.setAttribute('data-go', '');
    sparkle(centre(final), colour('yellow'), 8, 30);
  } else await steal(old, final);
  screen.removeAttribute('data-playing');
}
