/**
 * The website: what the app's page shows when it is opened in a plain browser (no
 * `Phone` plugin, `phone.inApp`). It is the invite page behind every shared link
 * `https://<server>/<CODE>` and the QR code: get the app, or open the game in it.
 *
 * Mechanisms: `main.js` shows only this screen outside the apps; there is no game, no
 * socket and nothing stored in a browser. "Open in the app" uses the app's link scheme
 * (`APP.scheme`), which the store apps register (`phone.onInvite` receives it).
 * Store buttons come from `STORES`; a store without a link yet is left out.
 */

import { APP, STORES } from '../../shared/config.js';
import { NAME_TITLE, esc, hero } from '../ui.js';
import { legalFooter } from './home.js';

const SMALL = 'mb-2 block text-center text-sm text-muted';

export function landingScreen(code) {
  const stores = [
    // Plain text buttons: the official store badges and logos have their own usage rules.
    STORES.ios ? `<a class="btn" href="${esc(STORES.ios)}" rel="noopener">App Store (iPhone)</a>` : '',
    STORES.android ? `<a class="btn" href="${esc(STORES.android)}" rel="noopener">Google Play (Android)</a>` : '',
  ].join('');
  const open = code
    ? `<div class="rounded-3xl bg-card px-4 py-4.5 text-center"><small class="${SMALL}">You’re invited to game</small>
        <div class="mb-3.5 font-display text-6xl font-extrabold tracking-[.25em] text-yellow">${esc(code)}</div>
        <a class="btn bg-coral text-white" href="${esc(`${APP.scheme}://join/${code}`)}">Open in the app</a></div>`
    : '';
  return {
    key: `landing|${code || ''}`,
    layout: `<div class="screen">
      <div class="my-auto pt-4">
        ${hero(NAME_TITLE, { more: '<p class="mx-auto mt-3 max-w-80 leading-snug font-medium text-muted">The party game with the photos on your phones. Guess whose photo it is!</p>' })}
        <div class="space-y-3">${open}<div class="space-y-2.5"><small class="${SMALL}">${code ? 'No app yet? Get it free:' : 'Get the free app:'}</small>${stores}</div></div>
      </div>
      ${legalFooter()}
    </div>`,
    parts: {},
  };
}
