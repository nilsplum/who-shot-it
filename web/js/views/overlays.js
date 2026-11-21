/**
 * Everything drawn over the screens: the 3-2-1 countdown, the "Reconnecting…" banner,
 * and the two full screens without game content (joining, and "this game is open
 * somewhere else": the same player connected again, for example after the app was
 * restored while an older connection was still alive).
 *
 * Mechanisms: `main.js` paints the countdown into `#cover` and the banner into `#banner`;
 * the banner appears only after the connection has been down for a moment, so short
 * hiccups never flash it.
 */

export const BANNER_DELAY_MS = 1500;

export function countdownHtml(view, leftMs) {
  if (!view || view.phase !== 'countdown' || leftMs === null) return '';
  return `<div class="cnt"><span>${Math.max(1, Math.ceil(leftMs / 1000))}</span></div>`;
}

export function bannerHtml(session, now) {
  const down = session.code && session.conn === 'down' && now - session.downSince > BANNER_DELAY_MS;
  return down ? '<div class="banner" role="status">Reconnecting…</div>' : '';
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
