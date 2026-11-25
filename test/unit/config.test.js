/**
 * The shared config (web/shared/config.js), with the version gate's rules, and every file
 * that restates one of its values because it cannot import it: the web page, the legal page, the Capacitor
 * config, the native projects and wrangler.jsonc. A copy that drifts fails here. Also the
 * colours: their one home is the theme in styles/app.css, and the app's code and pages, and
 * the drafts that try out new ones (drafts/), only name them.
 */
import { describe, expect, test } from 'vitest';
import {
  APP, ENVIRONMENTS, EMOJIS, LEGAL, LIMITS, PRESETS, REACTIONS, SETTINGS, SETTINGS_DEFAULTS, SILENT_VERSION, STORES, buildNumber, isRoomCode, isVersion, mayPlay,
  normalizeGate, normalizeSetting, normalizeSettings, olderThan, presetOf, reviewLink,
} from '../../web/shared/config.js';
import indexHtml from '../../web/index.html?raw';
import legalHtml from '../../web/legal.html?raw';
import capacitorConfig from '../../capacitor.config.json?raw';
import packageJson from '../../package.json?raw';
import wranglerConfig from '../../wrangler.jsonc?raw';
import stylesCss from '../../styles/app.css?raw';
import androidManifest from '../../android/app/src/main/AndroidManifest.xml?raw';
import androidStrings from '../../android/app/src/main/res/values/strings.xml?raw';
import androidGradle from '../../android/app/build.gradle?raw';
import iosInfo from '../../ios/App/App/Info.plist?raw';
import iosProject from '../../ios/App/App.xcodeproj/project.pbxproj?raw';

/** Every text file of the repo that people write (the built stylesheet web/css/app.css is not one). */
const texts = import.meta.glob([
  '../../web/**/*.{js,mjs,html,css,svg}', '!../../web/css/**', '../../styles/**/*.css', '../../src/**/*.js', '../../test/**/*.js', '../../docs/**/*.md', '../../store/**/*.js', '../../*.md', '../../scripts/**/*.{sh,mjs}',
  '../../drafts/**/*.{js,html,css,md}',
  '../../android/app/src/main/java/**/*.java', '../../android/app/src/main/AndroidManifest.xml', '../../android/app/build.gradle',
  '../../ios/App/App/*.swift', '../../ios/App/App/Info.plist', '../../ios/App/App/PrivacyInfo.xcprivacy',
], { query: '?raw', import: 'default', eager: true });

/** wrangler.jsonc without its comments (it is JSON with comments). */
const wrangler = JSON.parse(wranglerConfig.replace(/^\s*\/\/.*$/gm, ''));

/** A colour of the theme (`--color-<name>` in styles/app.css). */
const colour = (name) => stylesCss.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8});`))[1];

describe('settings', () => {
  test('every default is one of its options', () => {
    for (const s of SETTINGS) expect(normalizeSetting(s.key, s.default)).toBe(s.default);
  });

  test('unknown or invalid values fall back to the defaults', () => {
    expect(normalizeSettings({ photos: 7, mode: 'blur', evil: true, time: '10' })).toEqual({ ...SETTINGS_DEFAULTS, mode: 'blur' });
    expect(normalizeSettings(null)).toEqual(SETTINGS_DEFAULTS);
    expect(normalizeSetting('nope', 1)).toBeUndefined();
  });

  test('every setting but the obvious one explains itself in short lines', () => {
    expect(SETTINGS.filter((s) => !s.help).map((s) => s.key)).toEqual(['photos']);
    for (const s of SETTINGS.filter((x) => x.help)) {
      expect(s.help.length).toBeGreaterThanOrEqual(2);
      for (const [which, text] of s.help) {
        expect(which && text, s.key).toBeTruthy();
        // Grandma-short: one or two short sentences.
        expect(text.length, `${s.key}: ${text}`).toBeLessThanOrEqual(60);
      }
    }
  });

  test('presets are complete, valid settings, and recognised again', () => {
    expect(PRESETS[0].settings).toEqual(SETTINGS_DEFAULTS);
    for (const p of PRESETS) {
      expect(normalizeSettings(p.settings)).toEqual(p.settings);
      expect(presetOf({ ...p.settings })).toBe(p);
    }
    expect(presetOf({ ...SETTINGS_DEFAULTS, time: 30 })).toBeNull();
  });
});

describe('avatars and reactions', () => {
  /** One character with its own emoji look: every supported phone draws it the same way, no text fallback. */
  const singleEmoji = /^\p{Emoji_Presentation}$/u;

  test('there are far more avatars than players, so a full game still has a choice', () => {
    expect(new Set(EMOJIS).size).toBe(EMOJIS.length);
    expect(EMOJIS.length).toBeGreaterThan(2 * LIMITS.maxPlayers);
  });

  test('every avatar and reaction is a single emoji, and none means two things', () => {
    for (const e of [...EMOJIS, ...REACTIONS]) expect(e, e).toMatch(singleEmoji);
    expect(new Set(REACTIONS).size).toBe(REACTIONS.length);
    // A reaction rising up the screen must never look like a player; 👑 marks the host, 📷 is Show again.
    for (const e of [...REACTIONS, '👑', '📷']) expect(EMOJIS, e).not.toContain(e);
  });

  test('the app shows no emoji newer than Emoji 12.0, the newest Android 10 can draw', () => {
    // Most new emojis land in U+1FA70 to U+1FAFF; of those, only these are Emoji 12.0 or older.
    const old = /[\u{1FA70}-\u{1FA73}\u{1FA78}-\u{1FA7A}\u{1FA80}-\u{1FA82}\u{1FA90}-\u{1FA95}]/u;
    const files = Object.entries(texts).filter(([file]) => /\/web\/.*\.(js|html)$/.test(file) && !file.includes('/vendor/'));
    for (const [file, text] of files) {
      const newer = [...text.matchAll(/[\u{1FA70}-\u{1FAFF}]/gu)].map((m) => m[0]).filter((c) => !old.test(c));
      expect(newer, file).toEqual([]);
    }
  });
});

test('a player reviews on the iPhone\'s write-review page, on Google Play once it has a page, and nowhere in a browser', () => {
  expect(reviewLink('ios')).toBe(STORES.ios ? `${STORES.ios}?action=write-review` : null);
  expect(reviewLink('android')).toBe(STORES.android);
  expect(reviewLink('web')).toBe(null);
});

test('room codes use only the unambiguous alphabet', () => {
  expect(isRoomCode('ABCD')).toBe(true);
  expect(isRoomCode('AB0D')).toBe(false);
  expect(isRoomCode('abcd')).toBe(false);
  expect(isRoomCode('ABCDE')).toBe(false);
});

describe('the version gate', () => {
  test('a version is three whole numbers, compared as numbers, not as text', () => {
    expect(isVersion(APP.version)).toBe(true);
    expect(isVersion('1.0.11')).toBe(true);
    for (const v of ['1.0', '1.0.100', 'v1.0.1', '1.0.1 ', '', null, 10011]) expect(isVersion(v), String(v)).toBe(false);
    expect(olderThan('1.0.9', '1.0.10')).toBe(true);
    expect(olderThan('1.0.10', '1.0.9')).toBe(false);
    expect(olderThan('1.0.10', '1.0.10')).toBe(false);
    expect(olderThan('1.9.99', '2.0.0')).toBe(true);
  });

  test('a gate holds only versions; anything else lets every app play and offers no update', () => {
    const open = { min: null, newest: { ios: null, android: null } };
    expect(normalizeGate(null)).toEqual(open);
    expect(normalizeGate('1.0.9')).toEqual(open);
    expect(normalizeGate({ min: 'soon', newest: { ios: '1.0.12', android: 7, web: '9.9.9' } })).toEqual({ min: null, newest: { ios: '1.0.12', android: null } });
    expect(mayPlay('0.0.1', open)).toBe(true);
    expect(mayPlay(undefined, open)).toBe(true);
  });

  test('an app may play from the minimum on; one that says no version counts as the last one that said none', () => {
    const gate = normalizeGate({ min: '1.0.11' });
    expect(mayPlay('1.0.11', gate)).toBe(true);
    expect(mayPlay('1.0.12', gate)).toBe(true);
    expect(mayPlay('1.0.10', gate)).toBe(false);
    expect(mayPlay(undefined, gate)).toBe(false);
    expect(mayPlay('nonsense', gate)).toBe(false);
    expect(mayPlay(undefined, normalizeGate({ min: SILENT_VERSION }))).toBe(true);
  });

  test('every build updates where it was installed from: the stores for production, TestFlight and Google Play for staging', () => {
    const platforms = Object.keys(normalizeGate(null).newest);
    for (const e of Object.values(ENVIRONMENTS)) expect(Object.keys(e.update)).toEqual(platforms);
    expect(ENVIRONMENTS.production.update.ios).toBe(STORES.ios);
    expect(ENVIRONMENTS.production.update.android).toBe(`https://play.google.com/store/apps/details?id=${APP.id}`);
    expect(ENVIRONMENTS.staging.update.ios).toMatch(/^https:\/\/testflight\.apple\.com\/join\/[A-Za-z0-9]+$/);
    expect(ENVIRONMENTS.staging.update.android).toBe(ENVIRONMENTS.production.update.android);
  });
});

describe('values restated outside the config', () => {
  test('the brand name', () => {
    expect(indexHtml).toContain(`<title>${APP.name}</title>`);
    expect(indexHtml).toContain(`<meta property="og:title" content="${APP.name}">`);
    expect(legalHtml).toContain(`${APP.name}</title>`);
    expect(JSON.parse(capacitorConfig).appName).toBe(APP.name);
    expect(androidStrings).toContain(`<string name="app_name">${APP.name}</string>`);
    expect(iosInfo).toMatch(new RegExp(`<key>CFBundleDisplayName</key>\\s*<string>${APP.name.replace('?', '\\?')}</string>`));
  });

  test('the app version: the terms come back with every new version', () => {
    expect(APP.version).toBe(JSON.parse(packageJson).version);
  });

  test('the app id', () => {
    expect(JSON.parse(capacitorConfig).appId).toBe(APP.id);
    expect(androidGradle).toContain(`applicationId "${APP.id}"`);
    expect(androidGradle).toContain(`namespace = "${APP.id}"`);
    expect(iosProject.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)).toEqual([`PRODUCT_BUNDLE_IDENTIFIER = ${APP.id};`, `PRODUCT_BUNDLE_IDENTIFIER = ${APP.id};`]);
  });

  test('the invite link scheme', () => {
    expect(androidManifest).toContain(`<data android:scheme="${APP.scheme}" android:host="join" />`);
    expect(iosInfo).toMatch(new RegExp(`<key>CFBundleURLSchemes</key>\\s*<array>\\s*<string>${APP.scheme}</string>`));
  });

  test('the environments: wrangler.jsonc deploys each one\'s Worker at its address, and the page may talk to each', () => {
    // Production is wrangler.jsonc's top level; staging is env.staging, which Wrangler names
    // "<name>-staging" and gives the top level's settings, but not its Durable Objects.
    const configs = { production: wrangler, staging: { ...wrangler, ...wrangler.env.staging } };
    expect(Object.keys(ENVIRONMENTS)).toEqual(['production', 'staging']);
    expect(Object.keys(wrangler.env)).toEqual(['staging']);
    expect(ENVIRONMENTS.production.worker).toBe(wrangler.name);
    expect(ENVIRONMENTS.staging.worker).toBe(`${wrangler.name}-staging`);
    expect(wrangler.env.staging.durable_objects).toEqual(wrangler.durable_objects);
    expect(wrangler.env.staging.migrations).toEqual(wrangler.migrations);
    for (const [name, { origin, worker }] of Object.entries(ENVIRONMENTS)) {
      const { host } = new URL(origin);
      if (host.endsWith('.workers.dev')) {
        expect(configs[name].workers_dev, name).toBe(true);
        expect(host.startsWith(`${worker}.`), name).toBe(true);
      } else {
        expect(configs[name].routes, name).toContainEqual({ pattern: host, custom_domain: true });
      }
    }
    const origins = Object.values(ENVIRONMENTS).map((e) => e.origin);
    expect(indexHtml).toContain(`img-src 'self' blob: data: ${origins.join(' ')};`);
    expect(indexHtml).toContain(`connect-src 'self' ${origins.map((o) => `${o} wss://${new URL(o).host}`).join(' ')};`);
  });

  test('a build\'s number carries its environment, is never used twice, and only grows', () => {
    expect(buildNumber('1.0.9', 'staging')).toBe(100090);
    expect(buildNumber('1.0.9', 'production')).toBe(100091);
    const digits = Object.values(ENVIRONMENTS).map((e) => e.build);
    expect(new Set(digits).size).toBe(digits.length);
    for (const d of digits) expect(d >= 0 && d <= 9).toBe(true);
    // Above every build made before environments had a digit (the plain version number).
    expect(buildNumber('1.0.9', 'staging')).toBeGreaterThan(10009);
    expect(buildNumber('1.0.10', 'staging')).toBeGreaterThan(buildNumber('1.0.9', 'production'));
    expect(() => buildNumber('1.0.9', 'local')).toThrow('No environment "local"');
  });

  test('the legal page: its date is the terms version, its age the minimum age', () => {
    const date = new Date(`${LEGAL.version}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    expect(legalHtml).toContain(`Last updated: ${date}`);
    expect(legalHtml).toContain(`you must be ${LEGAL.minAge} or older`);
  });
});

describe('colours: styles/app.css is their one home', () => {
  test('the page restates the dark blue as its theme colour', () => {
    expect(indexHtml).toContain(`<meta name="theme-color" content="${colour('navy')}">`);
  });

  test('the code and pages of the app and the drafts define no colour, they only name the theme colours', () => {
    const files = Object.entries(texts).filter(([file]) => (/\/web\/.*\.(js|html)$/.test(file) && !file.includes('/vendor/')) || /\/drafts\/.*\.(js|html|css)$/.test(file));
    expect(files.length).toBeGreaterThan(30);
    for (const [file, text] of files) {
      const own = text.replace(/<meta name="theme-color" content="#[0-9a-fA-F]+">/, '');
      expect(own.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g), file).toBeNull();
    }
  });
});

test('no long dash anywhere in the repo text', () => {
  expect(Object.keys(texts).length).toBeGreaterThan(40);
  for (const [file, text] of Object.entries(texts)) {
    if (file.includes('/vendor/')) continue;
    expect(text.includes('—'), file).toBe(false);
  }
});
