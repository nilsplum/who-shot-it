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
    2. Everyone gets a few random photos from their phone. Don’t like them? Tap No for new ones, or tap one photo to swap just that one. Happy? Tap Yes.
    3. The photos pop up one by one. Tap who took it. Fast and right scores the most.

    MADE FOR PARTIES
    • 2 to 12 players, best together in one room
    • Classic, or Tricky: photos start blurry, zoomed in or pixelated
    • Pick rounds, time and points, each option explained in one sentence
    • A leaderboard after every photo, reactions and a podium at the end
    • Free, no account, no ads

    YOUR PHOTOS STAY YOURS
    • The app picks the photos on your phone. Nothing is shared until you tap Yes.
    • Chats, emails and other photos full of text stay out, and screenshots can too.
    • Only the players in your game see them.
    • Each photo is deleted right after its round.
    • Anyone can report a photo, and it is gone for everyone at once.

    Grab your friends, open the app and find out who really took that photo.

    Questions or ideas? whoshotit.info@gmail.com

**Keywords** (100; words from the name and subtitle count already, so they are not repeated;
never other apps' names):

    guess who,friends,group,camera roll,gallery,pictures,quiz,trivia,multiplayer,funny,icebreaker

**What’s New** (later versions only): one or two plain sentences about what players notice.

    New photos at once, and you can swap single photos. A leaderboard after every photo, with Show again for one more look. Everyone can tap Play again, and a game’s code works for a whole day. The new setting “Which photos” keeps chats, emails and other photos full of text out of the game.

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

**App Review notes** (Apple's questions for new apps, answered in its order; `submit` adds
"How to test" below them):

    1. Screen recording: attached. It was made on an iPhone with this build and starts with opening the app. It shows a whole game: creating a game, allowing photo access, removing a player, reporting a photo and the final scores. (The terms screen of the first launch, which everyone accepts before playing, was accepted just before the recording.) Leo, Max and Zoe are our own test players, run on a computer with drawn sample pictures, so one person could record a full game. The video is shortened in a few places (waiting time, iOS pop ups, rounds 6 to 11).

    2. Purpose and audience: Who Shot It? is a party game for friends aged 16 and older who meet in person. Each player gets a few random photos from their own phone and decides whether to play with them. Then the photos appear one by one on every phone, and everyone guesses whose photo it is. It gives a group something fun to do together with the photos they already have. Free, no account, no ads, no purchases.

    3. Setup and main features: see "How to test" below. No login, demo account or sample files are needed.

    4. External services: only our own game server on Cloudflare (Workers and Durable Objects, data stored in the EU). It passes the game and the photos a player confirmed between the phones of one game. No analytics, ads, login, payment or AI services.

    5. Regions: the app works the same in every country where it is offered (all except China mainland).

    6. Regulated industry or protected material: none. Players only use photos from their own library.

**How to test** (for App Review and for TestFlight's beta review):

    HOW TO TEST
    A game needs at least two devices, each with a few photos.
    Device A: accept the terms, enter a name, tap Create game, keep Classic, tap Start game. A four letter code appears.
    Device B: accept the terms, enter a name, type the code, tap Join.
    On both: tap Continue and allow photo access. Tap No for other random photos, or Yes to play with them. When everyone is ready, the game starts by itself. Tap the player you think took the photo.

    PHOTOS AND SAFETY
    Only photos a player confirms with Yes leave the phone, and only to the players of that one game. Each photo is deleted from our server right after its round.
    Report: the flag on a photo deletes it for everyone at once.
    Remove: the host taps a player to remove them. They cannot rejoin that game.
    Offensive nicknames are replaced. Everyone accepts the terms (16+) before playing.
    Questions and reports: whoshotit.info@gmail.com

**Screen recording for App Review:** `store/review-video.mp4`, attached by `submit` (not in
git: it shows a real phone and its photos). How to make one: docs/apps.md, First release.

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
