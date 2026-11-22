# Game flow overhaul: settings, photo choice, leaderboard, play again (plan)

Status: implemented on 22 November 2026 (all ten commits). Open: trying the iPhone's
iCloud previews on a real phone through TestFlight, and submitting 1.0.2 to App Review once
1.0.0 is live. Each commit below is implemented
with `docs/prompts/implement.md`; after each one its status line here is set to done and
its decisions are added to the decision log at the end.

This plan turns the operator's request of 22 November 2026 (and his answers to the
questions that followed) into ten commits. It explains for every change what it is, why,
where it goes, and what to watch out for. The coding challenge style guide of this repo
applies throughout: `AGENTS.md` (centralisation, single source of truth, documentation
first, two passes, the dash rule) and the README.

## 1. What the operator asked for

Everything below comes from the request or from his answers; nothing else is changed
(section 9 lists what was deliberately left out).

**Settings and the "New game" step**
- The settings button on "New game" becomes a card like the presets, with a big icon and
  only the word "Custom". Icon and text well positioned.
- Default rounds: 15.
- Photos per player: by default 4 x 4 = 16, only square numbers to choose from: 4, 9, 16
  and 25. The photo grid is always a square, and its tiles use as much space as there is
  (big tiles for 4, small but still clear tiles for 25).
- "Speed counts" is called "Speed bonus".
- The settings sheet's "Done" is green and always visible; the settings scroll underneath
  it to the very end.

**Choosing photos (lobby)**
- Tapping one photo flips it to another one. At most three swaps per set, with a clearly
  visible counter; a new set ("No", new settings) resets it. A fourth tap is refused
  without any text or popup: a short cross on the photo and a vibration.
- A long press on a photo shows it big, as long as the finger stays anywhere on the
  screen (not necessarily on the photo).
- At the bottom of the lobby, small and grey but visible: "Waiting on" and the names of
  everyone the game waits for.

**During the game**
- After each round's reveal comes a new screen, the mid-game leaderboard: "Round 1 of 5",
  all players ranked, each with the rank, avatar, name, the pick ("✓ Ben +520" in green
  when right, "✗ Ben" when wrong, without "+0"), and the total score. Very simple.
- At its start, the leaderboard shows the previous order and scores for a moment, then
  the players slide to their new places and the points count up. Simple, elegant,
  understood at a glance. It stays 5 seconds.
- "Show again": a big button with a photo icon and the text "Show again". Anyone may hold
  it; while someone holds it, every player sees the round's photo, and the clock stands
  still. It reuses the existing photo display.
- The guessing and reveal screen is simplified: each card shows only the avatar and the
  name. On the reveal, the card of the photo's owner turns green, a wrong pick of mine
  red. A right guess gets a nice animation. Vibration: one short pulse when right, two
  when wrong.
- What stays on that screen: leave (✕), the round ("3 / 15"), the timer bar, the photo
  with its report flag, the row of who has already answered (where the host can still
  remove a player), and the reactions. What goes: the score and "+points" at the top, the
  small avatars of who picked whom, the points on the cards, "(you)".
- Reactions stay, on the reveal and on the leaderboard (and on the end screen as today).
  The set becomes 😂 🙈 🔥 🤯 👀 🫣 😩 🫠 🧐 🎉 (no clown), sorted by relevance from left
  to right, in a row that scrolls to the right, with an inconspicuous arrow button that
  cycles through it. A tapped emoji rises from its own button.
- Reporting works the same on iPhone and Android (it is the same web code).

**Play again and sessions**
- Everyone sees "Play again" on the results screen. It is idempotent: the first tap starts
  a new game under the same code, every later tap joins that game. Nobody is pulled away
  from their results.
- Leaving (✕), also from the results screen, lands on the home screen with the code
  already in the code field, so joining again is one tap.
- A game's code stays open for 24 hours after the last activity, even when everyone left
  or closed the app: the next morning, the same code still works.

**Platform**
- Double-tap zoom is prevented everywhere in the app.
- Every photo of the gallery must have the same chance; no time based or other hidden
  restriction.
- The terms screen ("I agree") shows after every install and every app update, so a
  needed confirmation can never be forgotten. Legally safe, super simple.

**Process**
- A commit sequenced plan (this document), the implementation and analysis prompts carried
  over from the starlabsMVP repo (`docs/prompts/`), the server checked for errors, and the
  legal page checked against the plan.
- The grandmother who is almost blind is the mental model for every new or changed part:
  big, clear, few details, every word and every visual element must earn its place. It is
  not a mandate to redesign the rest of the app (the operator is happy with it).

## 2. Findings before planning

**Server errors since launch.** Cloudflare's analytics (GraphQL, 19 to 22 November) show
no exception and no exceeded limit for the Worker or the rooms. The only non-success
status is "clientDisconnected" (55 room and 76 Worker requests): a phone closing its
socket (app in the background, screen locked). That is normal and expected. Nothing to
fix.

**How random the photos are today.** Each phone draws uniformly at random from every photo
the app may read: on the iPhone every image asset of the library (hidden ones excluded),
on Android every image in the phone's media store; inside the app the previews of a lobby
prefer photos not shown yet (`seen`), and "Which photos" leaves out screenshots and photos
full of text by design. There is no time based bias, with one exception found on the
iPhone: a preview is requested from what the phone keeps on the device only
(`download: false` in `PhonePlugin.swift`), and a photo with no local version (iCloud
Photos with "Optimize iPhone Storage", where older photos may live only in iCloud) is
skipped. Those are typically older photos, so they can never come up: exactly the hidden
time restriction the operator suspected. Commit 9 fixes it. On Android, photos that exist
only in a cloud (for example Google Photos backups not on the phone) are not on the phone
at all and cannot be read by any app without that cloud's own login; that limit stays and
is stated in the docs.

**Zoom.** Capacitor already disables pinch zoom in its web view on both platforms
(`zoomEnabled` defaults to false). What still zooms is WebKit's double-tap zoom, which a
viewport without scale limits allows. Commit 3 removes it.

**Compatibility with installed apps.** The server serves every app version at once. After
this plan's server deploy, versions 1.0.0 and 1.0.1 keep working with three visible
degradations: they draw 16 photos one by one in full size (slow, about 10 to 30 seconds),
they show the leaderboard phase as a longer reveal, and their old reactions (😱 😍 💀)
are dropped by the server. No crash and no data issue. The deploy therefore goes out
together with the new app version (commit 10), and the operator confirms it then.

## 3. The grandmother rule (UX for someone who is almost blind)

These rules apply to every element this plan adds or changes. They are how the screens
are meant to feel, and they are checked in every commit's review.

- **One thing per screen, said once.** The leaderboard shows ranks, names, the pick and
  the total, nothing else. The guessing screen shows the photo and the people to choose
  from. No hints, no counters, no labels that repeat what the layout already says.
- **Big targets.** Every button an older player needs is at least 56 points tall and
  spans the width (Show again, Play again, Done, Yes/No); player cards stay at least 64
  points tall; emoji buttons are 52 points round. Nothing important is a small text link.
- **Strong contrast and colour plus shape.** Green and red never carry meaning alone:
  right is green with ✓, wrong is red with ✗, the swap refusal is a big ✗ on the photo.
  Text on coloured backgrounds is white or the dark ink token, never grey.
- **Big type where it matters.** Names on cards and leaderboard rows 18 points, the
  leaderboard title 26 points, scores 20 points. Only the deliberately quiet "Waiting on"
  line is small and grey, as asked.
- **Feel it, not just see it.** One short vibration when right, two when wrong (and two
  for a refused swap). The same two meanings everywhere, nothing else vibrates.
- **Hold to look.** Any time a photo should be seen bigger, the gesture is the same: hold
  your finger down (a photo in the choice, "Show again" on the leaderboard), the photo
  fills the screen, let go and it is gone. Moving the finger does not end it.
- **Calm motion.** Animations are short (under one second), move in one direction and
  explain a change (a card pops when right, rows slide to their new rank, a photo flips
  when swapped). With the phone's "Reduce Motion" setting on, they are replaced by an
  instant change.
- **Screen readers.** Every new control has a spoken label (VoiceOver and TalkBack): the
  cards say the name, rows say "1st, Ann, right: Ben, plus 520, 1340 points", the swap
  counter says "2 swaps left", Show again says "Show the photo again". Holding works with
  a screen reader too (double tap and hold).
- **Same place, same meaning.** Leave is always top left, the reactions are always the
  same row at the bottom, the main action is always the big button at the bottom.

## 4. Decisions about the mechanisms

**The leaderboard is a server phase.** The server alone runs phases and timers
(`src/game/rules.js`); every phone shows what the view says. So the leaderboard is a new
phase `board` between `reveal` and the next round's `load`: reveal for
TIMING.revealMs (3.5 s), then board for TIMING.boardMs (5 s) when "Next round" is
automatic, or until the host taps "Next" when it is "Host taps". The reveal itself is
always timed. `inGame` includes `board`, so the round's photo stays stored and servable
until the board ends (needed for Show again), and the privacy promise "deleted right
after its round" stays true because the board belongs to the round.

**Show again is room state, not a relayed message.** Reactions are relayed without state
because they change nothing. Show again changes what everyone sees and pauses the clock,
so it lives in the room: `game.peeks` maps a player to the time their hold expires. An app
holding sends `peek {on: true}` at once and again every second; letting go sends
`peek {on: false}`. A hold that stops being renewed (lost connection) expires after
TIMING.peekHoldMs by itself, so the room can never get stuck. While any hold is active the
board's remaining time is frozen (`game.paused`), and it resumes from where it stood when
the last hold ends. The view says `round.peek: true`, and every phone shows the photo.

**One "hold to look" mechanism.** The long press in the photo choice (local, for one phone)
and Show again (shared, through the server) look and behave the same: a full screen photo
over everything while a pointer is down. One overlay root (`#look` in `index.html`), one
view function, one pointer handler in `main.js` for every element marked `data-hold`. The
photo in the overlay is shown like on the stage (whole photo, no effect).

**Play again is per player.** "Play again" is the event `again` for everyone. The first one
in the `end` phase saves the final standings (`room.final`), returns the room to the lobby
and marks every other player as still on the results (`onResults`). Their apps keep
showing the end screen from `room.final` with the same button; tapping it clears the mark
(they join the new game). A player on the results is simply not ready, so the start waits
for them, and the lobby's "Waiting on" line names them. Leaving works as everywhere.

**24 hour codes.** TIMING.roomIdleMs becomes 24 hours, and a room no longer closes when its
last player leaves: it returns to an empty lobby (no host, no game) and waits for anyone
with the code, until it idles out. Players who only closed the app stay in the room as
offline (in a game) or are dropped from the lobby after a minute, as today. The phone
remembers the code of the last game (`device.lastRoom`), which fills the code field.

**Photo counts as squares.** "Photos per player" offers 4, 9, 16 and 25 (default 16). The
grid has `sqrt(n)` columns and is a square that takes all the room the lobby has between
the header and the buttons.

**Swapping one photo.** A short tap on a photo of the set on screen replaces it with the
next fitting preview from the deck (`photos.js`), instantly, with a flip. `photos.swaps`
counts down from LIMITS.swapsPerSet (3) and resets with every new set. At zero, a tap
shows a ✗ on that photo for a moment and vibrates twice. The deck refills as after "No".

**Reactions.** REACTIONS becomes the ten emojis in the order above (the server validates
against the same list). The row is horizontally scrollable with an arrow button at its
right end that scrolls one page and, at the end, back to the start. A reaction rises from
its button's position (`floatEmoji` gets a start point); a reaction from someone else
rises from that emoji's button on this phone, or from the bottom centre if the row is not
on screen.

**Haptics.** The official `@capacitor/haptics` plugin (MIT, from the Capacitor team, the
same source as the App and Share plugins) is added. `phone.js` gets one function,
`buzz('yes' | 'no')`: one medium impact, or two with 150 ms between them. In the browser
(tests, website) it does nothing.

**Terms on every install and update.** The terms screen shows while the phone's accepted
token differs from `LEGAL.version + APP.version`. `APP.version` is a new value in
`config.js`, pinned to `package.json`'s version by `test/unit/config.test.js`, so a
release cannot forget it: every version bump shows the terms once, and so does a change of
the legal date.

**Fair photos on the iPhone.** When a preview is not on the device, the plugin asks iCloud
for it, with a time limit per photo (TIMING.previewCloudMs, 4 s, passed in by `phone.js`);
a photo that does not arrive in time is skipped for this batch only. So every photo of
the library can come up, and one slow download never holds a batch for long.

## 5. Legal check (step by step)

Read: `web/legal.html` (all of it), `docs/apps.md` (store answers), the welcome screen.

1. **24 hour codes.** The policy already promises "at the latest 24 hours after its last
   activity", but also "deleted when its last player leaves", which becomes false. That
   sentence goes. What an empty room keeps is the code, the settings and the keys of
   removed players (pseudonymous random keys, kept so a removed player stays out); no
   names, no photos. Purpose (letting the same group continue) and duration (24 hours)
   fit GDPR Art. 5(1)(e) storage limitation. Photos are still deleted after their round.
2. **The leaderboard shows everyone's answers.** The reveal already shows who picked whom,
   but the policy lists only "name, avatar, points, reactions and photos" as what other
   players see. "answers" is added. No new data.
3. **The phone remembers the last code.** "Saved on your phone" gets "and the code of the
   last game". It is stored on the device only, for the game the player asked for, so the
   § 25(2) No. 2 TDDDG exception (strictly necessary) still fits.
4. **Show again, swaps, long press, the bigger photo count.** No new data, no new
   recipient. With 16 photos more photos are uploaded than shown; they leave the phone only
   after "Yes" (the policy's "only the photos on screen are sent" stays true) and are
   deleted at the game's end.
5. **Haptics plugin.** A new open source component in the app: listed under Licences
   ("Capacitor and its App, Haptics and Share plugins") and in
   `web/vendor/capacitor.LICENSE.txt`. It sends no data.
6. **App Store and Google Play rules for user content.** Report (the flag) and block (the
   host removes a player, in the lobby and in the answered row during a game) stay
   reachable at every point of a game; terms are accepted before playing. Nothing in this
   plan removes them.
7. **Accepting again.** The legal text changes, so `LEGAL.version` (the page date) changes
   in the same commit; with commit 8 every app update asks once anyway.

Result: safe with these text changes; nothing needs a lawyer.

## 6. Affected areas (map)

| Area | Files |
|---|---|
| Config (single source) | `web/shared/config.js` (SETTINGS, REACTIONS, LIMITS, TIMING, APP.version, LEGAL.version) |
| Protocol | `web/shared/api.js` (the `peek` message, its documentation) |
| Game logic | `src/game/rules.js`, `src/game/state.js`, `src/game/view.js` |
| Room shell | `src/room.js` (CLIENT_EVENTS `peek`) |
| App controller | `web/js/main.js`, `web/js/store.js`, `web/js/photos.js`, `web/js/phone.js`, `web/js/ui.js` |
| Views | `views/newgame.js`, `views/sheets.js`, `views/lobby.js`, `views/game.js`, new `views/board.js`, `views/end.js`, `views/home.js`, `views/welcome.js`, `views/overlays.js` |
| Page and styles | `web/index.html` (viewport, `#look`), `web/css/app.css` |
| Native | `ios/App/App/PhonePlugin.swift` (iCloud previews), Android twin header; `@capacitor/haptics` through `npx cap sync` |
| Legal | `web/legal.html`, `web/vendor/capacitor.LICENSE.txt` |
| Tests | `test/unit/config.test.js`, `rules.test.js`, `view.test.js`, `test/integration/room.test.js`, `test/e2e/game.spec.js`, `test/e2e/fake-phone.js` |
| Helpers | `scripts/helpers/demo-players.mjs`, `scripts/helpers/store-images.mjs` |
| Docs | README, `AGENTS.md` (documentation map), `docs/apps.md`, `docs/guides/demo-players.md`, `store/listing.md` |

## 7. Commits

Every commit leaves the app working, runs `./scripts/test.sh` (unit, integration, browser)
before it is committed, does both passes of `AGENTS.md` §2 for anything it renames or
removes, and updates the header comment of every file whose role changed.

### Commit 1: docs: the plan and the prompts
Status: done.

This document, and `docs/prompts/` with the analysis and implementation prompts carried
over from the starlabsMVP repo (`_DOCUMENTATION/PROMPTS/analysis-long.md` and
`implement-long.md`), adapted to this repo: its documents (`AGENTS.md`, README, this
`docs/plans/` folder), its one test entry point (`./scripts/test.sh` instead of Docker),
its rule that commit messages may name a plan commit but code comments never do. The
documentation map in `AGENTS.md` gets the two folders: plans (history: corrections are
added as dated notes) and prompts.

### Commit 2: settings, defaults and the "New game" step
Status: done.

- `config.js`: `photos` options `[[4,'4'],[9,'9'],[16,'16'],[25,'25']]`, default 16;
  `rounds` default 15; `points` option labels "Speed bonus" / "Fixed", help "Speed bonus:
  Right and fast gets the most points." `PRESETS` follow the defaults automatically.
  Pass 2: "Speed counts" in `src/game/score.js`'s header, the help, tests, docs.
- `views/newgame.js`: the "Game settings" button with its summary becomes a third card in
  the preset style (`.preset`), icon ⚙️ at the preset icon size, the label "Custom" only;
  highlighted (`on`) exactly when the settings are no preset (`presetOf` is null), so the
  three cards read as one choice. Tapping it opens the settings sheet as before.
  `settingsSummary` stays (the lobby uses it).
- `views/sheets.js` and CSS: the settings sheet's body scrolls; "Done" sits in a sticky
  footer at the bottom of the sheet (`position: sticky; bottom: 0` with the sheet
  background behind it and a top fade), green (`--g` with the dark ink, a new
  `.btn.done` class), always visible; the last setting can be scrolled fully above it
  (bottom padding as tall as the footer). Other sheets keep their buttons.
- Room compatibility: `normalizeSetting` rejects the old photo counts, so a room created
  by an old app gets 16 (section 2, compatibility).
- Tests: the config tests (defaults are options, presets), `rules.test.js` uses of
  `photos: 3` become 4 where they test the limit, the e2e New game step (the card text,
  settings in the sheet), integration tests that create rooms with `photos: 3`.

### Commit 3: touch: haptics, hold to look, no double-tap zoom
Status: done.

- `package.json`: `@capacitor/haptics` pinned (8.0.2 at planning time; check the newest
  8.x), installed, `npx cap sync` (adds it to the iPhone package list and Android). Its
  notice in `web/vendor/capacitor.LICENSE.txt` and the Licences line in `web/legal.html`.
- `phone.js`: `buzz('yes' | 'no')` (one impact, or two 150 ms apart; nothing without the
  plugin). The only way the app vibrates.
- Hold to look: `#look` root in `index.html`; `views/overlays.js` gets `lookHtml(src)` (the
  photo, contained, on the veil). `main.js`: one pointer handler for elements with
  `data-hold` (`data-hold="now"` starts at once, `data-hold="long"` after 350 ms and is
  cancelled by moving more than 10 px before that); once the look is open, only
  `pointerup` / `pointercancel` anywhere close it; a long press swallows the click that
  follows on release. No feature uses it yet; commits 4 and 6 do.
- No double-tap zoom: viewport `maximum-scale=1, user-scalable=no` (WKWebView honours it;
  pinch is already off through Capacitor) and `touch-action: manipulation` on `html`.
- Tests: none for haptics (native); the overlay is covered in commit 4's e2e test.

### Commit 4: choosing photos: square grid, swap one, hold to look
Status: done.

- `lobby.js` and CSS: the grid gets `--cols` = `Math.ceil(Math.sqrt(size))`; it is a
  square sized to the free space (`.mine` takes the remaining height; the grid is
  `aspect-ratio: 1` with `max-width: 100%` and `max-height: 100%`), tiles square with a
  small gap. Ready state, loading tiles and the "Ready" grid use the same layout.
  Tile fade only for freshly dealt or swapped tiles (a `new` class for one paint), so a
  swap does not make every tile flash.
- Swap: each tile is `data-act="swap" data-v="<index>"` and `data-hold="long"`.
  `photos.js` gets `swap(index)`: takes the next deck preview, puts it in that slot,
  prepares its upload, marks the old one seen, decrements `photos.swaps`; `roll` resets
  `photos.swaps` to LIMITS.swapsPerSet (new, 3). The swapped tile flips (`flip` class,
  rotateY 90 to 0 in 300 ms). At zero swaps, the tap adds a ✗ mark to that tile for
  700 ms and `buzz('no')`; nothing else. Deck empty: the same refusal.
- Counter: under the grid, one line "↻ Tap a photo to swap it: 3 left", quiet but
  readable; at zero it reads "↻ No swaps left". Spoken label "3 swaps left".
- Long press: shows the tile's photo in the look overlay (its upload version when ready,
  else the preview), until the finger lifts anywhere.
- Tests: e2e: a swap changes one tile and the counter; the fourth tap is refused; a long
  press opens and closes the look (the fake phone has enough photos).

### Commit 5: the game screen: simple cards, colours, reactions
Status: done.

- `views/game.js`: the top bar keeps ✕ and the round; the score and `.gain` go. Cards:
  avatar and name only (no "(you)", no voter avatars, no points), at least 64 points
  tall, name 18 points. In `show`: tap to pick (selected card yellow edge as today). In
  `reveal`: the owner's card green with a ✓ badge, my wrong pick red with a ✗ badge,
  everything else unchanged. If my pick is right: the owner card pops and a short burst
  of small confetti (CSS only) leaves it. The dots row and the host's "Reveal now" stay
  in `show`; the host's "Next" moves to the board (commit 6). Header comment rewritten.
- `main.js`: when this phone sees the reveal of a round for the first time, `buzz('yes')`
  if its pick was the owner, else `buzz('no')` (also with no answer).
- Reactions: `REACTIONS` in `config.js` becomes 😂 🙈 🔥 🤯 👀 🫣 😩 🫠 🧐 🎉. One view
  function `reactionsRow()` (in `ui.js`) used by the reveal, the board and the end
  screen: a horizontally scrolling row of 52 point buttons with a small "›" button at
  its right that scrolls by one page and wraps to the start at the end. `floatEmoji`
  gets the start position: from the tapped button; incoming reactions from the matching
  button if visible, else from the bottom centre.
- Tests: e2e adapted (no scores on cards; reveal classes); a unit test that every
  reaction the server accepts is in the app's row (they are the same constant).

### Commit 6: the leaderboard and Show again
Status: done.

- `rules.js`: `reveal` sets `room.deadline = now + TIMING.revealMs` always; when due, the
  new phase `board` starts with `deadline = auto ? now + TIMING.boardMs : null`; `next`
  (host) works in `board`; from `board` the next round starts. `peek` event: only in
  `board`, only while the round's photo exists; `on: true` sets
  `game.peeks[playerId] = now + TIMING.peekHoldMs` and, if the board has a deadline and
  nothing is paused, `game.paused = deadline - now` and `deadline = null`; `on: false`
  deletes that entry. `settle` drops expired entries; when none are left and the board is
  paused, `deadline = now + game.paused`, `paused = null`. `nextWake` includes the
  earliest hold expiry. `report` in `board` deletes the photo (like in `reveal`) and ends
  any hold. Phases documented in the header (lobby, countdown, load, show, reveal, board,
  end).
- `state.js`: `inGame` includes `board`; the Game shape gets `peeks` and `paused`.
- `view.js`: `round.peek` (true while any hold is active); `left` while paused is the
  frozen remainder; `results` visible in `reveal` and `board`.
- `room.js`: `peek: (m) => ({ on: m.on === true })` in CLIENT_EVENTS; `api.js` documents
  it. A phone holding resends every second (TIMING.peekRenewMs).
- `views/board.js` (new): top bar with ✕; title "Round 3 of 15"; the timer bar (paused
  while someone holds); one row per player, sorted by total (ties share a rank, in join
  order): rank, avatar, name 18 points, under it ✓ green "Ben +520" or ✗ red "Ben" (no
  answer: ✗ red "No answer"), total 20 points on the right; my own row has a yellow edge.
  Below: the reactions row, then "Next" (host, manual mode only), then the big "📷 Show
  again" (`data-hold="now"`). While `round.peek`, the look overlay shows the round's photo
  on every phone. Rows enter in the previous order with the previous totals (total minus
  this round's points), then after 400 ms slide to the new order (each row's offset is a
  CSS variable, `transition: transform 600ms`) while the totals count up (500 ms,
  `requestAnimationFrame`, started by `main.js` when the board part is painted, like
  `startStage`). The host taps a row to remove a player (same sheet as in the lobby).
- `config.js` TIMING: `revealMs` 3500 (was 6500 for reveal and reading scores),
  `boardMs` 5000, `peekHoldMs` 2500, `peekRenewMs` 1000.
- `main.js`: board screen routing, the look overlay driven by `round.peek`, sending
  `peek` on press, renewal, release.
- Tests: rules (reveal to board to next round; manual waits on the board; peek pauses
  and resumes with the same remaining time; an abandoned hold expires; peek outside the
  board or by an unknown player is ignored), view (`peek`, frozen `left`), integration
  (a game through the board phase; a photo is still servable during the board and gone
  after it), e2e (the board appears with the pick line; holding Show again shows the photo
  on another phone).

### Commit 7: play again, 24 hour codes, the code remembered
Status: done.

- `rules.js`: `endGame` saves `room.final` (each player's id, name, avatar, score, plus
  the stats). `again` from anyone: in `end`, `toLobby` and mark every other player
  `onResults = true`; in the lobby, a marked player's `again` clears the mark; anything
  else is ignored. `room.final` is dropped when no player is marked and the phase is not
  `end`. The last player leaving no longer closes the room: it goes to an empty lobby
  with no host; `hadPlayers` goes away (pass 2). TIMING.roomIdleMs becomes 24 hours.
- `state.js`: Player gets `onResults`; Room gets `final`.
- `view.js`: `me.onResults`; `final` (the standings and stats) while the phase is `end`
  or the viewer is on the results.
- Apps: `main.js` shows the end screen while `phase === 'end' || me.onResults`;
  `views/end.js` renders from `view.final` and shows "Play again" to everyone (the host
  check goes); a hidden `data-next` marks that a new game is already open (for the demo
  players and tests, no visible text).
- Lobby: "Waiting on Ann, Ben" at the bottom, small and grey, whenever someone is not
  ready (including players still on the results); replaces today's "Waiting for …" line
  that only showed once you were ready. "Waiting for friends…" (alone in the room)
  stays.
- The code remembered: `store.js` gets `lastRoom` (set when entering a room, kept after
  leaving); `views/home.js` fills the code field with it.
- Legal (same commit, section 5): the three text changes, `LEGAL.version` and the date.
- Tests: rules (again from a non-host; idempotent; the others stay on the results and
  are waited for; the empty room survives and resets; idles out after 24 hours), view,
  integration (leaving everyone, then joining the same code again works), e2e (a guest
  taps Play again; leaving shows the code prefilled).

### Commit 8: the terms after every install and update
Status: done.

- `config.js`: `APP.version` (the app version, restated from `package.json`, pinned by
  `config.test.js`). `main.js` and `welcome.js`: the accepted token is
  `${LEGAL.version}+${APP.version}`; the welcome screen shows while it differs. Header
  comments say that a release therefore always asks once.
- `scripts/release-apps.sh` needs nothing: the test fails if the two versions differ, and
  the release runs the tests first. `docs/apps.md` (Releasing) says to raise both.
- Tests: config (the pin), e2e (a stored old token shows the terms again).

### Commit 9: every photo has the same chance (iPhone)
Status: done (tried on a real iPhone through TestFlight in commit 10).

- `PhonePlugin.swift`: in `randomPhotos`, when the local preview is missing, request it
  once more with iCloud download allowed, waiting at most `cloudMs` (from `phone.js`,
  TIMING.previewCloudMs = 4000) by an asynchronous request and a semaphore with timeout
  (the request is cancelled on timeout); still nothing: skip the photo for this batch
  (not excluded later). The header comment states the fairness rule. Android twin: same
  parameter accepted and documented as unused (its media store has no cloud-only
  photos); `phone.js` documents the parameter. Batch timeout in `phone.js` rises to cover
  a few slow photos (TIMING.previewMs 15000).
- Docs: README (Photos) and the privacy wording stay true (still only on the phone).
- Tests: native code has no automated test; tried on a real iPhone with iCloud Photos
  through TestFlight (the release commit says so).

### Commit 10: helpers, docs and the release
Status: done. Version 1.0.2 (build 10002) is in TestFlight; the server was deployed on 22 November 2026 after the operator confirmed, and a full game with demo players (removal, report, five rounds with leaderboards, Play again) ran on it.

- `demo-players.mjs`: wait through the board; on the results, tap "Play again" when
  `data-next` says a new game is open, and also before leaving; their guide updated.
- `store-images.mjs`: the reveal and new game slides still show what they say; redraw
  the store images (`--store-images`).
- Docs pass 2 for everything above: README (game life, photos, 24 hours), `docs/apps.md`,
  `docs/guides/demo-players.md`, `store/listing.md` (What's New for this version: plain,
  no dashes), `AGENTS.md` if a rule's example changed.
- Version 1.0.2 (`package.json`, `APP.version`), TestFlight upload, and the server deploy
  after the operator confirms (critical command, section 2 compatibility). Then a test
  game on both platforms.

## 8. Things to pay attention to

- **Rooms are one event at a time.** Every new rule stays pure and synchronous; `peek`
  renewals are tiny and rate limited by the app (one per second per holder); the server
  ignores more than one renewal per 500 ms per player (attachment timestamp, like
  reactions).
- **Never stuck.** Every hold expires by itself; a paused board always resumes; an empty
  room always has a way back (anyone with the code) and always idles out.
- **The painter.** Animations that must survive repaints (the board's slide and count up,
  a swap flip) start only when their part is painted (`changed` from `paint`), like the
  photo effects, and their markup must not change while they run (no timer text in the
  same part).
- **Reduce Motion.** `@media (prefers-reduced-motion: reduce)` turns the flip, the slide,
  the confetti, the pop and the count up into instant changes.
- **Dash rule.** No long dashes and no en dashes in any text (the tests check it).
- **Old apps.** Section 2. Do not deploy the server before the new app version is in
  TestFlight, and ask before deploying.

## 9. Not part of this plan (ask before doing)

- A general accessibility pass of the screens this plan does not touch (start, welcome,
  invite, help): the operator declined it; the grandmother rule applies only to new and
  changed parts.
- The avatar sheet's "Done" (stays as it is; only the settings sheet's Done turns green).
- Changes to the end screen beyond "Play again for everyone", rendering from the final
  standings and the new reaction row (the operator likes it as it is).
- Pinch zoom (already off through Capacitor; unchanged).
- Anything about Android photo backups in Google Photos (not on the phone, not readable).

## 10. Decision log

| Question | Decision | Why |
|---|---|---|
| Where the leaderboard lives | A server phase `board` | Phases and timers belong to the server; every phone stays in step. |
| Show again as state or relay | Room state with expiring holds | It pauses the clock and must reach late joiners; expiry prevents a stuck room. |
| Clock during Show again | Paused, resumes with the same remaining time | Operator: "so lange jemand hält, hält die Uhr an". |
| Reveal and board times | 3.5 s and 5 s | Operator set 5 s for the board; the reveal no longer shows scores, so it can be short. |
| Board in "Host taps" mode | The reveal stays timed, the board waits for "Next" | One waiting point, where the scores are. |
| No answer on the board | ✗ "No answer" in red | It is a wrong outcome, said in two words; never "+0". |
| Ties on the board | Same rank, join order | Fair and stable. |
| Own row | Yellow left edge | The quickest way to find yourself, without words. |
| Total score icon | None (the screenshot's ⚡ is that app's) | Fewer details. |
| Haptic for no answer | Two pulses | Not right is "no". |
| Swap refusal haptic | Two pulses | The same "no" everywhere. |
| Swap counter text | "↻ Tap a photo to swap it: 3 left" | The feature must be discoverable; one short line does it. |
| Long press preview source | Upload version when ready, else the preview | Sharper when available, never waits. |
| Reaction order | 😂 🙈 🔥 🤯 👀 🫣 😩 🫠 🧐 🎉 | Most used party reactions first (laugh, embarrassed, great, no way, suspicious), then the rest. |
| Play again | Per player, idempotent | Operator: start or join, nobody is pulled away. |
| Empty room | Back to an empty lobby, open 24 h | The same code works next morning, nothing old is shown. |
| Terms gate | `LEGAL.version + APP.version` | Every install and update asks, and a test keeps the version honest. |
| iCloud previews | Fallback download with 4 s limit | Every photo can come up; one slow photo never blocks. |
| Prompts location | `docs/prompts/` | This repo's docs folder; adapted to its files and test runner. |
| Commit 2: the settings sheet's own layout | The sheet root carries its name as a class (`sheet-settings`); that sheet is a flex column whose settings scroll and whose footer holds "Done" | Sticky positioning inside a padded scroll box is unreliable, and `:has()` is missing on iOS 15.0 to 15.3 (the app supports 15.0). |
| Commit 2: Done's green | The same style as "Yes" (`.btn.yes, .btn.done`) | One green action style in the app. |
| Commit 2: Custom card | Lives in the presets row and is highlighted when no preset matches | The three cards read as one choice; it replaces the old summary line, which the lobby still shows. |
| Commit 3: the legal page's date | The Licences line names Haptics now; the date (and with it everyone's new consent) changes in commit 7 | The licence list is not something players agree to, and commit 7 changes the privacy text in the same release anyway. |
| Commit 3: holds without features | The `HOLDS` table starts empty; commits 4 and 6 add the photo choice and Show again | The mechanism is one piece of code; each feature only adds its entry. |
| Commit 3: the tap after a hold | Lifting the finger from a held element is not a tap on it; corrected in commit 4 to swallow only the click on that same element (matched by `data-hold` and `data-v`, since repaints replace nodes) | A global 400 ms window first swallowed every tap after page load, then the "No" tapped right after looking at a photo (both caught by the browser tests). |
| Commit 4: sizing the square grid | The grid sits in a box that takes the free height (container query units, `min(100cqw, 100cqh)`); the lobby page gets the screen's exact height (`.wrap.fit`) | Container units need a container with a definite height; with only a minimum height they measure 0 (the tiles had no size). Content that does not fit still scrolls. On iOS 15 without container units the grid takes the full width. |
| Commit 4: tiles as buttons | Each photo of the choice is a button (tap to swap, `data-hold` to look); the "Ready" grid uses plain tiles that can only be held | Buttons are reachable for screen readers and get the standard tap behaviour. |
| Commit 4: refused swap | Also when the deck has no photo ready (a nearly empty library) | Same feedback for every "not possible", no new message. |
| Commit 5: the host's "Next" | Stays on the reveal until commit 6 adds the board | "Host taps" games must keep working between commits. |
| Commit 5: players not among the options | No longer listed below the cards on the reveal | They were there only to show every score; scores move to the board. |
| Commit 5: the reaction test | An integration test that the room passes on a listed reaction and drops an old app's emoji, instead of a unit test comparing the constant with itself | The app and the server read the same constant; what can break is the server's filter. |
| Commit 5: when to vibrate | On the first view of a round's reveal (also after reconnecting during one), from the room's own results | The room's results are the truth; an optimistic pick could differ. |
| Commit 6: removing a player on the board | Not added; the host removes players in the lobby and in the "who has answered" row while guessing | The operator kept that row, so the block stays reachable in every round; a second place would add a detail nobody asked for (deviation from this plan's commit 6 text). |
| Commit 6: the slide | Rows stand in their new order and start shifted to their old places (`--shift`), then slide to zero | The list keeps its natural height (also when someone leaves during the board), and no absolute positions are needed. |
| Commit 6: Show again on the holder's phone | Shown at once on the phone that holds it; the other phones follow the room's `peek` | No round trip before the holder sees anything. |
| Commit 6: renewal limit | The room ignores a renewal less than 500 ms after the last one from the same socket | Renewals come once a second; anything faster is waste, and every renewal is broadcast. |
| Commit 6: the timer while paused | The view says `paused`, and the apps stop counting down | Otherwise the bar would keep shrinking on the phones while the room's clock stands still. |
| Commit 6: "Next ›" on the reveal | Gone; the host's "Next" lives on the board in "Host taps" mode | The reveal is 3.5 s; one waiting point is enough. |
| Commit 7: the end screen's data | One field `final` (the last game's players with their scores, the fastest guess, the best fooler) for the `end` phase and for whoever is still on the results; the old `stats` goes | One source for the same screen in both situations. |
| Commit 7: "Waiting on" | Shown whether or not this player is ready, without this player's own name, and without an ellipsis | Operator's words; listing yourself while choosing photos would be odd. |
| Commit 7: forgetting the code | The remembered code is cleared when the room is gone or this player was removed | A dead or closed code in the field would only lead to an error. |
| Commit 7: who hosts after a room was empty | The first player back | Same rule as for a new room. |
| Commit 8: where the token is built | One function `termsToken()` in `config.js`, used by the gate, "I agree" and the boot rejoin | One definition of what "accepted" means. |
| Commit 8: the legal page's "Changes" sentence | Unchanged ("when a change matters for you, the app asks you to accept the new version") | Still true; asking after every update asks more often, never less. |
| Commit 9: a cloud budget per batch | Besides the 4 s per photo, a batch spends at most 8 s on iCloud previews; photos beyond it are skipped in this batch only | A library mostly in iCloud would otherwise make a batch take very long; skipped photos stay in the draw for the next batches. |
| Commit 9: the batch timeout | TIMING.previewMs rises from 10 s to 15 s | Room for the local work plus the cloud budget. |
| Commit 10: the store images | Four photos each (the drawn library fills a 2 x 2 choice), the leaderboard instead of the reveal for "Fast and right wins", and each player picks someone else so one guess is right | The images show the app as it is now, with a ✓ and a ✗ on the board. |
| Commit 10: what goes to Apple | 1.0.2 is uploaded to TestFlight only; the App Store submission waits until 1.0.0 is live and the operator says go | Apple keeps one version in review at a time, and the release is the operator's call. |
| Commit 10: the server deploy | Not done yet; it needs the operator's confirmation (critical command), and should go out when 1.0.2 is in his testers' hands | Section 2: 1.0.0 and 1.0.1 keep working with the new server, a little worse. |
