/**
 * What only the Android store gets: its short description, category and tags, the
 * developer name and contact it shows, its privacy label ("Data safety") and the
 * declaration for the photo permission. Together with `store/android_ios_listing.js` (both
 * stores) this is the whole Android listing; `store/images/android_*` are its images.
 *
 * Mechanisms: `scripts/helpers/listing.mjs` merges and checks it (LISTINGS.android). No
 * script uploads it: everything here is entered by hand in the Play Console once, and again
 * when it changes (docs/guides/android.md, steps 2 and 3); `./scripts/dev.sh store` shows
 * the page (Android) and is the easiest place to copy the texts from.
 *
 * Invariants:
 * - `dataSafety` must match the privacy policy (web/legal.html) and the iPhone's privacy
 *   label (`privacy` in store/ios_listing.js): the same data, in Google's words.
 * - `developer` is the name of the Google Play developer account (an organization account
 *   for HiveDone UG, docs/guides/android.md, step 1), not set by any upload.
 * - The age (LEGAL.minAge in web/shared/config.js) is set through the content rating and
 *   the target audience forms (docs/guides/android.md, step 3).
 * - No "What's new": `play-upload.mjs` releases without release notes, so the page shows none.
 */

export default {
  /** Under the name on the page and in search. */
  shortDescription: 'Photo guessing game for friends: guess whose phone each random photo came from!',
  developer: 'HiveDone UG (haftungsbeschränkt)',
  /** App type Game, category Trivia; the tags as the Play Console offers them. */
  category: 'Trivia',
  tags: ['Party', 'Trivia', 'Casual'],
  /** Shown on the page for players' questions (App support). */
  contactEmail: 'whoshotit.info@gmail.com',
  /**
   * The privacy label ("Data safety"), as entered in the Play Console: data shared with
   * others (none), and data collected, by Google's category with its data types: each
   * collected, not processed ephemerally, required, for App functionality only. Encrypted
   * in transit; deletion on request by email (and gone after a day at the latest anyway).
   * The answers, points and reactions the room keeps for the game are Google's "Other
   * actions" ("gameplay, likes"), Apple's "Gameplay Content".
   */
  dataSafety: {
    shared: {},
    collected: { 'Personal info': ['Name'], 'Photos and videos': ['Photos'], 'App activity': ['Other actions'], 'Device or other IDs': ['Device or other IDs'] },
    encryptedInTransit: true,
    deletionOnRequest: true,
  },
  /**
   * The declaration for READ_MEDIA_IMAGES (Play Console, App content, Photo and video
   * permissions): why the app needs the whole library instead of a picker. Never shown on
   * the page.
   */
  photoPermission: 'Who Shot It? is a party game whose core feature is guessing whose photo it is. For each game the app picks random photos from the player’s whole library on the device; the player sees them and confirms or redraws. A picker cannot provide random photos from the whole library, which is the point of the game. Only photos the player confirms leave the device; they are shown to the players in that private game and deleted after their round.',
};
