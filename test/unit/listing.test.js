/**
 * The store listings (`store/*_listing.js`, read by `scripts/helpers/listing.mjs`): what a
 * store would refuse or waste fails here, in every test run, instead of at release time
 * (`app-store.mjs submit` refuses the same problems). `./scripts/dev.sh store` shows them.
 */
import { expect, test } from 'vitest';
import { IMAGE_FILES, LISTINGS, problems } from '../../scripts/helpers/listing.mjs';
import { APP, ENVIRONMENTS } from '../../web/shared/config.js';

/** The files in store/images/, by repo path (only their names: nothing is loaded). */
const images = Object.keys(import.meta.glob('../../store/images/**/*')).map((file) => file.replace('../../', ''));
const exists = (file) => images.includes(file);

test('every text fits its store, every image is there, no keyword is wasted', () => {
  expect(problems(exists)).toEqual([]);
});

test('store/images holds exactly the images the stores get, named by who gets them', () => {
  expect([...images].sort()).toEqual([...IMAGE_FILES].sort());
  for (const file of images) expect(file, file).toMatch(/^store\/images\/(android_ios|android|ios)_/);
});

test('the checks find what a store would refuse', () => {
  const { ios } = LISTINGS;
  const bad = { ...LISTINGS, ios: { ...ios, subtitle: 'x'.repeat(31), keywords: `${ios.keywords},shot, cheap,shot`, whatsNew: '' } };
  expect(problems(() => false, bad)).toEqual(expect.arrayContaining([
    'ios: subtitle has 31 characters, 30 fit',
    'ios: whatsNew is missing',
    'ios: keyword "shot" repeats "shot" from the name or subtitle, which count already',
    'ios: keyword " cheap" has a space next to a comma or is empty (spaces count toward the limit)',
    'ios: a keyword is there twice',
    `${IMAGE_FILES[0]} is missing (node scripts/helpers/app-assets.mjs draws it)`,
  ]));
});

test('both stores get the same name, description and links, built from the config (the store apps\' server)', () => {
  const site = ENVIRONMENTS.production.origin;
  for (const listing of Object.values(LISTINGS)) {
    expect(listing.name.startsWith(APP.name)).toBe(true);
    expect(listing.description).toBe(LISTINGS.ios.description);
    for (const url of [listing.website, listing.privacyPolicyUrl, listing.supportUrl].filter(Boolean)) expect(url.startsWith(site), url).toBe(true);
  }
  // The imprint stays one tap from both store pages (German law), through the description.
  expect(LISTINGS.android.description).toContain(`${site}/legal`);
});
