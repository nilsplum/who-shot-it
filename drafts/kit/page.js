/**
 * The page of every draft: its title and note, the controls, and the draft's screen in one
 * or more phone-sized frames side by side, each with its title, its idea, a Replay button
 * and the vibrations it plays.
 *
 * Mechanisms: scripts/helpers/drafts.mjs serves this page (kit/page.html) at /<draft>/. It
 * imports the draft's `draft.js` (drafts/README.md, "A draft") and shows the draft's screen
 * (/<draft>/screen) in an iframe per frame. An iframe is a phone of its own: the app's
 * layout rules (`h-dvh`, `short:`, the bigger type on tablets) see the phone's size, not the
 * browser window's, and an overlay over "the whole screen" covers only that phone. Every
 * choice is kept in this page's address and handed to each frame in its own
 * (`kit/screen.js` `options`), so a reload, Replay and the reload after a change in
 * drafts/ (`/events`) keep it. A screen's `buzz` arrives here as a message: its phone
 * jolts as hard as the vibration would feel, and the vibration is named under it.
 *
 * Invariants: choosing an option reloads the page, so every screen starts from its
 * beginning with the new choice; this page knows nothing about what a draft shows. The
 * phones are scaled to fit side by side, never above their real size and never below half
 * (then they wrap).
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

/** The phone's frame around its screen, and the space between phones, in px. */
const BEZEL = 6;
const GAP = 32;

const draft = (await import(new URL('draft.js', location.href))).default;
const params = new URLSearchParams(location.search);
const frames = draft.frames && draft.frames.length ? draft.frames : [{ id: 'screen', title: '', idea: '' }];
const controls = [
  ...(frames.length > 1 ? [{ key: 'show', label: 'Show', options: [['all', 'All'], ...frames.map((f) => [f.id, f.title])], value: 'all' }] : []),
  ...(draft.controls || []),
  { key: 'phone', label: 'Phone', options: PHONES, value: '393x852' },
  { key: 'reduce', label: 'Reduce Motion', options: [['0', 'Off'], ['1', 'On']], value: '0' },
];
/** Each control's value: from the address when it is one of its options, else its default. */
const chosen = Object.fromEntries(controls.map((c) => [c.key, c.options.some(([v]) => v === params.get(c.key)) ? params.get(c.key) : c.value]));
const [width, height] = chosen.phone.split('x').map(Number);
const shown = chosen.show && chosen.show !== 'all' ? frames.filter((f) => f.id === chosen.show) : frames;
const name = location.pathname.split('/').filter(Boolean)[0];
document.title = `${draft.title} · drafts`;

/** A control: its label and a button per option, the chosen one pressed. */
const control = (c) => `<div class="flex items-center gap-2"><span class="text-xs text-muted">${esc(c.label)}</span>
  <div class="flex rounded-full bg-raised p-0.5">${c.options.map(([v, label]) => `<button class="rounded-full px-3 py-1 text-sm aria-pressed:bg-yellow aria-pressed:text-navy" data-key="${esc(c.key)}" data-v="${esc(v)}" aria-pressed="${chosen[c.key] === v}">${esc(label)}</button>`).join('')}</div></div>`;

/** The address of a frame's screen: every choice of this page plus which frame it is. */
const screenUrl = (f) => `screen?${new URLSearchParams({ ...chosen, frame: f.id })}`;

const phone = (f) => `<figure class="flex flex-col items-center" data-frame="${esc(f.id)}">
  <figcaption class="mb-3 text-center" data-caption>${f.title ? `<b class="block font-display text-3xl font-extrabold">${esc(f.title)}</b>` : ''}${f.idea ? `<p class="mt-1 text-xs leading-snug text-muted">${esc(f.idea)}</p>` : ''}</figcaption>
  <div class="overflow-hidden rounded-[2.75rem] border-6 border-raised bg-stage shadow-lift" data-phone><iframe class="block origin-top-left border-0" title="${esc(f.title || draft.title)}" src="${esc(screenUrl(f))}" width="${width}" height="${height}"></iframe></div>
  <div class="mt-2 flex h-8 items-center gap-1"><button class="link mt-0 p-1.5" data-replay>Replay</button><span class="text-xs text-muted" data-felt></span></div>
</figure>`;

document.getElementById('page').innerHTML = `<header class="px-6 pt-5 pb-5" data-head>
  <div class="flex flex-wrap items-baseline gap-x-3"><h1 class="font-display text-6xl font-extrabold">${esc(draft.title)}</h1><span class="text-sm text-muted">drafts/${esc(name)}</span></div>
  ${draft.note ? `<p class="mt-1.5 max-w-200 text-sm leading-snug text-muted">${esc(draft.note)}</p>` : ''}
  <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">${controls.map(control).join('')}
    <button class="rounded-full bg-coral px-4 py-1.5 text-sm font-bold text-white active:scale-97" data-replay-all>Replay all (R)</button></div>
</header>
<section class="flex flex-wrap items-start justify-center gap-8 px-6 pb-10" data-phones>${shown.map(phone).join('')}</section>`;

const figures = [...document.querySelectorAll('[data-frame]')];

/** Sizes every phone at `scale` (its frame, its screen and its caption, which wraps to the phone's width). */
function size(scale) {
  for (const fig of figures) {
    const outer = width * scale + 2 * BEZEL;
    fig.querySelector('[data-phone]').style.cssText = `width:${outer}px;height:${height * scale + 2 * BEZEL}px`;
    fig.querySelector('iframe').style.transform = `scale(${scale})`;
    fig.querySelector('[data-caption]').style.width = `${outer}px`;
  }
}

/**
 * Scales the phones so they all fit side by side and fully in the window, between half
 * and their real size; the captions get one height, so the phones line up.
 */
function fit() {
  const across = (innerWidth - 48 - GAP * (figures.length - 1)) / (figures.length * (width + 2 * BEZEL));
  size(Math.max(0.5, Math.min(1, across)));
  const captions = figures.map((f) => f.querySelector('[data-caption]'));
  for (const c of captions) c.style.minHeight = '';
  const tallest = Math.max(...captions.map((c) => c.offsetHeight));
  const head = document.querySelector('[data-head]').offsetHeight;
  const below = figures[0].querySelector('[data-replay]').parentElement.offsetHeight + 64;
  const down = (innerHeight - head - tallest - below) / (height + 2 * BEZEL);
  size(Math.max(0.5, Math.min(1, across, down)));
  const settled = Math.max(...captions.map((c) => c.offsetHeight));
  for (const c of captions) c.style.minHeight = `${settled}px`;
}

const replay = (fig) => fig.querySelector('iframe').contentWindow.location.reload();
const replayAll = () => figures.forEach(replay);

document.addEventListener('click', (e) => {
  const option = e.target.closest('[data-key]');
  if (option) {
    params.set(option.dataset.key, option.dataset.v);
    location.search = params.toString();
  } else if (e.target.closest('[data-replay-all]')) replayAll();
  else if (e.target.closest('[data-replay]')) replay(e.target.closest('[data-frame]'));
});
addEventListener('keydown', (e) => {
  if (e.key === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) replayAll();
});
addEventListener('resize', fit);
fit();

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
