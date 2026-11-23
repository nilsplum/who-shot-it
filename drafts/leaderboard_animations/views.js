/**
 * The leaderboard in its final state (`boardScreen`), built like the app's view
 * (web/js/views/board.js, same classes, same layout) from the app's own pieces
 * (web/js/ui.js), with what the story needs added, the way the app would get it: the
 * leader wears the gold medal 🥇 on their avatar (👑 already means the host), and a total
 * bumps when its coin lands (`data-go`). What it was before this round rides along in
 * `data-*`, as in the app; each piece the story finds has a hook (`data-cell`,
 * `data-medal`).
 *
 * Mechanisms: screen.js paints it with the app's painter (web/js/render.js).
 */
import { REACTIONS } from '/shared/config.js';
import { LEAVE_BUTTON, avatar, esc, reactionsRow, timerBar, topBar } from '/js/ui.js';

/** Players ranked by `score(p)`, ties in join order: [{ p, rank, index }] (views/board.js). */
function ranking(players, score) {
  const sorted = players.map((p, join) => ({ p, join, s: score(p) })).sort((a, b) => b.s - a.s || a.join - b.join);
  return sorted.map((x, index) => ({ p: x.p, index, rank: sorted.findIndex((y) => y.s === x.s) + 1 }));
}

/** A player's pick of this round under their name (views/board.js `pickLine`). */
function pickLine(g, p) {
  const line = (colour, text) => `<span class="truncate text-md ${colour}">${text}</span>`;
  if (!p.pick) return { html: line('text-red', '✗ No answer'), said: 'no answer' };
  const name = esc(g.players.find((x) => x.id === p.pick).name);
  return p.pick === g.owner ? { html: line('text-green', `✓ ${name}`), said: `right: ${name}, plus ${p.points}` } : { html: line('text-red', `✗ ${name}`), said: `wrong: ${name}` };
}

/** A row, as views/board.js: moved by `--shift` rows before its slide, gliding home, lifted while it overtakes (`data-lift`). */
const ROW = 'relative mb-2 flex h-16 translate-y-[calc(var(--shift,0)*(100%+--spacing(2)))] items-center gap-3 rounded-2xl border-l-6 bg-card pr-3.5 pl-3 transition duration-700 ease-spring data-lift:z-10 data-lift:scale-103 data-lift:shadow-lift motion-reduce:transition-none';
const NUMBER = 'font-display text-3xl font-extrabold';
const APPEARS = 'data-go:animate-appear motion-reduce:animate-none';

/** The leader's gold medal on their avatar: hidden while the story plays until it has landed there (`data-go`). */
const MEDAL = '<span class="lb-medal in-data-playing:not-data-go:invisible data-go:animate-lb-medal motion-reduce:animate-none" data-medal aria-hidden="true">🥇</span>';

/** The leaderboard after round `g.round.n`, in its final state; what it was before this round rides along in `data-*` (views/board.js). */
export function boardScreen(g) {
  const before = ranking(g.players, (p) => p.before);
  const after = ranking(g.players, (p) => p.score);
  const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
  const rows = after.map(({ p, index, rank }) => {
    const from = before.find((x) => x.p === p);
    const line = pickLine(g, p);
    const said = `${ordinal(rank)}, ${esc(p.name)}, ${line.said}, ${p.score} points`;
    const chip = p.points ? `<span class="inline-block rounded-full bg-green-dark px-2 py-0.5 text-sm text-green tabular-nums ${APPEARS}" data-cell="gain">+${p.points}</span>` : '';
    return `<div class="${ROW} ${p.id === g.me ? 'border-l-yellow' : 'border-l-transparent'}" data-shift="${from.index - index}" data-rank="${rank}" data-was="${from.rank}" aria-label="${said}">
      <span class="inline-block w-6.5 text-center ${NUMBER} ${APPEARS}" data-cell="rank">${rank}</span><span class="relative inline-grid shrink-0" data-cell="who">${avatar(p, 'lg')}${rank === 1 ? MEDAL : ''}</span><div class="flex min-w-0 flex-1 flex-col"><b class="truncate text-xl">${esc(p.name)}</b>${line.html}</div>
      ${chip}<b class="${NUMBER} text-yellow tabular-nums data-go:animate-lb-hit motion-reduce:animate-none" data-cell="total" data-from="${p.before}">${p.score}</b></div>`;
  }).join('');
  return {
    key: 'board',
    layout: `<div class="screen h-dvh">
      ${topBar(LEAVE_BUTTON)}
      <h2 class="mt-1 text-center font-display text-4xl font-extrabold">Round ${g.round.n} of ${g.round.total}</h2>
      <div data-part="timer"></div>
      <div class="mt-1 min-h-0 flex-1 overflow-y-auto" data-part="board"></div>
      ${reactionsRow(REACTIONS)}
      <button class="btn mt-3 p-4.5 text-2xl active:bg-picked" aria-label="Show the photo again">📷 Show again</button>
    </div>`,
    parts: { timer: timerBar('look'), board: rows },
  };
}
