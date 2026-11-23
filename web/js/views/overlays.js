/**
 * Everything drawn over the screens: the start of a game ("Is everyone here?" before a
 * group's first game, "Get ready", then the 3-2-1),
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
 * A group's first game asks before it starts, on every phone once everyone said "Yes"
 * (`view.start`): Yes starts it, No lets the group wait for whoever is missing ("Start now"
 * appears in the lobby, `views/lobby.js`). Anyone may answer for the group.
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
 * The start of a game, or null: "Is everyone here?" (`ASK`) in a group's first lobby, then
 * the room's three steps (`view.phase` 'countdown', `src/game/rules.js`): "Get ready" while
 * photos are still on their way (a bar: how far the group's uploads are, `sendShare`, this
 * phone's own counted exactly) or while the phones get the first photo (a spinner: it takes
 * a moment); then the 3-2-1 (`count`). Each number is a new element, so its entrance plays
 * once (a number that stays, the 1 until the first photo appears, stays still), and
 * `main.js` feels each one as it is painted.
 */
export function startScreen(view, leftMs, sendShare) {
  if (!view || !view.me) return null;
  if (view.phase === 'lobby' && view.start && view.start.mode === 'ask' && view.start.everyone && !view.me.onResults) return ASK;
  if (view.phase !== 'countdown') return null;
  const n = leftMs === null ? null : Math.max(1, Math.ceil(leftMs / 1000));
  const wait = view.uploads && sendShare !== null ? progress(sendShare, 'Sending photos') : SPINNER;
  return {
    key: 'start',
    // Both parts share the one cell in the middle; the empty one takes no room.
    layout: '<div class="fixed inset-0 z-50 grid place-items-center bg-page px-10"><div class="col-start-1 row-start-1 w-full max-w-80 text-center" data-part="wait"></div><div class="col-start-1 row-start-1" data-part="count"></div></div>',
    parts: {
      wait: n === null ? `<div class="mb-6 font-display text-5xl font-extrabold text-yellow">Get ready</div>${wait}` : '',
      count: n === null ? '' : `<span class="block animate-count font-display text-9xl font-extrabold text-yellow motion-reduce:animate-none" data-count="${n}">${n}</span>`,
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
