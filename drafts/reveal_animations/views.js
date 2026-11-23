/**
 * The reveal in its final state (`revealScreen`), built like the app's view
 * (web/js/views/game.js, same classes, same layout) from the app's own pieces
 * (web/js/ui.js): the photo, the green ✓, my red ✗ and the reactions, with what the story
 * needs added, the way the app would get it. The result waits while the story plays
 * (`data-playing` on the screen): the owner's card looks like the others, my pick stays
 * yellow, and the ✓ and ✗ are hidden, until the story lets each card go (`data-go`), which
 * also plays its entrance. The app's confetti on a right guess is replaced by the story's
 * coins. Each piece the story finds has a `data-*` hook (`data-card`, `data-after`).
 *
 * Mechanisms: screen.js paints it with the app's painter (web/js/render.js). The photo is a
 * drawn stand-in (a pizza, in theme colours), never a real one.
 */
import { REACTIONS } from '/shared/config.js';
import { LEAVE_BUTTON, avatar, barTitle, esc, reactionsRow, timerBar, topBar } from '/js/ui.js';

/** The round's photo: a pizza on a plate with a slice gone, drawn, as a phone would show a photo (whole, on the stage). */
const PHOTO = `<svg class="size-full" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Photo">
  <rect width="300" height="400" class="fill-glow-violet"/>
  <circle cx="40" cy="40" r="150" class="fill-white" opacity="0.05"/>
  <circle cx="150" cy="205" r="128" class="fill-line-strong"/>
  <circle cx="150" cy="205" r="120" class="fill-white"/>
  <circle cx="150" cy="205" r="104" class="fill-p6"/>
  <circle cx="150" cy="205" r="90" class="fill-p11"/>
  <path d="M150 205 L251.5 168.1 A108 108 0 0 1 243.5 259 Z" class="fill-white"/>
  <g class="fill-p0"><circle cx="112" cy="155" r="13"/><circle cx="168" cy="133" r="13"/><circle cx="92" cy="217" r="13"/><circle cx="138" cy="257" r="13"/><circle cx="182" cy="243" r="12"/><circle cx="140" cy="197" r="13"/><circle cx="128" cy="123" r="11"/></g>
  <g class="fill-green"><ellipse cx="156" cy="166" rx="9" ry="5" transform="rotate(30 156 166)"/><ellipse cx="108" cy="245" rx="9" ry="5" transform="rotate(-20 108 245)"/><ellipse cx="196" cy="268" rx="8" ry="4.5" transform="rotate(50 196 268)"/></g>
</svg>`;

/** The stage: the photo, and ⚑ to flag it (as views/game.js). */
const stage = () => `<div class="absolute inset-0 overflow-hidden">${PHOTO}</div>
  <button class="absolute top-2 right-2 size-8.5 rounded-full bg-stage/70 text-md text-white opacity-70" aria-label="Report this photo">⚑</button>`;

/** The cards' layouts by how many there are (views/game.js `DENSITIES`). */
const DENSITIES = {
  roomy: { grid: 'grid-cols-2 gap-2', card: 'min-h-16 rounded-2xl border-3 px-3 py-2.5', avatar: 'lg', name: 'text-xl', badge: 'text-4xl' },
  medium: { grid: 'grid-cols-3 gap-1.5', card: 'min-h-16 rounded-2xl border-3 px-2 py-1.5', avatar: 'md', name: 'text-md', badge: 'text-2xl' },
  compact: { grid: 'grid-cols-4 gap-1.5', card: 'h-12 rounded-xl border-2 px-1.5', avatar: 'sm', name: 'text-sm', badge: 'text-xl' },
};
const densityOf = (count) => (count <= 4 ? DENSITIES.roomy : count <= 9 ? DENSITIES.medium : DENSITIES.compact);

/** A card's inside: avatar, name and badge, stacked on a narrow card (views/game.js `inside`). */
const inside = (p, d, badge = '') =>
  `<span class="grid grid-cols-[auto_1fr_auto] items-center gap-2 @max-[7.5rem]:grid-cols-1 @max-[7.5rem]:content-center @max-[7.5rem]:justify-items-center @max-[7.5rem]:gap-0">${avatar(p, d.avatar)}<span class="max-w-full min-w-0 truncate leading-tight ${d.name}">${esc(p.name)}</span>${badge}</span>`;

/** The ✓ or ✗, hidden until its card is let go (`rv-waits`), then stamped on. */
const badge = (d, glyph, colour) =>
  `<span class="leading-none font-extrabold ${d.badge} ${colour} rv-waits in-data-go:animate-rv-stamp motion-reduce:animate-none @max-[7.5rem]:absolute @max-[7.5rem]:top-0.5 @max-[7.5rem]:right-1 @max-[7.5rem]:text-md">${glyph}</span>`;

const CARD = '@container relative grid text-left text-ink';
const LOOK = {
  plain: 'border-transparent bg-card',
  right: 'border-green bg-green-dark',
  wrong: 'border-red bg-red-dark',
};

/**
 * A card on the reveal. While the story plays, the owner's card looks plain and my pick
 * keeps its yellow (`rv-hold-plain`, `rv-hold-chosen`); let go, the owner's card pops (it
 * bounces when it was my pick too) and my wrong pick shakes, the app's own entrances.
 */
function revealCard(g, d, p) {
  const mine = g.players.find((x) => x.id === g.me).pick;
  const name = esc(p.name);
  if (p.id === g.owner) {
    const won = mine === p.id;
    return `<div class="${CARD} ${d.card} ${LOOK.right} ${won ? 'rv-hold-chosen z-1 data-go:animate-win' : 'rv-hold-plain data-go:animate-reveal'} motion-reduce:animate-none" data-card="${p.id}" aria-label="${name}: their photo">${inside(p, d, badge(d, '✓', 'text-green'))}</div>`;
  }
  if (p.id === mine) return `<div class="${CARD} ${d.card} ${LOOK.wrong} rv-hold-chosen data-go:animate-jiggle motion-reduce:animate-none" data-card="${p.id}" aria-label="${name}: your pick, wrong">${inside(p, d, badge(d, '✗', 'text-red'))}</div>`;
  return `<div class="${CARD} ${d.card} ${LOOK.plain}" data-card="${p.id}">${inside(p, d)}</div>`;
}

/** The reveal of round `g.round.n`, in its final state (the story holds the result back, see above). */
export function revealScreen(g) {
  const d = densityOf(g.players.length);
  return {
    key: 'game|reveal',
    layout: `<div class="screen h-dvh">
      <div data-part="bar"></div>
      <div data-part="timer"></div>
      <div class="relative min-h-0 flex-1 overflow-hidden rounded-3xl bg-stage" data-part="stage"></div>
      <div data-part="opts"></div>
      <div class="mt-3 flex h-15 flex-col justify-end"><div data-part="dots"></div><div data-part="after"></div></div>
    </div>`,
    parts: {
      bar: topBar(LEAVE_BUTTON, barTitle(`${g.round.n} / ${g.round.total}`)),
      timer: timerBar('look'),
      stage: stage(),
      opts: `<div class="mt-3 grid ${d.grid}">${g.players.map((p) => revealCard(g, d, p)).join('')}</div>`,
      dots: '',
      after: `<div class="rv-waits data-go:animate-fade" data-after>${reactionsRow(REACTIONS)}</div>`,
    },
  };
}
