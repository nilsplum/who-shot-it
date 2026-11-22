/**
 * The end screen: podium, fastest right guess, best fooler, the rest of the ranking,
 * reactions and "Play again" for everyone.
 *
 * Mechanisms: shown in the `end` phase, and to every player still on their results after
 * someone else opened the next game (`me.onResults`); it draws from the room's final
 * standings (`view.final`), so it stays the same while the next game fills. "Play again"
 * opens the next game under the same code, or joins it when it is open already; there each
 * player gets a fresh random set of photos (`main.js`, `photos.spent`). `data-next` marks
 * that the next game is open (on the button, for the demo players and the tests; nothing visible). All
 * photos of the game are already deleted on the server at this point. The results sit in
 * the middle of the free space and scroll by themselves when there are more players than
 * fit, so the reactions and "Play again" always stay on screen.
 */

import { LEAVE_BUTTON, avatar, esc, reactionsRow, topBar } from '../ui.js';

/** The podium's places, left to right: second, first, third (first in yellow, the others in silver and bronze). */
const PLACES = [
  { at: 1, n: 2, block: 'h-19 bg-silver' },
  { at: 0, n: 1, block: 'h-26 bg-yellow' },
  { at: 2, n: 3, block: 'h-14 bg-bronze' },
];

export function endScreen({ view }, reactions) {
  const final = view.final || { players: [], fastest: null, fooler: null };
  const ranked = final.players.slice().sort((a, b) => b.score - a.score);
  const name = (id) => esc((final.players.find((p) => p.id === id) || {}).name || '');
  const { fastest, fooler } = final;
  const facts = [
    fastest ? `⚡ ${name(fastest.id)}: ${(fastest.ms / 1000).toFixed(1)} s` : '',
    fooler ? `🎭 ${name(fooler.id)}: fooled ${fooler.count}×` : '',
  ].filter(Boolean);
  const place = ({ at, n, block }) => {
    const p = ranked[at];
    return p ? `<li class="max-w-30 flex-1 text-center">${avatar(p, 'xl', { extra: `mb-1.5 ${n === 1 ? 'animate-winner motion-reduce:animate-none' : ''}` })}<div class="truncate text-sm">${esc(p.name)}</div><div class="mt-0.5 mb-1.5 text-xs text-yellow">${p.score}</div>
      <div class="grid place-items-center rounded-t-xl rounded-b-sm font-display text-4xl font-extrabold text-navy ${block}">${n}</div></li>` : '';
  };
  const body = `<div class="my-auto">
    <ul class="mt-7 mb-3.5 flex items-end justify-center gap-2.5" aria-label="Podium">${PLACES.map(place).join('')}</ul>
    ${facts.length ? `<div class="mt-2.5 mb-4.5 flex flex-col gap-1 text-center text-sm text-muted">${facts.map((f) => `<div>${f}</div>`).join('')}</div>` : ''}
    ${ranked.length > 3 ? `<ul>${ranked.slice(3).map((p, i) => `<li class="flex items-center gap-2.5 px-1 py-2"><span class="text-muted">${i + 4}.</span>${avatar(p)}<span class="flex-1 truncate">${esc(p.name)}</span><b class="text-yellow">${p.score}</b></li>`).join('')}</ul>` : ''}
  </div>`;
  return {
    key: `end|${view.code}`,
    layout: `<div class="screen h-dvh">
      ${topBar(LEAVE_BUTTON)}
      <div class="flex min-h-0 flex-1 flex-col overflow-y-auto" data-part="body"></div>
      <div class="my-4.5">${reactionsRow(reactions)}</div>
      <div data-part="again"></div>
    </div>`,
    parts: {
      body,
      again: `<button class="btn bg-coral text-white" data-act="again"${view.phase === 'end' ? '' : ' data-next="1"'}>Play again</button>`,
    },
  };
}
