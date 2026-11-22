/**
 * The text check (web/js/textcheck.js) on the previews in test/fixtures/text/ (real photos
 * and drawn phone screens, see SOURCES.md there): every `keep-…` image stays in the game
 * under "Little text", every `skip-…` image is left out as full of text. Beyond the bare
 * decision, both groups must stay clearly apart from LIMITS.textLines, so a slightly
 * different photo or phone does not flip the result.
 *
 * The images are JPEG files like the phone's previews; the Workers runtime the tests run in
 * cannot decode images, so `jpeg-js` (a development tool only) does it here.
 */
import jpeg from 'jpeg-js';
import { describe, expect, test } from 'vitest';
import { LIMITS } from '../../web/shared/config.js';
import { grayOf, textLines } from '../../web/js/textcheck.js';

const files = import.meta.glob('../fixtures/text/*.jpg', { query: '?inline', import: 'default', eager: true });

/** Lines of text in a fixture, measured exactly as the app does on a preview. */
function linesOf(dataUrl) {
  const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
  const { width, height, data } = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  return { width, height, lines: textLines(grayOf(data), width, height) };
}

const images = Object.entries(files).map(([file, url]) => ({ name: file.split('/').pop(), ...linesOf(url) }));
const keep = images.filter((i) => i.name.startsWith('keep-'));
const skip = images.filter((i) => i.name.startsWith('skip-'));

test('the test images cover both kinds and have the preview size the app gets', () => {
  expect(keep.length).toBeGreaterThanOrEqual(30);
  expect(skip.length).toBeGreaterThanOrEqual(15);
  expect(keep.length + skip.length).toBe(images.length);
  for (const i of images) expect(Math.max(i.width, i.height), i.name).toBe(LIMITS.previewSide);
});

describe('photos without much text stay, even busy ones (crowds, leaves, windows, a meme)', () => {
  test.each(keep)('$name', ({ lines }) => {
    expect(lines).toBeLessThan(LIMITS.textLines - 1);
  });
});

describe('photos full of text are left out (chats, emails, documents, lists, light and dark)', () => {
  test.each(skip)('$name', ({ lines }) => {
    expect(lines).toBeGreaterThanOrEqual(2 * LIMITS.textLines);
  });
});

test('an empty or flat image has no lines', () => {
  expect(textLines(new Uint8Array(100 * 50), 100, 50)).toBe(0);
  expect(textLines(new Uint8Array(100 * 50).fill(200), 100, 50)).toBe(0);
});
