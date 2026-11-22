/**
 * The start screen: name, avatar, create a game or join one.
 *
 * Mechanisms: shown in the app while the player is in no game. The code field holds the
 * last game's code (`device.lastRoom`), so the same group is one tap away. Opened through
 * an invite link (`phone.onInvite`), it becomes a one-tap join screen for that code, with
 * creating a new game as a small link below. "Create game" leads to the "New game" step
 * (`views/newgame.js`). Actions (`data-act`) are handled in `main.js`. The logo, the name
 * and the form sit in the middle of the free space; the legal link stays at the bottom.
 */

import { LIMITS } from '../../shared/config.js';
import { serverUrl } from '../api.js';
import { HELP_BUTTON, NAME_TITLE, colourOf, esc, hero, topBar } from '../ui.js';

/** The legal page opens in the phone's browser (it lives on the server, `web/legal.html`). */
export const legalLink = (text = 'Legal &amp; privacy') => `<a href="${esc(serverUrl('/legal'))}" target="_blank" rel="noopener">${text}</a>`;

/** The legal link at the bottom of the start screen and the website. */
export const legalFooter = () => `<div class="mt-6 text-center text-xs text-muted">${legalLink()}</div>`;

/** The two text fields (name and code): dark, with a yellow border while typing. */
const FIELD = 'w-full rounded-2xl border-2 border-transparent bg-raised px-4 py-3.75 text-ink outline-hidden placeholder:text-hint focus:border-yellow';

export function homeScreen({ device, session }) {
  const invite = session.invite;
  const actions = invite
    ? `<button class="btn bg-coral text-white" data-act="join">Join ${esc(invite)}</button>`
    : `<button class="btn bg-coral text-white" data-act="create">Create game</button>
       <div class="flex gap-2.5"><input class="${FIELD} text-center font-display text-3xl font-extrabold tracking-[.35em] uppercase" type="text" id="code" maxlength="${LIMITS.codeLength}" placeholder="CODE" value="${esc(device.lastRoom || '')}" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="go" aria-label="Game code"><button class="btn w-auto shrink-0 bg-yellow px-5 text-navy" data-act="join">Join</button></div>`;
  return {
    key: `home|${invite || ''}`,
    layout: `<div class="screen">
      ${topBar('', '', HELP_BUTTON)}
      <div class="my-auto pt-4">
        ${hero(NAME_TITLE)}
        <div class="space-y-3">
          <div class="flex gap-2.5"><span data-part="avatar"></span><input class="${FIELD} text-xl font-bold" type="text" id="name" maxlength="${LIMITS.nameMax}" placeholder="Your name" value="${esc(device.name)}" autocomplete="off" enterkeyhint="done" aria-label="Your name"></div>
          ${actions}
        </div>
        ${invite ? '<button class="link" data-act="newgame">Create a new game</button>' : ''}
      </div>
      ${legalFooter()}
    </div>`,
    parts: {
      avatar: `<button class="grid size-14 place-items-center rounded-2xl border-2 border-player bg-player-fill text-5xl leading-none active:scale-95" data-act="avatar" aria-label="Pick your avatar" style="--player:${colourOf(device.avatar)}">${esc(device.avatar)}</button>`,
    },
  };
}
