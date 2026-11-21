/**
 * The pure browser helpers: iPhone links (web/js/device.js) and the photo roll (web/js/photos.js).
 */
import { describe, expect, test } from 'vitest';
import { SHORTCUT } from '../../web/shared/config.js';
import { browserLink, isIOS, shortcutLink } from '../../web/js/device.js';
import { pickIndexes } from '../../web/js/photos.js';
import { seededRandom } from '../helpers.js';

const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const CHROME_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1';
const FIREFOX_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36';

describe('iPhone links', () => {
  test('iOS is detected, including iPads that report a Mac', () => {
    expect(isIOS(SAFARI, false)).toBe(true);
    expect(isIOS(ANDROID, false)).toBe(false);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', true)).toBe(true);
  });

  test('callbacks return to the browser the player is using', () => {
    const url = 'https://whoshot.it/ABCD';
    expect(browserLink(url, SAFARI)).toBe(url);
    expect(browserLink(url, CHROME_IOS)).toBe('googlechromes://whoshot.it/ABCD');
    expect(browserLink(url, FIREFOX_IOS)).toBe(`firefox://open-url?url=${encodeURIComponent(url)}`);
  });

  test('the shortcut link carries the upload link and the callbacks, encoded', () => {
    const link = shortcutLink({ uploadUrl: 'https://whoshot.it/api/rooms/ABCD/pool/tok', doneUrl: 'https://whoshot.it/api/rooms/ABCD/pool/tok/done', backUrl: 'https://whoshot.it/ABCD', ua: SAFARI });
    expect(link.startsWith('shortcuts://x-callback-url/run-shortcut?')).toBe(true);
    expect(link).not.toContain('+');
    const q = new URL(link.replace('shortcuts://x-callback-url/', 'https://x/')).searchParams;
    expect(q.get('name')).toBe(SHORTCUT.name);
    expect(q.get('input')).toBe('text');
    expect(q.get('text')).toBe('https://whoshot.it/api/rooms/ABCD/pool/tok');
    expect(q.get('x-success')).toBe('https://whoshot.it/api/rooms/ABCD/pool/tok/done');
    expect(q.get('x-cancel')).toBe('https://whoshot.it/ABCD');
    expect(q.get('x-error')).toBe('https://whoshot.it/ABCD?setup=1');
  });
});

describe('the photo roll', () => {
  test('shows unseen photos first, and a different set when starting over', () => {
    const seen = new Set();
    const first = pickIndexes(7, 3, seen, [], seededRandom(1));
    first.forEach((i) => seen.add(i));
    const second = pickIndexes(7, 3, seen, first, seededRandom(2));
    expect(second.some((i) => first.includes(i))).toBe(false);
    second.forEach((i) => seen.add(i));
    // One unseen photo left: start over, but not with the set on screen.
    const third = pickIndexes(7, 3, seen, second, seededRandom(3));
    expect(third.some((i) => second.includes(i))).toBe(false);
  });

  test('with fewer candidates than the set size, every candidate is shown', () => {
    expect(pickIndexes(2, 2, new Set(), [], seededRandom(4)).sort()).toEqual([0, 1]);
  });
});
