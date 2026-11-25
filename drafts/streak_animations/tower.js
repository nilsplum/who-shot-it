/**
 * The tower: the streak as a tower of building blocks over the bonus number. A chunky block
 * for every number, its number big on the left and what that number adds to the bonus on the
 * right ("2 +100", "3 +100", and "MAX" once the bonus has reached its cap, with a crown), each
 * in the next colour of the rainbow. A block drops in from above, lands with a squash and a
 * thump that makes the whole tower sway; the more dramatic the step (`drama`, 0 to 1), the
 * higher it falls, the harder it squashes and the more the tower sways. At most four blocks
 * stand: when one more lands the lowest is knocked out sideways. When the bonus is done the
 * tower is swallowed by the number below it.
 *
 * Mechanisms: reveal.js builds one tower in a group anchored over the bonus number (drawn
 * smaller on a small phone, `u`), calls `drop` for each number and `swallow` at the end; the
 * bonus number counts up in step with each landing. A block is an element of that group, moved
 * with `translate`; the group sways with `rotate`.
 *
 * Invariants: never more than BLOCKS blocks at once, and a block never starts its fall higher
 * than the photo reaches (`room`), so the tower and its falling blocks stay inside the photo of
 * the smallest phone; every motion is transform, scale, rotate or opacity.
 */
import { EASE, capped, stepOf, toward } from './moves.js';

/** The most blocks standing at once, the distance between two (px, before the phone's scale) and the time a block takes to land (ms). */
const BLOCKS = 4;
const PITCH = 40;
export const LAND = 260;
/** A block's colour by its number, written out whole so Tailwind builds them. */
const FILLS = ['bg-green', 'bg-yellow', 'bg-p6', 'bg-coral', 'bg-p8', 'bg-violet'];

/** A block for the number `k`: the number and what it adds ("MAX" when nothing), a crown when the bonus has reached its cap. */
const block = (k) => `<div class="absolute -mt-9 -ml-14 flex h-9 w-28 items-center justify-between rounded-xl ${FILLS[(k - 2) % FILLS.length]} px-3 font-display font-extrabold text-navy streak-edge"><span class="text-2xl leading-none">${k}</span><span class="text-xl leading-none tabular-nums">${stepOf(k) ? `+${stepOf(k)}` : 'MAX'}</span>${capped(k) ? '<i class="absolute -top-3.5 right-2 text-base leading-none not-italic" aria-hidden="true">👑</i>' : ''}</div>`;

/** A tower in `grp`, drawn at `u` of its size, with `room` (in its own units) of photo above its foot. */
export function tower({ grp, u, room }) {
  const blocks = [];
  /** Where block number `i` stands: a little off the middle, one way then the other. */
  const spot = (i) => ({ x: i % 2 ? 5 : -5, y: -i * PITCH });
  const place = (i) => `${spot(i).x}px ${spot(i).y}px`;

  /** The tower sways from its foot: `amount` degrees at first, less and less. */
  function sway(amount) {
    grp.animate([{ rotate: '0deg' }, { rotate: `${-amount}deg` }, { rotate: `${amount * 0.6}deg` }, { rotate: `${-amount * 0.25}deg` }, { rotate: '0deg' }], { duration: 560, easing: EASE.out });
  }

  /**
   * Block `k` drops in on top, `drama` (0 to 1) deciding how high it falls and how hard it
   * squashes; it has landed after LAND ms. A full tower loses its lowest block sideways.
   * `big` makes it the biggest (the last one).
   */
  function drop(k, drama, big = false) {
    if (blocks.length === BLOCKS) {
      const lowest = blocks.shift();
      const side = k % 2 ? 160 : -160;
      lowest.animate([{ translate: lowest.style.translate, rotate: lowest.style.rotate, opacity: 1 }, { translate: `${side}px 20px`, rotate: `${side / 3}deg`, opacity: 0 }], { duration: 320, easing: 'ease-in' }).finished.then(() => lowest.remove());
      blocks.forEach((b, i) => {
        b.animate([{ translate: b.style.translate }, { translate: place(i) }], { duration: 220, easing: EASE.out });
        b.style.translate = place(i);
      });
    }
    const i = blocks.length;
    const holder = document.createElement('div');
    holder.innerHTML = block(k);
    const piece = holder.firstElementChild;
    piece.style.translate = place(i);
    piece.style.rotate = `${i % 2 ? 1.5 : -1.5}deg`;
    grp.append(piece);
    blocks.push(piece);
    // As high as the drama wants, but never above the top of the photo (a block is 36 tall).
    const height = Math.max(40, Math.min(150 + 100 * drama, room + spot(i).y - 36));
    const squash = 1.1 + 0.28 * drama;
    piece.animate([{ translate: `${spot(i).x}px ${spot(i).y - height}px` }, { translate: place(i), offset: 0.72, easing: EASE.out }, { translate: place(i) }], { duration: LAND, easing: 'ease-in' });
    piece.animate([{ scale: '1' }, { scale: '1', offset: 0.72 }, { scale: `${squash} ${2 - squash}`, offset: 0.8 }, { scale: `${2 - squash * 0.9} ${squash * 0.92}`, offset: 0.9 }, { scale: big ? '1.1' : '1' }], { duration: LAND, fill: 'forwards' });
    setTimeout(() => sway(0.7 + 1.1 * drama + 0.3 * blocks.length), LAND * 0.78);
    return piece;
  }

  /** The tower is swallowed by `target` (a point of the screen): its blocks shrink into it, lowest first. */
  function swallow(target) {
    return Promise.all(blocks.map((b, i) => {
      const d = toward(b, target, u);
      return b.animate([{ translate: place(i), opacity: 1 }, { translate: `${spot(i).x + d.x}px ${spot(i).y + d.y}px`, scale: 0.25, rotate: `${i % 2 ? 50 : -50}deg`, opacity: 0 }], { duration: 340, delay: i * 45, easing: 'ease-in', fill: 'forwards' }).finished;
    }));
  }

  return { drop, swallow };
}
