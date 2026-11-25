/**
 * The streak's badge: a small white card, a little askew, with the number of right answers in
 * a row and a flame in the streak's tier colour (yellow, orange, coral, pink, violet) under a
 * band of it. It shows the streak where the player sees it: at the bottom middle of the photo on
 * the reveal (normal size, in a soft halo that keeps it legible on any photo) and on the avatar
 * of every player with a streak on the leaderboard (`small`).
 *
 * Mechanisms: round.js paints it into the two screens in their final state, as the app
 * would; reveal.js swaps it when the streak's bonus is added.
 *
 * Invariant: the whole badge is one element with `data-streak`, so a swap is one replacement.
 */
import { lookOf } from './moves.js';

/** The badge of a streak of `n`; `size` is 'normal' or 'small'. */
export function badge(n, size = 'normal') {
  const look = lookOf(n);
  const small = size === 'small';
  return `<span class="relative inline-flex -rotate-6 items-center gap-0.5 rounded-md border-t-4 ${look.band} bg-white ${small ? 'px-1 py-px text-2xs shadow-lift' : 'px-2.5 py-1 text-lg streak-halo'} leading-none font-extrabold ${look.onWhite}" data-streak="${n}" aria-label="${n} right answers in a row">${n}<i class="not-italic" aria-hidden="true">🔥</i></span>`;
}
