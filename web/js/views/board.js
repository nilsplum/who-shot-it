/**
 * The leaderboard between the photos: "Round 3 of 15", everyone ranked by points with
 * their pick of this round (✓ and the name in green with the points won, or ✗ and the
 * name in red), the reactions, the host's "Next" when the host decides, and "Show again".
 *
 * Mechanisms: shown in the `board` phase, after each round's reveal. The rows stand in
 * their new order but start shifted to their places before this round (`--shift` rows,
 * one step being a row and the gap under it), with the rank and the totals from before
 * (total minus this round's points); then `main.js` (`startBoard`, when the part is
 * painted) lets them slide home, shows the new rank (`data-rank`, into the cell
 * `data-cell="rank"`) and counts the totals up (`data-from` to `data-to`, cell
 * `data-cell="total"`). Holding "Show again" (`data-hold="peek"`, `main.js`) shows the
 * round's photo to every player while the finger stays down, and the room's clock stands
 * still meanwhile. The list scrolls by itself when there are more players than fit, so
 * the reactions and the buttons always stay on screen.
 *
 * Invariants: nothing here changes while the board is on screen (the timer bar is drawn
 * outside this part), so a repaint never restarts the animation. Ties share a rank and
 * keep join order. Every row says the same in words for screen readers.
 */

import { LEAVE_BUTTON, avatar, esc, reactionsRow, timerBar, topBar } from '../ui.js';

/** Players ranked by `score(p)`, ties in join order: [{ p, rank, index }]. */
function ranking(players, score) {
  const sorted = players.map((p, join) => ({ p, join, s: score(p) })).sort((a, b) => b.s - a.s || a.join - b.join);
  return sorted.map((x, index) => ({ p: x.p, index, rank: sorted.findIndex((y) => y.s === x.s) + 1 }));
}

function pickLine(view, p) {
  const r = view.round;
  const res = (r.results || {})[p.id];
  const line = (colour, text) => `<span class="truncate text-md ${colour}">${text}</span>`;
  if (!res || !res.pick) return { html: line('text-red', '✗ No answer'), said: 'no answer' };
  const picked = view.players.find((x) => x.id === res.pick);
  const name = esc(picked ? picked.name : '?');
  return res.pick === r.owner
    ? { html: line('text-green', `✓ ${name} +${res.points}`), said: `right: ${name}, plus ${res.points}` }
    : { html: line('text-red', `✗ ${name}`), said: `wrong: ${name}` };
}

/** A row; mine is marked yellow on the left. It slides by its own height plus the gap (`mb-2`) per step. */
const ROW = 'mb-2 flex h-16 translate-y-[calc(var(--shift)*(100%+--spacing(2)))] items-center gap-3 rounded-2xl border-l-6 bg-card pr-3.5 pl-3 transition-transform duration-600 ease-spring motion-reduce:transition-none';
const NUMBER = 'font-display text-3xl font-extrabold';

function rows(view) {
  const gained = (p) => ((view.round.results || {})[p.id] || {}).points || 0;
  const before = ranking(view.players, (p) => p.score - gained(p));
  const after = ranking(view.players, (p) => p.score);
  const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
  return after.map(({ p, index, rank }) => {
    const from = before.find((x) => x.p === p);
    const line = pickLine(view, p);
    const said = `${ordinal(rank)}, ${esc(p.name)}, ${line.said}, ${p.score} points`;
    return `<div class="${ROW} ${p.id === view.me.id ? 'border-l-yellow' : 'border-l-transparent'}" style="--shift:${from.index - index}" data-rank="${rank}" aria-label="${said}">
      <span class="w-6.5 text-center ${NUMBER}" data-cell="rank">${from.rank}</span>${avatar(p, 'lg')}<div class="flex min-w-0 flex-1 flex-col"><b class="truncate text-xl">${esc(p.name)}</b>${line.html}</div>
      <b class="${NUMBER} text-yellow tabular-nums" data-cell="total" data-from="${p.score - gained(p)}" data-to="${p.score}">${p.score - gained(p)}</b></div>`;
  }).join('');
}

export function boardScreen({ view }, { reactions }) {
  const host = view.hostId === view.me.id;
  const r = view.round;
  return {
    key: `board|${view.code}|${r.n}`,
    layout: `<div class="screen h-dvh">
      ${topBar(LEAVE_BUTTON)}
      <h2 class="mt-1 text-center font-display text-4xl font-extrabold">Round ${r.n} of ${r.total}</h2>
      ${timerBar('look')}
      <div class="mt-1 min-h-0 flex-1 overflow-y-auto" data-part="board"></div>
      ${reactionsRow(reactions)}
      <div data-part="next"></div>
      <div data-part="look"></div>
    </div>`,
    parts: {
      board: rows(view),
      next: host && !view.settings.auto ? '<button class="btn mt-3 bg-coral text-white" data-act="next">Next</button>' : '',
      // A reported photo is gone: then there is nothing to show again.
      look: `<button class="btn mt-3 p-4.5 text-2xl active:bg-picked" data-hold="peek" ${r.photo ? '' : 'disabled'} aria-label="Show the photo again">📷 Show again</button>`,
    },
  };
}
