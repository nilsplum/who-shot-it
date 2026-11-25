/**
 * The lobby: the room code, the settings summary, who is here and ready, and the
 * player's own photos: n random ones from the phone, "Play with these?" Yes / "No →".
 *
 * Mechanisms: shown in the `lobby` and `countdown` phases. `main.js` deals the photos by
 * itself as soon as the app may read them (`photos.roll`); the first time, the player is
 * asked once ("Continue" shows the phone's own question), and if access is off, "Open
 * settings" leads to the switch. The game starts by itself when everyone said "Yes"
 * (server rule `everyoneSaidYes`). The player whose Yes would start it sees a stamped START
 * on their Yes (`nudge.startsWith`); in a group's first game that Yes asks "Is everyone
 * here?" on their phone first (the 'start' sheet, `main.js` `sayYes`). Only when everyone
 * said Yes without that (the last one left or was removed, two at once, an older app) does
 * every phone ask (`views/overlays.js`), and after a No "Start now" appears at the bottom
 * while it can start the game (`startNow`). The start ("Get
 * ready", the 3-2-1) is an overlay (`views/overlays.js`). Tapping the code opens the invite sheet, tapping the settings
 * summary opens the settings sheet (read-only for everyone but the host), and tapping a
 * player opens "Remove?" (the host may remove anyone, everyone a player who is offline;
 * nobody is removed for being offline).
 *
 * The players: a small pill each, its border always 2 px (so nothing shifts): green when
 * ready, dashed grey while the game waits for them to be ready, red and glowing slowly with
 * "Offline, tap to remove" while they are offline, never faded. They take exactly two rows
 * that scroll sideways together, with an arrow at their right while they do not all fit
 * (`players`, `ui.sidewaysRow`), so the photo grid keeps the same room for 2 players or 16.
 *
 * The photos: a grid of 2 x 2 to 5 x 5 places (by "Photos per player") filling the room
 * between the players and the buttons, exactly as wide as No and Yes; on a short screen
 * (`short:`) the code and the gaps above it are smaller to leave it more. Tapping a photo
 * swaps it (`photos.swap`): the tile turns over like a card, the old photo away and the new
 * one in. The line under the grid counts the swaps left ("(3 left)" in green, bumping as it
 * goes down, red and shaking at 0 and again on every refused tap); holding a photo shows it
 * big (`main.js`, hold to look). "Yes" makes the player ready at once: the set stays with
 * "✓ Ready" while its photos go in the background (`session.sending`; only if the group
 * waits for them does the start show how far they are, `views/overlays.js`). Every wait
 * shows itself: "Picking photos…" under a spinner before the first set, and the set dimmed
 * under a spinner while No waits for new photos.
 *
 * The photo area is five parts (`title`, `pick`, `note`, `actions`, `links`), so what
 * changes often (the swap counter) never repaints the grid and its photos.
 *
 * The bubble: while the group waits for one last player, the others' phones show a comic
 * bubble over the photos teasing them (`web/js/nudge.js` decides when and what, `context.nudge`
 * is the moment's appearance): a speech bubble in that player's colour slides in from a side,
 * the other players' small bubbles call the name, and it leaves again (`nudge`). It is a part
 * of its own (`nudge`), laid over the photos and taking no tap, so holding a photo, "Change"
 * and the players all work through it; its markup changes only when an appearance starts or
 * begins to leave, and main.js fits its line right after it is painted (`fitNudge`).
 */

import { SETTINGS, normalizeSettings } from '../../shared/config.js';
import { NUDGE, bulgeRows, startsWith } from '../nudge.js';
import { photos } from '../photos.js';
import { HELP_BUTTON, LEAVE_BUTTON, OFFLINE_LOOK, SPINNER, avatar, canRemove, colourOf, esc, sidewaysRow, topBar } from '../ui.js';

const label = (key, value) => {
  const setting = SETTINGS.find((s) => s.key === key);
  const option = setting.options.find(([v]) => v === value);
  return option ? option[1] : '';
};

export function settingsSummary(s) {
  return [`${s.photos} photos`, s.rounds ? `${s.rounds} rounds` : '', s.time ? `${s.time} s` : '∞', label('mode', s.mode)].filter(Boolean).join(' · ');
}

/** The grid's columns and rows by its side (whole class names, so Tailwind builds them). */
const SIDES = { 2: 'grid-cols-2 grid-rows-2', 3: 'grid-cols-3 grid-rows-3', 4: 'grid-cols-4 grid-rows-4', 5: 'grid-cols-5 grid-rows-5' };

/**
 * The photos as a grid of `size` places (the setting), filling its box: the box takes the
 * free space (a size container), the grid its full width (as wide as No and Yes) and as much
 * of its height as keeps a tile at most 3:4 portrait (`100cqw * 4/3`, the gaps aside); in a
 * taller box it sits in the middle. Its rows and columns stretch, so the tiles take the free
 * space's shape. Only below 9rem of free height (7rem on a short screen, which has the least
 * to give) does the page scroll instead. Without container units (iOS 15) the tiles are square and the grid
 * takes the full width. `busy` dims it under a spinner while "No" waits for new photos.
 */
function grid(tiles, size, busy = false) {
  const wait = busy ? `<div class="absolute inset-0 grid place-items-center">${SPINNER}</div>` : '';
  return `<div class="@container-size relative flex min-h-36 flex-1 flex-col justify-center short:min-h-28"><div class="grid w-full gap-1 supports-[width:1cqw]:h-[min(100cqh,calc(100cqw*4/3))] ${SIDES[Math.ceil(Math.sqrt(size))]} ${busy ? 'opacity-40' : ''}">${tiles.join('')}</div>${wait}</div>`;
}

/** A place in the grid; it takes the shape the grid gives it (square without container units, see `grid`). */
const TILE = 'relative grid place-items-center rounded-lg bg-card text-4xl text-white not-supports-[width:1cqw]:aspect-square';
/** How a photo enters the set: dealt in (a fade), or turned over by a swap (`transform-3d` keeps its two faces in 3D). */
const ENTRANCE = { in: 'animate-deal', flip: 'animate-flip transform-3d' };

/**
 * One face of a tile: the photo filling it. The back face (the photo a swap replaced) is
 * turned away from the start (`rotate-y-180`), and a face never shows its back, so the turn
 * shows the old photo until half way, then the new one.
 */
const face = (url, back = false) =>
  `<span class="absolute inset-0 rounded-lg bg-cover bg-center bg-no-repeat backface-hidden ${back ? 'rotate-y-180' : ''}" style="background-image:url('${url}')"></span>`;

/** The set on screen as tiles: tap to swap (unless `fixed`), hold to see big. */
function chosenTiles(fixed) {
  return photos.chosen.map((c, i) => {
    const cls = `${TILE} ${ENTRANCE[c.anim] || ''} motion-reduce:animate-none`;
    const faces = `${face(c.url)}${c.from ? face(c.from, true) : ''}`;
    const hold = `data-hold="tile" data-v="${i}"`;
    return fixed
      ? `<div class="${cls}" ${hold} role="img" aria-label="Photo ${i + 1}">${faces}</div>`
      : `<button class="${cls}" data-act="swap" ${hold} aria-label="Photo ${i + 1}: tap to swap it">${faces}</button>`;
  });
}

/**
 * The line under the grid: "Tap to swap (2 left), hold to preview". The count is green and
 * bumps each time it goes down; at 0 it is red and shakes, again on every refused tap. Its
 * markup carries the number and, at 0, the refusals so far (`photos.refusals`), so every
 * change is a new element whose animation plays once, and a repaint with the same markup
 * changes nothing.
 */
function swapsLine() {
  const n = photos.swaps;
  const count = n
    ? `<span class="inline-block animate-bump text-green motion-reduce:animate-none" data-n="${n}">(${n} left)</span>`
    : `<span class="inline-block animate-jiggle text-red motion-reduce:animate-none" data-n="0" data-try="${photos.refusals}">(0 left)</span>`;
  return `<p class="mt-2 text-center text-xs text-muted">Tap to swap ${count}, hold to preview</p>`;
}

const withoutPhotos = '<button class="link" data-act="guess">Play without photos</button>';

/** The dashed card that stands in for the photos while there are none to show. */
const PICK = 'w-full rounded-3xl border-2 border-dashed border-line-strong px-4 py-6.5 text-center';

/** The card shown instead of photos: why, and the one thing to tap. */
function card(icon, title, text, button) {
  return `<div class="${PICK}"><div class="text-6xl">${icon}</div><b class="mt-2 block text-2xl">${title}</b><small class="mt-1 block text-sm text-muted">${text}</small>${button}</div>${withoutPhotos}`;
}

const mainButton = (act, text) => `<button class="btn mt-4 bg-coral text-white" data-act="${act}">${text}</button>`;

/**
 * START, stamped onto the Yes of the player whose Yes would start the game: dark, extra bold,
 * in a thin frame, a little crooked, landing with the stamp the reveal's ✓ and ✗ use. Never
 * taller than the button's text line (one pixel of padding, no line gap), so the button keeps
 * its height whether it is there or not; a new element each time it appears, so it stamps
 * again then and never on a repaint.
 */
const START = '<span class="inline-block -rotate-8 animate-stamp rounded-md border-2 border-navy px-1.5 py-px font-display text-xs leading-none font-extrabold tracking-wider motion-reduce:animate-none" data-cell="start">START</span>';

/**
 * Yes (green) and "No →" (ice blue, a new set). The last player's Yes carries START next to
 * the word, the pair centred, so "Yes" moves a little to the left; its accessible name says
 * what it does.
 */
function actions(view) {
  const off = photos.rolling ? 'disabled' : '';
  const yes = startsWith(view, true)
    ? `<button class="btn flex items-center justify-center gap-2 bg-green text-navy" data-act="yes" data-start aria-label="Yes, start the game" ${off}>Yes${START}</button>`
    : `<button class="btn bg-green text-navy" data-act="yes" ${off}>Yes</button>`;
  return `<div class="mt-3.5 grid grid-cols-2 gap-2.5">${yes}<button class="btn bg-ice text-navy" data-act="no" aria-label="No, other photos" ${off}>No →</button></div>`;
}

/** The player's photo area as its five parts: `{ title, pick, note, actions, links }` (empty ones are ''). */
function mine({ view, session }) {
  const me = view.me;
  const parts = { title: '', pick: '', note: '', actions: '', links: '' };
  const ready = '<div class="mt-4 text-center"><b class="text-green">✓ Ready</b></div><button class="link" data-act="unready">Change</button>';
  // Ready from the moment "Yes" is tapped: the photos go in the background (`session.sending`).
  if (me.ready || session.sending) {
    const count = me.photoCount || (session.sending ? session.sending.count : 0);
    if (!count) return { ...parts, pick: ready };
    // The set as it was chosen ("Yes" sends no more of it than the game can show); without
    // the local previews (the app was closed meanwhile), neutral tiles stand in.
    const tiles = photos.chosen.length >= count && photos.chosen.every((c) => c.url)
      ? chosenTiles(true)
      : Array.from({ length: count }, () => `<div class="${TILE}">📷</div>`);
    return { ...parts, pick: grid(tiles, view.settings.photos), note: ready };
  }
  if (photos.chosen.length) {
    const limited = session.access === 'limited'
      ? '<button class="link" data-act="opensettings">Only some photos are shared. Share all ›</button>'
      : '';
    return {
      title: '<h2 class="mb-3 text-center font-display text-2xl font-extrabold short:mb-2 short:text-xl">Play with these?</h2>',
      pick: grid(chosenTiles(false), view.settings.photos, photos.rolling),
      note: swapsLine(),
      actions: actions(view),
      links: `${limited}${withoutPhotos}`,
    };
  }
  if (session.access === 'ask') {
    return { ...parts, pick: card('🖼️', 'Your photos', 'The game picks a few random photos from your phone. You see them first.', mainButton('allow', 'Continue')) };
  }
  if (session.access === 'denied') {
    return { ...parts, pick: card('🔒', 'Photos are turned off', 'Allow photos for this app in your phone’s settings.', mainButton('opensettings', 'Open settings')) };
  }
  if (photos.empty) {
    const limited = session.access === 'limited';
    const filtered = normalizeSettings(view.settings).filter !== 'all';
    const why = limited ? 'Share more photos with this app in your phone’s settings.'
      : filtered ? 'None of the photos here fit “Which photos” in the game settings.'
        : 'This phone has no photos the game can use.';
    return { ...parts, pick: card('🔍', 'No photos found', why, limited ? mainButton('opensettings', 'Open settings') : '') };
  }
  return { ...parts, pick: `<div class="${PICK}">${SPINNER}<p class="mt-3 text-sm text-muted">Picking photos…</p></div>` };
}

/**
 * The quiet line at the bottom: who the game is waiting on (not ready, still on the last
 * game's results, or offline), whether or not this player is ready already.
 */
function status({ view }) {
  const ps = view.players;
  const line = (text) => `<div class="mt-4 text-center text-muted">${text}</div>`;
  if (ps.length < 2) return line('Waiting for friends…');
  const waiting = ps.filter((p) => p.id !== view.me.id && (!p.ready || !p.connected));
  if (waiting.length) return `<div class="mt-2.5 text-center text-xs text-muted">Waiting on ${waiting.map((p) => esc(p.name)).join(', ')}</div>`;
  if (view.me.ready && !ps.some((p) => p.photoCount > 0 || p.sending)) return line('Someone needs photos.');
  return '';
}

/**
 * "Start now", the fallback's second half: on every phone once someone answered the
 * room-wide "Is everyone here?" with No (`view.start.mode` 'button', `views/overlays.js`),
 * big and pulsing at the bottom, but only while it can start the game (everyone said "Yes").
 * Before that the last player's own Yes starts it (its START), and a greyed button next to
 * that would only compete. Anyone may tap it.
 */
function startNow({ view }) {
  if (!view.start || view.start.mode !== 'button' || !view.start.everyone) return '';
  return '<button class="btn mt-3 animate-breathe bg-coral text-white motion-reduce:animate-none" data-act="go">Start now</button>';
}

/**
 * A player's pill, its look by how the game stands with them: ready (green), not ready
 * (dashed grey), offline (the red warning light, `ui.OFFLINE_LOOK`, with "Offline, tap to
 * remove" under the name). A player this phone may remove (`ui.canRemove`: the host anyone
 * else, everyone an offline player) is a button that opens the "Remove?" sheet. It is as
 * tall as its row (`players`), the offline note's two lines included, and a long name is cut
 * short, so one name never takes a row's width.
 */
function chip(view, p) {
  const offline = !p.connected;
  const look = offline ? OFFLINE_LOOK : p.ready ? 'border-green bg-card' : 'border-dashed border-line-strong bg-card';
  const name = offline
    ? `<span class="flex flex-col text-left"><span class="max-w-28 truncate leading-tight">${esc(p.name)}</span><small class="text-2xs leading-none whitespace-nowrap text-red">Offline, tap to remove</small></span>`
    : `<span class="max-w-28 truncate">${esc(p.name)}</span>`;
  const inner = `${avatar(p, 'sm')}${name}${p.id === view.hostId ? '<span aria-label="Host">👑</span>' : ''}${p.ready && !offline ? '<span class="text-green">✓</span>' : ''}`;
  const cls = `flex items-center gap-1 rounded-full border-2 pr-2 pl-0.5 text-xs ${look}`;
  const label = offline ? `${esc(p.name)} is offline: remove from game` : `${esc(p.name)}: remove from game`;
  return canRemove(view, p)
    ? `<button class="${cls}" data-act="remove" data-v="${esc(p.id)}" aria-label="${label}">${inner}</button>`
    : `<div class="${cls}">${inner}</div>`;
}

/**
 * The players in two rows that scroll sideways together (the `chips` slot of the lobby's
 * sideways row): the first, third, fifth… player on top, the others below, so whoever joins
 * is added at the end of a row and nobody else moves. Both rows are always there and every
 * pill is exactly as tall as its row, so the two rows take the same height for one player or
 * sixteen, offline or not.
 */
function players(view) {
  const pills = view.players.map((p) => chip(view, p));
  const row = (second) => `<div class="flex h-8 gap-1.5">${pills.filter((_, i) => i % 2 === second).join('')}</div>`;
  return row(0) + row(1);
}

/**
 * The slot the players are painted into: as wide as they are and in the middle while they
 * fit, else starting at the left edge (an auto margin, so nothing is ever cut off at the
 * start). Its 4 px around them, which the scroller's negative margin takes back in height,
 * keep an offline player's glow (`animate-beacon`, 4 px) from being clipped by the scroller.
 */
const PLAYERS_SLOT = '<div class="mx-auto flex w-max flex-col gap-1.5 p-1" data-part="chips"></div>';

/**
 * A comic tail: a short bent wedge sitting on a straight part of its bubble's edge (never a
 * corner, so it always meets the edge cleanly), drawn pointing up and to the left from a top
 * edge; `where` places it and may mirror it (`-scale-x-100` points right, `-scale-y-100`
 * down from a bottom edge). Its fill (the first path, reaching a little into the bubble)
 * covers the bubble's outline where the tail leaves it, and its two sides (the second path)
 * carry the outline on to a rounded tip, so bubble and tail are one outline without a seam.
 * Three of its units are its bubble's outline (one unit is 1px at the base font size): the
 * big bubble's tail is 1.75rem wide (0.19rem outline), a small bubble's 1.4rem (0.15rem);
 * `nudge-tail` in styles/app.css colours it. Its base runs through the middle of the
 * outline's band (y 20.5 of 22), where the outline of its sides begins.
 */
const TAIL_SIDES = 'M6 20.5 Q7.5 10 2 1.5 Q13 8 24 20.5';
const tail = (where) => `<svg class="pointer-events-none absolute nudge-tail ${where}" viewBox="0 0 28 22" aria-hidden="true"><path d="M6 23 L${TAIL_SIDES.slice(1)} L24 23 Z"/><path d="${TAIL_SIDES}"/></svg>`;

/** A line as the bubble's letters, each sized by its place ("ss SS ss", `nudge.bulgeRows`); an emoji keeps its colours. */
const letters = (text, call = false) => bulgeRows(text, { call }).map((row) => `<span class="block whitespace-nowrap">${row.map((c) => `<span class="bulge" style="--k:${c.k}"${c.emoji ? ' data-emoji' : ''}>${esc(c.ch)}</span>`).join('')}</span>`).join('');

/**
 * The small bubbles, by their place around the big one (`NUDGE_CALLS`): above its right end,
 * below its left end, and below its right end, lower (so the two below never meet). Each one's
 * tail points off the screen, to where its player sits, and it pops out from that corner;
 * each tilts a little its own way and pops in at its own moment after the big bubble arrived.
 */
const CALLS = [
  { box: 'right-0 bottom-full mb-6 translate-x-2', tail: 'bottom-full right-[max(1rem,18%)] h-[1.1rem] w-[1.4rem] -scale-x-100', from: 'top right', tilt: 6, delay: 0.45 },
  { box: 'left-0 top-full mt-4 -translate-x-2', tail: 'top-full left-[max(1rem,18%)] h-[1.1rem] w-[1.4rem] -scale-y-100', from: 'bottom left', tilt: -7, delay: 0.75 },
  { box: 'right-0 top-full mt-16 translate-x-3', tail: 'top-full right-[max(1rem,18%)] h-[1.1rem] w-[1.4rem] -scale-100', from: 'bottom right', tilt: 4, delay: 1.05 },
];

/**
 * How each piece moves, entering (`in`) and leaving (`out`): one complete set of classes
 * each, picked by the view. Leaving is a new paint, so the endless moves (the rock, the
 * turning rays) would start over and jump; they go on instead from where an appearance
 * always is when it leaves (`resume`, its time on screen).
 */
const MOVES = {
  in: { bubble: 'animate-nudge-in', boing: 'animate-nudge-boing', call: 'animate-nudge-call-in', wiggle: 'animate-nudge-wiggle', resume: '' },
  out: { bubble: 'animate-nudge-out', boing: '', call: 'animate-nudge-call-out', wiggle: '', resume: ` style="animation-delay:-${NUDGE.showMs}ms"` },
};

/**
 * The bubble over the photos for the moment's appearance `n` (`nudge.nudgeAt`), or '' while
 * there is none: the big bubble in the waited-for player's colour, with its rays, its tail
 * pointing up to the players, its pop-art dots, its gleam and its line; around it the small
 * bubbles, each in its player's colour. Entering, it slides in from its side (`--from`) while
 * it grows, rocks and bounces once, and the small ones pop in one after another; leaving, the
 * same markup is painted once more with the exit's classes. The line is also there as plain
 * text for screen readers, announced once per appearance (not again as it leaves).
 */
function nudge(n) {
  if (!n) return '';
  const m = MOVES[n.leaving ? 'out' : 'in'];
  const still = 'motion-reduce:animate-none';
  const calls = n.calls.map((call, i) => {
    const at = CALLS[i];
    return `<div class="absolute ${at.box}" style="--tilt:${at.tilt}deg;--delay:${at.delay}s">
      <div class="${m.call} ${still}" style="transform-origin:${at.from}">
        <div class="rotate-(--tilt) ${m.wiggle} ${still}">
          <div class="nudge-call px-3.5 py-1.5" style="--player:${colourOf(call.avatar)}" data-cell="call"><i class="nudge-dots"></i>${tail(at.tail)}<p class="nudge-text relative w-max text-center text-xl" aria-hidden="true">${letters(call.text, true)}</p></div>
        </div>
      </div>
    </div>`;
  }).join('');
  return `<div class="absolute top-[40%] left-1/2 -translate-1/2" style="--from:${n.from}">
      <div class="${m.bubble} ${still}">
        <div class="relative animate-nudge-rock ${still}"${m.resume}>
          <i class="nudge-rays pointer-events-none absolute -inset-[40%] animate-nudge-turn ${still}"${m.resume}></i>
          <div class="relative origin-bottom ${m.boing} ${still}">
            <div class="nudge-bubble grid min-w-52 place-items-center px-5 py-4" style="--player:${colourOf(n.avatar)}" data-cell="bubble">
              <i class="nudge-dots"></i><i class="nudge-gleam"></i>
              ${tail('bottom-full left-[max(2rem,22%)] h-[1.375rem] w-[1.75rem]')}
              <p class="nudge-text relative w-max text-center" aria-hidden="true" data-cell="line">${letters(n.line)}</p>
            </div>
          </div>
          ${calls}
        </div>
      </div>
    </div>${n.leaving ? '' : `<p class="sr-only" role="status">${esc(n.line)}</p>`}`;
}

export function lobbyScreen(c) {
  const { view } = c;
  const host = view.hostId === view.me.id;
  return {
    key: `lobby|${view.code}`,
    layout: `<div class="screen h-dvh">
      ${topBar(LEAVE_BUTTON, '', HELP_BUTTON)}
      <button class="mx-auto mt-1.5 mb-2 flex justify-center gap-2 active:scale-97" data-act="invite" aria-label="Invite friends">${[...view.code].map((ch) => `<span class="grid h-16 w-13.5 place-items-center rounded-2xl bg-yellow font-display text-6xl font-extrabold text-navy short:h-12 short:w-10.5 short:text-4xl">${esc(ch)}</span>`).join('')}</button>
      <div data-part="cfg"></div>
      ${sidewaysRow(PLAYERS_SLOT, 'More players', { row: 'mt-4.5 mb-1.5 short:mt-2.5', scroller: '-my-1' })}
      <div class="mt-4.5 flex flex-1 flex-col short:mt-2.5">
        <div data-part="title"></div>
        <div class="relative flex flex-1 flex-col">
          <div class="flex flex-1 flex-col" data-part="pick"></div>
          <div class="pointer-events-none absolute inset-0 z-10 @container-size" data-part="nudge"></div>
        </div>
        <div data-part="note"></div>
        <div data-part="actions"></div>
        <div data-part="links"></div>
      </div>
      <div data-part="status"></div>
      <div data-part="go"></div>
    </div>`,
    parts: {
      cfg: `<button class="mx-auto block rounded-full border border-line bg-card px-3.5 py-1.75 text-xs ${host ? 'text-ink' : 'text-muted'}" data-act="settings">${esc(settingsSummary(view.settings))}${host ? ' ⚙︎' : ''}</button>`,
      chips: players(view),
      ...mine(c),
      nudge: nudge(c.nudge),
      status: status(c),
      go: startNow(c),
    },
  };
}
