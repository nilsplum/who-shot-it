/**
 * Everything drawn over the screens: the 3-2-1 countdown, the "Reconnecting…" banner, the
 * photo held to look at, and the two full screens without game content (joining, and
 * "this game is open somewhere else": the same player connected again, for example after
 * the app was restored while an older connection was still alive).
 *
 * Mechanisms: `main.js` paints the countdown into `#cover`, the banner into `#banner` and
 * the held photo into `#look` (with the one painter, `lookScreen`); the banner appears only
 * after the connection has been down for a moment, so short hiccups never flash it. The
 * 3-2-1 belongs to the lobby's phases (a change during it returns to the lobby at once), so
 * it is drawn over the lobby, on the page's own background (`bg-page`) and fully opaque:
 * nothing of the lobby shows through, and it looks like a screen of its own. The held photo
 * is the app's one way to see a photo big ("hold to look", `main.js`): the whole photo on
 * dark, like the stage. A photo of the choice shows its preview at once and its big version
 * fades in above it the moment it is decoded (`photos.holdPhoto`), so it gets sharper in
 * place and is never empty.
 */

import { SPINNER, esc } from '../ui.js';

export const BANNER_DELAY_MS = 1500;

export function countdownHtml(view, leftMs) {
  if (!view || view.phase !== 'countdown' || leftMs === null) return '';
  return `<div class="fixed inset-0 z-50 grid place-items-center bg-page font-display text-9xl font-extrabold text-yellow"><span class="animate-count">${Math.max(1, Math.ceil(leftMs / 1000))}</span></div>`;
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
