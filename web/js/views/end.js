/**
 * The end screen: the podium, fastest right guess, best fooler, the rest of the ranking,
 * reactions and "Play again" for everyone.
 *
 * Mechanisms: shown in the `end` phase (right after the last photo's reveal, `rules.js`),
 * and to every player still on their results after someone else opened the next game
 * (`me.onResults`); it draws from the room's final standings (`view.final`), so it stays
 * the same while the next game fills. The podium is revealed with tension, once per game end
 * (`main.js` `startPodium`, `session.shown`): every place starts as a dashed "?"
 * (`data-covered` on the place) that trembles harder and harder with light ticks, then its
 * player pops in with a thud; third place, then second, then the winner (the longest wait,
 * ticks speeding up), with confetti (`data-burst`). Only then do the facts, the rest of the
 * ranking and "Play again" fade in: they stay hidden while the screen has `data-playing`,
 * also when a part is repainted meanwhile. "Play again" opens the next game under the same
 * code, or joins it when it is open already; there each player gets a fresh random set of
 * photos (`main.js`, `photos.spent`). `data-next` marks that the next game is open (on the
 * button, for the demo players and the tests; nothing visible). All photos of the game are
 * already deleted on the server at this point. The results sit in the middle of the free
 * space and scroll by themselves when there are more players than fit, so the reactions and
 * "Play again" always stay on screen.
 *
 * Invariant: the markup is always the final state (everyone revealed, everything shown);
 * the story is played over it, so a repaint, a reconnect or Reduce Motion simply shows the
 * end.
 */

import { CONFETTI, LEAVE_BUTTON, avatar, esc, reactionsRow, topBar } from '../ui.js';

/** The podium's places, left to right: second, first, third (first in yellow, the others in silver and bronze). */
const PLACES = [
  { at: 1, n: 2, block: 'h-19 bg-silver' },
  { at: 0, n: 1, block: 'h-26 bg-yellow' },
  { at: 2, n: 3, block: 'h-14 bg-bronze' },
];

/** What follows the podium: hidden while it plays, then fading in (`main.js` `startPodium`). */
const AFTER = 'in-data-playing:invisible in-data-ended:animate-arrive motion-reduce:animate-none';

/**
 * One place: its player (avatar, name, score) over its block, and over the player the
 * dashed "?" that stands in for them until the reveal (shown only while the place is
 * `data-covered`). The player pops in when `main.js` sets `data-go`; the winner's confetti
 * flies when the place gets `data-burst`.
 */
function place(p, { n, block }) {
  const pop = n === 1 ? 'data-go:animate-winner' : 'data-go:animate-appear';
  const confetti = n === 1 ? `<span class="hidden in-data-burst:contents">${CONFETTI}</span>` : '';
  const cover = `<div class="absolute inset-x-0 top-0 hidden justify-items-center in-data-covered:grid" aria-hidden="true"><span class="grid size-13 place-items-center rounded-full border-2 border-dashed border-line-strong text-3xl font-extrabold text-muted data-tense:animate-tense motion-reduce:animate-none" data-cell="cover">?</span></div>`;
  const who = `<div class="relative in-data-covered:invisible ${pop} motion-reduce:animate-none" data-cell="who">${avatar(p, 'xl', { extra: 'mb-1.5' })}<div class="truncate text-sm">${esc(p.name)}</div><div class="mt-0.5 mb-1.5 text-xs text-yellow">${p.score}</div>${confetti}</div>`;
  return `<li class="relative max-w-30 flex-1 text-center" data-place="${n}">${cover}${who}
    <div class="grid place-items-center rounded-t-xl rounded-b-sm font-display text-4xl font-extrabold text-navy ${block}">${n}</div></li>`;
}

export function endScreen({ view }, reactions) {
  const final = view.final || { players: [], fastest: null, fooler: null };
  const ranked = final.players.slice().sort((a, b) => b.score - a.score);
  const name = (id) => esc((final.players.find((p) => p.id === id) || {}).name || '');
  const { fastest, fooler } = final;
  const facts = [
    fastest ? `⚡ ${name(fastest.id)}: ${(fastest.ms / 1000).toFixed(1)} s` : '',
    fooler ? `🎭 ${name(fooler.id)}: fooled ${fooler.count}×` : '',
  ].filter(Boolean);
  const podium = PLACES.map((spot) => (ranked[spot.at] ? place(ranked[spot.at], spot) : '')).join('');
  const results = `<div class="my-auto">
    <ul class="mt-7 mb-3.5 flex items-end justify-center gap-2.5" aria-label="Podium">${podium}</ul>
    <div class="${AFTER}">
      ${facts.length ? `<div class="mt-2.5 mb-4.5 flex flex-col gap-1 text-center text-sm text-muted">${facts.map((f) => `<div>${f}</div>`).join('')}</div>` : ''}
      ${ranked.length > 3 ? `<ul>${ranked.slice(3).map((p, i) => `<li class="flex items-center gap-2.5 px-1 py-2"><span class="text-muted">${i + 4}.</span>${avatar(p)}<span class="flex-1 truncate">${esc(p.name)}</span><b class="text-yellow">${p.score}</b></li>`).join('')}</ul>` : ''}
    </div>
  </div>`;
  return {
    key: `end|${view.code}`,
    layout: `<div class="screen h-dvh">
      ${topBar(LEAVE_BUTTON)}
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto" data-part="results"></div>
      <div class="my-4.5">${reactionsRow(reactions)}</div>
      <div data-part="again"></div>
    </div>`,
    parts: {
      results,
      again: `<button class="btn bg-coral text-white ${AFTER}" data-act="again"${view.phase === 'end' ? '' : ' data-next="1"'}>Play again</button>`,
    },
  };
}
