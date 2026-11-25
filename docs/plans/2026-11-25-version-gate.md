# The version gate: which app versions a server lets play, and "Update" when a newer one is out (plan)

Status: planned on 25 November 2026 on the branch `feat/version-gate` (worktree
`.claude/worktrees/staging`, from `main` at 42e37bd, app 1.0.10). Each commit's status line in
section 6 says how far it is.

## Operator handoff

What only the operator can do, and what is worth knowing, kept up to date with every commit.

**Done**
- Commits 1 to 6, merged into `main`.
- Staging deployed on 25 November 2026 from `main` at 84f9cc5 (`./scripts/deploy.sh staging
  --min 1.0.7 --newest ios=1.0.11 --newest android=none`, every test green): Cloudflare
  version 37fe025b, which serves its gate (read back): 1.0.7 and newer may play, newest
  iPhone 1.0.11, Android none.
- 1.0.11 uploaded as build 100110 for staging (`./scripts/release-apps.sh staging ios`): in
  TestFlight's Team, and sent to Apple's beta check for the public link. 1.0.9 and 1.0.10
  passed that check meanwhile, so the public link gives 1.0.10 (staging) now and 1.0.11 once
  approved.
- App Store Connect, so TestFlight carries only staging builds: the public link's group
  (Friends) lost the production builds 1.0.0, 1.0.5, 1.0.6 and 1.0.7; the team's group was
  made again without automatic distribution (staging builds 1.0.9 to 1.0.11), the old one
  deleted. Nothing was expired; 1.0.5 is untouched in App Review.
- Production untouched, as the operator asked: Cloudflare version 9226b0f0 runs exactly
  1.0.5's code (checked file by file), without a gate (every app may play there).

**How to work from now on** (docs/apps.md, Releasing)
- Every `./scripts/deploy.sh staging|production` shows which app versions that server lets
  play now and asks whether to change them (Enter keeps them; `--min` and `--newest` give
  them in advance). Raising production's minimum asks for a typed phrase.
- Once a version can be installed (TestFlight for staging, the App Store or Google Play for
  production), tell that server with `--newest ios=<version>` (or `android=`), so older apps
  show "Update" on their start screen.

**To do by hand**
- Add yourself to the new team group: App Store Connect, the app, TestFlight, Internal
  Testing, Team, Testers (+), tick yourself, Add. Apple's API refuses internal testers ("Tester(s)
  cannot be assigned", even back into the old group), so until then your TestFlight gets
  builds only through the public link.
- The next production release deploys `main` to production (`./scripts/deploy.sh
  production`): then set its gate too, `--newest ios=<the App Store's version>`, and a
  minimum once the old versions should go.

## 1. What the operator asked for (verbatim)

> I want you to take a step back and check if there is a centralised version gate system like commonly used. Evaluate what makes sense for the version gate here and what the standard pattern is to make this work for android and ios apps that are packaged together, cloudflare and appstore versions, and the test development with testflight and android testing.
>
> Take a step back to see the full picture. I want a really simple, robust, centralised system that makes sure to let us choose in the deployment where to deploy to (production or staging) and then asks for the minimum version required etc.
>
> Then, and only then, go ahead and check out the mechanism and devops scripts of starlabsmvp in order to consider how it works there and how the ux of the devops scripts is and how its integrated into the codebase architecture and so on.
>
> After that, take a step back and make a plan for this simple system, ensuring the plan follows the agents.md guidelines and works well and simple for every scenario.
>
> After making the plan, go ahead and implement it step by step on a new branch. MAke sure that you re-read every file you touch.
>
> After that, go ahead and merge into main, then test and then  and release the version to staging and set the minimum gate to 1.0.7 (current public testflight application). Also, publish the new testglight version. Ensure that everything is in the correct state and consider if my instructions and the order really makes sense or if I didnt see or forget something or if there are any other issues.

The answers to the questions:

- *Where should each server's minimum live, and how is it set?*
  > check out the starlabsmvp repo now in order to see how it works there for the developer ux of the devops logic.
- *Apps up to 1.0.10 never say their version: how should they count?* "As 1.0.10 (Recommended)".
- *When should a too-old app find out?*
  > THe thing that appears should, if legally possible make them click a button to land on the store screen and upate, there should be the lowest friction ever. It should also say the time if legally possible, that it takes to update. Figure out how to make people actually click to update. Search the web to figure out what makes them update and what makes them close the app again. IT should be the lowest possible friction. For this reason it should also only require the update when the person was already prepared and click on create or join. If there is an update possible, there should be a small indicator on the start screen, that is also visible but does not add clutter.
  >
  > Generally, everything should be simple and grandma friendly for the users, not many details, as few text as possible, everything big and easy to understand and intuitive.

## 2. How it is today, and what the standard is

**Today.** No app tells the server its version, and the server checks none. A server change
must stay compatible with every version still installed (README, Release), forever, because
nothing can ask an old app to update. Two servers (`ENVIRONMENTS`): production (the store
apps, 1.0.5 waiting for App Review, and the TestFlight builds up to 1.0.7) and staging (the
TestFlight builds from 1.0.9 on). The public TestFlight link gives 1.0.7 until Apple's beta
check approves 1.0.9 or 1.0.10.

**The standard pattern** (the same in every source):
- **The server owns a minimum version** and refuses older apps with a clear answer the app
  turns into an "Update" screen (Clerk's minimum app version for iOS and Android; Firebase's
  Remote Config "minimum version" pattern; Guardsquare: a client-side check alone can be
  skipped, so the server enforces). The minimum is raised only once the replacement can be
  installed everywhere, or users are blocked with nowhere to go.
- **A second, softer value** says which version is the newest available, for an optional
  "update available" hint that never blocks.
- **When to ask:** Google's in-app update guidance: a blocking update only when the version
  cannot work any more, a gentle hint otherwise, and never in the middle of a task. Update
  screens that convert: one primary button straight to the store page, a short title that
  says what it is for, almost no text, the screen stays until the update is done.

**Starlabs** (`scripts/release.sh`): two committed files (`MIN_REQUIRED_VERSION`,
`LATEST_RECOMMENDED_VERSION`) deployed with the backend, stamped as headers on every answer;
the desktop app shows a modal it cannot close when it is older than the minimum, and a banner
when it is older than the latest. Its developer experience worth taking over: one script per
environment that **shows the values a deploy will serve before it deploys**, a **typed
phrase only for the step that can block people** (raising the minimum, "block clients older
than X"), and **reading the values back from the live server after the deploy** to prove they
are served (`--verify-gate`). Its invariant: never raise the minimum before the new version
can be installed. What does not fit here: the release script commits and pushes the files
itself, and one pair of files serves both environments.

## 3. The design

**The gate** is `{ min, newest: { ios, android } }`, every value a version (`1.0.11`) or null:
- `min`: the oldest version that may create or join a game on that server. Null: every one.
- `newest`: per platform, the newest version people can install for that server (production:
  the App Store and Google Play; staging: TestFlight and Google Play's internal track). An app
  older than its platform's `newest` shows "✨ Update" on its start screen. Null: no hint.

**Where it lives: given at each deploy, served by the live server.** `./scripts/deploy.sh
staging|production` reads what the live server serves now (`GET /api/gate`), shows it, asks
for each value with the live one as the default (Enter keeps it; `--min <version>` and
`--newest ios=<version>` / `android=<version>` give them in advance, `none` clears one),
checks them (`min` never above a platform's `newest`), asks for the typed phrase "raise the
minimum to <version>" when production's minimum goes up, runs every test, deploys the Worker
with the gate as one value (`--var GATE:<json>`), and reads it back from the live server.
Cloudflare keeps it with each deployed version, so a rollback restores that version's gate
too. Nothing is committed: the gate changes when stores approve versions, not when code
changes, so the live server is its one source of truth and the script always starts from it.
A server deployed without a gate (an old version, local development, the tests by default)
lets every app play and offers no update.

**The server** (`web/shared/config.js` holds the rules both sides use: `isVersion`,
`olderThan`, `normalizeGate`, `mayPlay`, `SILENT_VERSION`):
- `GET /api/gate` answers the gate (the Worker only, no room is touched).
- `POST /api/rooms` (Create) carries the app's version; a too-old app gets 426 `{ error:
  'update' }` (`STATUS.update`, `web/shared/api.js`).
- The room's `hello` (Join) carries it too; a too-old new player's socket is closed with
  `CLOSE.update` (4007). A player already in the game plays on (a running game never breaks).
- Apps up to 1.0.10 send no version and count as 1.0.10 (`SILENT_VERSION`). They cannot show
  the update screen, so a minimum above 1.0.10 closes their socket as "full" instead (a code
  they know as final: they show "This game is full." and stop instead of reconnecting forever),
  and the deploy script warns before it sets one.

**The app** (from 1.0.11):
- Sends `version` with Create and in every hello.
- Asks the server for the gate once per start (`fetchGate`, a 10 s timeout; failing quietly).
- **"✨ Update"** (small, top left of the start screen) when a newer version is out for its
  platform: a link straight to its store page.
- **"Update to play"**, a sheet, only when the player taps "Create game" or "Join" (the
  moment they are ready) and the app is too old: by the gate it already knows (at once,
  before the "New game" step), or by the server's answer (Create's 426, Join's
  `CLOSE.update`). Big ✨, the title, one line "It takes about a minute.", one big yellow
  "Update" button straight to the store page, and a quiet "Not now". The code typed stays,
  so after the update joining is one tap.
- The store page per build (`ENVIRONMENTS[environment].update[platform]`): production the
  App Store page and Google Play; staging the public TestFlight link and Google Play (internal
  testers see their version there).

**Scripts:** `./scripts/deploy.sh` as above (`scripts/helpers/gate.mjs`: `ask`, `verify`,
`show`); `./scripts/release-apps.sh status` also shows both servers' gates, next to App Store
Connect, so the operator sees "approved in the store" and "newest on the server" together.

**The numbers now:** this branch makes the app 1.0.11 (the first that sends its version).
Staging gets `min` 1.0.7 (as asked; every app on staging is 1.0.9 or newer, so nobody is
refused) and `newest` iPhone 1.0.11 (the build uploaded right after), Android none (no
Android build is on staging's track). Production is not deployed: its server (Cloudflare
version 9226b0f0) is the one Apple's reviewer of 1.0.5 uses; it has no gate, which simply
means everyone may play and nobody is offered an update, and the 1.0.11 app copes with that.

## 4. Things to pay attention to

- **1.0.7 plays on production, not staging.** The public TestFlight link's 1.0.7 was built
  before environments, so the staging gate of 1.0.7 does not concern it. Once Apple approves a
  staging build for the public link, friends who updated play on staging and friends still on
  1.0.7 on production: they cannot join each other's games ("No game with this code"). The
  gate cannot tell 1.0.7 (it says no version, and it talks to production).
- **A minimum above 1.0.10** refuses every app before 1.0.11 without telling it why. Only
  sensible once nearly everyone has 1.0.11 or newer.
- **App Review:** production's `min` must never be above the version in review; it cannot be
  while `min` stays at or below a released `newest`.
- **A gate-only change deploys the code it runs from** (tests first). For production that is
  `main`, which must be releasable anyway.
- **Free plan:** one small Worker request per app start (no room involved); create and join
  only compare two strings.
- **Privacy:** the version is technical data ("Connection data" in the privacy policy covers
  it) and is not stored; no store label changes.

## 5. Not part of this plan

- Reading the stores' approved versions automatically (App Store Connect, Google Play) to fill
  in `newest`: the deploy asks instead.
- Asking the terms again after every update (`termsToken`): an earlier, separate decision.
- Deploying production.

## 6. Commits

### Commit 1: docs: this plan

Status: done (25 November 2026).

### Commit 2: gate: the rules, the server's answer, create and join refuse a too-old app

`web/shared/config.js`: `SILENT_VERSION`, `isVersion`, `olderThan` (and `buildNumber` reads
the version through the same `versionNumber`), `normalizeGate`, `mayPlay`, the update pages
per environment and platform (`ENVIRONMENTS[...].update`, with `STORES.ios` from the same App
Store constant). `web/shared/api.js`: `API.gate()`, `STATUS.update`, `CLOSE.update`, the
`version` in Create's body and in hello. `src/http.js`: `gateOf(env)`. `src/worker.js`: the
route and Create's check. `src/room.js`: hello's check (a new player only). `vitest.config.js`:
the integration tests' gate. Tests: unit (the rules, the pages), integration (the answer,
Create's 426, hello's `CLOSE.update`, a player already in the game, an app that says no
version).

Status: done (25 November 2026; its decisions in section 7).

### Commit 3: app: says its version, asks for the gate, "✨ Update" and "Update to play"

`web/js/api.js` (`fetchGate`, Create's version and its 426), `web/js/phone.js`
(`updateLink`), `web/js/store.js` (`session.gate`, the sheet's name), `web/js/connection.js`
(`CLOSE.update` is final), `web/js/main.js` (boot, hello, the checks on Create game and Join,
`onEnd`, the context), `web/js/views/home.js` (the link), `web/js/views/sheets.js` (the
sheet). Tests: unit (`updateLink`), e2e (the link on the start screen, the sheet from the
known gate, from Create's answer and from Join's close; the code stays).

Status: done (25 November 2026; its decisions in section 7).

### Commit 4: scripts: the deploy asks for the gate, sets it, reads it back; status shows it

`scripts/helpers/gate.mjs` (`ask`, `verify`, `show`), `scripts/deploy.sh` (`--min`,
`--newest`, the phrase, `--var GATE:...`, the read-back), `scripts/release-apps.sh` (`status`
shows the gates), `wrangler.jsonc` (its comment), README, `docs/apps.md` (Releasing),
AGENTS.md (the gate is the one value a deploy is given).

Status: done (25 November 2026; its decisions in section 7).

### Commit 5: chore(release): version 1.0.11

`package.json`, `package-lock.json`, `APP.version`.

Status: done (25 November 2026). `test/unit/config.test.js` now also holds that the app's
version comes after `SILENT_VERSION`.

### Commit 6: TestFlight carries only staging builds

Added on 25 November 2026, after the operator's answer before the release: "ensure that there
is no such complexity of any versino using production even thoough they are in testflight
... Everything should be clean and robust, without any backwards compatibility ... We dont
have any testflight users". `scripts/helpers/app-store.mjs`: `testflight` refuses a
production build and an internal group that gets every build by itself, and puts each
staging build into every group itself; `submit` sends to App Review only (no longer to the
public link). `scripts/release-apps.sh`, README, `docs/apps.md` (Releasing, First release:
the groups), `docs/guides/demo-players.md` (the App Review recording is made with the staging
build), AGENTS.md. Once in App Store Connect (through the API, approved by the operator): the
production builds leave the public link's group, and the team's group is made again without
automatic distribution, the old one deleted.

Status: done (25 November 2026; its decisions in section 7).

## 7. Decision log

- **Given at deploy, not committed** (the operator left it to the Starlabs comparison):
  Starlabs commits its files because the values ship inside its image. Here the values change
  when a store approves a version, which no commit marks; committing them would make
  `deploy.sh` write and push commits on `main` (production deploys only from a clean `main`)
  and let the repo say one thing while the server serves another. Starlabs needs
  `--verify-gate` exactly for that gap. Taking the live value as the default and reading it
  back after each deploy closes it. Cloudflare keeps each deployed version's value, so a
  rollback restores it. AGENTS.md's "no environment variables" gets this one stated exception.
- **One deploy step, not a separate command:** the operator asked that the deployment asks
  for it; a separate "set the gate" command would be a second way to deploy.
- **Per platform `newest`, one `min`:** the minimum is about what the server understands (the
  same for both apps); what can be installed differs per store and day.
- **Old apps refused as "full":** their only final close codes are full, gone, removed,
  replaced and left; "full" keeps their code and stops the reconnecting, the others would
  forget the code or say something worse.
- **The sheet's words:** "Update to play" (what it is for), "It takes about a minute." (an
  honest estimate for an app of a few megabytes, which sets the expectation that keeps people
  going; it promises nothing legally binding), one yellow "Update" button, "Not now" as a
  quiet link so the button stands alone. "✨ Update" on the start screen is a link, not a
  sheet: one tap to the store.
- **Commit 2:** versions compare through one number (`versionNumber`, which `buildNumber`
  already used), so a version is three whole numbers with minor and patch below 100, the same
  limit the build numbers have. The room reads the gate once when its object starts: a deploy
  restarts every Durable Object, so it can never hold an old one. The integration tests'
  Worker gets a fixed gate in `vitest.config.js` (1.0.8 and newer, iPhone 1.0.12), so their
  own players (who say no version) still play; the end-to-end server runs without one, like
  `./scripts/dev.sh`. "This version is newer than `SILENT_VERSION`" is checked with the version
  change (commit 5), when it becomes true.
- **Commit 3:** "✨ Update" is a part of the start screen of its own: the server's answer
  comes after the first paint, and a screen's layout is painted only when the screen
  changes. On "Create game" and "Join" the gate the app knows is checked first (before the
  name), so a player never fills in the "New game" step for nothing; the server's own answer
  stays the authority (an app whose gate did not come, or a server whose gate rose since).
  Refused on joining, the app goes back to the start screen without a word and opens the
  sheet; the code it tried stays in the field (`device.lastRoom`). The end-to-end test gives
  the phones the answers of a server with a gate (Playwright's `route` and
  `routeWebSocket`), since the local server has none, like `./scripts/dev.sh`.
- **Commit 6:** Apple cannot switch automatic distribution off on an existing internal
  group (`hasAccessToAllBuilds` is not among the attributes a change may set, only a new
  group's), so the team's group is made again without it and the old one deleted; its
  settings (feedback on, Mac and Vision Pro availability) and its one tester are carried
  over. Nothing is expired: production builds simply belong to no group, and 1.0.5 stays in
  App Review untouched. A production iPhone upload without `--submit` stays possible (it
  waits for App Review); there is no TestFlight step for it any more. Production was checked
  against "the old state, compatible with 1.0.5": it runs exactly 1.0.5's code (Cloudflare
  version 9226b0f0, deployed from 847b99b, whose files match the live ones byte for byte), so
  it was not deployed; it gets the gate with its next release.
- **The team's group, carried over:** Apple's API made the new group and moved the builds, but
  refused to put the one tester into it, and then also back into the old one (409 "Tester(s)
  cannot be assigned"): internal testers are added on the website only. The old group was
  deleted anyway (it had no tester left and was the one thing still getting production
  builds), and docs/apps.md says the team's members are added on the website.
- **Commit 4:** the asking and checking is one Node helper (`scripts/helpers/gate.mjs`), which
  talks to the person on stderr and hands the script two lines on stdout (the gate, and the
  minimum if it went up), so the typed phrase stays the scripts' one `confirm_phrase`. Only
  values not given as options are asked, and only in a terminal; without one the live values
  stay, so an unattended run never waits. A server that does not answer is started from no
  gate with a warning (opening is the direction that never blocks anyone); one that answers
  "not found" (deployed before the gate) has none. The minimum may not be above any newest
  version that is set; a platform without one is not checked (nothing can be known about
  it). Every upload prints the deploy command that tells the server the new version is out
  (`tell_newest`), and `./scripts/release-apps.sh status` shows both servers' gates next to
  App Store Connect, so "approved" and "newest on the server" are seen together. Test players
  (`demo-players.mjs`) run the real page from the server, so they say the server's own version
  and are never refused.
