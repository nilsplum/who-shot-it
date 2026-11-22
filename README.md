# Who Shot It?

> A side project by Nils Plum. HiveDone UG (haftungsbeschränkt) is only its legal publisher (see the
> imprint); the game is not part of HiveDone's products. Contact: whoshotit.info@gmail.com

**The party game that lives in your camera roll.** Everyone at the table opens the app, and
the game deals each player a few random photos from their own phone. Then the fun starts:
one photo after another pops up on every screen, and everybody races to tap *whose phone it
came from*. Was the blurry 2 a.m. kebab Ana's? Is the 400th cat picture Ben's? Right and
fast scores the most, and every reveal is a story.

- **Free, no account.** Install, pick an emoji, play. 2 to 16 players.
- **Your photos, your call.** Don't like what you were dealt? Tap **No** for new ones.
  Nothing leaves a phone before its owner taps **Yes**, and each photo is deleted right after
  its round.
- **Two ways to start, every option to tune:** Classic or Tricky (blurry, zoomed, pixelated),
  then photos per player, which photos (screenshots and photos full of text can stay out),
  rounds, time, points, streak bonus and more, each explained by a "?".

An iPhone and an Android app ([Capacitor](https://capacitorjs.com) around the game in
`web/`) and one server on Cloudflare's free plan: a Worker plus one Durable Object per game
room, stored in the EU.

## Quick start

| Command | What it does |
|---|---|
| `./scripts/setup.sh` | Installs the pinned dependencies and the test browser. Run once and after dependency changes. |
| `./scripts/test.sh` | All tests: unit + integration (inside the Workers runtime), then phone-sized browsers playing a full game with a stand-in photo library. `--no-e2e` skips the browsers. |
| `./scripts/dev.sh [android\|ios\|store]` | The server locally at `http://localhost:8787`; with a platform also the app on a phone or emulator, loading the game live from this computer. `store`: both store pages as players will see them, at `http://localhost:8788`. |
| `./scripts/deploy.sh` | Checks, runs every test, deploys the server to Cloudflare. |
| `./scripts/release-apps.sh [android] [ios]` | Runs every test, builds the signed apps and uploads them to App Store Connect and Google Play; `--submit` also fills in the App Store page and sends it to App Review (`--no-upload`: only build into `dist/`). |

Needs Node.js 22.12 or newer (`package.json`, `engines`); app builds need Android Studio
(Android) or a Mac with Xcode 26+ (iPhone), see [docs/apps.md](docs/apps.md).

## Release

**Server** (one time: `npx wrangler login` on the machine you deploy from): `./scripts/deploy.sh`.
It refuses while a `TODO_OPERATOR:` value is left or the machine is not logged in, and
deploys only if every test passes. Keep Cloudflare's cookie-setting extras (Bot Fight Mode,
Web Analytics, Zaraz) off: the privacy policy promises no cookies and no analytics.

**Apps:** raise `"version"` in `package.json`, run `./scripts/release-apps.sh --submit`. It
uploads both apps and sends them to review; both go live by themselves after approval. Store setup and the first release by hand:
[docs/apps.md](docs/apps.md); everything the stores get (texts, images, form answers): `store/`.

**The server's address** is `SERVER.origin` in `web/shared/config.js` (and `wrangler.jsonc`;
a test keeps them in step): for now `who-shot-it.<subdomain>.workers.dev`. The apps have it
built in, so a move to a domain needs a new app release, and the old address stays on until
no installed app uses it.

## How it works

```
app (web/ inside Capacitor) ── HTTPS ──>  Worker (src/worker.js)  ──>  Room Durable Object (src/room.js)
   │  photos: native plugin              /api/* only; only the apps     one per room code, in the EU;
   │  (Phone), on the phone only         may call it (CORS)             SQLite: room state and photos
   └── WebSocket ────────────────────────────────────────────────────>
```

| Where | What |
|---|---|
| `web/shared/config.js` | **The single source of truth**: brand and app id, server address, settings with their help and the presets, limits, timings, scoring, terms version. Used by the app and the server. |
| `web/shared/api.js` | Every path, socket message and close code, and the route parser both sides use. |
| `src/game/` | Pure game logic: `rules.js` (state machine and timers), `plan.js` (which photo when), `score.js`, `view.js` (what an app may see), `state.js` (room shape, name filter). No I/O, fully unit-tested. |
| `src/room.js` | The room: turns messages, uploads and its alarm into events, then persists, deletes unreferenced photos, broadcasts views and sets the next alarm. |
| `src/worker.js` | Creates rooms (EU only), checks who may call, forwards room requests. Everything else is the website from `web/`. |
| `styles/app.css` | The design: Tailwind's theme (every colour, with the dark blue and the yellow as main colours; the type scale, fonts, animations) and the shared `screen`, `btn` and `link`. Built into `web/css/app.css` (git-ignored) by `wrangler dev`/`deploy` and the app release. |
| `web/js/` | The app: `main.js` (controller), `views/` (screens and sheets as HTML strings with Tailwind classes; shared pieces in `ui.js`), `render.js` (repaints only changed parts), `connection.js` (socket with reconnect), `photos.js` (the dealt set and the previews kept ready), `textcheck.js` (counts lines of text on a preview), `phone.js` (everything native). |
| `web/legal.html` | Imprint, privacy policy, terms, content reports, licences. |
| `store/` | Everything the stores get, named by who gets it (`android_ios_` both, `ios_`, `android_`): the listings and `images/`. `scripts/helpers/listing.mjs` is the one reader: the iOS upload, the image scripts and the preview (`./scripts/dev.sh store`) all use it, so the preview shows what both stores get. |
| `android/`, `ios/` | The native projects; what is ours there: [docs/apps.md](docs/apps.md). |
| `test/` | `unit/`, `integration/` (Vitest in workerd), `e2e/` (Playwright, with a fake photo plugin). |

**A game's life.** A new player accepts the terms once (16+, only photos everyone in them
would be okay with). "Create game", pick Classic or Tricky (or tune the settings), "Start
game": a 4-letter code (no look-alike letters). Friends join with the code, a shared link
or the QR code. Each phone gets a random secret key for that game, so a closed app lands
back as the same player. The server alone runs phases, timers, scores and the host role:
lobby → 3-2-1 once everyone (at least two) is ready (the game is dealt then: which photos,
in which random order) → per round *load* (every phone holds the photo and the next two) →
*show* → *reveal* → *board* (the leaderboard; holding "Show again" shows the photo to
everyone and stops the clock; when its time is up it waits until every phone holds the next
round's photos) → *end*. "Play again" is anyone's: the first tap opens the
next game under the same code, the others join it when they are done looking at the
results. Apps get a full snapshot after every change, with the photo's owner hidden until
the reveal.

**Photos.** With the player's permission, the app picks n random photos on the phone and
shows small previews. A bucket of checked previews (and the big versions of the first
ones, from photos on the phone) fills in the background on every screen, so No, a swap and
Yes never wait; holding a photo shows it big and sharpens it in place. The host's "Which
photos" decides what may come up: all, little text (default: photos with 6 or more lines of
text, like chats and emails, stay out) or no screenshots either; the check runs on the
phone. Yes uploads exactly the photos shown, shrunk to at most 1080 px JPEG without
location data. A photo is deleted right after its round (its reveal and leaderboard), and
also when reported, on "Change", "Leave", removal, a new photo count and at the game's end.
A room keeps its code for 24 hours after its last activity, even when everyone left, so the
same group can play again the next day; then it is deleted. From the 3-2-1 on, every phone
loads the game's photos in play order and keeps them in memory only; a photo's link works
only until its round is over.

**Keeping it friendly.** Anyone can flag the photo on screen (⚑): the others stop seeing
it and the round waits; Delete photo deletes it for everyone at once, and after 15 s it goes
by itself. The host can remove a player, who cannot rejoin that game. Nicknames with
blocked words become "Player".

**In a browser** the same page is the website: `/<CODE>` is the invite page ("Open in the
app", store links), `/legal` the legal texts.

## Operations

- **Logs:** none are stored. `npx wrangler tail` streams the live Worker logs when needed.
- **Limits:** the free plan allows 100,000 requests per day and 5 GB of Durable Object storage.
  A room stores only small state plus the photos still to come.
- **Updating dependencies:** change the exact version in `package.json`, run `npm install`,
  then `./scripts/setup.sh` and `./scripts/test.sh`; commit `package.json` and `package-lock.json`.
  When raising `wrangler`, also raise `compatibility_date` in `wrangler.jsonc`; for
  Capacitor see [docs/apps.md](docs/apps.md).
- **Legal texts:** `web/legal.html`. If what the app stores, sends or deletes changes, update
  the privacy section in the same change.

## Troubleshooting

- A script says what is missing and how to fix it (`scripts/helpers/preflight.sh`).
- No photos are dealt: the player turned photo access off; the app shows "Open settings".
- "Only some photos are shared": the player allowed only selected photos; the link opens the
  app's settings to share all.
