/**
 * The shared config (web/shared/config.js) and every file that restates one of its
 * values because it cannot import it: the web page, the legal page, the Capacitor
 * config, the native projects and wrangler.jsonc. A copy that drifts fails here. Also the
 * colours: their one home is the theme in styles/app.css, and the app's code and pages
 * only name them.
 */
import { describe, expect, test } from 'vitest';
import {
  APP, EMOJIS, LEGAL, LIMITS, PRESETS, SERVER, SETTINGS, SETTINGS_DEFAULTS, isRoomCode, normalizeSetting, normalizeSettings, presetOf,
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

test('there are more avatars than players, so every player can have their own', () => {
  expect(new Set(EMOJIS).size).toBe(EMOJIS.length);
  expect(LIMITS.maxPlayers).toBeLessThan(EMOJIS.length);
});

test('room codes use only the unambiguous alphabet', () => {
  expect(isRoomCode('ABCD')).toBe(true);
  expect(isRoomCode('AB0D')).toBe(false);
  expect(isRoomCode('abcd')).toBe(false);
  expect(isRoomCode('ABCDE')).toBe(false);
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

  test('the server address: the page may talk to it, and wrangler.jsonc serves it', () => {
    const { host } = new URL(SERVER.origin);
    expect(indexHtml).toContain(`connect-src 'self' ${SERVER.origin} wss://${host};`);
    expect(indexHtml).toContain(`img-src 'self' blob: data: ${SERVER.origin};`);
    if (host.endsWith('.workers.dev')) {
      expect(wrangler.workers_dev).toBe(true);
      expect(host.startsWith(`${wrangler.name}.`)).toBe(true);
    } else {
      expect(wrangler.routes).toContainEqual({ pattern: host, custom_domain: true });
    }
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

  test('the code and pages of the app define no colour, they only name the theme colours', () => {
    const files = Object.entries(texts).filter(([file]) => /\/web\/.*\.(js|html)$/.test(file) && !file.includes('/vendor/'));
    expect(files.length).toBeGreaterThan(20);
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
