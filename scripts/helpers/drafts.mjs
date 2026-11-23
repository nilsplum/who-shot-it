/**
 * The drafts: pages for trying out screens and animations before they go into the app, at
 * http://localhost:8789/<draft>/. Run by `./scripts/dev.sh drafts [name]`: it picks a draft
 * (the name given, or typed and chosen in a short list in the terminal), serves everything,
 * opens the draft in the browser and reloads every open draft whenever a file it shows
 * changes. `--no-open` leaves the browser alone. Every page lists all drafts by their
 * folder in its top bar (from /drafts.json), so the others are one click away; / opens
 * the first.
 *
 * Mechanisms: a draft is a folder of drafts/ with a `draft.js` (drafts/README.md). Every
 * draft's page is the kit's page (drafts/kit/page.html, at /<draft>/), which reads the
 * draft's `draft.js` and shows its screen in phone-sized frames; a screen is the kit's
 * screen page (drafts/kit/screen.html, at /<draft>/screen) running the draft's `screen.js`
 * and `style.css`. Beside the drafts it serves the app's own files from web/ at the paths
 * the app uses (APP_DIRS), so a draft imports the app's real views and helpers. Every
 * stylesheet is built by Tailwind, exactly as the app's: a draft's `style.css` imports the
 * app's styles/app.css and adds what the draft needs (its theme entries, utilities, plain
 * CSS), and the kit's page has drafts/kit/drafts.css (/drafts.css). They are built into
 * memory when first asked for and again after a change in drafts/, web/js, web/shared or
 * styles/ (a draft can show the app's own code), and every open page is told to reload
 * (`/events`).
 *
 * Invariants:
 * - Listens only on this computer (127.0.0.1). Serves only files under drafts/ and the
 *   app's folders in APP_DIRS, never a dotfile or a path outside them; nothing is cached,
 *   so a reload always shows the files as they are.
 * - The pages load nothing from anywhere else (CSP below) and nothing here writes a file:
 *   the stylesheets live in memory; one that fails to build keeps its last good version.
 * - When a drafts server already runs on PORT, starting another one only opens the chosen
 *   draft in the browser.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.join(import.meta.dirname, '..', '..');
const DRAFTS = path.join(ROOT, 'drafts');
const WEB = path.join(ROOT, 'web');
/** The game's local server is 8787 (`./scripts/dev.sh`), the store preview 8788. */
const PORT = 8789;
const ORIGIN = `http://localhost:${PORT}`;
/** The app's own folders, served from web/ at the paths the app itself uses (its fonts are linked as /fonts/…). */
const APP_DIRS = ['js', 'shared', 'fonts', 'icons'];
/** What a draft cannot be called: the app's folders above and the server's own paths. */
const RESERVED = new Set([...APP_DIRS, 'kit', 'events', 'ping', 'drafts.css', 'drafts.json']);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};
/** The app's own policy (web/index.html) for a local page: everything from here, frames only of itself. */
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

function fail(reason, fix) {
  console.error(`✗ ${reason}\n  Fix: ${fix}`);
  process.exit(1);
}

/** The drafts: the folders of drafts/ with a draft.js, a lower-case name and not a reserved one, sorted. */
function listDrafts() {
  return fs.readdirSync(DRAFTS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[a-z0-9_]+$/.test(d.name) && !RESERVED.has(d.name) && fs.existsSync(path.join(DRAFTS, d.name, 'draft.js')))
    .map((d) => d.name)
    .sort();
}

/** Whether the letters of `query` appear in `name` in the same order ("resan" fits "results_animations"). */
const inOrder = (query, name) => {
  let i = 0;
  for (const c of name) if (c === query[i]) i += 1;
  return i === query.length;
};

/**
 * The drafts that fit what was typed, best first: the name itself, then names that start
 * with it, contain it, or hold its letters in order. A space counts as the underscore.
 */
function matches(typed, names) {
  const q = typed.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!q) return names;
  const rank = (n) => (n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : inOrder(q, n) ? 3 : -1);
  return names.map((n) => [rank(n), n]).filter(([r]) => r >= 0).sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1])).map(([, n]) => n);
}

/**
 * Lets the operator choose a draft in the terminal: typing narrows the list, ↑ and ↓ move,
 * Tab completes the marked name, Enter opens it, Esc or Ctrl+C quits. The cursor stays on
 * the typing line; every key redraws the list below it. Resolves the name, or null.
 */
function choose(names, typed = '') {
  const out = process.stdout;
  const PROMPT = 'Draft: ';
  let at = 0;
  return new Promise((resolve) => {
    const draw = () => {
      const list = matches(typed, names);
      at = Math.min(at, Math.max(0, list.length - 1));
      const rows = list.length ? list.map((n, i) => (i === at ? `\x1b[1m› ${n}\x1b[0m` : `  ${n}`)) : ['  (no draft fits)'];
      const lines = [`${PROMPT}${typed}`, ...rows, '\x1b[2m↑ ↓ choose · Tab complete · Enter open · Esc quit\x1b[0m'];
      readline.cursorTo(out, 0);
      readline.clearScreenDown(out);
      out.write(lines.join('\n'));
      readline.moveCursor(out, 0, -(lines.length - 1));
      readline.cursorTo(out, PROMPT.length + typed.length);
    };
    const done = (name) => {
      process.stdin.off('keypress', onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      readline.cursorTo(out, 0);
      readline.clearScreenDown(out);
      if (name) out.write(`${PROMPT}${name}\n`);
      resolve(name);
    };
    const onKey = (text, key = {}) => {
      const list = matches(typed, names);
      if ((key.ctrl && key.name === 'c') || key.name === 'escape') return done(null);
      if (key.name === 'return') return list.length ? done(list[at]) : undefined;
      if (key.name === 'up') at = Math.max(0, at - 1);
      else if (key.name === 'down') at = Math.min(list.length - 1, at + 1);
      else if (key.name === 'tab') typed = list[at] || typed;
      else if (key.name === 'backspace') {
        typed = typed.slice(0, -1);
        at = 0;
      } else if (text && !key.ctrl && !key.meta && /^[\w -]$/.test(text)) {
        typed += text;
        at = 0;
      }
      return draw();
    };
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.on('keypress', onKey);
    draw();
  });
}

/**
 * The draft to open: the one named on the command line when it is a draft's name or fits
 * only one, else the operator's choice (the typed name already filled in). Without a
 * terminal to choose in, a name that fits exactly one draft is required.
 */
async function pickDraft(typed) {
  const names = listDrafts();
  const fits = matches(typed || '', names);
  if (typed && (fits[0] === typed || fits.length === 1)) return fits[0];
  if (!process.stdin.isTTY) fail(typed ? `No single draft fits "${typed}".` : 'No draft named.', `Name one: ./scripts/dev.sh drafts <name> (the drafts: ${names.join(', ')}).`);
  return choose(names, typed || '');
}

/** Tailwind's command line (a pinned development dependency). */
const TAILWIND = path.join(ROOT, 'node_modules', '.bin', 'tailwindcss');
/** The kit page's stylesheet, and a draft's: its own `style.css`. */
const KIT_CSS = path.join(DRAFTS, 'kit', 'drafts.css');
const styleOf = (draft) => path.join(DRAFTS, draft, 'style.css');

/** Builds the stylesheet `source` with Tailwind; resolves its CSS, or null after saying why it failed. */
function build(source) {
  return new Promise((resolve) => {
    const child = spawn(TAILWIND, ['--input', source, '--minify'], { cwd: ROOT });
    let built = '';
    let said = '';
    child.stdout.on('data', (chunk) => (built += chunk));
    child.stderr.on('data', (chunk) => (said += chunk));
    child.on('error', (error) => {
      console.error(`✗ Tailwind did not start (${error.code}). Fix: run ./scripts/setup.sh.`);
      resolve(null);
    });
    child.on('close', (code) => {
      if (code !== 0 || !built) console.error(`✗ ${path.relative(ROOT, source)} did not build; its last version stays:\n${said.trim()}`);
      resolve(code === 0 && built ? built : null);
    });
  });
}

/**
 * Every stylesheet asked for, by its source file: its last good CSS and the build that
 * makes it fresh (null after a change). Requests while it builds share that one build.
 */
const sheets = new Map();

/** The current CSS of the stylesheet `source`, built once after every change. */
function stylesheet(source) {
  let sheet = sheets.get(source);
  if (!sheet) sheets.set(source, (sheet = { css: '', fresh: null }));
  if (!sheet.fresh) {
    sheet.fresh = build(source).then((css) => {
      if (css) sheet.css = css;
      return sheet.css;
    });
  }
  return sheet.fresh;
}

/** The open pages waiting to be told to reload (`/events`, server-sent events). */
const listeners = new Set();

/** What the drafts show: the drafts themselves, and the app's code and styles they use. */
const WATCHED = [DRAFTS, path.join(WEB, 'js'), path.join(WEB, 'shared'), path.join(ROOT, 'styles')];

/**
 * Watches WATCHED: shortly after the last change (an editor writes a file in several
 * steps), every stylesheet is due for a fresh build and every open page is told to reload
 * (its stylesheets wait for their build). Dotfiles (editor and system files) do not count.
 */
function watchDrafts() {
  let timer = null;
  for (const dir of WATCHED) {
    fs.watch(dir, { recursive: true }, (_, file) => {
      if (file && String(file).split(path.sep).some((part) => part.startsWith('.'))) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (const sheet of sheets.values()) sheet.fresh = null;
        for (const res of listeners) res.write('data: reload\n\n');
      }, 150);
    });
  }
}

/**
 * The file an address names, or null: a draft's page and screen are the kit's; any other
 * path of a draft or of the kit is its file; the app's folders come from web/.
 */
function fileFor(parts) {
  if (!parts.length || parts.some((part) => part.startsWith('.') || part.includes('\0'))) return null;
  const [head, ...rest] = parts;
  if (APP_DIRS.includes(head)) return path.join(WEB, head, ...rest);
  if (head === 'kit') return path.join(DRAFTS, 'kit', ...rest);
  if (!listDrafts().includes(head)) return null;
  if (!rest.length) return path.join(DRAFTS, 'kit', 'page.html');
  if (rest.length === 1 && rest[0] === 'screen') return path.join(DRAFTS, 'kit', 'screen.html');
  return path.join(DRAFTS, head, ...rest);
}

const server = http.createServer((req, res) => {
  const headers = (type) => ({ 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': CSP });
  const send = (status, type, body) => res.writeHead(status, headers(type)).end(body);
  if (req.method !== 'GET') return send(405, TYPES['.json'], '{"error":"Only GET"}');
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, ORIGIN).pathname);
  } catch {
    return send(400, TYPES['.json'], '{"error":"Bad address"}');
  }
  // Nothing lives at the root: it opens the first draft, whose top bar lists them all.
  if (pathname === '/') return res.writeHead(302, { Location: `/${listDrafts()[0]}/` }).end();
  if (pathname === '/ping') return send(200, TYPES['.json'], '{"drafts":true}');
  if (pathname === '/drafts.json') return send(200, TYPES['.json'], JSON.stringify({ drafts: listDrafts() }));
  if (pathname === '/drafts.css') return stylesheet(KIT_CSS).then((css) => send(200, TYPES['.css'], css));
  if (pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
    res.write(': connected\n\n');
    listeners.add(res);
    req.on('close', () => listeners.delete(res));
    return undefined;
  }
  const parts = pathname.split('/').filter(Boolean);
  // A draft's stylesheet is built from its style.css (with the app's), not sent as written.
  if (parts.length === 2 && parts[1] === 'style.css' && listDrafts().includes(parts[0])) {
    return stylesheet(styleOf(parts[0])).then((css) => send(200, TYPES['.css'], css));
  }
  // A draft's page without its final slash: its own files are addressed relative to it.
  if (parts.length === 1 && !pathname.endsWith('/') && listDrafts().includes(parts[0])) {
    return res.writeHead(302, { Location: `/${parts[0]}/` }).end();
  }
  const file = fileFor(parts);
  const type = file && TYPES[path.extname(file)];
  if (!type || !fs.existsSync(file) || !fs.statSync(file).isFile()) return send(404, TYPES['.json'], '{"error":"Not found"}');
  return send(200, type, fs.readFileSync(file));
});

/** Opens `url` in the default browser (macOS `open`, elsewhere `xdg-open`); says where to go when that fails. */
function openBrowser(url) {
  const child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore', detached: true });
  child.on('error', () => console.log(`  Open ${url} in your browser.`));
  child.unref();
}

/** Whether a drafts server answers on PORT already (another terminal runs it). */
async function running() {
  try {
    const res = await fetch(`${ORIGIN}/ping`, { signal: AbortSignal.timeout(800) });
    return res.ok && (await res.json()).drafts === true;
  } catch {
    return false;
  }
}

const args = process.argv.slice(2);
const open = !args.includes('--no-open');
const name = await pickDraft(args.find((a) => !a.startsWith('--')));
if (!name) process.exit(0);
const url = `${ORIGIN}/${name}/`;
if (await running()) {
  console.log(`→ The drafts already run in another terminal: ${url}`);
  if (open) openBrowser(url);
  process.exit(0);
}
// The kit's and the chosen draft's stylesheets build while the browser opens.
stylesheet(KIT_CSS);
stylesheet(styleOf(name));
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') fail(`Port ${PORT} is used by another program.`, `Stop it (lsof -i :${PORT} shows which), then run ./scripts/dev.sh drafts again.`);
  fail(error.message, 'Run ./scripts/dev.sh drafts again.');
});
server.listen(PORT, '127.0.0.1', () => {
  watchDrafts();
  console.log(`→ ${url}\n  Every draft is at ${ORIGIN}/<name>/; a change in drafts/ or the app's code reloads it. Ctrl+C stops.`);
  if (open) openBrowser(url);
});
