/**
 * Everything drawn over the screens: the start of a game ("Is everyone here?" on every phone
 * when a group's first game was not confirmed on the last player's phone, "Get ready", then
 * the 3-2-1 as a film leader),
 * the "Reconnecting…" banner, the photo held to look at, and the two full screens without
 * game content (joining, and "this game is open somewhere else": the same player connected
 * again, for example after the app was restored while an older connection was still alive).
 *
 * Mechanisms: `main.js` paints the start into `#cover` and the held photo into `#look`
 * (each with the one painter, `startScreen` and `lookScreen`), and the banner into
 * `#banner`; the banner appears only after the connection has been down for a moment, so
 * short hiccups never flash it. The start belongs to the lobby's phases (a change during it
 * returns to the lobby at once), so it is drawn over the lobby, on the page's own
 * background (`bg-page`) and fully opaque: nothing of the lobby shows through, and it looks
 * like a screen of its own. The held photo
 * is the app's one way to see a photo big ("hold to look", `main.js`): the whole photo on
 * dark, like the stage. A photo of the choice shows its preview at once and its big version
 * fades in above it the moment it is decoded (`photos.holdPhoto`), so it gets sharper in
 * place and is never empty.
 */

import { SPINNER, esc, progress } from '../ui.js';

export const BANNER_DELAY_MS = 1500;

/**
 * The room-wide "Is everyone here?", the fallback: a group's first game normally asks on
 * the last player's phone before their Yes (the 'start' sheet, `views/sheets.js`), and the
 * room starts at once. Only when everyone said "Yes" without that (the last one left or was
 * removed, two said Yes at the same moment, the last Yes came from an older app) does every
 * phone ask (`view.start` 'ask' with `everyone`): Yes starts it, No lets the group wait for
 * whoever is missing ("Start now" appears in the lobby, `views/lobby.js`). Anyone may answer
 * for the group.
 */
const ASK = {
  key: 'ask',
  layout: `<div class="fixed inset-0 z-50 grid place-items-center bg-page px-6"><div class="w-full max-w-90 text-center">
    <div class="text-6xl leading-none">🙋</div>
    <h2 class="mt-4 font-display text-5xl font-extrabold">Is everyone here?</h2>
    <p class="mt-2 mb-7 text-muted">Anyone who joins later plays without photos.</p>
    <div class="flex flex-col gap-2.5"><button class="btn bg-green text-navy" data-act="go">Yes, start</button><button class="btn" data-act="wait">No, wait</button></div>
  </div></div>`,
  parts: {},
};

/**
 * The 3-2-1 as a film leader, the countdown at the head of a film reel (chosen from
 * drafts/countdown_animations): a frame over the screen with crosshairs and two circles, the
 * number in their middle, and a hand that goes round once per number, leaving its shadow
 * behind it (CSS animations of one second, `animate-hand`, `animate-sweep`); the frame
 * weaves a little, like film in a projector (`animate-weave`), and the number changes with
 * a cut, as film does. The shadow is a circle half as wide as its stroke, so its stroke is
 * a filled pie; its length is 100 (radius 100 / 2π), so it runs out from 100 to 0. With
 * Reduce Motion the leader stands still: the circles and the number, without the hand.
 */
const leader = (n) => `<div class="screen h-dvh"><div class="relative grid flex-1 animate-weave place-items-center overflow-hidden rounded-3xl border-2 border-line motion-reduce:animate-none">
  <i class="absolute inset-y-0 left-1/2 w-px bg-line-strong"></i><i class="absolute inset-x-0 top-1/2 h-px bg-line-strong"></i>
  <div class="relative grid size-60 place-items-center">
    <svg class="col-start-1 row-start-1 size-full" viewBox="0 0 80 80" aria-hidden="true">
      <circle cx="40" cy="40" r="15.9155" class="fill-none animate-sweep stroke-raised motion-reduce:animate-none" stroke-width="31.83" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 40 40)"/>
      <circle cx="40" cy="40" r="36.4" class="fill-none stroke-ink/40" stroke-width="2" vector-effect="non-scaling-stroke"/>
      <circle cx="40" cy="40" r="31.83" class="fill-none stroke-ink/40" stroke-width="2" vector-effect="non-scaling-stroke"/>
    </svg>
    <i class="absolute bottom-1/2 left-1/2 -ml-px h-[39.8%] w-0.5 origin-bottom animate-hand bg-ink/80 motion-reduce:hidden"></i>
    <span class="relative col-start-1 row-start-1 font-display text-9xl leading-none font-extrabold text-ink" data-count="${n}">${n}</span>
  </div>
</div></div>`;

/**
 * The start of a game, or null: the room-wide "Is everyone here?" (`ASK`, the fallback), then
 * the room's three steps (`view.phase` 'countdown', `src/game/rules.js`): "Get ready" while
 * photos are still on their way (a bar: how far the group's uploads are, `sendShare`, this
 * phone's own counted exactly) or while the phones get the first photo (a spinner: it takes
 * a moment); then the 3-2-1 (`count`), the film leader (`leader`). Each number is a new
 * element, so its hand goes round once (a number that stays, the 1 until the first photo
 * appears, keeps its round full), and `main.js` feels each one as it is painted and keeps it
 * on the room's second (web/js/countdown.js).
 */
export function startScreen(view, leftMs, sendShare) {
  if (!view || !view.me) return null;
  if (view.phase === 'lobby' && view.start && view.start.mode === 'ask' && view.start.everyone && !view.me.onResults) return ASK;
  if (view.phase !== 'countdown') return null;
  const n = leftMs === null ? null : Math.max(1, Math.ceil(leftMs / 1000));
  const wait = view.uploads && sendShare !== null ? progress(sendShare, 'Sending photos') : SPINNER;
  return {
    key: 'start',
    // Both parts share the one cell, the whole screen; the empty one shows nothing.
    layout: '<div class="fixed inset-0 z-50 grid bg-page"><div class="col-start-1 row-start-1 grid place-items-center px-10"><div class="w-full max-w-80 text-center" data-part="wait"></div></div><div class="col-start-1 row-start-1" data-part="count"></div></div>',
    parts: {
      wait: n === null ? `<div class="mb-6 font-display text-5xl font-extrabold text-yellow">Get ready</div>${wait}` : '',
      count: n === null ? '' : leader(n),
    },
  };
}

export function bannerHtml(session, now) {
  const down = session.code && session.conn === 'down' && now - session.downSince > BANNER_DELAY_MS;
  return down ? '<div class="fixed inset-x-0 top-0 z-70 animate-fade bg-warning px-3 pt-[calc(--spacing(2)+env(safe-area-inset-top))] pb-2 text-center text-sm text-warning-ink" role="status">Reconnecting…</div>' : '';
}

/**
 * The photo over everything while a finger holds it, or null: `{ key, base, sharp }`, its
 * preview (or the round's photo) and, once decoded, its sharp version above it. `key` names
 * what is held, so while the sharp layer is added the painter keeps the overlay (its fade
 * does not play again) and the preview as they are, and only the sharp layer fades in.
 */
export function lookScreen(look) {
  if (!look) return null;
  const layer = (src, alt, extra = '') => `<img class="col-start-1 row-start-1 size-full object-contain ${extra}" alt="${alt}" src="${esc(src)}">`;
  return {
    key: `look|${look.key}`,
    layout: `<div class="fixed inset-0 z-65 grid animate-fade place-items-center bg-stage pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"><div class="contents" data-part="base"></div><div class="contents" data-part="sharp"></div></div>`,
    // The sharp layer is the same photo: the preview below already names it for screen readers.
    parts: { base: layer(look.base, 'Photo'), sharp: look.sharp ? layer(look.sharp, '', 'animate-fade') : '' },
  };
}

export const joiningScreen = {
  key: 'joining',
  layout: `<div class="screen"><div class="my-auto">${SPINNER}</div></div>`,
  parts: {},
};

export const awayScreen = {
  key: 'away',
  layout: `<div class="screen"><div class="my-auto text-center"><p class="mb-4.5 font-display text-3xl font-extrabold">This game is open somewhere else.</p><button class="btn bg-coral text-white" data-act="here">Play here</button></div></div>`,
  parts: {},
};
