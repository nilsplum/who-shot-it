/**
 * The one reader of everything the stores get: each store's listing, put together from
 * `store/android_ios_listing.js` (both stores) and `store/<platform>_listing.js` (one
 * store), the images in `store/images/`, and the stores' rules a listing must keep.
 *
 * Mechanisms: every script that touches a store reads it from here, so what is shown is
 * what is uploaded. `app-store.mjs` uploads LISTINGS.ios with IMAGES.ios and refuses while
 * `problems` finds any; `app-assets.mjs` draws the icons and the banner and
 * `store-images.mjs` the screenshots into the files IMAGES names; `store-preview.mjs`
 * (`./scripts/dev.sh store`) shows both pages; `test/unit/listing.test.js` expects no
 * problems, so a text over its limit fails the tests instead of the release.
 *
 * Invariants:
 * - Imports only the listings (which import only the config), no Node modules, so the unit
 *   tests run it inside the Workers runtime. Whoever calls `problems` says how to find a file.
 * - File names say who gets what: `android_ios_` both stores, `ios_` or `android_` one.
 * - A fact has one home: a platform's listing never sets a key the shared one has.
 */
import both from '../../store/android_ios_listing.js';
import android from '../../store/android_listing.js';
import ios from '../../store/ios_listing.js';

const OWN = { ios, android };

/** What each store gets: the shared listing with the platform's own fields. */
export const LISTINGS = { ios: { ...both, ...ios }, android: { ...both, ...android } };

/** The screenshots' files, one per caption and in its order, for a platform. */
const screenshots = (platform) => both.screenshots.map((s, i) => `store/images/${platform}_screenshot-${i + 1}-${s.screen}.png`);

/**
 * The images each store gets, with the size in pixels it asks for. The iPhone store takes
 * the icon from the app itself (drawn from the same `web/icons/icon.svg`); its copy here is
 * what the preview shows. Screenshots: the 6.9 inch iPhone size, and a 1:2 Android phone.
 */
export const IMAGES = {
  ios: {
    icon: { file: 'store/images/ios_icon-1024.png', width: 1024, height: 1024 },
    screenshots: { files: screenshots('ios'), width: 1290, height: 2796 },
  },
  android: {
    icon: { file: 'store/images/android_icon-512.png', width: 512, height: 512 },
    featureGraphic: { file: 'store/images/android_feature-graphic-1024x500.png', width: 1024, height: 500 },
    screenshots: { files: screenshots('android'), width: 1080, height: 2160 },
  },
};

/** Every image file the stores get. */
export const IMAGE_FILES = Object.values(IMAGES).flatMap((images) => Object.values(images).flatMap((image) => image.files || [image.file]));

/**
 * The longest text each store accepts, in characters. Apple's review notes and TestFlight's
 * test notes have the same limit as its description.
 */
const LIMITS = {
  ios: { name: 30, subtitle: 30, promotionalText: 170, keywords: 100, description: 4000, whatsNew: 4000, reviewNotes: 4000, howToTest: 4000 },
  android: { name: 30, shortDescription: 80, description: 4000, photoPermission: 4000 },
};

/** Both stores get the same screenshots: the iPhone store takes 1 to 10, the Android store 2 to 8. */
const SCREENSHOTS = { min: 2, max: 8 };

const words = (text) => text.toLowerCase().match(/[a-z0-9]+/g) || [];

/**
 * Everything a store would refuse or waste, as plain sentences; empty when all is well.
 * `exists(file)` says whether a repo path exists (the scripts ask the disk, the unit test
 * the files Vite sees); `listings` is replaceable so the test can check bad ones.
 */
export function problems(exists, listings = LISTINGS) {
  const found = [];
  for (const [platform, own] of Object.entries(OWN)) {
    for (const key of Object.keys(own).filter((k) => k in both)) found.push(`${key} is set in android_ios_listing.js and again in ${platform}_listing.js`);
  }
  for (const [platform, limits] of Object.entries(LIMITS)) {
    for (const [key, limit] of Object.entries(limits)) {
      const text = listings[platform][key];
      const length = typeof text === 'string' ? [...text.trim()].length : 0;
      if (!length) found.push(`${platform}: ${key} is missing`);
      else if (length > limit) found.push(`${platform}: ${key} has ${length} characters, ${limit} fit`);
    }
  }
  const keywords = (listings.ios.keywords || '').split(',');
  const taken = new Set(words(`${listings.ios.name} ${listings.ios.subtitle}`));
  for (const keyword of keywords) {
    if (keyword !== keyword.trim() || !keyword) found.push(`ios: keyword "${keyword}" has a space next to a comma or is empty (spaces count toward the limit)`);
    const repeated = words(keyword).filter((w) => taken.has(w));
    if (repeated.length) found.push(`ios: keyword "${keyword}" repeats "${repeated.join(' ')}" from the name or subtitle, which count already`);
  }
  if (new Set(keywords).size !== keywords.length) found.push('ios: a keyword is there twice');
  const count = listings.ios.screenshots.length;
  if (count < SCREENSHOTS.min || count > SCREENSHOTS.max) found.push(`${count} screenshots, the stores take ${SCREENSHOTS.min} to ${SCREENSHOTS.max}`);
  for (const file of IMAGE_FILES) {
    const drawer = file.includes('_screenshot-') ? 'store-images' : 'app-assets';
    if (!exists(file)) found.push(`${file} is missing (node scripts/helpers/${drawer}.mjs draws it)`);
  }
  return found;
}
