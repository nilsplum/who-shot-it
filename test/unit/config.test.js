/**
 * The shared config (web/shared/config.js) and the facts other files restate from it.
 */
import { describe, expect, test } from 'vitest';
import { APP, EMOJIS, LIMITS, SETTINGS, SETTINGS_DEFAULTS, isRoomCode, normalizeSetting, normalizeSettings } from '../../web/shared/config.js';
import indexHtml from '../../web/index.html?raw';
import legalHtml from '../../web/legal.html?raw';
import manifest from '../../web/manifest.webmanifest?raw';

const texts = import.meta.glob(['../../web/**/*.{js,mjs,html,css,webmanifest}', '../../src/**/*.js', '../../docs/**/*.md', '../../*.md', '../../scripts/**/*.sh'], { query: '?raw', import: 'default', eager: true });

describe('settings', () => {
  test('every default is one of its options', () => {
    for (const s of SETTINGS) expect(normalizeSetting(s.key, s.default)).toBe(s.default);
  });

  test('unknown or invalid values fall back to the defaults', () => {
    expect(normalizeSettings({ photos: 7, mode: 'blur', evil: true, time: '10' })).toEqual({ ...SETTINGS_DEFAULTS, mode: 'blur' });
    expect(normalizeSettings(null)).toEqual(SETTINGS_DEFAULTS);
    expect(normalizeSetting('nope', 1)).toBeUndefined();
  });

  test('settings with help text have a line for every option', () => {
    for (const s of SETTINGS.filter((x) => x.help)) {
      for (const [value] of s.options) expect(s.help[String(value)]).toBeTruthy();
    }
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

test('the static files restate the brand name exactly', () => {
  expect(indexHtml).toContain(`<title>${APP.name}</title>`);
  expect(indexHtml).toContain(`<meta property="og:title" content="${APP.name}">`);
  expect(legalHtml).toContain(`${APP.name}</title>`);
  expect(JSON.parse(manifest).name).toBe(APP.name);
});

test('no long dash anywhere in the repo text', () => {
  expect(Object.keys(texts).length).toBeGreaterThan(20);
  for (const [file, text] of Object.entries(texts)) {
    if (file.includes('/vendor/')) continue;
    expect(text.includes('—'), file).toBe(false);
  }
});
