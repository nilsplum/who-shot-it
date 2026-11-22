/**
 * The app's colours for the scripts that draw images (`app-assets.mjs`: icons and launch
 * screens; `store-images.mjs`: the store screenshots), read from their one home, the
 * `@theme` of `styles/app.css`. A colour changed there is drawn everywhere on the next run.
 */
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'styles', 'app.css'), 'utf8');

/** The colour token `--color-<name>` as its hex value; a name the theme lacks is an error, never a guess. */
export function colour(name) {
  const found = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8});`));
  if (!found) throw new Error(`styles/app.css has no colour --color-${name}`);
  return found[1];
}
