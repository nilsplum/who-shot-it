/**
 * The drafts (drafts/, shown by `./scripts/dev.sh drafts`): every draft has the shape the
 * kit's page and screen expect (drafts/README.md, "A draft"), so a new one cannot break its
 * page in a way that shows only when it is opened. What a draft shows is not tested: a
 * draft is judged by looking at it.
 */
import { expect, test } from 'vitest';

/** Every file of drafts/ by its path inside drafts/ (only the names; nothing is loaded). */
const files = Object.keys(import.meta.glob('../../drafts/**/*')).map((file) => file.replace('../../drafts/', ''));
/** Each draft's description (its draft.js), by the draft's name. */
const drafts = Object.fromEntries(Object.entries(import.meta.glob('../../drafts/*/draft.js', { eager: true, import: 'default' })).map(([file, draft]) => [file.split('/')[3], draft]));
/** The choices the kit's page makes itself (drafts/kit/page.js): a draft's own controls cannot take these names. */
const KIT_CHOICES = ['show', 'phone', 'reduce', 'frame'];

test('drafts/ holds its README, the kit and drafts, nothing else', () => {
  expect(files).toContain('README.md');
  const folders = new Set(files.filter((f) => f.includes('/')).map((f) => f.split('/')[0]));
  expect(Object.keys(drafts).length).toBeGreaterThan(0);
  for (const folder of folders) expect(folder === 'kit' || folder in drafts, `${folder}: a folder without draft.js`).toBe(true);
});

/** Each draft's stylesheet as written, by the draft's name. */
const styles = Object.fromEntries(Object.entries(import.meta.glob('../../drafts/*/style.css', { query: '?raw', import: 'default', eager: true })).map(([file, css]) => [file.split('/')[3], css]));

test('every draft has a lower-case name, its screen and its style', () => {
  for (const name of Object.keys(drafts)) {
    expect(name).toMatch(/^[a-z0-9_]+$/);
    expect(files, name).toContain(`${name}/screen.js`);
    expect(files, name).toContain(`${name}/style.css`);
  }
});

test("every draft builds its stylesheet on the app's, so it shows the app's design and moves into it as it is", () => {
  for (const [name, css] of Object.entries(styles)) {
    expect(css, name).toContain("@import '../../styles/app.css';");
    expect(css, name).toContain("@source '.';");
  }
});

test('every description has a title, frames with their own ids, and controls with a valid default', () => {
  for (const [name, draft] of Object.entries(drafts)) {
    expect(typeof draft.title, name).toBe('string');
    const frames = draft.frames || [];
    for (const f of frames) expect([typeof f.id, typeof f.title, typeof f.idea], `${name}: ${f.id}`).toEqual(['string', 'string', 'string']);
    expect(new Set(frames.map((f) => f.id)).size, name).toBe(frames.length);
    for (const c of draft.controls || []) {
      expect(KIT_CHOICES, `${name}: ${c.key}`).not.toContain(c.key);
      expect(c.options.map(([value]) => value), `${name}: ${c.key}`).toContain(c.value);
    }
  }
});
