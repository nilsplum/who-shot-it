# Store listing

Everything the App Store and Google Play pages show, in one place. Paste the texts as they
are. Every sentence is true for the app as it is; when a feature changes, check this page
in the same change (AGENTS.md, legal documents). No dashes anywhere: commas, colons and
full stops read better on a phone.

The images are in `store/images/`: the icons and the Google Play banner are drawn from
`web/icons/icon.svg` on every app build (`scripts/helpers/app-assets.mjs`); the
screenshots with their captions are drawn by `scripts/helpers/store-images.mjs`
(`./scripts/release-apps.sh --store-images`, whenever the app's look changes). The
captions live in that file.

## Why the texts are written this way

The name alone does not say what the app is, so the store name adds "Photo Party Game",
and the subtitle, the first screenshot and the first line of the description all say the
same simple thing: photos from your friends' phones, guess whose it is. The privacy part
is in the description because the first question anyone has about this game is "who sees
my photos?".

## App Store (App Store Connect)

**Name** (30 characters at most; the home screen keeps showing "Who Shot It?"):

    Who Shot It? Photo Party Game

**Subtitle** (30):

    Guess whose photo it is

**Promotional text** (170; can change any time without a review):

    Tonight’s best party game is already on your phones. Random photos from everyone’s camera roll, one question: whose is it?

**Description:**

    Your camera roll is full of stories. Time to play them.

    Who Shot It? turns the photos on your phones into the funniest guessing game at the table. Everyone gets a few random photos from their own phone. Then one photo after another pops up on every screen, and you race to tap whose phone it came from.

    Was that blurry pizza at 2 a.m. Lena’s? Is the 400th cat picture Ben’s? Guess fast, guess right, and the points are yours. The reveal is where the laughs begin.

    HOW IT WORKS
    1. One person creates a game. Friends join with a four letter code.
    2. Everyone gets a few random photos from their phone. Don’t like them? Tap No for new ones. Happy? Tap Yes.
    3. The photos pop up one by one. Tap who took it. Fast and right scores the most.

    MADE FOR PARTIES
    • 2 to 12 players, best together in one room
    • Classic, or Tricky: photos start blurry, zoomed in or pixelated
    • Pick rounds, time and points, each option explained in one sentence
    • Streak bonus, reactions and a podium at the end
    • Free, no account, no ads

    YOUR PHOTOS STAY YOURS
    • The app picks the photos on your phone. Nothing is shared until you tap Yes.
    • Only the players in your game see them.
    • Each photo is deleted right after its round.
    • Anyone can report a photo, and it is gone for everyone at once.

    Grab your friends, open the app and find out who really took that photo.

    Questions or ideas? whoshotit.info@gmail.com

**Keywords** (100; words from the name and subtitle count already, so they are not repeated;
never other apps' names):

    guess who,friends,group,camera roll,gallery,pictures,quiz,trivia,multiplayer,funny,icebreaker

**What’s New** (later versions only): one or two plain sentences about what players notice.

**URLs:**
- Support URL: `https://who-shot-it.nils-plum.workers.dev/legal#imprint`
- Marketing URL: `https://who-shot-it.nils-plum.workers.dev`
- Privacy Policy URL: `https://who-shot-it.nils-plum.workers.dev/legal#privacy`

**Copyright:** `2026 HiveDone UG (haftungsbeschränkt)`

**Category:** Games, subcategories Trivia and Casual. Secondary category: Entertainment.

**Screenshots:** `store/images/app-store/` (6.9 inch iPhone, 1290 x 2796), in their numbered
order. Only the first three show in search results, so they tell the whole idea.

**App Review contact** (seen only by Apple's reviewers):

    Nils Plum, +49 177 2438912, whoshotit.info@gmail.com

**App Review notes:**

    The game needs at least two phones in the same game. Install the app on two devices, accept the terms, enter a name, tap Create game, then Start game, and join on the second device with the four letter code. Allow photo access when asked (both devices need a few photos in their library). Content moderation: every player confirms their own photos (Yes or No) before anything is shared; the flag on each photo deletes it for everyone at once; the host can remove a player (tap the player), who cannot rejoin; nicknames with blocked words are replaced; every player accepts the terms (16+) before playing. No account, no ads, no tracking. Contact: whoshotit.info@gmail.com

**Settings made by `scripts/helpers/app-store.mjs`** (`node scripts/helpers/app-store.mjs submit`):
categories (above), content rights (players share their own photos), age rating (user
generated content and contests yes, everything else no, raised to 16+ to match the terms),
free, every country except China mainland (games there need a licence), release after
approval. Only two settings have no API and are made by hand once: App Privacy (Photos
or Videos and User ID, App Functionality only, not linked, no tracking) and the EU trader
status (docs/apps.md).

## Google Play (prepared; see docs/guides/android.md)

**App name** (30): `Who Shot It? Photo Party Game`

**Short description** (80):

    Random photos from your friends’ phones. Guess who took them!

**Full description:** the App Store description above, unchanged.

**Graphics:** icon `store/images/google-play-icon-512.png`, banner
`store/images/google-play-feature-graphic-1024x500.png`, phone screenshots
`store/images/google-play/` (1080 x 2160).

**Category:** Game, Trivia. Tags: Party, Trivia, Casual. Contact email:
whoshotit.info@gmail.com. Website: `https://who-shot-it.nils-plum.workers.dev`.
