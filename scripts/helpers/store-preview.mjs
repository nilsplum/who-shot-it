/**
 * The store preview: both store pages as players will see them, at http://localhost:8788,
 * with a switch between Android and iOS. Run by `./scripts/dev.sh store`, which restarts it
 * whenever a listing changes (`node --watch`), so a reload of the browser shows the edit.
 *
 * Mechanisms: everything shown comes from `listing.mjs` (LISTINGS and IMAGES, the same
 * objects `app-store.mjs` uploads and the Android page is filled in from) plus the age
 * (LEGAL.minAge) and the version (APP.version) from the config, so what is seen here is
 * what the stores get. Above the pages it lists `problems`: a text over its limit, a
 * wasted keyword, a missing image. Each platform shows its search result, its page and (on
 * Android, where the page shows only the short description) the full description and the
 * banner as the store features it.
 *
 * Invariants:
 * - Shows only what the stores make public: never the review notes or contact, and the
 *   search keywords only as a note beside the search result.
 * - Names no store: it imitates the pages in neutral colours of its own, defined once in
 *   `:root` below. They are not the app's colours (styles/app.css): this is not the app.
 * - Listens only on this computer (127.0.0.1), serves only the images IMAGES names, and
 *   loads nothing from anywhere else (its Content-Security-Policy says so).
 * - The texts are escaped and shown with their line breaks, as the stores show them.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { APP, LEGAL } from '../../web/shared/config.js';
import { IMAGE_FILES, IMAGES, LISTINGS, problems } from './listing.mjs';

const ROOT = path.join(import.meta.dirname, '..', '..');
const PORT = 8788;

/** The images by the address the page asks for (`/<file name>`): nothing else is served. */
const SERVED = new Map(IMAGE_FILES.map((file) => [`/${path.basename(file)}`, path.join(ROOT, file)]));
const src = (file) => `/${path.basename(file)}`;

const esc = (value) => String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
/** "A, B and C", as the Android store lists data types. */
const and = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : items.join(''));
/** Apple's category id as its page shows it: GAMES_TRIVIA is "Trivia". */
const categoryName = (id) => id.replace(/^GAMES_/, '').toLowerCase().replace(/(^|_)(\w)/g, (_, gap, c) => `${gap && ' '}${c.toUpperCase()}`);
const language = (locale) => new Intl.DisplayNames(['en'], { type: 'language' }).of(locale.split('-')[0]);
const age = `${LEGAL.minAge}+`;

const ICON = {
  search: '<svg viewBox="0 0 24 24" class="glyph"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  person: '<svg viewBox="0 0 24 24" class="glyph"><circle cx="12" cy="8" r="4.2" fill="currentColor"/><path d="M3.8 21c0-4.6 3.7-7.2 8.2-7.2s8.2 2.6 8.2 7.2z" fill="currentColor"/></svg>',
  dice: '<svg viewBox="0 0 24 24" class="glyph"><rect x="3" y="3" width="18" height="18" rx="4.5" fill="currentColor"/><circle cx="8.2" cy="8.2" r="1.8" fill="var(--screen)"/><circle cx="12" cy="12" r="1.8" fill="var(--screen)"/><circle cx="15.8" cy="15.8" r="1.8" fill="var(--screen)"/></svg>',
  shield: '<svg viewBox="0 0 24 24" class="glyph"><path d="M12 2.5 4 5.5v6c0 5 3.4 8.8 8 10 4.6-1.2 8-5 8-10v-6z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};

/** A text the store cuts after a few lines, with the "more" that opens it. */
const clamped = (text) => `<p class="text clamp">${esc(text)}</p><button class="more" data-more>more</button>`;

/** One phone: a caption above it, the screen, and an optional note below it. */
const frame = (caption, platform, screen, note = '') => `<figure class="frame">
  <figcaption>${caption}</figcaption>
  <div class="phone"><div class="screen ${platform}"><div class="clock">9:41</div>${screen}</div></div>
  ${note && `<p class="note">${note}</p>`}
</figure>`;

// ---------- iOS ----------

/** The privacy label's sections, as the iPhone store words them. */
const PRIVACY = {
  tracking: ['Data Used to Track You', 'The following data may be used to track you across apps and websites owned by other companies:'],
  linked: ['Data Linked to You', 'The following data may be collected and linked to your identity:'],
  notLinked: ['Data Not Linked to You', 'The following data may be collected but it is not linked to your identity:'],
};

function iosPrivacy(privacy) {
  const cards = Object.entries(PRIVACY).filter(([key]) => Object.keys(privacy[key]).length).map(([key, [title, text]]) => `<div class="card">
    <h3>${title}</h3><p class="muted small">${text}</p>
    <ul class="kinds">${Object.entries(privacy[key]).map(([kind, types]) => `<li><b>${esc(kind)}</b><span class="muted small">${esc(types.join(', '))}</span></li>`).join('')}</ul>
  </div>`);
  return cards.join('') || '<div class="card"><h3>Data Not Collected</h3><p class="muted small">The developer does not collect any data from this app.</p></div>';
}

function iosSearch(l) {
  return `<h1 class="large">Search</h1>
  <div class="searchbar">${ICON.search}<span>${esc(APP.name.toLowerCase().replace(/[^a-z ]/g, ''))}</span></div>
  <div class="result">
    <div class="result-head">
      <img class="icon ios-icon" src="${src(IMAGES.ios.icon.file)}" alt="">
      <div class="grow"><b class="one-line">${esc(l.name)}</b><span class="muted one-line">${esc(l.subtitle)}</span></div>
      <span class="get">Get</span>
    </div>
    <div class="result-shots">${IMAGES.ios.screenshots.files.slice(0, 3).map((f) => `<img src="${src(f)}" alt="">`).join('')}</div>
  </div>`;
}

function iosPage(l) {
  const fact = (label, big, small) => `<div class="fact"><small>${label}</small><b>${big}</b><small>${small}</small></div>`;
  const category = categoryName(l.categories.subcategories[0]);
  const info = [['Seller', l.developer], ['Category', category], ['Languages', language(l.locale)], ['Age Rating', age], ['Copyright', `© ${l.copyright}`], ['Price', 'Free']];
  const links = [['Developer Website', l.website], ['App Support', l.supportUrl], ['Privacy Policy', l.privacyPolicyUrl]];
  return `<div class="nav accent">‹ Search</div>
  <div class="head">
    <img class="icon ios-icon big" src="${src(IMAGES.ios.icon.file)}" alt="">
    <div class="grow"><h1>${esc(l.name)}</h1><p class="muted">${esc(l.subtitle)}</p>
      <div class="actions"><span class="get filled">Get</span></div></div>
  </div>
  <div class="facts">
    ${fact('Ages', age, 'Years Old')}${fact('Category', ICON.dice, esc(category))}
    ${fact('Developer', ICON.person, esc(l.developer))}${fact('Language', l.locale.split('-')[0].toUpperCase(), language(l.locale))}
  </div>
  <div class="shots">${IMAGES.ios.screenshots.files.map((f) => `<img src="${src(f)}" alt="">`).join('')}</div>
  <section>${clamped(`${l.promotionalText}\n\n${l.description}`)}</section>
  <section class="split"><span class="accent">${esc(l.developer)}</span><span class="muted">Developer</span></section>
  <section><h2>What’s New</h2><p class="muted small">Version ${esc(APP.version)}</p>${clamped(l.whatsNew)}</section>
  <section><h2>App Privacy</h2><p class="small">The developer, ${esc(l.developer)}, indicated that the app’s privacy practices may include handling of data as described below.</p>${iosPrivacy(l.privacy)}</section>
  <section><h2>Information</h2>
    <dl class="info">${info.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    ${links.map(([label, url]) => `<a class="link accent" href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`).join('')}
  </section>`;
}

// ---------- Android ----------

/** The rows of the privacy label ("Data safety"), as the Android store words them. */
function androidSafety(safety) {
  const shared = Object.keys(safety.shared);
  const collected = Object.keys(safety.collected);
  const rows = [
    shared.length ? ['This app may share these data types with third parties', and(shared)] : ['No data shared with third parties', 'Learn more about how developers declare sharing'],
    collected.length ? ['This app may collect these data types', and(collected)] : ['No data collected', 'Learn more about how developers declare collection'],
    [safety.encryptedInTransit ? 'Data is encrypted in transit' : 'Data isn’t encrypted', ''],
    safety.deletionOnRequest ? ['You can request that data be deleted', ''] : null,
  ];
  return `<div class="card">${rows.filter(Boolean).map(([title, text]) => `<div class="safety">${ICON.shield}<div><b>${esc(title)}</b>${text && `<p class="muted small">${esc(text)}</p>`}</div></div>`).join('')}</div>`;
}

const chips = (l) => `<div class="chips">${[...new Set([l.category, ...l.tags])].map((t) => `<span>${esc(t)}</span>`).join('')}</div>`;
const androidIcon = (size = '') => `<img class="icon android-icon ${size}" src="${src(IMAGES.android.icon.file)}" alt="">`;
const androidTitle = (l) => `<div class="grow"><b class="one-line">${esc(l.name)}</b><span class="muted small one-line">${esc(l.developer)}</span></div>`;

function androidSearch(l) {
  return `<div class="searchbar pill">←<span>${esc(APP.name.toLowerCase().replace(/[^a-z ]/g, ''))}</span>${ICON.search}</div>
  <div class="result">
    <div class="result-head">${androidIcon()}<div class="grow"><b class="one-line">${esc(l.name)}</b><span class="muted small one-line">${esc(l.developer)}</span><span class="muted small">${esc(l.category)} · ${age}</span></div></div>
    <span class="install">Install</span>
    <div class="result-shots">${IMAGES.android.screenshots.files.slice(0, 3).map((f) => `<img src="${src(f)}" alt="">`).join('')}</div>
  </div>`;
}

function androidPage(l) {
  const support = [['Website', l.website], ['Support email', `mailto:${l.contactEmail}`, l.contactEmail], ['Privacy policy', l.privacyPolicyUrl]];
  return `<div class="nav">←</div>
  <div class="head">${androidIcon('big')}<div class="grow"><h1>${esc(l.name)}</h1><p class="accent">${esc(l.developer)}</p></div></div>
  <div class="facts"><div class="fact"><b class="badge">${age}</b><small>Rated for ${age}</small></div></div>
  <span class="install wide">Install</span>
  <div class="shots">${IMAGES.android.screenshots.files.map((f) => `<img src="${src(f)}" alt="">`).join('')}</div>
  <section><h2>About this game <span class="muted">→</span></h2><p class="text">${esc(l.shortDescription)}</p>${chips(l)}</section>
  <section><h2>Data safety <span class="muted">→</span></h2>
    <p class="muted small">Safety starts with understanding how developers collect and share your data. Data privacy and security practices may vary based on your use, region, and age. The developer provided this information and may update it over time.</p>
    ${androidSafety(l.dataSafety)}</section>
  <section><h2>App support</h2>${support.map(([label, url, shown = url]) => `<a class="support" href="${esc(url)}" target="_blank" rel="noopener"><b>${label}</b><span class="muted small">${esc(shown)}</span></a>`).join('')}</section>`;
}

function androidAbout(l) {
  const info = [['Version', APP.version], ['Content rating', `Rated for ${age}`], ['Offered by', l.developer]];
  return `<div class="nav mini">← ${androidIcon('small')}${androidTitle(l)}</div>
  <section><h2>About this game</h2><p class="text">${esc(l.description)}</p>${chips(l)}</section>
  <section><h2>App info</h2><dl class="info">${info.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>`;
}

function androidFeatured(l) {
  return `<h1 class="large">Games</h1>
  <section><h2>Featured</h2><div class="feature">
    <img src="${src(IMAGES.android.featureGraphic.file)}" alt="">
    <div class="result-head">${androidIcon()}${androidTitle(l)}<span class="install">Install</span></div>
  </div></section>`;
}

// ---------- The page ----------

function page() {
  const found = problems((file) => fs.existsSync(path.join(ROOT, file)));
  const { ios, android } = LISTINGS;
  const status = found.length
    ? `<ul class="status bad">${found.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
    : '<p class="status good">✓ Every text fits its limit and every image is there.</p>';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Listing · ${esc(APP.name)}</title>
<style>
  :root {
    color-scheme: light dark;
    --page: #e9e9ee; --screen: #fff; --ink: #111; --muted: #6e6e73; --line: #d9d9de; --fill: #f2f2f7;
    --bezel: #1c1c1e; --ios: #007aff; --on-ios: #fff; --android: #01875f; --on-android: #fff; --good: #1a7f37; --bad: #c62828;
  }
  @media (prefers-color-scheme: dark) {
    :root { --page: #0e0e10; --screen: #000; --ink: #f5f5f7; --muted: #98989f; --line: #38383a; --fill: #1c1c1e;
      --bezel: #3a3a3c; --ios: #0a84ff; --android: #8ad3a6; --on-android: #00391f; --good: #6fcf8a; --bad: #ff7b7b; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.35 system-ui, -apple-system, sans-serif; }
  .top { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px 16px 4px; }
  .switch { display: flex; background: var(--fill); border-radius: 10px; padding: 3px; }
  .switch button { border: 0; background: none; color: var(--ink); font: 600 15px system-ui; padding: 7px 26px; border-radius: 8px; cursor: pointer; }
  .switch button[aria-pressed="true"] { background: var(--screen); box-shadow: 0 1px 3px rgb(0 0 0 / .15); }
  .status { margin: 0; font-size: 13px; max-width: 640px; }
  .status.good { color: var(--good); }
  .status.bad { color: var(--bad); padding-left: 18px; }
  .view { display: flex; flex-wrap: wrap; justify-content: center; gap: 28px; padding: 16px; }
  .view[hidden] { display: none; }
  .frame { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  figcaption { font-size: 13px; font-weight: 600; color: var(--muted); }
  .note { margin: 0; width: 390px; font-size: 12px; color: var(--muted); text-align: center; }
  .phone { width: 390px; height: 844px; border: 11px solid var(--bezel); border-radius: 56px; overflow: hidden; background: var(--screen); }
  .screen { height: 100%; overflow-y: auto; scrollbar-width: none; padding: 0 0 40px; }
  .clock { height: 44px; display: flex; align-items: center; padding: 0 28px; font-weight: 600; font-size: 14px; }
  .screen.android { font-family: Roboto, system-ui, sans-serif; }
  img { display: block; }
  h1, h2, h3, p { margin: 0; }
  section { margin: 0 18px; padding: 16px 0; border-top: 1px solid var(--line); }
  h2 { font-size: 21px; margin-bottom: 8px; }
  h3 { font-size: 16px; margin-bottom: 4px; }
  .muted { color: var(--muted); }
  .small { font-size: 13px; }
  .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .one-line { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .text { white-space: pre-line; }
  .clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .more { border: 0; background: none; padding: 0; font: inherit; color: var(--ios); float: right; cursor: pointer; }
  .glyph { width: 22px; height: 22px; }
  .nav { padding: 6px 18px 10px; font-size: 17px; display: flex; align-items: center; gap: 12px; }
  .large { font-size: 32px; padding: 4px 18px 10px; }
  .searchbar { margin: 0 18px 14px; display: flex; align-items: center; gap: 8px; background: var(--fill); border-radius: 11px; padding: 9px 11px; color: var(--muted); }
  .searchbar span { flex: 1; color: var(--ink); }
  .searchbar .glyph { width: 18px; height: 18px; }
  .result { margin: 0 18px; display: flex; flex-direction: column; gap: 12px; }
  .result-head { display: flex; align-items: center; gap: 12px; }
  .result-shots { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .result-shots img { width: 100%; border-radius: 12px; border: 1px solid var(--line); }
  .head { display: flex; gap: 16px; padding: 4px 18px 16px; }
  .head h1 { font-size: 22px; line-height: 1.2; }
  .actions { margin-top: auto; padding-top: 10px; }
  .icon { width: 62px; height: 62px; border: 1px solid var(--line); }
  .icon.big { width: 118px; height: 118px; }
  .icon.small { width: 32px; height: 32px; }
  .ios-icon { border-radius: 22.37%; }
  .android-icon { border-radius: 20%; }
  .shots { display: flex; gap: 10px; overflow-x: auto; scrollbar-width: none; padding: 4px 18px 16px; }
  .facts { display: flex; overflow-x: auto; scrollbar-width: none; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin: 0 18px 16px; padding: 10px 0; }
  .fact { flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 0 14px; color: var(--muted); }
  .fact + .fact { border-left: 1px solid var(--line); }
  .fact small { font-size: 11px; text-transform: uppercase; letter-spacing: .3px; }
  .fact small:last-child { text-transform: none; }
  .fact b { font-size: 20px; line-height: 24px; }
  .info { margin: 0; }
  .info div { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid var(--line); }
  .info dt { color: var(--muted); }
  .info dd { margin: 0; text-align: right; }
  .link { display: block; padding: 11px 0; text-decoration: none; border-bottom: 1px solid var(--line); }
  .card { background: var(--fill); border-radius: 14px; padding: 14px; margin-top: 12px; }
  .kinds { list-style: none; padding: 0; margin: 10px 0 0; display: flex; flex-direction: column; gap: 8px; }
  .kinds li { display: flex; flex-direction: column; }
  .split { display: flex; justify-content: space-between; }

  /* iOS */
  .ios .accent { color: var(--ios); }
  .ios .get { background: var(--fill); color: var(--ios); font-weight: 700; padding: 6px 20px; border-radius: 99px; }
  .ios .get.filled { background: var(--ios); color: var(--on-ios); }
  .ios .shots img { width: 230px; border-radius: 22px; border: 1px solid var(--line); }

  /* Android */
  .android .accent { color: var(--android); font-weight: 600; }
  .android .more { color: var(--android); }
  .android .searchbar.pill { border-radius: 99px; padding: 12px 18px; }
  .android .install { background: var(--android); color: var(--on-android); font-weight: 600; text-align: center; padding: 8px 20px; border-radius: 99px; }
  .android .install.wide { display: block; margin: 0 18px 16px; padding: 11px; }
  .android .shots img { height: 300px; border-radius: 10px; border: 1px solid var(--line); }
  .android .facts { justify-content: flex-start; border: 0; }
  .android .fact { flex: 0 0 auto; }
  .badge { border: 1.5px solid currentColor; border-radius: 5px; padding: 0 5px; font-size: 15px !important; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  .chips span { border: 1px solid var(--line); border-radius: 8px; padding: 5px 12px; font-size: 13px; }
  .safety { display: flex; gap: 14px; padding: 8px 0; }
  .safety .glyph { flex: none; color: var(--muted); }
  .support { display: flex; flex-direction: column; padding: 9px 0; color: inherit; text-decoration: none; }
  .nav.mini b { font-size: 15px; }
  .feature > img { width: 100%; border-radius: 14px; margin-bottom: 12px; }
</style>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
</head>
<body>
<header class="top">
  <div class="switch"><button data-show="android">Android</button><button data-show="ios">iOS</button></div>
  ${status}
</header>
<main>
  <div class="view" data-view="android">
    ${frame('Search', 'android', androidSearch(android))}
    ${frame('Page', 'android', androidPage(android))}
    ${frame('About this game', 'android', androidAbout(android))}
    ${frame('Featured', 'android', androidFeatured(android))}
  </div>
  <div class="view" data-view="ios">
    ${frame('Search', 'ios', iosSearch(ios), `Also found by: ${esc(ios.keywords.split(',').join(', '))}`)}
    ${frame('Page', 'ios', iosPage(ios))}
  </div>
</main>
<script>
  // The switch keeps its choice in the address (#android or #ios), so a reload stays there.
  const show = (platform) => {
    for (const view of document.querySelectorAll('[data-view]')) view.hidden = view.dataset.view !== platform;
    for (const button of document.querySelectorAll('[data-show]')) button.setAttribute('aria-pressed', button.dataset.show === platform);
    history.replaceState(null, '', '#' + platform);
  };
  show(location.hash === '#ios' ? 'ios' : 'android');
  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-show]');
    if (button) show(button.dataset.show);
    // "more" opens the text above it, as the stores do.
    const more = event.target.closest('[data-more]');
    if (more) { more.previousElementSibling.classList.remove('clamp'); more.remove(); }
  });
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const image = SERVED.get(pathname);
  // Nothing is cached, so a reload always shows the files as they are now.
  const headers = (type) => ({ 'Content-Type': type, 'Cache-Control': 'no-store' });
  if (req.method !== 'GET') {
    res.writeHead(405, headers('text/plain; charset=utf-8')).end('Only GET');
  } else if (pathname === '/') {
    res.writeHead(200, headers('text/html; charset=utf-8')).end(page());
  } else if (image && fs.existsSync(image)) {
    res.writeHead(200, headers('image/png')).end(fs.readFileSync(image));
  } else {
    res.writeHead(404, headers('text/plain; charset=utf-8')).end('Not found');
  }
});
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `✗ Port ${PORT} is in use.\n  Fix: stop the other preview (Ctrl+C in its terminal), then run it again.` : `✗ ${error.message}`);
  process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => console.log(`→ Open http://localhost:${PORT} (both store pages; reload the browser after a change)`));
