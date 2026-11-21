# Who Shot It?

A party game in the browser: everyone gets random photos from their own phone, then a photo
pops up and everybody taps whose it is. Fast and right scores more. No app, no account, free.
Photos never leave a phone before its owner taps **Yes**, and are deleted after their round.

Runs entirely on Cloudflare's free plan: one Worker plus one Durable Object per game room.

## Quick start

| Command | What it does |
|---|---|
| `./scripts/setup.sh` | Installs the pinned dependencies and the test browser. Run once and after dependency changes. |
| `./scripts/test.sh` | All tests: unit + integration (inside the Workers runtime), then three phone browsers playing a full game. `--no-e2e` skips the browsers. |
| `./scripts/dev.sh` | The whole app locally at `http://localhost:8787` (phones on the same Wi-Fi can join). |
| `./scripts/deploy.sh` | Checks, runs every test, deploys to Cloudflare. |

Needs Node.js 22.12 or newer (`package.json`, `engines`).

## Deploy

One time:
1. The domain (`whoshot.it`, set in `wrangler.jsonc` → `routes`) must be a zone in your
   Cloudflare account. To use another one, change it there; nothing else names the domain.
2. Build and share the iPhone shortcut and paste its iCloud link into
   `web/shared/config.js` → `SHORTCUT.installUrl` ([docs/ios-shortcut.md](docs/ios-shortcut.md)).
3. `npx wrangler login` on the machine you deploy from.

Then `./scripts/deploy.sh`. It refuses while a `TODO_OPERATOR:` value is left or the machine
is not logged in, and deploys only if every test passes.

Keep Cloudflare's cookie-setting extras (Bot Fight Mode, Web Analytics, Zaraz) off for this
zone: the privacy policy promises no cookies and no analytics.

## How it works

```
browser (web/)  ── HTTPS ──>  Worker (src/worker.js)  ──>  Room Durable Object (src/room.js)
   │                           /api/* only;                  one per room code; SQLite storage
   └── WebSocket ─────────────────────────────────────────>  holds the room state and photos
```

| Where | What |
|---|---|
| `web/shared/config.js` | **The single source of truth**: brand, settings, limits, timings, scoring, shortcut. Used by browser and server. |
| `web/shared/api.js` | Every path and socket message, and the route parser both sides use. |
| `src/game/` | Pure game logic: `rules.js` (state machine and timers), `plan.js` (which photo when), `score.js`, `view.js` (what a browser may see), `state.js` (room shape). No I/O, fully unit-tested. |
| `src/room.js` | The room: turns messages, uploads and its alarm into events, then persists, deletes unreferenced photos, broadcasts views and sets the next alarm. |
| `src/worker.js` | Creates rooms, forwards room requests. Everything else is static files from `web/`. |
| `web/js/` | The browser app: `main.js` (controller), `views/` (screens and sheets as HTML strings), `render.js` (repaints only changed parts), `connection.js` (socket with reconnect), `photos.js` (pick, roll, shrink). |
| `web/legal.html` | Imprint, privacy policy, terms, content reports. |
| `test/` | `unit/`, `integration/` (Vitest in workerd), `e2e/` (Playwright). |

**A room's life.** "Create game" makes a 4-letter code (no look-alike letters). Each browser
keeps a random secret player key, so reloads, a second tab or the iPhone shortcut's return
land back as the same player. The server alone runs phases, timers, scores and the host role:
lobby → 3-2-1 once everyone (at least two) is ready → per round *load* (everyone has the
photo) → *show* → *reveal* → *end* → "Play again". Browsers get a full snapshot after every
change, with the photo's owner hidden until the reveal.

**Photos.** A player picks a source ("All photos": a folder on Android and computers, the
shortcut on iPhone; or "Choose photos"), sees n random photos and taps No (others) or Yes.
Only then are those n shrunk to at most 1080 px JPEG and uploaded. A photo is deleted right
after its round, and also on "Change", "Leave", a new photo count, the game's end and when
the room closes (last player gone, or 2 hours without activity). Photo links work only for
the current and the next round.

**Settings** (host): photos per player, rounds, time, mode (Classic, Blur, Zoom, Pixel, Mix),
points (speed or fixed), answers (all players or 4), streak bonus, photo picks (fair or random),
next round (automatic or host).

## Operations

- **Logs:** none are stored. `npx wrangler tail` streams the live Worker logs when needed.
- **Limits:** the free plan allows 100,000 requests per day and 5 GB of Durable Object storage.
  A room stores only small state plus the photos still to come.
- **Updating dependencies:** change the exact version in `package.json`, run `npm install`,
  then `./scripts/setup.sh` and `./scripts/test.sh`; commit `package.json` and `package-lock.json`.
  When raising `wrangler`, also raise `compatibility_date` in `wrangler.jsonc`.
- **Legal texts:** `web/legal.html`. If what the app stores, sends or deletes changes, update
  the privacy section in the same change.

## Troubleshooting

- A script says what is missing and how to fix it (`scripts/helpers/preflight.sh`).
- "All photos" missing on iPhone: `SHORTCUT.installUrl` is not an `https://` link yet.
- Android "All photos" finds nothing: in the folder picker, open **DCIM › Camera** and allow access.
