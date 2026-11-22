/**
 * The start screen: name, avatar, create a game or join one.
 *
 * Mechanisms: shown in the app while the player is in no game. The code field holds the
 * last game's code (`device.lastRoom`), so the same group is one tap away. Opened through
 * an invite link (`phone.onInvite`), it becomes a one-tap join screen for that code, with
 * creating a new game as a small link below. "Create game" leads to the "New game" step
 * (`views/newgame.js`). Actions (`data-act`) are handled in `main.js`.
 */

import { LIMITS } from '../../shared/config.js';
import { serverUrl } from '../api.js';
import { LOGO, colourOf, esc } from '../ui.js';

/** The legal page opens in the phone's browser (it lives on the server, `web/legal.html`). */
export const legalLink = (text = 'Legal &amp; privacy') => `<a href="${esc(serverUrl('/legal'))}" target="_blank" rel="noopener">${text}</a>`;

export function homeScreen({ device, session }) {
  const invite = session.invite;
  const actions = invite
    ? `<button class="btn main" data-act="join">Join ${esc(invite)}</button>`
    : `<button class="btn main" data-act="create">Create game</button>
       <div class="joinrow"><input type="text" id="code" maxlength="${LIMITS.codeLength}" placeholder="CODE" value="${esc(device.lastRoom || '')}" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-label="Game code"><button class="btn join" data-act="join">Join</button></div>`;
  return {
    key: `home|${invite || ''}`,
    layout: `<div class="wrap">
      <div class="top"><span></span><span></span><button class="icon qmark" data-act="help" aria-label="How to play">?</button></div>
      <div class="hero">${LOGO}<h1 class="disp">Who <span>Shot It?</span></h1></div>
      <div class="stack">
        <div class="who"><span data-part="avatar"></span><input type="text" id="name" maxlength="${LIMITS.nameMax}" placeholder="Your name" value="${esc(device.name)}" autocomplete="off" enterkeyhint="done" aria-label="Your name"></div>
        ${actions}
      </div>
      ${invite ? '<button class="link" data-act="newgame">Create a new game</button>' : ''}
      <div class="spacer"></div>
      <div class="foot">${legalLink()}</div>
    </div>`,
    parts: {
      avatar: `<button class="av" data-act="avatar" aria-label="Pick your avatar" style="--c:${colourOf(device.avatar)}">${esc(device.avatar)}</button>`,
    },
  };
}
