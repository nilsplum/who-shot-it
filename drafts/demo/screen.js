/**
 * The demo draft's screen: the app's own pieces (its top bar, avatars, button classes and
 * colours), arranged like a small lobby, and the players' entrance of the chosen frame.
 *
 * Mechanisms: runs in a phone frame of the demo's page (drafts/kit/page.js) and paints
 * into #app like the app does. It imports the app's helpers from /js/ui.js (served from
 * web/ by scripts/helpers/drafts.mjs), so the pieces look exactly as in the app; the
 * entrances are theme entries of its style.css, used as classes. `buzz` shows each light
 * tap under the phone.
 *
 * Invariants: the way the app plays an entrance (AGENTS.md, Rendering): the markup is the
 * final state, whole class names picked per frame; the story only sets `data-*` attributes
 * over it (`data-playing` hides what has not arrived, `data-go` lets each piece arrive). Until
 * the page's Play (`play`), and always with Reduce Motion, the final screen shows at once.
 */
import { buzz, options, play, wait } from '/kit/screen.js';
import { LEAVE_BUTTON, avatar, esc, topBar } from '/js/ui.js';

/** Stand-in players (never real people): a name and an avatar of the app's list. */
const PLAYERS = [['Lena', '🦊'], ['Ben', '🐼'], ['Ana', '🐸'], ['Max', '🦄'], ['Mia', '🐙'], ['Leo', '🦁']].map(([name, emoji]) => ({ name, avatar: emoji }));

const players = PLAYERS.slice(0, Number(options.players) || 3);
/** How a piece arrives, per frame: whole class names, so Tailwind builds them. */
const ENTRANCE = { pop: 'data-go:animate-demo-pop', slide: 'data-go:animate-demo-slide' };
/** Hidden while the story plays, until the piece's own `data-go`. */
const WAITS = 'in-data-playing:not-data-go:invisible motion-reduce:animate-none';
const pill = (p) => `<div class="flex items-center gap-1.75 rounded-full border-2 border-green bg-card py-0.5 pr-3 pl-0.5 text-sm ${ENTRANCE[options.frame] || ENTRANCE.pop} ${WAITS}" data-pill>${avatar(p)}<span>${esc(p.name)}</span></div>`;

document.getElementById('app').innerHTML = `<div class="screen h-dvh">
  ${topBar(LEAVE_BUTTON)}
  <h1 class="mt-6 text-center font-display text-6xl font-extrabold">Who’s here?</h1>
  <div class="mt-6 flex flex-wrap justify-center gap-1.5">${players.map(pill).join('')}</div>
  <button class="btn mt-auto bg-coral text-white data-go:animate-demo-bump ${WAITS}" data-start>Start game</button>
</div>`;

if (play) {
  const screen = document.getElementById('app').firstElementChild;
  // In the same task as the paint, so no frame shows the end first.
  screen.setAttribute('data-playing', '');
  await wait(400);
  for (const el of document.querySelectorAll('[data-pill]')) {
    el.setAttribute('data-go', '');
    buzz('tap');
    await wait(220);
  }
  await wait(200);
  document.querySelector('[data-start]').setAttribute('data-go', '');
}
