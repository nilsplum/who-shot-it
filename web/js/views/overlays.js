/**
 * Everything drawn over the screens: the 3-2-1 countdown, the "Reconnecting…" banner, the
 * photo held to look at, and the two full screens without game content (joining, and
 * "this game is open somewhere else": the same player connected again, for example after
 * the app was restored while an older connection was still alive).
 *
 * Mechanisms: `main.js` paints the countdown into `#cover`, the banner into `#banner` and
 * the held photo into `#look`; the banner appears only after the connection has been
 * down for a moment, so short hiccups never flash it. The held photo is the app's one way
 * to see a photo big ("hold to look", `main.js`): the whole photo on dark, like the stage.
 */

import { esc } from '../ui.js';

export const BANNER_DELAY_MS = 1500;

export function countdownHtml(view, leftMs) {
  if (!view || view.phase !== 'countdown' || leftMs === null) return '';
  return `<div class="cnt"><span>${Math.max(1, Math.ceil(leftMs / 1000))}</span></div>`;
}

export function bannerHtml(session, now) {
  const down = session.code && session.conn === 'down' && now - session.downSince > BANNER_DELAY_MS;
  return down ? '<div class="banner" role="status">Reconnecting…</div>' : '';
}

/** The photo at `src` over everything while a finger holds it, or nothing. */
export function lookHtml(src) {
  return src ? `<div class="look"><img alt="Photo" src="${esc(src)}"></div>` : '';
}

export const joiningScreen = {
  key: 'joining',
  layout: '<div class="wrap"><div class="away"><div class="spin"></div></div></div>',
  parts: {},
};

export const awayScreen = {
  key: 'away',
  layout: `<div class="wrap"><div class="away"><p>This game is open somewhere else.</p><button class="btn main" data-act="here">Play here</button></div></div>`,
  parts: {},
};
