/**
 * The end screen: the podium, fastest right guess, best fooler, the rest of the ranking,
 * reactions and "Play again" for everyone.
 *
 * Mechanisms: shown in the `end` phase (right after the last photo's reveal, `rules.js`),
 * and to every player still on their results after someone else opened the next game
 * (`me.onResults`); it draws from the room's final standings (`view.final`), so it stays
 * the same while the next game fills. The podium is revealed once per game end by
 * `podium.js` (`main.js` `startPodium`, `session.shown`), which plays its story over this
 * markup with `data-*` attributes and custom properties: each place has an orb where its
 * player stands, shown only while the place is `data-covered` (its player hidden, its
 * block dimmed, brighter as the orb fills: `--fill`); the orb fills (`--charge`) and bursts,
 * the player pops out (`data-go`, `--pop` times its size half way). The winner has rays of
 * light behind them and cracks in its orb. The facts, the ranking and "Play again" stay
 * hidden while the screen has `data-playing`, also when a part is repainted meanwhile, and
 * fade in with `data-ended`. "Play again" opens the next game under the same code, or joins
 * it when it is open already; there each player gets a fresh random set of photos
 * (`main.js`, `photos.spent`). `data-next` marks that the next game is open (on the button,
 * for the demo players and the tests; nothing visible). All photos of the game are already
 * deleted on the server at this point.
 *
 * Layout: the podium and the facts always stay on screen; only the rest of the ranking
 * scrolls, in its own list with a scrollbar that shows only while it scrolls
 * (`scrollbar-quiet`), so with 16 players the podium never scrolls away. When everything
 * fits it sits in the middle of the free space. Nothing on the podium sits in a scrolling
 * box: a player popping out a little too big at the screen's edge can never make it scroll.
 *
 * Invariant: the markup is always the final state (everyone revealed, the rays turning,
 * the blocks glowing, everything shown); the story is played over it, so a repaint, a
 * reconnect or Reduce Motion simply shows the end.
 */

import { LEAVE_BUTTON, avatar, esc, reactionsRow, topBar } from '../ui.js';

/**
 * The podium's places, left to right: second, first, third. Each has its colour (`tone`:
 * silver, the yellow, bronze, also its orb's, its glow's and its rays'), its block's height,
 * and how big its player pops out (the winner's biggest).
 */
const PLACES = [
  { at: 1, n: 2, block: 'h-19 bg-silver', tone: 'silver', pop: 1.3 },
  { at: 0, n: 1, block: 'h-26 bg-yellow', tone: 'yellow', pop: 1.55 },
  { at: 2, n: 3, block: 'h-14 bg-bronze', tone: 'bronze', pop: 1.3 },
];

/** What follows the podium: hidden while it plays, then fading in (`podium.js`). */
const AFTER = 'in-data-playing:invisible in-data-ended:animate-arrive motion-reduce:animate-none';

/** The winner's orb cracks as it fills (`data-crack`, then `data-split`): four lines from the rim towards the middle. */
const CRACKS = '<svg class="absolute inset-0 orb-cracks" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6 L29 18 L35 24 L30 33"/><path d="M58 30 L46 31 L41 38 L34 36"/><path d="M12 48 L22 42 L24 34 L30 33"/><path d="M44 56 L40 46 L34 44 L33 37"/></svg>';

/**
 * One place: its player (avatar, name, score) over its block; the orb over the avatar's
 * middle (half the avatar's height down: `top-6.5`), shown while the place is covered; for
 * the winner the rays, centred on the same point and behind everything (`-z-1`), so no
 * animation or scrolling can move them off their player.
 */
function place(p, { n, block, tone, pop }) {
  const rays = n === 1 ? '<i class="pointer-events-none absolute top-6.5 left-1/2 -z-1 size-85 -translate-1/2 rounded-full bg-rays animate-rays in-data-covered:hidden motion-reduce:animate-none" aria-hidden="true" data-cell="rays"></i>' : '';
  const orb = `<div class="absolute top-6.5 left-1/2 -mt-8 -ml-8 hidden size-16 orb in-data-covered:block" aria-hidden="true" data-cell="orb"><i class="absolute inset-0 orb-ring"></i><i class="absolute inset-3 orb-core"></i>${n === 1 ? CRACKS : ''}</div>`;
  const who = `<div class="relative in-data-covered:invisible data-go:animate-pop-in motion-reduce:animate-none" style="--pop:${pop}" data-cell="who">${avatar(p, 'xl', { extra: 'mb-1.5' })}<div class="truncate text-sm">${esc(p.name)}</div><div class="mt-0.5 mb-1.5 text-xs text-yellow">${p.score}</div></div>`;
  return `<li class="relative max-w-30 flex-1 text-center" style="--tone:var(--color-${tone})" data-place="${n}">${rays}${orb}${who}
    <div class="grid place-items-center rounded-t-xl rounded-b-sm font-display text-4xl font-extrabold text-navy podium-block ${block}">${n}</div></li>`;
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
  return {
    key: `end|${view.code}`,
    layout: `<div class="screen h-dvh">
      ${topBar(LEAVE_BUTTON)}
      <div class="flex min-h-0 flex-1 flex-col justify-center">
        <div data-part="podium"></div>
        <ul class="min-h-0 overflow-y-auto scrollbar-quiet ${AFTER}" data-part="ranking"></ul>
      </div>
      <div class="my-4.5">${reactionsRow(reactions)}</div>
      <div data-part="again"></div>
    </div>`,
    parts: {
      podium: `<ul class="mt-7 mb-3.5 flex items-end justify-center gap-2.5" aria-label="Podium">${podium}</ul>
        ${facts.length ? `<div class="mt-2.5 mb-4.5 flex flex-col gap-1 text-center text-sm text-muted ${AFTER}">${facts.map((f) => `<div>${f}</div>`).join('')}</div>` : ''}`,
      ranking: ranked.slice(3).map((p, i) => `<li class="flex items-center gap-2.5 px-1 py-2"><span class="text-muted">${i + 4}.</span>${avatar(p)}<span class="flex-1 truncate">${esc(p.name)}</span><b class="text-yellow">${p.score}</b></li>`).join(''),
      again: `<button class="btn bg-coral text-white ${AFTER}" data-act="again"${view.phase === 'end' ? '' : ' data-next="1"'}>Play again</button>`,
    },
  };
}
