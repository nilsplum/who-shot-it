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
import { esc, hero, steps } from '../ui.js';

export function welcomeScreen() {
  const link = (path, text) => `<a class="text-ink underline" href="${esc(serverUrl(path))}" target="_blank" rel="noopener">${text}</a>`;
  return {
    key: 'welcome',
    layout: `<div class="screen">
      <div class="my-auto pb-6">
        ${hero('Welcome!', { small: true })}
        ${steps([
          ['🎂', `You are ${LEGAL.minAge} or older.`],
          ['📷', 'You only share photos the people in them would be okay with.'],
          ['🚫', 'Nothing hurtful, sexual or illegal. Anyone can report a photo, and it is deleted at once.'],
        ])}
        <p class="text-center text-xs leading-normal font-medium text-muted">By playing you agree to the ${link('/legal#terms', 'terms')}. How we handle your data: ${link('/legal#privacy', 'privacy')}.</p>
      </div>
      <button class="btn bg-coral text-white" data-act="agree">I agree, let’s play</button>
    </div>`,
    parts: {},
  };
}
