/**
 * The page of every draft: a top bar with every draft (by its folder, the current one
 * marked) and Play all; a bar with the choices, what belongs to the draft on the left (which
 * of its frames to show, its own controls) and what belongs to the viewer on the right (the
 * phone, Reduce Motion); and the draft's screen in one or more phone-sized frames side by
 * side, each with its title, a Play button and the vibration it just played.
 *
 * Mechanisms: scripts/helpers/drafts.mjs serves this page (kit/page.html) at /<draft>/ and
 * the list of drafts at /drafts.json. It imports the draft's `draft.js` (drafts/README.md, "A
 * draft") and shows the draft's screen (/<draft>/screen) in an iframe per frame. An iframe is
 * a phone of its own: the app's layout rules (`h-dvh`, `short:`, the bigger type on tablets)
 * see the phone's size, not the browser window's, and an overlay over "the whole screen"
 * covers only that phone. Every choice is kept in this page's address and handed to each
 * frame in its own (`kit/screen.js` `options`), so a reload, Play and the reload after a
 * change in drafts/ (`/events`) keep it; a link to another draft keeps the viewer's choices
 * (CARRIED). Play loads a frame again with `play` added to its address, which starts its
 * story. A screen's `buzz` arrives here as a message: its phone jolts as hard as the
 * vibration would feel, and the vibration is named beside its Play.
 *
 * Invariants:
 * - Nothing plays by itself: opening the page, a choice (which reloads it) and the reload
 *   after a change show every screen's final state; only Play, Play all or R start a story.
 *   With several phones on the page, they never all start at once.
 * - This page knows nothing about what a draft shows; of `draft.js` it reads the `title`
 *   (the browser tab), the `frames` and the `controls`. The phones are scaled to fit side by
 *   side and fully in the window, never above their real size and never below half (then
 *   they wrap).
 */
import { esc } from '/js/ui.js';

/** The phones to try a screen on, smallest first: the sizes the app's layout tests use. */
const PHONES = [['360x640', 'Small Android'], ['375x667', 'iPhone SE'], ['393x852', 'iPhone 15']];

/** The app's vibrations (`HAPTICS` in web/js/phone.js) in words, and how hard the phone jolts for each. */
const FELT = {
  tap: { words: 'light tap', px: 1.5 },
  yes: { words: 'firm pulse', px: 2.5 },
  no: { words: 'two firm pulses', px: 2.5, twice: true },
  count: { words: 'buzz', px: 2.5, long: true },
  land: { words: 'heavy thud', px: 5 },
};

/** The phone's frame around its screen, in px (`border-6`). */
const BEZEL = 6;

/** The choices about the viewer, not the draft: a link to another draft keeps them. */
const CARRIED = ['phone', 'reduce'];

const draft = (await import(new URL('draft.js', location.href))).default;
/** Every draft by its folder, for the top bar (none if the server cannot say: the page still works). */
const names = await fetch('/drafts.json').then((res) => res.json()).then((list) => list.drafts, () => []);
const params = new URLSearchParams(location.search);
const frames = draft.frames && draft.frames.length ? draft.frames : [{ id: 'screen', title: '' }];
const SHOW = frames.length > 1 ? { key: 'show', label: 'Show', options: [['all', 'All'], ...frames.map((f) => [f.id, f.title])], value: 'all' } : null;
const PHONE = { key: 'phone', label: 'Phone', options: PHONES, value: '393x852' };
const REDUCE = { key: 'reduce', label: 'Reduce motion', options: [['0', 'Off'], ['1', 'On']], value: '0' };
/** The draft's side of the choices bar, and the viewer's. */
const DRAFT_CHOICES = [SHOW, ...(draft.controls || [])].filter(Boolean);
const controls = [...DRAFT_CHOICES, PHONE, REDUCE];
/** Each control's value: from the address when it is one of its options, else its default. */
const chosen = Object.fromEntries(controls.map((c) => [c.key, c.options.some(([v]) => v === params.get(c.key)) ? params.get(c.key) : c.value]));
const [width, height] = chosen.phone.split('x').map(Number);
const shown = chosen.show && chosen.show !== 'all' ? frames.filter((f) => f.id === chosen.show) : frames;
const name = location.pathname.split('/').filter(Boolean)[0];
document.title = `${draft.title} · drafts`;

/** A choice of one option: its label, then its options side by side, the chosen one pressed; on a narrow window the options scroll sideways. */
const segmented = (c) => `<div class="flex max-w-full min-w-0 items-center gap-2"><span class="shrink-0 text-xs text-muted">${esc(c.label)}</span>
  <div class="flex min-w-0 overflow-x-auto rounded-lg bg-stage p-0.5 ring-1 ring-line [scrollbar-width:none]">${c.options.map(([v, label]) => `<button class="rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-muted hover:text-ink aria-pressed:bg-raised aria-pressed:text-yellow" data-key="${esc(c.key)}" data-v="${esc(v)}" aria-pressed="${chosen[c.key] === v}">${esc(label)}</button>`).join('')}</div></div>`;

/** An off and on choice as a switch: a tap flips it (its button carries the other value). */
const toggle = (c) => {
  const on = chosen[c.key] === '1';
  return `<button class="group flex items-center gap-2 text-xs text-muted hover:text-ink" data-key="${esc(c.key)}" data-v="${on ? '0' : '1'}" aria-pressed="${on}">${esc(c.label)}
    <span class="relative h-4.5 w-8 rounded-full bg-stage ring-1 ring-line transition-colors group-aria-pressed:bg-yellow"><i class="absolute top-0.5 left-0.5 size-3.5 rounded-full bg-muted transition-transform group-aria-pressed:translate-x-3.5 group-aria-pressed:bg-navy"></i></span></button>`;
};

/** The viewer's choices that differ from their defaults, for the links to the other drafts. */
const carried = String(new URLSearchParams(CARRIED.filter((k) => chosen[k] !== controls.find((c) => c.key === k).value).map((k) => [k, chosen[k]])));

/** A draft in the top bar: its folder's name, the current one marked. */
const tab = (n) => `<a class="shrink-0 rounded-lg px-3 py-1.5 font-mono text-xs whitespace-nowrap text-muted hover:bg-card hover:text-ink aria-[current=page]:bg-raised aria-[current=page]:text-ink" href="/${esc(n)}/${carried ? `?${carried}` : ''}" ${n === name ? 'aria-current="page"' : ''}>${esc(n)}</a>`;

/** The address of a frame's screen: every choice of this page, which frame it is, and `play` when Play started it. */
const screenUrl = (f, play = false) => `screen?${new URLSearchParams({ ...chosen, frame: f.id, ...(play ? { play: '1' } : {}) })}`;

/**
 * A phone: its title (on two lines when it is long, never cut), the screen, and under it
 * Play (in the middle) with the vibration it just played (beside it, so Play never moves).
 */
const phone = (f) => `<figure class="flex flex-col items-center gap-2.5" data-frame="${esc(f.id)}">
  ${f.title ? `<figcaption class="max-w-full text-center font-display text-xl leading-tight font-extrabold text-balance" data-caption>${esc(f.title)}</figcaption>` : ''}
  <div class="overflow-hidden rounded-[2.75rem] border-6 border-raised bg-stage shadow-lift" data-phone><iframe class="block origin-top-left border-0" title="${esc(f.title || draft.title)}" src="${esc(screenUrl(f))}" width="${width}" height="${height}"></iframe></div>
  <div class="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2"><span></span><button class="rounded-lg px-3 py-1 text-sm font-semibold text-muted hover:bg-card hover:text-ink active:scale-97" data-play>▶ Play</button><span class="truncate text-xs text-muted" data-felt></span></div>
</figure>`;

document.getElementById('page').innerHTML = `<header class="z-10 border-b border-line bg-sheet sm:sticky sm:top-0" data-head>
  <div class="flex items-center gap-3 px-4 py-2">
    <img class="size-7 shrink-0 rounded-lg" src="/icons/icon.svg" alt="">
    <nav class="flex min-w-0 flex-1 gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Drafts">${names.map(tab).join('')}</nav>
    <button class="flex shrink-0 items-center gap-2 rounded-lg bg-coral px-3.5 py-1.5 text-sm font-bold whitespace-nowrap text-white hover:bg-coral/90 active:scale-97" data-play-all>▶ Play all<kbd class="hidden rounded bg-white/20 px-1.5 font-sans text-2xs sm:inline">R</kbd></button>
  </div>
  <div class="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-4 py-2">
    ${DRAFT_CHOICES.map(segmented).join('')}
    <div class="flex flex-wrap items-center gap-x-6 gap-y-2 sm:ml-auto">${segmented(PHONE)}${toggle(REDUCE)}</div>
  </div>
</header>
<section class="mx-auto flex flex-wrap items-start justify-center gap-8 px-4 py-6" data-phones>${shown.map(phone).join('')}</section>`;

const phones = document.querySelector('[data-phones]');
const figures = [...phones.querySelectorAll('[data-frame]')];

/**
 * Sizes every phone at `scale`: its frame and its screen (the frame's edge keeps its width);
 * the figure takes the frame's width, so a long title wraps instead of pushing. The titles
 * then get one height, so the phones line up.
 */
function size(scale) {
  const captions = figures.map((fig) => fig.querySelector('[data-caption]')).filter(Boolean);
  for (const c of captions) c.style.minHeight = '';
  for (const fig of figures) {
    const outer = width * scale + 2 * BEZEL;
    fig.style.width = `${outer}px`;
    fig.querySelector('[data-phone]').style.cssText = `width:${outer}px;height:${height * scale + 2 * BEZEL}px`;
    fig.querySelector('iframe').style.transform = `scale(${scale})`;
  }
  const tallest = Math.max(0, ...captions.map((c) => c.offsetHeight));
  for (const c of captions) c.style.minHeight = `${tallest}px`;
}

/**
 * Scales the phones as big as they can be, fully in the window below the top bars (the
 * title and Play around each phone keep their size), never above their real size and
 * never below half. As many fit side by side as allow half size or more (all of them on a
 * wide window, one on a phone); when that takes more than one row, the phones are shared
 * out evenly (six as three and three, not five and one), each row as wide as its phones.
 */
function fit() {
  size(0.5);
  // The gap and the margins as the browser has them: the app's stylesheet makes everything a
  // size bigger on a big window (its rem), so they are not fixed numbers.
  const style = getComputedStyle(phones);
  const gap = parseFloat(style.columnGap);
  const sides = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const room = phones.parentElement.clientWidth - sides - 1;
  const head = document.querySelector('[data-head]').offsetHeight;
  const first = figures[0];
  const around = first.offsetHeight - first.querySelector('[data-phone]').offsetHeight + 48;
  const down = (innerHeight - head - around - 2 * BEZEL) / height;
  const scaleFor = (perRow) => Math.min(1, down, (room - gap * (perRow - 1) - 2 * BEZEL * perRow) / (perRow * width));
  let most = figures.length;
  while (most > 1 && scaleFor(most) < 0.5) most -= 1;
  const perRow = Math.ceil(figures.length / Math.ceil(figures.length / most));
  const scale = Math.max(0.5, scaleFor(perRow));
  size(scale);
  phones.style.maxWidth = `${perRow * (width * scale + 2 * BEZEL) + gap * (perRow - 1) + sides + 1}px`;
}

/** Plays a phone's story from its beginning: its screen loads again, now with `play` (the same address again reloads it). */
const playOne = (fig) => {
  const f = shown.find((x) => x.id === fig.dataset.frame);
  fig.querySelector('iframe').contentWindow.location.replace(new URL(screenUrl(f, true), location.href).href);
};
const playAll = () => figures.forEach(playOne);

document.addEventListener('click', (e) => {
  const option = e.target.closest('[data-key]');
  if (option) {
    params.set(option.dataset.key, option.dataset.v);
    location.search = params.toString();
  } else if (e.target.closest('[data-play-all]')) playAll();
  else if (e.target.closest('[data-play]')) playOne(e.target.closest('[data-frame]'));
});
addEventListener('keydown', (e) => {
  if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) playAll();
});
addEventListener('resize', fit);
fit();
// The current draft's tab in view, when the top bar scrolls sideways on a narrow window.
document.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });

/** The phone jolts like the vibration would feel: once, twice (`no`) or as a short rattle (`count`). */
function feel(el, { px, twice, long }) {
  const jolt = long
    ? [...Array(6)].map((_, i) => ({ transform: `translate(${i % 2 ? px : -px}px, ${(i % 3) - 1}px)` })).concat({ transform: 'none' })
    : [{ transform: `translate(${-px}px, ${px / 2}px)` }, { transform: `translate(${px}px, ${-px / 2}px)` }, { transform: 'none' }];
  el.animate(jolt, { duration: long ? 140 : 90 });
  if (twice) setTimeout(() => el.animate(jolt, { duration: 90 }), 150);
}

addEventListener('message', (e) => {
  if (e.origin !== location.origin || !e.data || e.data.draft !== 'buzz') return;
  const fig = figures.find((f) => f.querySelector('iframe').contentWindow === e.source);
  const felt = FELT[e.data.kind];
  if (!fig || !felt) return;
  feel(fig.querySelector('[data-phone]'), felt);
  const label = fig.querySelector('[data-felt]');
  label.textContent = `📳 ${felt.words}`;
  for (const a of label.getAnimations()) a.cancel();
  label.animate([{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }], { duration: 1100, fill: 'forwards' });
});

// A change in drafts/ reloads the page (the server rebuilds the stylesheet first).
new EventSource('/events').onmessage = (e) => {
  if (e.data === 'reload') location.reload();
};
