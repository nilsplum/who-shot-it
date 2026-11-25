/**
 * The version gate of the deployed servers (`normalizeGate` in web/shared/config.js: which
 * app versions may play there, and the newest one out per platform), as the scripts need it.
 * Run only by `./scripts/deploy.sh` and `./scripts/release-apps.sh status`:
 *   ask <environment> [--min <version|none>] [--newest <ios|android>=<version|none>]...
 *       Shows what the live server serves now, then takes each value from the options, or
 *       asks for it in a terminal (Enter keeps the live one), and checks them. Prints two
 *       lines: the gate as JSON (for `wrangler deploy --var GATE:<json>`), then the new
 *       minimum when it is higher than the live one (deploy.sh asks production's typed
 *       phrase for it), else an empty line.
 *   verify <environment> <json>
 *       Reads the live server's gate until it is exactly <json> (a deploy needs a few seconds
 *       to reach everywhere); fails after about half a minute.
 *   show
 *       Each environment's live gate, one line each.
 *
 * Mechanisms: the gate is never stored in the repo. Every deploy is given it (`GATE`, a value
 * Cloudflare keeps with that deployed version, so a rollback restores it), and the live server
 * answers it at `API.gate()`. So the live server is its one source of truth: `ask` starts
 * from it and `verify` proves the deploy carries it. A server that has no such answer
 * (deployed before the gate) has no gate: every app may play there.
 *
 * Invariants:
 * - `min` is never above a platform's `newest`: an app asked to update can always find the
 *   newer version where it updates (never block before the replacement is out).
 * - Everything for the person at the terminal goes to stderr; stdout carries only what the
 *   calling script reads.
 * - Questions only in a terminal; without one the options or the live values count, so a run
 *   without anyone at the keyboard never waits.
 */
import readline from 'node:readline/promises';
import { API } from '../../web/shared/api.js';
import { ENVIRONMENTS, SILENT_VERSION, isVersion, normalizeGate, olderThan } from '../../web/shared/config.js';

/** The platforms a gate has a newest version for (its `newest` keys), with the names people know. */
const PLATFORMS = Object.keys(normalizeGate(null).newest);
const NAMES = { ios: 'iPhone', android: 'Android' };

const say = (line = '') => process.stderr.write(`${line}\n`);
function stop(reason, fix) {
  say(`✗ ${reason}`);
  say(`  Fix: ${fix}`);
  process.exit(1);
}

/** A value as typed: a version, null for "none", undefined for anything else. */
const valueOf = (text) => (text === 'none' ? null : isVersion(text) ? text : undefined);

/** One line a person reads: who may play, and what is out. */
const describe = (gate) => `${gate.min ? `${gate.min} and newer may play` : 'every version may play'}; newest out: ${PLATFORMS.map((p) => `${NAMES[p]} ${gate.newest[p] || 'none'}`).join(', ')}`;

/**
 * The gate the live server of `environment` serves, or null when it does not answer. A server
 * deployed before the gate answers "not found": it has none, which is the open gate.
 */
async function live(environment) {
  try {
    const res = await fetch(ENVIRONMENTS[environment].origin + API.gate(), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
    if (res.status === 404) return normalizeGate(null);
    return res.ok ? normalizeGate(await res.json()) : null;
  } catch {
    return null;
  }
}

/** The values given in advance: `{ min, newest: { ios, android } }`, each left out when not given. */
function given(args) {
  const out = { newest: {} };
  for (let i = 0; i < args.length; i += 2) {
    const [option, text = ''] = [args[i], args[i + 1]];
    if (option === '--min') {
      out.min = valueOf(text);
      if (out.min === undefined) stop(`--min needs a version like 1.0.11, or none (got: ${text || 'nothing'}).`, 'For example: --min 1.0.11');
    } else if (option === '--newest') {
      const [platform, version] = text.split('=');
      if (!PLATFORMS.includes(platform) || valueOf(version) === undefined) stop(`--newest needs a platform and a version, like ios=1.0.11 (got: ${text || 'nothing'}).`, `Platforms: ${PLATFORMS.join(', ')}; the version can be none.`);
      out.newest[platform] = valueOf(version);
    } else {
      stop(`Unknown option for the version gate: ${option}`, 'Use --min <version> and --newest <platform>=<version>.');
    }
  }
  return out;
}

/** Asks for one value in the terminal until it is a version, "none" or kept (Enter). */
async function question(rl, text, value) {
  for (;;) {
    const answer = (await rl.question(`  ${text} [${value || 'none'}]: `)).trim();
    if (!answer) return value;
    if (valueOf(answer) !== undefined) return valueOf(answer);
    say('  A version like 1.0.11, or none.');
  }
}

async function ask(environment, args) {
  const options = given(args);
  const now = await live(environment);
  if (!now) say(`! The ${environment} server (${ENVIRONMENTS[environment].origin}) did not answer: starting from no gate, so check every value.`);
  const before = now || normalizeGate(null);
  say(`→ The apps on ${environment} now: ${describe(before)}`);
  const gate = normalizeGate({ min: 'min' in options ? options.min : before.min, newest: { ...before.newest, ...options.newest } });
  if (process.stdin.isTTY) {
    const open = [!('min' in options), ...PLATFORMS.map((p) => !(p in options.newest))];
    if (open.some(Boolean)) {
      say('  Enter keeps a value, "none" clears it.');
      const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
      if (!('min' in options)) gate.min = await question(rl, 'Oldest version that may play', gate.min);
      for (const p of PLATFORMS) {
        if (!(p in options.newest)) gate.newest[p] = await question(rl, `Newest ${NAMES[p]} version people can install`, gate.newest[p]);
      }
      rl.close();
    }
  }
  for (const p of PLATFORMS) {
    if (gate.min && gate.newest[p] && olderThan(gate.newest[p], gate.min)) {
      stop(`The oldest version that may play (${gate.min}) is newer than the newest ${NAMES[p]} version out (${gate.newest[p]}): those apps would be asked to update to a version they cannot get.`, `Lower the minimum, or raise the newest ${NAMES[p]} version once that version can be installed.`);
    }
  }
  if (gate.min && olderThan(SILENT_VERSION, gate.min)) {
    say(`! Apps up to ${SILENT_VERSION} cannot show "Update to play": with this minimum they are told "This game is full." when they join, and "Could not create a game." when they create one.`);
  }
  say(`→ ${environment} after this deploy: ${describe(gate)}`);
  const raised = gate.min && (!before.min || olderThan(before.min, gate.min)) ? gate.min : '';
  process.stdout.write(`${JSON.stringify(gate)}\n${raised}\n`);
}

async function verify(environment, json) {
  const want = JSON.stringify(normalizeGate(JSON.parse(json)));
  for (let attempt = 0; attempt < 15; attempt++) {
    const got = await live(environment);
    if (got && JSON.stringify(got) === want) {
      say(`✓ ${environment} serves its version gate: ${describe(got)}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  stop(`${environment} does not serve the version gate it was deployed with (${want}).`, `See what it serves: ./scripts/release-apps.sh status; then deploy again: ./scripts/deploy.sh ${environment}`);
}

async function show() {
  for (const environment of Object.keys(ENVIRONMENTS)) {
    const gate = await live(environment);
    console.log(`${environment} server: ${gate ? describe(gate) : 'does not answer'}`);
  }
}

const [command, environment, ...rest] = process.argv.slice(2);
if (command === 'show') await show();
else if (!ENVIRONMENTS[environment]) stop(`Which environment? (got: ${environment || 'nothing'})`, `Name one: ${Object.keys(ENVIRONMENTS).join(' or ')}.`);
else if (command === 'ask') await ask(environment, rest);
else if (command === 'verify') await verify(environment, rest[0]);
else stop(`Unknown command: ${command || 'nothing'}`, 'Use: ask, verify or show (run by ./scripts/deploy.sh and ./scripts/release-apps.sh).');
