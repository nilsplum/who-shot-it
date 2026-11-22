/**
 * The first screen of the app after every install and update: the few rules everyone
 * agrees to before playing
 * (minimum age, only photos the people in them would be okay with, nothing hurtful,
 * reports delete at once), with the terms and privacy policy one tap away.
 *
 * Mechanisms: `main.js` shows it while `device.agreed` is not the current `termsToken()`
 * (the legal date and the app version), so every new app version and every change to the
 * terms asks everyone once more, without anyone having to remember it. "I agree" stores
 * the token on the phone. The app stores require that players accept the terms before they
 * can share anything, and the terms are what makes removing content and players fair.
 */

import { LEGAL } from '../../shared/config.js';
import { serverUrl } from '../api.js';
import { LOGO, esc } from '../ui.js';

export function welcomeScreen() {
  const terms = esc(serverUrl('/legal#terms'));
  const privacy = esc(serverUrl('/legal#privacy'));
  return {
    key: 'welcome',
    layout: `<div class="wrap">
      <div class="hero small">${LOGO}<h1 class="disp">Welcome!</h1></div>
      <ul class="steps">
        <li><span>🎂</span>You are ${LEGAL.minAge} or older.</li>
        <li><span>📷</span>You only share photos the people in them would be okay with.</li>
        <li><span>🚫</span>Nothing hurtful, sexual or illegal. Anyone can report a photo, and it is deleted at once.</li>
      </ul>
      <p class="fine">By playing you agree to the <a href="${terms}" target="_blank" rel="noopener">terms</a>. How we handle your data: <a href="${privacy}" target="_blank" rel="noopener">privacy</a>.</p>
      <div class="spacer"></div>
      <button class="btn main" data-act="agree">I agree, let’s play</button>
    </div>`,
    parts: {},
  };
}
