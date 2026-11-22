/**
 * What both store pages show alike: the name, the description, the links and the
 * screenshots' captions. Everything the stores get lives in `store/`, and its file names
 * say who gets it: `android_ios_` both stores, `ios_` only the iPhone store
 * (`store/ios_listing.js`), `android_` only the Android store (`store/android_listing.js`);
 * the images in `store/images/` follow the same names.
 *
 * Mechanisms: `scripts/helpers/listing.mjs` puts this together with each platform's own
 * listing and checks the result against the stores' rules. `scripts/helpers/app-store.mjs`
 * uploads the iPhone page from it, the Android page is filled in by hand from it
 * (docs/guides/android.md), `scripts/helpers/store-images.mjs` draws the screenshots with
 * these captions, and `./scripts/dev.sh store` shows both pages as players will see them
 * (the easiest place to read or copy a text from).
 *
 * Invariants:
 * - Every sentence is true for the app as it is: when a feature changes, the listings
 *   change in the same commit (AGENTS.md, legal documents). Plain words and no dashes:
 *   commas, colons and full stops read better on a phone.
 * - A key set here is never set again in a platform's listing (`problems` in listing.mjs):
 *   each fact has one home.
 * - Links and the number of players are built from the config (SERVER.origin, LIMITS),
 *   never written out, so a move to a domain or a new player limit changes them too.
 * - Screenshots show only drawn stand-in photos (`scripts/helpers/demo-photos.mjs`), never
 *   real ones: nobody's private pictures, no image licence needed.
 *
 * Why the texts are written this way: the name alone does not say what the app is, so the
 * store name adds "Photo Party Game", and the subtitle (iPhone), the short description
 * (Android), the first screenshot and the first line of the description all say the same
 * simple thing: photos from your friends' phones, guess whose it is. The privacy part is in
 * the description because the first question anyone has about this game is "who sees my
 * photos?". The imprint link at the end keeps the imprint one tap from the store page
 * (German law), on Android too, where the page links only the website.
 */
import { APP, LIMITS, SERVER } from '../web/shared/config.js';

const description = `Your camera roll is full of stories. Time to play them.

Who Shot It? turns the photos on your phones into the funniest guessing game at the table. Everyone gets a few random photos from their own phone. Then one photo after another pops up on every screen, and you race to tap whose phone it came from.

Was that blurry pizza at 2 a.m. Lena’s? Is the 400th cat picture Ben’s? Guess fast, guess right, and the points are yours. Then the reveal. Friendships have survived worse. Probably.

HOW IT WORKS
1. One person creates a game. Friends join with a four letter code.
2. Everyone gets a few random photos from their phone. Don’t like them? Tap No for new ones, or tap one photo to swap just that one. Happy? Tap Yes.
3. The photos pop up one by one. Tap who took it. Fast and right scores the most.

MADE FOR PARTIES
• ${LIMITS.minPlayers} to ${LIMITS.maxPlayers} players, best together in one room
• Classic, or Tricky: photos start blurry, zoomed in or pixelated
• Pick rounds, time and points, each option explained in one sentence
• Reactions, a leaderboard between the photos, a secret final round and a podium at the end
• Free, no account, no ads

YOUR PHOTOS STAY YOURS
• The app picks the photos on your phone. Nothing is shared until you tap Yes.
• Chats, emails and other photos full of text stay out, and screenshots can too.
• Only the players in your game see them.
• Each photo is deleted right after its round.
• Anyone can flag a photo: it is hidden at once and deleted for everyone.

Grab your friends, open the app and find out who really took that photo.

Questions or ideas? whoshotit.info@gmail.com
Imprint and privacy: ${SERVER.origin}/legal`;

export default {
  /** The listings' one language: English (United States), on both stores. */
  locale: 'en-US',
  /** The name on the store page and in search; the home screen keeps showing APP.name. */
  name: `${APP.name} Photo Party Game`,
  description,
  /** Linked from both pages: the iPhone store calls it "Marketing URL", the Android store "Website". */
  website: SERVER.origin,
  privacyPolicyUrl: `${SERVER.origin}/legal#privacy`,
  /**
   * The screenshots, in the order a new player needs to understand the game: what it is,
   * where the photos come from, the fun part, the options, and the answer to "who sees my
   * photos?". Only the first three show in iPhone search results, so they tell the whole
   * idea. `screen` is the app screen `store-images.mjs` takes for it; each caption is a
   * short headline and one plain sentence.
   */
  screenshots: [
    { screen: 'guess', title: 'Whose photo is it?', text: 'Random photos from everyone’s phone. Tap who took it.' },
    { screen: 'photos', title: 'Bring your photos', text: 'The app picks a few at random. Tap No for new ones, Yes when you like them.' },
    { screen: 'board', title: 'Fast and right wins', text: 'See who guessed what. Then laugh about it.' },
    { screen: 'newgame', title: 'Play it your way', text: 'Classic, or photos that start blurry, zoomed in or pixelated.' },
    { screen: 'yours', title: 'Your photos stay yours', text: 'Nothing is shared until you tap Yes. Each photo is deleted after its round.' },
  ],
};
