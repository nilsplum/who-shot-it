/**
 * What only the iPhone store gets: the texts only its page has, its categories and privacy
 * label, the developer name it shows, and the answers for App Review and TestFlight's beta
 * review. Together with `store/android_ios_listing.js` (both stores) this is the whole
 * iPhone listing; `store/images/ios_*` are its images.
 *
 * Mechanisms: `scripts/helpers/listing.mjs` merges and checks it (LISTINGS.ios);
 * `node scripts/helpers/app-store.mjs submit` (`./scripts/release-apps.sh ios --submit`)
 * uploads every field below except `privacy` and `developer`, and sets besides: content
 * rights (players share their own photos), the age rating (user generated content and
 * contests yes, everything else no, raised to LEGAL.minAge in web/shared/config.js, the age
 * of the terms), free, every country except China mainland (games there need a licence),
 * release after approval. `./scripts/dev.sh store` shows the page (iOS).
 *
 * Invariants:
 * - Two settings have no API and are made by hand once (docs/apps.md, First release): the
 *   privacy label (`privacy`) and the EU trader status. `privacy` must match the iOS privacy
 *   manifest `ios/App/App/PrivacyInfo.xcprivacy` and the privacy policy (web/legal.html).
 * - `developer` is the name of the Apple developer account, not set by any upload: the app
 *   is published through the managing director's own account (web/legal.html, Imprint).
 * - Review texts are seen only by Apple's reviewers; the preview never shows them.
 */
import { SERVER, TIMING } from '../web/shared/config.js';

const promotionalText = 'Your next party game is already on your phones: random photos from everyone’s camera roll, and one question. Whose is it?';

/**
 * What players notice in this version, in plain sentences: the App Store's "What's New"
 * (Apple takes it only for updates) and TestFlight's "What to Test" for this version's build.
 */
const whatsNew = 'In the lobby, the players now take two rows that you can swipe sideways, with an arrow to go through them, so your photos stay big even with 16 players. The arrow of the reactions now turns round too.';

/** The test steps, for App Review (below its answers) and for TestFlight's beta review. */
const howToTest = `HOW TO TEST
A game needs at least two devices, each with a few photos.
Device A: accept the terms, enter a name, tap Create game, keep Classic, tap Start game. A four letter code appears.
Device B: accept the terms, enter a name, type the code, tap Join.
On both: tap Continue and allow photo access. Tap No for other random photos, or Yes to play with them. When everyone is ready, the app asks “Is everyone here?”: tap Yes, start. Tap the player you think took the photo.

PHOTOS AND SAFETY
Only photos a player confirms with Yes leave the phone, and only to the players of that one game. Each photo is deleted from our server right after its round.
Report: tap the flag on a photo. The others stop seeing it at once, and Delete photo deletes it for everyone (after ${TIMING.flagMs / 1000} seconds it is deleted anyway).
Remove: the host taps a player to remove them. They cannot rejoin that game.
Offensive nicknames are replaced. Everyone accepts the terms (16+) before playing.
Questions and reports: whoshotit.info@gmail.com`;

/** Apple's questions for new apps, answered in its order, then the test steps. */
const reviewNotes = `1. Screen recording: attached, uncut. It was made with this build on an iPad, where the iPhone app runs in its iPhone layout, and starts with opening the app. It shows a whole game: creating a game, choosing photos, removing a player, “Is everyone here?”, reporting a photo, the final round and the final scores. Photo access and the terms had been accepted before the recording (both are asked only at the first start). The other players are our own test players, run on a computer with drawn sample pictures, so one person could record a whole game.

2. Purpose and audience: Who Shot It? is a party game for friends aged 16 and older who meet in person. Each player gets a few random photos from their own phone and decides whether to play with them. Then the photos appear one by one on every phone, and everyone guesses whose photo it is. It gives a group something fun to do together with the photos they already have. Free, no account, no ads, no purchases.

3. Setup and main features: see "How to test" below. No login, demo account or sample files are needed.

4. External services: only our own game server on Cloudflare (Workers and Durable Objects, data stored in the EU). It passes the game and the photos a player confirmed between the phones of one game. No analytics, ads, login, payment or AI services.

5. Regions: the app works the same in every country where it is offered (all except China mainland).

6. Regulated industry or protected material: none. Players only use photos from their own library.

${howToTest}`;

export default {
  subtitle: 'Camera roll guessing game',
  /** Shown above the description; can change any time without a review. */
  promotionalText,
  /**
   * Search words, never shown. Commas without spaces (a space counts toward the limit).
   * Words of the name and subtitle count already, so none is repeated, and never other
   * apps' names or trademarks (App Review guideline 2.3.7). The store combines every word
   * of the name, subtitle and keywords, so single words cover whole searches: "party games
   * with friends", "group games for adults", "game night", "games to play in person",
   * "local multiplayer", "icebreaker games", "guess whose photo" (why these: the search
   * note in store/android_ios_listing.js).
   */
  keywords: 'friends,group,guess,whose,adults,night,person,play,multiplayer,icebreaker,phone,fun,pics,quiz,local',
  whatsNew,
  developer: 'Nils Plum',
  /** The imprint, which also names every way to reach us. */
  supportUrl: `${SERVER.origin}/legal#imprint`,
  copyright: '2026 HiveDone UG (haftungsbeschränkt)',
  /** Apple's category ids: Games, with Trivia and Casual, and Entertainment as the second category. */
  categories: { primary: 'GAMES', subcategories: ['GAMES_TRIVIA', 'GAMES_CASUAL'], secondary: 'ENTERTAINMENT' },
  /**
   * The privacy label ("App Privacy"), by section of the page and Apple's data category,
   * with the data types ticked in App Store Connect: "Yes, we collect data", each type for
   * App Functionality only, not linked to the player, no tracking. The nickname and the
   * random per-game key are Apple's "User ID"; the answers, points and reactions the room
   * keeps for the game are its "Gameplay Content".
   */
  privacy: {
    tracking: {},
    linked: {},
    notLinked: { 'User Content': ['Photos or Videos', 'Gameplay Content'], Identifiers: ['User ID'] },
  },
  /** Seen only by Apple's reviewers, for App Review and TestFlight's beta review. */
  reviewContact: { firstName: 'Nils', lastName: 'Plum', phone: '+49 177 2438912', email: 'whoshotit.info@gmail.com' },
  reviewNotes,
  howToTest,
  /**
   * The screen recording App Review asks new apps for, attached by `submit` (skipped if
   * missing). Git-ignored: it shows a real phone and its photos. How to make one:
   * docs/guides/demo-players.md.
   */
  reviewVideo: 'store/ios_review-video.mp4',
};
