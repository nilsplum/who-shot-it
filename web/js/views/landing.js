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
import { LOGO, esc } from '../ui.js';
import { legalLink } from './home.js';

export function landingScreen(code) {
  const stores = [
    // Plain text buttons: the official store badges and logos have their own usage rules.
    STORES.ios ? `<a class="btn" href="${esc(STORES.ios)}" rel="noopener">App Store (iPhone)</a>` : '',
    STORES.android ? `<a class="btn" href="${esc(STORES.android)}" rel="noopener">Google Play (Android)</a>` : '',
  ].join('');
  const open = code
    ? `<div class="invite"><small>You’re invited to game</small><div class="big-code">${esc(code)}</div>
        <a class="btn main" href="${esc(`${APP.scheme}://join/${code}`)}">Open in the app</a></div>`
    : '';
  return {
    key: `landing|${code || ''}`,
    layout: `<div class="wrap">
      <div class="hero">${LOGO}<h1 class="disp">Who <span>Shot It?</span></h1>
        <p class="tagline">The party game with the photos on your phones. Guess whose photo it is!</p></div>
      <div class="stack">${open}<div class="stores"><small>${code ? 'No app yet? Get it free:' : 'Get the free app:'}</small>${stores}</div></div>
      <div class="spacer"></div>
      <div class="foot">${legalLink()}</div>
    </div>`,
    parts: {},
  };
}
