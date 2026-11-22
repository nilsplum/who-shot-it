/**
 * The leaderboard between the photos: "Round 3 of 15", everyone ranked by points with
 * their pick of this round (✓ and the name in green with the points won, or ✗ and the
 * name in red), the reactions, the host's "Next" when the host decides, and "Show again".
 *
 * Mechanisms: shown in the `board` phase, after each round's reveal. The rows stand in
 * their new order but start shifted to their places before this round, with the totals
 * from before (total minus this round's points); then `main.js` (`startBoard`, when the
 * part is painted) lets them slide home and counts the totals up. Holding "Show again" (`data-hold="peek"`, `main.js`) shows the
 * round's photo to every player while the finger stays down, and the room's clock stands
 * still meanwhile.
 *
 * Invariants: nothing here changes while the board is on screen (the timer bar is drawn
 * outside this part), so a repaint never restarts the animation. Ties share a rank and
 * keep join order. Every row says the same in words for screen readers.
 */

import { avatar, esc, reactionsRow } from '../ui.js';

/** Players ranked by `score(p)`, ties in join order: [{ p, rank, index }]. */
function ranking(players, score) {
  const sorted = players.map((p, join) => ({ p, join, s: score(p) })).sort((a, b) => b.s - a.s || a.join - b.join);
  return sorted.map((x, index) => ({ p: x.p, index, rank: sorted.findIndex((y) => y.s === x.s) + 1 }));
}

function pickLine(view, p) {
  const r = view.round;
  const res = (r.results || {})[p.id];
  if (!res || !res.pick) return { html: '<span class="pk no">✗ No answer</span>', said: 'no answer' };
  const picked = view.players.find((x) => x.id === res.pick);
  const name = esc(picked ? picked.name : '?');
  return res.pick === r.owner
    ? { html: `<span class="pk ok">✓ ${name} +${res.points}</span>`, said: `right: ${name}, plus ${res.points}` }
    : { html: `<span class="pk no">✗ ${name}</span>`, said: `wrong: ${name}` };
}

function rows(view) {
  const gained = (p) => ((view.round.results || {})[p.id] || {}).points || 0;
  const before = ranking(view.players, (p) => p.score - gained(p));
  const after = ranking(view.players, (p) => p.score);
  const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
  return after.map(({ p, index, rank }) => {
    const from = before.find((x) => x.p === p);
    const line = pickLine(view, p);
    const said = `${ordinal(rank)}, ${esc(p.name)}, ${line.said}, ${p.score} points`;
    return `<div class="row ${p.id === view.me.id ? 'me' : ''}" style="--shift:${from.index - index}" data-rank="${rank}" aria-label="${said}">
      <span class="rk">${from.rank}</span>${avatar(p)}<div class="who"><b>${esc(p.name)}</b>${line.html}</div>
      <b class="tot" data-from="${p.score - gained(p)}" data-to="${p.score}">${p.score - gained(p)}</b></div>`;
  }).join('');
}

export function boardScreen({ view }, { reactions }) {
  const host = view.hostId === view.me.id;
  const r = view.round;
  return {
    key: `board|${view.code}|${r.n}`,
    layout: `<div class="wrap">
      <div class="top"><button class="icon" data-act="leave" aria-label="Leave">✕</button><span></span><span></span></div>
      <h2 class="lbt">Round ${r.n} of ${r.total}</h2>
      <div class="timer" id="timer"><i id="tbar"></i></div>
      <div class="lb" data-part="board"></div>
      <div class="spacer"></div>
      ${reactionsRow(reactions)}
      <div data-part="next"></div>
      <div data-part="look"></div>
    </div>`,
    parts: {
      board: rows(view),
      next: host && !view.settings.auto ? '<button class="btn main" data-act="next">Next</button>' : '',
      // A reported photo is gone: then there is nothing to show again.
      look: `<button class="btn again-look" data-hold="peek" ${r.photo ? '' : 'disabled'} aria-label="Show the photo again">📷 Show again</button>`,
    },
  };
}
