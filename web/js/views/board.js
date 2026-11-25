/**
 * The leaderboard between the photos: "Round 3 of 15", everyone ranked by points with
 * their pick of this round (✓ and the name in green, or ✗ and the name in red) and the
 * points it won as a chip next to the total, the leader's gold medal, the streak of everyone
 * who has one (right answers in a row, 2 or more) as a small badge on their avatar, the
 * reactions, the host's "Next" when the host decides, and "Show again".
 *
 * Mechanisms: shown in the `board` phase, after each round's reveal but the last one (the
 * last reveal ends the game, `rules.js`). The markup is always the board's final state (the
 * new order, ranks and totals, the medal on the leader); what it was before this round
 * rides along in `data-*` (the rows each moved, `data-shift`, the old rank, `data-was`, the
 * old total, `data-from`). The entrance is `board.js`'s (`main.js` `startBoard` plays it
 * once per board, `session.shown`): cause, then effect. Every row first stands where it
 * stood before, with its old rank and total, and the old leader wears the medal; the
 * points chips pop in and each throws a coin into its total, which rolls up; then the rows
 * slide to their new places, the ones moving up lifted above the others (`data-lift`: a
 * little bigger, a shadow), so everyone sees who overtakes whom; last the changed ranks pop
 * and the medal flies to the new leader. A board already shown (a repaint, a reconnect)
 * simply stays in its final state.
 *
 * The medal is worn by everyone who leads with more than 0 points (tied leaders each wear
 * one; before the first points are won nobody leads), hidden while the story plays until it
 * has landed (`data-playing` on the screen, `data-go` on the medal).
 *
 * The board after the second-to-last photo is "FINAL ROUND": no ranking ("Results are
 * hidden"), the words smashed onto the screen, which shakes once as they land (`board.js`,
 * with the `land` vibration), so the final standings stay a secret until the podium.
 * Holding "Show again" (`data-hold="peek"`, `main.js`) shows the round's photo to every
 * player while the finger stays down, and the room's clock stands still meanwhile. There is
 * no timer bar here: the board's time is the story and a short rest (`TIMING.boardMs`). When
 * that is up but not every phone holds the next round's photos yet, it stays and the table's
 * loading bar appears in the slot under the title (`loading`, kept empty until then, so
 * nothing moves). The list scrolls by itself when there are more players than fit, so the
 * reactions and the buttons always stay on screen.
 *
 * Invariants: nothing in the `board` part changes while the board is on screen unless the
 * players do (the loading bar is a part of its own), and its markup never depends on the
 * entrance, so a repaint can neither restart nor cut it. Ties share a rank and keep join
 * order. Every row says the same in words for screen readers. The list has room at its
 * sides for a row lifted by `data-lift`: a list that scrolls vertically scrolls sideways
 * too, so a bigger row without that room would make it scroll sideways.
 */

import { LEAVE_BUTTON, avatar, esc, progress, reactionsRow, streakBadge, topBar } from '../ui.js';

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
    ? { html: line('text-green', `✓ ${name}`), said: `right: ${name}, plus ${res.points}` }
    : { html: line('text-red', `✗ ${name}`), said: `wrong: ${name}` };
}

/**
 * A row; mine is marked yellow on the left. Before its slide it is moved by `--shift` rows
 * (its own height plus the gap, `mb-2`), which `board.js` sets; `transition` lets it glide
 * home (0.7 s, as long as `board.js`'s slide step) and lifts it while `data-lift` is on.
 */
const ROW = 'relative mb-2 flex h-16 translate-y-[calc(var(--shift,0)*(100%+--spacing(2)))] items-center gap-3 rounded-2xl border-l-6 bg-card pr-3.5 pl-3 transition duration-700 ease-spring data-lift:z-10 data-lift:scale-103 data-lift:shadow-lift motion-reduce:transition-none';
const NUMBER = 'font-display text-3xl font-extrabold';
/** Pops in when `board.js` sets `data-go` (the round's points, a new rank). */
const APPEARS = 'data-go:animate-appear motion-reduce:animate-none';
/**
 * The leader's gold medal on their avatar: while the story plays it stays hidden until it has
 * landed there (`data-go`, set by `board.js` when the medal arrives).
 */
const MEDAL = '<span class="lb-medal in-data-playing:not-data-go:invisible data-go:animate-lb-medal motion-reduce:animate-none" data-medal aria-hidden="true">🥇</span>';

function rows(view) {
  const gained = (p) => ((view.round.results || {})[p.id] || {}).points || 0;
  const before = ranking(view.players, (p) => p.score - gained(p));
  const after = ranking(view.players, (p) => p.score);
  const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
  return after.map(({ p, index, rank }) => {
    const from = before.find((x) => x.p === p);
    const line = pickLine(view, p);
    const points = gained(p);
    // The streak the room told for this round (`results`), shown only from 2 on.
    const streak = ((view.round.results || {})[p.id] || {}).streak || 0;
    const said = `${ordinal(rank)}, ${esc(p.name)}, ${line.said}${streak >= 2 ? `, ${streak} right in a row` : ''}, ${p.score} points`;
    const chip = points ? `<span class="inline-block rounded-full bg-green-dark px-2 py-0.5 text-sm text-green tabular-nums ${APPEARS}" data-cell="gain">+${points}</span>` : '';
    return `<div class="${ROW} ${p.id === view.me.id ? 'border-l-yellow' : 'border-l-transparent'}" data-shift="${from.index - index}" data-rank="${rank}" data-was="${from.rank}" aria-label="${said}">
      <span class="inline-block w-6.5 text-center ${NUMBER} ${APPEARS}" data-cell="rank">${rank}</span><span class="relative inline-grid shrink-0" data-cell="who">${avatar(p, 'lg')}${rank === 1 && p.score > 0 ? MEDAL : ''}${streak >= 2 ? `<span class="absolute -right-2 -bottom-1.5 z-2">${streakBadge(streak, 'small')}</span>` : ''}</span><div class="flex min-w-0 flex-1 flex-col"><b class="truncate text-xl">${esc(p.name)}</b>${line.html}</div>
      ${chip}<b class="${NUMBER} text-yellow tabular-nums data-go:animate-lb-hit motion-reduce:animate-none" data-cell="total" data-from="${p.score - points}">${p.score}</b></div>`;
  }).join('');
}

/**
 * The board after the second-to-last photo: no ranking, only "FINAL ROUND", which
 * `board.js` smashes onto the screen (`data-go`). It wraps between its two words (`w-min`).
 */
const FINAL_ROUND = `<div class="grid h-full place-items-center text-center" data-final>
  <div><p class="text-muted">Results are hidden</p><p class="mx-auto mt-2 w-min font-display text-8xl leading-none font-extrabold text-yellow data-go:animate-smash motion-reduce:animate-none" data-cell="final">FINAL ROUND</p></div></div>`;

/** @param state { reactions: the reaction emojis, loading: how far the table is while the board waits for photos (0 to 1) or null } */
export function boardScreen({ view }, { reactions, loading }) {
  const host = view.hostId === view.me.id;
  const r = view.round;
  return {
    key: `board|${view.code}|${r.n}`,
    // The screen shakes once when FINAL ROUND lands (`board.js` sets `data-go`).
    layout: `<div class="screen h-dvh data-go:animate-shake motion-reduce:animate-none">
      ${topBar(LEAVE_BUTTON)}
      <h2 class="mt-1 text-center font-display text-4xl font-extrabold">Round ${r.n} of ${r.total}</h2>
      <div class="h-7" data-part="loading"></div>
      <div class="-mx-2 mt-1 min-h-0 flex-1 overflow-y-auto px-2" data-part="board"></div>
      ${reactionsRow(reactions)}
      <div data-part="next"></div>
      <div data-part="look"></div>
    </div>`,
    parts: {
      loading: loading === null ? '' : progress(loading, 'Loading photos'),
      board: r.n === r.total - 1 ? FINAL_ROUND : rows(view),
      next: host && !view.settings.auto ? '<button class="btn mt-3 bg-coral text-white" data-act="next">Next</button>' : '',
      // A reported photo is gone: then there is nothing to show again.
      look: `<button class="btn mt-3 p-4.5 text-2xl active:bg-picked" data-hold="peek" ${r.photo ? '' : 'disabled'} aria-label="Show the photo again">📷 Show again</button>`,
    },
  };
}
