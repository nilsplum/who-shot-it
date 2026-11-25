# Lobby and start: the last Yes, the bubble, the photo choice, the 3-2-1's loading, the rating (plan)

Status: planned on 25 November 2026 against `main` at 3829a5e (app 1.0.8), and being
implemented on the branch `feat/lobby-and-start` in its own worktree
(`.claude/worktrees/lobby-and-start`); each commit's status line in section 8 says how far it
is. Another piece of work (the leaderboard's entrance in `web/js/board.js`, the streaks in
`web/js/streak.js`, with changes to the room's rules) was in progress, uncommitted, in the main
folder at the same time and touches many of the same files. The operator chose to keep the two
apart (25 November 2026): this branch starts from `main` as it was, and the two meet when they
are merged (Operator handoff). The plan names functions, parts and selectors, never line
numbers.

Each commit is implemented with `docs/prompts/implement.md`; decisions made while
implementing go into the decision log at the end (section 11), dated, never rewritten.

## Operator handoff

What only the operator can do, and what is worth knowing from the implementation, kept up
to date with every commit.

**The branch and the merge**
- This work lives on `feat/lobby-and-start` (worktree `.claude/worktrees/lobby-and-start`),
  started from `main` at 3829a5e while the leaderboard and streak work was still uncommitted in
  the main folder. Whichever of the two reaches `main` second is merged with care: they overlap
  in `src/game/rules.js`, `state.js`, `view.js`, `web/js/main.js`, `styles/app.css`,
  `web/shared/config.js`, `AGENTS.md`, `README.md`, `drafts/README.md` and the e2e tests. Every
  conflict keeps both changes, then `./scripts/test.sh` runs in full before the merge is
  committed.
- The main folder still holds an untracked copy of `drafts/bubble_animations` (so the drafts
  page that was open there kept working). It is identical to the one committed on this branch
  and is deleted there right before the merge, or git refuses to merge over it.
- The leaderboard and streak work reached `main` first (2a6c4f4). `main` was merged into this
  branch on 25 November 2026, before commit 6 (three conflicts, both sides kept, the full
  suite green), so commits 6 to 8 are built and tested on the code they ship with, and the
  final merge into `main` has nothing left to resolve unless `main` moves again.

**Done**
- Commit 1: the plan and the bubble's draft are on the branch (nothing to deploy or release).
- Commit 2: the bubble is in the app, and the room counts the group's games (`view.games`).
  The server changed (the count), so it is part of the next deploy; installed apps ignore
  the new field. To try on the phones: the bubble's look and moves (commit 8's list).
- Commit 3: the room takes a confirmed last Yes (`sending` with `start`). No app sends it yet
  (commit 4 does), so nothing changes for players; installed apps go on as before.
- Commit 4: the app sends it: Yes left with START for the last player, "No →" in ice blue,
  "Is everyone here?" on the last phone only. This is why the server is deployed before this
  app is released (to do 1). The test players (`demo-players.mjs`) never take the START Yes:
  when recording, say Yes after them (`docs/guides/demo-players.md`). To try on the phones:
  the stamp landing, the sheet, the buttons (commit 8's list).
- Commit 5: the hint line is gone; a swap turns the tile to the swaps left (✕ at none) and
  pops the new photo, a refused tap shakes it with a red ✕, "No →" slides the set; "How to
  play" explains the swap and the hold in one line. App only, nothing to deploy. To try on the
  phones: the turn, the pop, the slide, with Reduce Motion too (commit 8's list).
- Commit 6: "Get ready" is gone; the start's film leader is on screen from the first moment,
  loads (its hand turning, its outer ring filling in white as the group's photos come in, no
  words), then counts 3-2-1 on the same frame. App only, nothing to deploy. To try on the
  phones: a start on a slow network (commit 8's list).
- Commit 7: after a close game, from the group's 3rd game in its room, every phone still on
  the results asks for the store's own rating window 2 s after the podium's story, once per
  app start; "How to play" has the quiet "⭐ Rate the game" link (App Store write-review page;
  on Android once `STORES.android` is set). Native on both phones (the twins compile on this
  Mac); on Android Google's In-App Review library 2.0.2, the one approved exception to the
  open-source rule. The legal page changed (one privacy sentence, "Licences", the date): it
  goes live with the next deploy, the app asks for the terms again with 1.0.9 anyway. To try:
  to do 3.
- Next: commit 8 (the release), then the merge into `main` (The branch and the merge, above).

**To do by hand, once the commits are in (in this order)**
1. Deploy the server first (`./scripts/deploy.sh`, a critical command: the implementing agent
   asks before it runs it). The new server keeps every installed app working (section 6), and
   the new app needs it: on the old server its "Yes, start" would still make every phone ask
   "Is everyone here?".
2. Try it on a real iPhone and a real Android phone with the test players
   (`docs/guides/demo-players.md`), as listed in commit 8 ("Try on both phones").
3. The rating window: an iPhone build from Xcode (`./scripts/dev.sh ios`) always shows it
   (Apple's development mode), TestFlight never does. On Android it only appears for an app
   installed from Google Play (the internal testing track); a build from this Mac completes
   silently. So the real check on Android waits for the Android release.
4. Release 1.0.9 (`./scripts/release-apps.sh --store-images --submit`, after reading commit 8):
   the store screenshot of the photo choice changes (Yes left, "No →" in ice blue, no hint
   line), and the first App Review note mentions "Is everyone here?", which now is a sheet on
   the last player's phone: record the review video again with the build that goes to review,
   or reword the note (commit 8).

## 1. What the operator asked for

### 1.1 The original request (verbatim)

> I want you to apply the following changes to the primary home + selection UI and UX:
>
> There should be no "is everybody ready" screen anymore. I used it because otherwise simply the state of everybody is ready but some people are still entering the loading screen would still lead to an immediate start. Instead, simply the last person in the session that is not ready, gets the "yes and start" button or something better phrased instead of the yes button. Clicking it makes a popup appear, if everybody is complete (as it does now for every person). Clicking yes starts the game. The popup should appear only if the session has no game yet, because this is the time where people might not have joined yet and all other people could be ready. This part is also similar to how it works today.
>
> Another nice feature I want is that whenever there is just one person that is not ready, there should be a funny text popping up in a floating big bubble like "its always mia...", or "mia get your stuff together". The last example is very bad. Do some creative work and think about what genuinly funny and not cringe or weird. It should be catchy and make sense. The text in the bubble should warp with the bubble to make it have a punshy and well desinged 3D look.
>
> Also, the loading screen before the 3,2,1 screen should be gone and the 3,2,1 should have a black and white loading animation that matches its style better.
>
> Also, in the app, there should be a call to rating the app, that appears within the bounds of android and apple legal setting and should appear on the times users are most likely to give a good review, for example after a game has ended and they click next game or when they won. I belive these two cases should be asked. Generally it should work in the standard way and definetly not anny the users. If it comes with a notification, it should be phrased based on whats proven to work.
>
> Also, the tap to swap and hold to preview text should be gone. instead of the swap indicator, the indication should happen when actually swapping the image. When doing so, it should swap to the number they have left and then the number should be replaced by the image. This should look snappy and well made.
> Also, the "No" button should get the text "No (next)" instead and it should be in a light blue with black text.
>
> Now go ahead and make a plan for that by asking me questions if something is unclear or if you feel like I havent thought about something or similar. Spawn sonnet subagents where needed to do research or read a lot of files in the code. Read the results and also read files yourself in order to figure out how everything looks now and how I want it to look. Really get into my perspective and figrue out how I mean things, how I want it to look and feel and so on. Take on the perspective of a UX and animation designer that knows what he is doing. The app should feel personal and well made. Dont make unrelated changes without aasking me. Also, if I leave things open, ask me by proposing the options. For the spinners when a single user is not ready, you should provide your approches to me also by using the ask question tool. Use it also to inform about the decisions like how the review system works usually and so on, getting my approval.
>
> Really do all the reading and gather absoltuely all teh context needed. Start with the readme and the agents.md file. Make sure to follow the agents.md guidelines and that they are enforeced well. Everything should be simple and fast, not performance intense and so on. It should all make sense from a UX standpoint and it should feel really high quality.
> After you are done, write this all in a commit sequenced planning document that explains what to keep in mind, the backgrounds, reasons and things to pay attention to in addition to my exact words and how they are meant and how it should feel and look and behave in every scenario, as well as design instructions like what to pay attention to in order not to get issues like overflow or performance issues and implementational instructinos on how to implement it, what files to read and so on.
>
> Make sure that the result of implementing the plan is still a well architected, well documented and commented codebase where everything is uniform and centralised and consistant design and architecture wise. It should all look and feel snappy and high quality and make sense from a UX standpoint. Dont plan any additionl changes before asking me using the ask questions tool. Dont implement the plan yet.

### 1.2 The answers to the questions (verbatim, each with its question in short)

Five rounds of questions (the fifth after the bubble's draft). Where an answer has notes, they
are quoted in full; they override the option they came with wherever they differ, and a later
round overrides an earlier one.

**Round 1**

- *The last player's button: what should it say?* Chosen: "Yes, start". Notes:
  > I believe the no (next) should actually just say No -> and it should be on the right side. The Yes button should also just be called yes and if its the last player it should get a start batch with an animation like a stamp with black text in bold font that say "START" and thats a bit cricket. The Yes text has to move a bit to the left I guess for this.
  >
  > Also, both buttons should be switched, the Yes button should be on the left.
  >
  > Also, the switch from the images should have an animation, it should slide from the left to the right and snap in place.
  >
  > Everything should be simple and follow the agents.md guidelines and it should be smooth or snappy and the performance should be good while beeing robust and simple.
- *The bubble's look (Comic sticker, Jelly bubble, Balloon)?* Chosen: "Comic sticker": a
  yellow speech bubble, dark text, dark outline and a thick 3D edge like a sticker, the tail
  pointing up to the players' row, the avatar before the text; it pops in with squash and
  stretch, then hovers and tilts slowly in 3D, each new line popping in again.
- *The bubble's text (escalating, one line per wait, only "It's always…")?* Chosen:
  "Escalating" with the lines proposed (section 3.3). Notes:
  > Make sure the text fits well into the bubbles. the text should be fat and bend with the bubble. The bubbles should actually be commic style but smooth. the text should be a really really bold font. I believe everything should be a litle bit translucent.
  >
  > Bending means something like this only also to the top and bottom (but less of course)
  > ss SS ss
  > ss SS ss
  >
  > bolt means really bold. Choose the font to match the design. The bubbles should look very well designed and elegant and yet match the funny texts.
  > Text can and should of course break-word. The bubbles should always nicely wrap around and everything should make sense with the gaps and so on.
- *When should the app ask for a rating?* Answer:
  > If possible, there should be also sometimes a prompt from our app to rate the app. If this is legally possible. It should prompt the users in a way and situation in which they are very likely to actually do it, not if they want to continue. I believe this could happen for all users at the same time, after a close battle and only within a random time period of all users average time since they have seen it before. If this is complicated with the data storage, I want some other solution that really makes sense. Explain whether we can do that and then take into account what I want and ask me again using the tool, explaining the context well.

**Round 2** (after explaining that an app-made "Rate us" prompt is forbidden by Apple's
guideline 5.6.1 and Google's in-app review rules, that the app may only pick the moment and
call the phone's own rating window, and that the "average time since everyone saw it" cannot
be known)

- *Rating pace (close game, all phones together; once per app start, or a random pause saved
  on the phone, or also the winner alone)?* Answer:
  > I want option 1, although I dont understand why the rating can be asked for once per app start. I though it would be restricted to only 3 times per year or once per month. If this is the case, I want it to be only displayed only after x games played of the user or a given time after they opened the account or similar. Still, it should, if possible ask them all together.
- *Android needs Google's Play In-App Review library (Google's own terms, not open source):
  allow it?* Chosen: "Allow it, both phones".
- *Which switch should slide from left to right?* Chosen: "No →, the whole set": the old set
  slides out to the right while the new set comes in from the left and snaps in place with a
  small overshoot (about 0.35 s); the first set of a game still fades in.
- *How does the new photo replace the number on a swap (Pop, Slide & snap, Turn again)?*
  Chosen: "Pop": the new photo pops out of the middle over the number, a little too big, then
  settles. Notes:
  > If there is no swap left, it should simply display an x. Before that it should only display the number, no text needed. I want the pop option..

**Round 3** (after explaining that the phone's own limit does not spread the asks out: all 3
of Apple's yearly windows could come in one evening; and that counting the games of the group
in its room keeps the table together without saving anything on the phones)

- *Which rating rule?* Answer:
  > I want option 1 but from the 3rd game on...

  So: at the first close game from the group's 3rd game in its room on, every phone at the
  table asks at the same moment, at most once per app start, nothing saved on the phones.
- *The bubble's font?* Chosen: "Bricolage Grotesque, fat" (the app's own title font at its
  heaviest, plus a thin outline in the text's own colour). Notes:
  > yes, but in very fat, if possible.
- *The 3-2-1's loading animation?* Chosen: "Hand spins + ring fills": the hand goes round one
  turn a second, the outer circle fills clockwise in white as the group's photos come in, no
  number yet; then 3, 2, 1 on the same frame.
- *Which light blue for "No →"?* Answer:
  > I want ice blue. Make sure its in the central color config, not defined in the code.

  So: Ice, `#C2E6FF`, as a new token in the `@theme` of `styles/app.css`.

**Round 4**

- *The bubble on the last player's own phone?* Chosen: "Not on theirs": only the others see
  it; on the last player's phone the START stamp is the signal and nothing covers the photos
  they are choosing.
- *The rare cases where everyone said Yes without the last Yes being confirmed (the last one
  left or was removed; two Yes at the same instant)?* Answer:
  > Maybe in these cases the "everybody here" screen shows and eveybody can answer, as it does now, but only in these rare edge cases.
- *Drafts first?* Answer:
  > As I said, write everthing down exactly as I want it over the course of your uqestions and my answers and what I initially wanted. Plan the implemen tation as it will be in the final app.

  So: no drafts; this plan specifies the final app.
- *Extras?* Chosen: both, "Swap & hold in 'How to play'" and "'Rate the app' link". Notes:
  > Be carefull, "rate the app" could be seen as prompt. This section should be well phrased and make actually users want to rate the app. The text should be minimal. Choose a strategy that works really well for this. Do websearch and get into the perspective of the user.

**Round 5** (after the bubble's draft, `drafts/bubble_animations`, which the operator had
asked for after the plan was written: "Now draft out only the bubble animation in three
different variations. Each should look absolutely well made, not just having one bubble but
actually also smaller ones with the name fileld in. I believe the text should be white or
slightly colored (similar to the outside of a bubble looks colored) and not translucent. Vary
in the desing of the bubble and the animation and the way it looks and feels.")

- *The bubble, after seeing the draft* (verbatim):
  > Regarding the bubble animation I want a few things to be changed:
  >
  > - The bubbles should not be visible at all times. the big bubble should move in from either left or right, getting bigger aswell. They should pop up, then disappear again for 10 seconds, starting with the first one the moment only one person is not ready yet. They should be in a completely random order
  > - The direction-attachements dont look very well. Think about their design again and how they attach. Ensure it looks well made and simple
  > - I want you to remove the ones that talk to the awaited user (he doesnt even see them, so it makes no sense). Also, I want more creative and nice ones to be added. They should not be weird at all but actually be funny and have personality
  > - I want to have the popart shadowing-dots to appear so it looks even more comic like. Make sure they are well placed.
  >
  > Dont update teh drafts yet. Start with the bubble commits and then complete the next 4 commits of the plan.
- *Which variation?* Chosen: "Comic chorus" (the speech bubble in the waited-for player's
  colour, the friends' small bubbles around it).
- *What the small bubbles say (they called the player: "Mia?", "Mia!!", "Mia…")?* Chosen:
  "Keep the name calls".
- *How long one appearance stays before its 10 s away?* Answer: "5s".
- *Where to work, with the leaderboard and streak work uncommitted in the main folder?*
  Chosen: "Own worktree from main".

### 1.3 How the words are meant (the interpretation this plan follows)

- "is everybody ready" screen: today's full-screen "Is everyone here?" cover that every phone
  shows in a group's first game once everyone said Yes. It goes from the normal flow; it stays
  only as the fallback for the rare cases (round 4).
- "session has no game yet": the group's first game in its room (`room.start` is still 'ask':
  no game of this group has started there; it is 'ask' again after everyone left the room).
- "popup": a confirmation, and every confirmation in this app is a bottom sheet
  (`web/js/views/sheets.js`, AGENTS.md §6). It appears on the last player's phone only.
- "start batch … like a stamp … a bit cricket": a START badge ("batch" = badge), stamped onto
  the Yes button with the stamp animation, sitting a little crooked ("cricket" = crooked).
  "black text" is the app's near-black navy (`text-navy`), as on every yellow and green
  button.
- "No ->": the label is "No →" (the arrow U+2192), not "No (next)".
- "the switch from the images": what "No →" does, the whole set (confirmed in round 2).
- "bend": the letters bulge as if printed on a ball: biggest in the middle of each line,
  smaller towards its ends; the middle line a little bigger than the lines above and below.
  The bubble's 3D tilt then bends the whole thing in space.
- "everything a little bit translucent" (round 1) was replaced by the draft's request: the
  text is white (or barely tinted) and opaque, and so is the comic bubble.
- "The bubbles should not be visible at all times … disappear again for 10 seconds":
  appearances of 5 s (round 5), each followed by 10 s without a bubble, the first at once.
- "completely random order": the lines are shuffled; no tiers, no escalation.
- "the ones that talk to the awaited user": the lines that address the player ("Mia, the whole
  table is staring at you."); every line now talks about them. The small bubbles keep calling
  the name (round 5).
- "direction-attachements": the tails that attach each bubble to where it points.
- "popart shadowing-dots": halftone dots that shade each bubble on its side away from the
  light, as printed comics do.
- "x": the ✕ glyph, in red, the app's colour for "no swaps left".
- "after x games … ask them all together": counted per group and room by the server, so every
  phone at the table has the same count (round 3).

## 2. Findings before planning (how it works today)

- **The start** (`src/game/rules.js`, header and `HANDLERS.start`; `src/game/state.js`
  `startMode`): a room has `start` 'ask' (a group's first game), 'button' (someone answered
  No) or 'auto' (later games). Once everyone (at least two, all connected, some photos) said
  Yes (`everyoneSaidYes`), an 'auto' room begins the start (`begin`), an 'ask' room waits and
  every phone shows "Is everyone here?" (`views/overlays.js` `ASK`, a full-screen cover);
  anyone's "Yes, start" (`start {go: true}`) sets 'auto' and the start begins; "No, wait"
  sets 'button', and the lobby shows a glowing "Start now" (`views/lobby.js` `startNow`,
  `animate-breathe`), greyed until everyone said Yes. `startMode` returns 'auto' unless a
  connected app said in its hello that it can ask (`asks`, apps 1.0.5 and newer), so older
  apps start by themselves. `startGame` sets 'auto'; an empty room is 'ask' again (`settle`).
- **"Yes"** (`web/js/main.js` `readyWith`): the app sends `sending {upload}` at once (the
  player counts as having said Yes, `saidYes`), uploads in the background, and the room counts
  the upload only if it is the one the player last said Yes to. "Play without photos"
  (`guess`) goes the same way with no photos.
- **The start's three steps** (`rules.js` `transition`, case 'countdown'): photos still on
  their way come in (no timer); the game is dealt and every phone gets the first photo
  (`game.waiting`, at most `TIMING.loadMaxMs`); the 3-2-1 (`TIMING.countdownMs`). During the
  first two, the view has no timer (`timerMs` null), and the app shows "Get ready" in yellow
  with a progress bar ("Sending photos", from `view.uploads` and this phone's own upload,
  `main.js` `sendShare`) or a spinner (`views/overlays.js` `startScreen`, part `wait`). Then
  the film leader (`leader(n)`, part `count`), kept on the room's clock by
  `web/js/countdown.js` and felt per number (`main.js` `paintStart`).
- **The photo choice** (`views/lobby.js` `mine`, `actions`, `swapsLine`, `chosenTiles`;
  `web/js/photos.js` `roll`, `swap`): "Play with these?", a grid of 2 x 2 to 5 x 5 tiles,
  the line "Tap to swap (n left), hold to preview" (green count that bumps, red and shaking at
  0 and on every refused tap), then "No" (dark) and "Yes" (green). A tap on a tile swaps it:
  the tile turns over like a card (`animate-flip`, old photo as the back face, `from`); 3
  swaps per set (`LIMITS.swapsPerSet`); a refusal buzzes twice. "No" deals a new set from the
  bucket (instant), which fades in (`animate-deal`). Holding a tile shows it big (`HOLDS.tile`).
- **What the lobby knows about others**: every view lists each player's `ready` (their Yes),
  `connected` and `photoCount` (`src/game/view.js`). The quiet line at the bottom says
  "Waiting on A, B" (`status`).
- **The end screen** (`views/end.js`, `web/js/podium.js`): the podium's story plays once per
  game end (`main.js` `startPodium`, `session.shown`); `view.final` has the final players
  with their scores; "Play again" opens the next game under the same code.
- **Native**: the app's own plugin `Phone` (`PhonePlugin.swift`, `PhonePlugin.java`,
  documented in `web/js/phone.js`); only `@capacitor/*` packages otherwise; the Android
  project has "no Google services" (`docs/apps.md`). The iPhone app supports iOS 15.4 and
  newer, Android 10 (API 29) and newer.
- **Installed apps**: 1.0.2 in the App Store (no `asks`), 1.0.5 in App Review and 1.0.6 to
  1.0.8 in TestFlight (all with `asks`). Section 6 says what each does with the new server.

## 3. The feel rules (how every new part looks and behaves)

### 3.1 The two buttons, and the last player's START

- **Order and look**: "Yes" on the left (green, `bg-green text-navy`, as today), "No →" on
  the right (ice blue, `bg-ice text-navy`). Same size, same `btn` shape, the grid exactly as
  wide as the photo grid (as today).
- **"No →"**: the label is "No →" (U+2192, Inter has it). Its accessible name: "No, other
  photos". It does what "No" did, plus the slide (3.4).
- **The last player's Yes**: on the phone of the one player whose Yes would start the game
  (`lastToSayYes`, 3.5), the Yes button says "Yes" followed by a START badge: "START" in the
  display font, extra bold, upper case, navy, inside a thin navy border with slightly rounded
  corners, small (about the size of the fine print), turned about 8° anticlockwise. Yes and
  the badge sit side by side, centred together, so "Yes" moves a little to the left. The
  badge lands with the app's stamp animation (`animate-stamp`: from big and turned, overshoot,
  settle; the reveal's ✓ and ✗ use the same), once each time it appears. It never changes the
  button's height. Accessible name of the button then: "Yes, start the game".
- **When the badge comes and goes**: it appears the moment this phone becomes the last one
  (others said Yes, or someone left) and disappears the moment it is not any more (someone
  joins, someone taps Change). Each new appearance stamps again; a repaint for anything else
  never replays it (its markup does not change).
- **What the last Yes does**:
  - A group's first game (`view.start.mode` 'ask'): the "Is everyone here?" sheet opens on
    this phone only (3.2). Nothing is sent yet.
  - Otherwise (later games, or the group already answered "No, wait" once): it says Yes as
    confirmed (`sending` with `start: true`) and the game starts at once.
- **"Play without photos"** by the last player counts like their Yes (it can start the game
  as well, when someone else has photos): same sheet in the first game, same `start: true`.
  Its link keeps its words.
- Vibrations: unchanged. The badge does not vibrate (the app's five vibrations keep their
  meanings, `phone.js` `HAPTICS`).

### 3.2 "Is everyone here?", on the last player's phone

- A bottom sheet (`sheets.js`, name 'start'): title "Is everyone here?", the line "Anyone who
  joins later plays without photos." (true: a player who joins during a game plays without
  photos), and two buttons: "Yes, start" (green) and "No, wait" (the quiet dark one). The
  backdrop and the Android back button close it like "No, wait".
- "Yes, start": closes the sheet and says Yes as confirmed (`start: true`); the 3-2-1's
  leader appears on every phone at once (3.6).
- "No, wait": closes the sheet and sends nothing. The player stays not ready, keeps the START
  badge, and can tap it again whenever their friend is there. When the friend joins, the
  friend is now the one not ready too, so the badge leaves this phone; once this player says
  Yes (now a plain Yes), the friend becomes the last one and gets the badge and the sheet.
- The sheet closes by itself the moment this phone is no longer the last one or leaves the
  lobby (someone joined, someone tapped Change, the game started by another route), like the
  other sheets that no longer fit (`main.js` `onMessage`).

### 3.3 The bubble (the "Comic chorus", only on the others' phones)

Chosen in round 5 from `drafts/bubble_animations` ("Comic chorus"), with the operator's
changes: it comes and goes, its lines come in random order and never talk to the player the
group waits for, its tails are redesigned, its pop-art dots are clearly there.

**When**: exactly one player is the last one (3.5), that player is connected (an offline
player already shows the red light and "Offline, tap to remove", and a joke would not help),
and this phone is not theirs and is in the lobby (not on the last game's results).

- **The rhythm**: the first appearance comes the moment that player becomes the last one; it
  stays 5 s and then leaves (0.35 s); then nothing for 10 s; then the next appearance, and so
  on for as long as the wait lasts (one every 15 s). When the wait ends (the last one says
  Yes, someone joins or taps Change, the last one goes offline), the bubble goes at once: the
  start's cover or the changed lobby takes over anyway.
- **The same on every phone**: every phone starts its rhythm when its view shows the last one
  (the room sends the views together, so they agree within the network's delay) and takes the
  same line, the same side and the same chorus from a shared seed. A phone that connects in
  the middle of a wait starts its own rhythm from then.

**What it says**: one line per appearance, the lines in a random order (a shuffle every phone
makes alike from the room's code, the group's game count `view.games` and the player's id, so
every game and every player gets another order); when the same player becomes the last one
again in the same lobby, the order goes on where it stopped instead of starting over. No line
talks to the player who is waited for (they never see the bubble); each talks about them, with
personality, never mean:

- It’s always {name}…
- Everyone’s ready. Except {name}.
- Classic {name}.
- What is {name} hiding? 👀
- {name} is choosing VERY carefully 🧐
- {name} is skipping the embarrassing ones 🙈
- Breaking news: {name} is still choosing
- Loading {name}… 12%
- {name} is negotiating with the camera roll
- {name} needs a minute. Or ten.
- Grab a snack. {name} is choosing 🍿
- Shh… {name} is concentrating
- {name} is curating a masterpiece 🎨
- {name} takes this game very seriously

- No possessive of the name ("Chris's" breaks on names ending in s); every emoji is Emoji 12.0
  or older (Android 10 draws them, like `REACTIONS`); the name is the room's (`cleanName`),
  escaped (`esc`).
- **The small bubbles** (the chorus): one per other player in the room (the waited-for player
  aside, this phone's own player included: the table is talking), three at most, in a shared
  random order, each in that player's colour, calling the name: "{name}?", "{name}!!",
  "{name}…" (round 5). A name over 10 characters is called by its first part ("Maximilian" for
  "Maximilian-Alexa") when that part has 3 characters or more, so it stays big enough to read;
  the big bubble always says the whole name. With two players there is one small bubble, with
  three two, from four on three.

**How it looks** (comic, smooth, opaque):

- **The big bubble**: a rounded rectangle with large soft corners in the waited-for player's
  colour, a little lighter at the top than at the bottom, a thick navy outline (about 3 px) and
  a hard navy shadow offset to the bottom right (its thickness), a gleam at its top left.
- **The pop-art dots**: halftone dots in a deeper shade of the bubble's own colour, on the
  side away from the light: densest at the lower right, thinning out towards the middle, gone
  before the upper left and the gleam. The small bubbles have them too, finer.
- **The tails**: a short, slightly bent wedge on a straight part of the bubble's edge (never on
  a corner, so it always meets the edge cleanly), filled like that edge, its outline continuing
  the bubble's: where the tail leaves the bubble the bubble's outline opens (the tail's fill
  covers it), and the tail's two sides carry the outline on to a rounded tip. The big bubble's
  tail points up to the players' row; each small bubble's points away, off the screen, to where
  its player sits (up and right, down and left, down and right).
- **The small bubbles**: pills in their player's colour, a thinner outline and shadow.
- **Behind the big bubble**: rays of light in the yellow, fading out at both ends, turning
  slowly.
- **The text**: white comic lettering: Bricolage Grotesque at its heaviest, made fatter with an
  outline in its own colour, outlined in navy all round and standing out with a short navy
  extrusion to the bottom right. Opaque; an emoji keeps its own colours (no outline). The bulge
  ("ss SS ss"): rows cut by the app (balanced, at most 13 characters, a longer word broken,
  after a hyphen where it has one), each character sized by its place in its row (about 0.76 at
  the ends to 1.24 in the middle) and each row a little by its place among the rows (about 0.92
  to 1.07), characters centred on the row's middle line.
- **Sizing**: the line is fitted after the paint: as big as fits 80% of the photo area's width
  and 36% of its height, at most 2rem; the bubble wraps it with even padding. The small bubbles'
  text has one size.
- **Where**: the big bubble centred in the photo area, a little above its middle; the small
  ones around it (above its right end, below its left end, below its right end and lower),
  inside the screen. Nothing blocks a tap (`pointer-events-none`).

**How it moves** (only `transform`, `translate`, `rotate`, `scale` and `opacity`):

- **In** (about 0.6 s): the big bubble slides in from the left or the right (a random side per
  appearance, the same on every phone), growing from about a third of its size as it comes,
  stops with a little squash and settles; its rays come with it.
- **The chorus**: the small bubbles pop out of their tails one after another (0.45 s, 0.75 s
  and 1.05 s after the start), a little too big first, and wiggle while they call.
- **While it stays**: the big bubble rocks gently in 3D (about ±8°, so the bulging letters bend
  with it) and gives one springy bounce about halfway; the rays turn.
- **Out** (0.35 s, after its 5 s): the small ones pop away, the big one shrinks and fades.
- Reduce Motion: it appears and goes without moving.
- Its markup changes only when an appearance starts and when it leaves, so the four repaints a
  second never restart its animations.

### 3.4 The photo choice

- **The hint line goes**: no "Tap to swap (n left), hold to preview" under the grid. The grid
  gets that height. Tapping a photo still swaps it, holding still shows it big; "How to play"
  explains both in one line (commit 5).
- **A swap** (tap on a photo with swaps left), about 0.75 s, snappy:
  1. 0 to 0.22 s: the photo turns over like a card (around its vertical axis, accelerating).
  2. Its back is a plain card (`bg-raised`) with one big number: the swaps left after this
     one (2, then 1) in yellow, in the display font, extra bold, sized to the tile (about half
     its shorter side, so it reads on a 5 x 5 grid as on a 2 x 2). When this swap used the
     last one, the back shows a red ✕ instead of 0. No text besides the number or ✕. It lands
     with a small bump (0.22 to 0.4 s).
  3. 0.4 to 0.7 s: the new photo pops out of the middle over the number: from about 0.4 of the
     tile's size and invisible, a little too big (1.06), then its size, with the app's bounce.
  4. Then the tile is painted plain with the new photo (the card's two faces go).
  - One light tap is felt as the swap happens (as today).
- **A refused tap** (no swaps left): the photo shakes (`animate-jiggle`, as the count did) and
  a red ✕ fades in over it on a dimmed layer and out again (about 0.6 s), each refused tap
  again; two firm pulses are felt (as today). A refusal while swaps are left but no photo is
  ready yet (rare: the bucket is empty) only shakes, without the ✕.
- **"No →"**, a new set replacing one on screen, about 0.4 s: the old set slides out to the
  right while the new set comes in from the left right behind it, overshoots a hair and snaps
  in place (like a strip moving one frame to the right). Both sets move as two whole grids,
  never tile by tile. The movement is clipped at the screen's edges (on a tablet, at the
  column's), so nothing ever makes the page scroll. The first set of a game, and a set after
  "Change", still fade in as today. If the next set has to wait (rare: the bucket is short),
  the old set stays dimmed under the spinner as today and slides out once the new one is there.
  Tapping "No →" again mid-slide starts the next slide at once from where things are.
- Reduce Motion: no turn, pop or slide (the new photo or set simply replaces the old); the ✕
  still fades in and out (opacity only).
- Accessible names: a tile is "Photo 3: tap to swap it" (as today); the count is announced
  nowhere else, since the card shows it.

### 3.5 "The last one", one rule for the badge and the bubble

The player whose Yes would start the game: the room has at least two players, exactly one of
them has not said Yes, everyone else is connected and said Yes (so their Yes would make
`everyoneSaidYes` true), and the lobby is the phase. That player is "the last one"
(`lastToSayYes(view)`, `web/js/nudge.js`). The badge shows on their phone, the bubble on the
others' (if the last one is connected). "Play without photos" by the last one counts only
when someone else already has photos in (otherwise the game could not start, "Someone needs
photos." stays).

### 3.6 The 3-2-1 with its loading (the "Get ready" screen goes)

- From the moment everyone said Yes (the room's `countdown` phase), the cover shows the film
  leader at once, as a screen of its own on the page's background (opaque, as today): the
  frame, the crosshairs, the two circles, the weave. It stays on screen, unchanged, through
  the loading and the 3, 2, 1, so nothing jumps.
- **While the start loads** (photos still on their way, the game being dealt, the first photo
  coming to every phone; usually under a second, a few seconds on a slow network):
  - no number;
  - the hand goes round and round, one turn a second (the same hand as the count's);
  - the outer circle fills clockwise from the top in white (`ink`), as far as the group's
    photos are in: while uploads run, the share the "Sending photos" bar showed (the others by
    whether theirs are in, this phone by how much of its upload is sent, `sendShare`); once
    every photo is in (the deal and the first photo), full. It moves in small steps as the
    upload goes on (whole percents), never backwards within one start.
  - It is felt nowhere (no vibration while loading).
- **Then the 3**: the number, its hand and its shadow (as today), cut in on the room's second
  (`countdown.js`), felt as today; the loading's hand and ring go with the cut (a cut is the
  leader's language: the number changes with a cut too). 2, 1, the white frame, the first
  photo: unchanged.
- Black and white: the leader's own colours only (`ink`, `ink/40`, `raised`, `line`); no
  yellow, no spinner, no words.
- Reduce Motion: the hand is hidden while loading (as during the count); the ring still fills.
- Accessible: the ring is a progress bar named "Getting the photos ready".

### 3.7 The rating

- **What players see**: the phone's own rating window (Apple's "Enjoying Who Shot It? Tap a
  star to rate it on the App Store.", Google's rating card). Its words cannot be changed, and
  no screen of ours comes before it (Apple's guideline 5.6.1 disallows custom review prompts;
  Google's in-app review guidelines forbid asking anything before the card, changing it or
  triggering it from a button). No notification is involved.
- **When**: at the end of a close game (the winner less than `SCORING.max` points, one fast
  right answer, ahead of second place, so the last photo could have flipped it; a tie counts),
  from the group's 3rd game in its room on (`view.games` at least 3), every phone still on
  that game's results asks at the same moment: 2 s after the podium's story has ended (with
  Reduce Motion, or when this phone did not play the story: 2 s after the end screen
  appeared). A phone that left the results (tapped "Play again", left the game) does not ask.
  Each phone asks at most once per app start. Whether the window really shows is the phone's
  decision: Apple at most 3 times a year per person (and never in TestFlight), Google its own
  quota; we are never told.
- **Why not more**: the app is never told whether the window appeared or whether someone
  rated, and the phone's limit alone does not spread the asks over time (all of Apple's three
  could come in one evening). The group's 3rd game plus a close finish is the moment players
  are happiest and not busy, and "once per app start" keeps one evening to one ask.
- Nothing is saved on the phone and nothing new is sent to the server; the server only counts
  the group's games in its room (`room.games`), which the view carries.
- **The quiet link** (in "How to play", for whoever wants to rate on their own, which both
  stores allow because the player taps it): below "Got it", above the legal link, two quiet
  lines:
  - "⭐ Rate the game" (the link, underlined like the legal link), opening the store's own
    review page: on the iPhone the App Store's write-review page
    (`STORES.ios` + `?action=write-review`, Apple's documented way), on Android the Google Play
    page (once `STORES.android` is set; until then the link is not shown on Android);
  - under it, muted: "It helps other groups find it."
  - Why this wording: it is a link, not a prompt (no question, no pop, no animation, not
    shown at any moment by itself, only inside the sheet the player opened), it states the
    one true reason a rating matters for a free game without ads (other groups discover it
    through ratings), it offers nothing in return (both stores forbid incentives) and it
    asks nothing about the player's mood (no "Do you like it?" gating). Developers who keep a
    calm rating link in a settings or info screen instead of prompting (for example Marco
    Arment's Overcast) report it works without annoying anyone, and Apple's own StoreKit
    sample uses exactly this write-review link for a review the person starts.

## 4. Decisions about the mechanisms

- **The confirmation travels with the Yes** (`sending {upload, start: true}`), not as a
  second message: two messages would be two events, and between them the room would broadcast
  a lobby where everyone said Yes, so every phone would flash "Is everyone here?" for a moment.
  The room applies it only if, after this Yes, everyone said Yes and the room would otherwise
  ask (`startMode` not 'auto'): then it starts as if the group had answered Yes (one function,
  `confirmStart`, which the `start {go: true}` handler uses too). A confirmed Yes that is not
  the last one (someone joined while the sheet was open) changes nothing beyond the Yes.
  A player who sends `start: true` without the sheet gains nothing an older app could not do
  (older apps' plain Yes plus anyone's "Yes, start" on the room-wide question).
- **The room-wide question stays, as the fallback only** (round 4): when everyone said Yes in
  a first game without a confirmed last Yes (the last one left or was removed, two Yes at the
  same instant, or the last Yes came from an app before 1.0.9), the room asks every phone as
  today (`ASK` in `views/overlays.js`, `start {go}`), and after "No, wait" "Start now" appears.
  "Start now" now shows only while it can start the game (everyone said Yes): in the normal
  flow the START badge does its job, and a greyed button next to it would compete. In a room
  where the group answered "No, wait" ('button'), the last one's START Yes starts at once
  without the sheet: the group already said who it was waiting for.
- **The group's game count** (`room.games`): how many games this group started in this room
  (incremented when a game starts, at the end of its 3-2-1, so a start that falls back to the
  lobby does not count; back to 0 when the room is left empty, with `start` 'ask'). The view
  carries it (`view.games`). It feeds the bubble's seed (another order each game), which is why
  it comes with the bubble, and the rating ("from the group's 3rd game"). It is kept next to `start` rather than replacing it:
  'auto' also means "the group confirmed its first start", which can happen before any game
  started. A room saved before it existed counts from 0.
- **One module for the last one**: `web/js/nudge.js` (new) holds `lastToSayYes(view)` (who
  it is: their phone gets the START badge, the others the bubble), the bubble's rhythm
  (`NUDGE`: 5 s on screen, 0.35 s to leave, 10 s away), its lines (`NUDGE_LINES`) and the
  small bubbles' calls (`NUDGE_CALLS`), the tracker (`nudgeTrack`: since when the current last
  one is the last one on this phone, and how many appearances that player had in this lobby, so
  a wait that is interrupted and comes back goes on with the order instead of repeating it),
  the appearance at a moment (`nudgeAt`: which line, from which side, in or leaving, or
  nothing), the bulge (`bulgeRows`: rows and each character's size, as data) and `shortName`.
  All of that is pure and unit-tested; its one DOM function, `fitNudge`, sizes the line to its
  bubble right after the paint, as `ui.syncRow` brings a row's arrow up to date. The lobby's
  view turns the data into markup (the `nudge` part); `main.js` keeps the tracker
  (`session.nudge`), passes the appearance to the view through `context()` and calls
  `fitNudge` when the part changed. The lines are user-facing text outside a view: acceptable
  because they are data the view renders, as the settings' help texts in `config.js` are.
- **A seeded order** for the lines, the sides and the chorus: `seeded(text)` in
  `web/shared/random.js` (a small hash of the text feeding a small pseudo-random generator), so
  every phone shuffles them alike from the same seed (the room's code, the group's game count,
  the player's id). Documented there as never for anything that must not be guessed.
- **The rhythm comes from the paint loop**: an appearance starts, leaves and ends on the four
  repaints a second `main.js` already runs (`nudgeAt` is asked at each), so the bubble adds no
  timer; its entrance, the chorus and its exit are CSS animations of the markup painted for
  that moment (`data-out` while it leaves).
- **The swap's card** reuses the tile's two-face mechanism (`from`, `settleLater`), now
  "old photo turns away, number card with the new photo popping on it", and the set's slide
  keeps the old set's previews alive while it slides out (`photos.leaving`), released when the
  slide ends, exactly as the swap keeps its old face (`from`). No new timers beyond the
  existing `settleLater`.
- **The loading is a part of the leader**: the cover's layout is the leader's frame (static),
  and its parts are the loading hand (`hand`), the ring (`ring`) and the number (`count`), so
  the ring's steps never restart the spinning hand and the frame's weave never restarts.
- **The rating's rule in one module**: `web/js/review.js` (new): `closeGame(final)`, the rule
  `rateNow({ games, final })`, `RATING` (from the 3rd game, 2 s after the story) and the
  once-per-app-start memory (in this page's memory only). `main.js` `startPodium` schedules
  it; `phone.js` `askForRating` calls the native method. UI pacing constants stay in their
  modules (as `BANNER_DELAY_MS`, `PODIUM`, the board's steps do); `config.js` keeps what the
  app and the server must agree on.
- **Native**: one method `requestReview` on the app's own plugin, twins (AGENTS.md §6): Swift
  with StoreKit (`AppStore.requestReview(in:)` from iOS 16, `SKStoreReviewController` for iOS
  15.4 and 15.x, on the main thread, with the foreground-active window scene; it resolves in
  every case), Java with Google's Play In-App Review (`ReviewManagerFactory`,
  `requestReviewFlow`, then `launchReviewFlow`; it resolves in every case and never reports
  an error to the player). No plugin package.
- **Google's library is the one documented exception** to the licence rule (approved in round
  2): `com.google.android.play:review`, pinned exactly in `android/app/build.gradle`, under
  Google's Play Core Software Development Kit Terms of Service (shipping allowed, changing
  not). Recorded in AGENTS.md §6 and §7, `docs/apps.md` and the legal page's licences.
- **The store link** comes from `STORES` (`config.js`), the one home of the store pages, via a
  small helper `reviewLink(platform)` next to it; the platform from `phone.js` `platform()`
  (Capacitor's `getPlatform`).
- **The ice blue** is a theme token: `--color-ice: #c2e6ff` in the `@theme` of
  `styles/app.css`, used as `bg-ice`. No colour value anywhere else.

## 5. Security, performance and legal check

**Security**
- Nothing new leaves a phone. The bubble shows names every phone already has, escaped. The
  `start` flag is a boolean the room honours only when it completes everyone's Yes; it cannot
  start a game anyone could not already start. `view.games` is a small count, no secret.
- The rating sends nothing; the native windows are the stores' own. The write-review link is
  a plain store URL.

**Performance** (AGENTS.md "Never freeze a room")
- The room: one boolean on `sending`, one `everyoneSaidYes` (a loop over at most 16 players,
  synchronous, holds nothing across a wait) when it is set, and one counter. No new message,
  no new broadcast, no timer. A confirmed last Yes even saves a broadcast (no lobby view with
  everyone ready before the start).
- The phones: the bubble is a handful of elements (the big bubble, its rays, up to three small
  ones) moved by CSS animations of `transform`, `translate`, `rotate`, `scale` and `opacity`
  (the graphics chip runs them); its markup (at most about 60 small spans) is painted when an
  appearance starts and when it leaves, nothing in between, and its line is fitted once per
  appearance (two reads of one element). No `backdrop-filter`, no SVG filter, no animated
  shadow, gradient or mask. The slide moves two grids with one transform each. The swap
  animates one tile. The ring repaints its own small part at most once per whole percent. The
  four repaints a second compare strings as today; the appearance is computed from the view,
  the tracker and the time (no loop beyond 16 players).
- Text in 3D: the tilt stays small (≤ 8°), so the bitmap of the text stays sharp.

**Legal**
- Apple 5.6.1 and 3.2.2(x), Google's in-app review guidelines and its ratings policy: the
  system windows only, at a natural break after a finished game, never from a button, no
  question before, no incentive; the quiet link is user-started and allowed by both
  (Apple documents the write-review link for exactly this).
- Privacy: nothing new is stored on the phone (the "Saved on your phone" list stays) and
  nothing new is sent. The privacy policy's "The app stores" item gets one sentence: if the
  app shows Apple's or Google's rating window and you rate, your rating goes to them under
  their policies and is public in the store; the app sends nothing for it. Privacy labels
  (`store/ios_listing.js`, `store/android_listing.js`) and the iOS privacy manifest do not
  change (StoreKit's review request is no required-reason API; the review is collected by the
  store, not by the app).
- Licences: Google's review library is listed on the legal page, whose "Open-source licences"
  becomes "Licences" (one item is not open source). The page's date (`LEGAL.version`) moves to
  the day of that commit.
- The bubble's lines tease without insulting; names with blocked words are "Player" already.

## 6. Compatibility with installed apps, and the deploy

- **New server, apps 1.0.5 to 1.0.8** (`asks`): their Yes never carries `start`, so in a
  first game the room asks every phone as today, and they answer as today. Later games start
  by themselves. Unchanged for them. They ignore `view.games`.
- **New server, app 1.0.2** (no `asks`): the room starts by itself, as today.
- **Mixed rooms**: a 1.0.9 phone that is last confirms on its own phone; if an older phone is
  last, everyone (1.0.9 phones too) gets the room-wide question. Both paths start the game.
- **New app, old server**: the old server drops `start` from `sending`, so a 1.0.9 phone's
  confirmed Yes would be followed by the room-wide question. That is why the server is
  deployed first (Operator handoff, 1).
- **Saved rooms** (up to 24 h): `start` keeps its values; a missing `games` counts from 0.
- 1.0.9 keeps sending `asks: true` (it can still show the room-wide question).

## 7. Affected areas (map)

| Area | Files |
|---|---|
| Room rules and shape | `src/game/rules.js`, `src/game/state.js`, `src/game/view.js`, `src/room.js` (`CLIENT_EVENTS.sending`), `web/shared/api.js` (message docs) |
| The last one, the bubble's rules | `web/js/nudge.js` (new), `web/shared/random.js` (`seeded`) |
| Lobby | `web/js/views/lobby.js`, `web/js/views/sheets.js`, `web/js/views/overlays.js`, `web/js/main.js`, `web/js/store.js`, `web/js/photos.js` |
| The 3-2-1 | `web/js/views/overlays.js`, `web/js/main.js` (`paintStart`, `sendShare`), `web/js/countdown.js` (header), `drafts/countdown_animations/app.js` (its call of `startScreen`) |
| Rating | `web/js/review.js` (new), `web/js/phone.js`, `web/js/main.js` (`startPodium`), `web/js/podium.js` (resolves when its story ends), `web/js/views/sheets.js`, `web/shared/config.js` (`reviewLink`), `ios/App/App/PhonePlugin.swift`, `android/app/src/main/java/com/hivedone/whoshotit/PhonePlugin.java`, `android/app/build.gradle` |
| Design | `styles/app.css` (`--color-ice`, animations and utilities for the badge, the bubble, the swap card, the slide, the loading hand and ring) |
| Legal and stores | `web/legal.html`, `web/vendor/google-play-review.LICENSE.txt` (new), `store/ios_listing.js` (How to test, review notes, What's New), `store/images/` (redrawn) |
| Docs | `README.md`, `AGENTS.md` (§6, §7 exception), `docs/apps.md`, `docs/guides/demo-players.md`, `drafts/README.md` (the countdown entry), this plan |
| Tests | `test/unit/rules.test.js`, `view.test.js`, `nudge.test.js` (new), `review.test.js` (new), `random.test.js` (new), `test/helpers.js`, `test/integration/room.test.js`, `test/e2e/game.spec.js`, `speed.spec.js`, `fake-phone.js`, `scripts/helpers/store-images.mjs`, `scripts/helpers/demo-players.mjs` |

## 8. Commits

Every commit: read AGENTS.md, the README and every file it changes as a whole first; keep the
header comments true (two passes, AGENTS.md §2: search the names and the claims, including
wrapped phrases, in `src/`, `web/`, `store/`, `test/`, `scripts/`, `docs/`, `drafts/`, the
README and AGENTS.md); run `./scripts/test.sh`; no comment cites this plan or a commit number.

The bubble comes first among the app's changes (round 5: "Start with the bubble commits"); it
brings the group's game count with it, which its order needs. The other commits follow in the
order they depend on each other.

### Commit 1: docs: the plan, with the bubble's draft

Status: done (25 November 2026).

This file, and `drafts/bubble_animations` (the three variations the bubble was chosen from,
kept as they were shown: round 5 asked not to change them yet) with its row in
`drafts/README.md`. Committed before commit 2 (`docs/prompts/implement.md`, step 7).

### Commit 2: lobby: the bubble for the last one; the room counts the group's games

Status: done (25 November 2026; its decisions in section 11).

Read: `src/game/rules.js`, `src/game/state.js`, `src/game/view.js`, `test/unit/rules.test.js`,
`test/unit/view.test.js`, `test/helpers.js`, `web/js/views/lobby.js`, `web/js/main.js`,
`web/js/store.js`, `web/js/render.js`, `web/js/ui.js`, `web/shared/random.js`,
`styles/app.css`, `test/e2e/game.spec.js`, `test/e2e/bots.js`, and the draft it comes from
(`drafts/bubble_animations/comic.js`, `bulge.js`, `stage.js`, `style.css`).

- The room counts the group's games (section 4): `newRoom` has `games: 0`; `startGame` adds
  one; the empty room (`settle`) sets it back to 0 (and counts as needing the reset while it is
  not 0); `view.games`; the room shape and the rules' header say so. Tests: `rules.test.js`
  (counted at the end of the 3-2-1, not at a start that fell back to the lobby; 0 again once
  the room was empty), `view.test.js` (`games` in the view).
- `random.js`: `seeded(text)` (a string hash, FNV-1a, feeding a small generator, mulberry32):
  numbers from 0 to 1, the same for the same text on every phone; for choices every phone must
  make alike, never for anything that must not be guessed. `test/unit/random.test.js` (new):
  the same text gives the same numbers and another text others, all from 0 to 1; a shuffle
  with it keeps every item.
- `web/js/nudge.js` (new; section 4): `lastToSayYes`, `NUDGE`, `NUDGE_LINES`, `NUDGE_CALLS`,
  `shortName`, `bulgeRows`, `nudgeTrack`, `nudgeAt`, `fitNudge`. Header per AGENTS.md §2
  (purpose, the rhythm, why the lines live here, what is pure and what touches the page).
- `main.js`: every view and every paint brings the tracker up to date
  (`session.nudge = nudgeTrack(session.nudge, view, now)`); `context()` passes the appearance
  (`nudgeAt`); `render` calls `fitNudge` when the `nudge` part changed, in the same task as the
  paint. Header: the bubble.
- `store.js`: `session.nudge` documented.
- `views/lobby.js`: the photo area becomes `relative`, with the `nudge` part over it
  (`pointer-events-none`, a size container); the bubble's markup from the appearance: the big
  bubble (its rays, its tail, its dots, its gleam, the rows of letter spans, `aria-hidden`,
  `data-cell="line"`), the small bubbles (`data-cell="call"`), the side as `--from`,
  `data-out` while it leaves, and the plain line for screen readers (`role="status"`). Header:
  the bubble.
- `styles/app.css`: utilities for the bubble (`bulge`, `nudge-bubble`, `nudge-call`,
  `nudge-dots`, `nudge-gleam`, `nudge-tail`, `nudge-rays`, `nudge-text`) and its moves
  (`nudge-in`, `nudge-out`, `nudge-rock`, `nudge-boing`, `nudge-turn`, `nudge-call-in`,
  `nudge-wiggle`), each with a comment saying its moment. Only theme colours, mixed with
  `color-mix` where a shade is needed.
- Tests:
  - `test/unit/nudge.test.js`: `lastToSayYes` (two players; three with one not ready; someone
    else offline but ready, so nobody is last; the last one offline is still the last one; one
    player alone); `nudgeAt` (in at once, leaving at 5 s, nothing from 5.35 s, the next at 15 s
    with another line; none on the last one's own phone, on results, out of the lobby, or for
    an offline last one); the order is the same for the same room, game and player and another
    for the next game; `nudgeTrack` (starts, keeps its start while the same player is last,
    ends, goes on with the order when they become the last one again); `bulgeRows` (rows of at
    most 13, balanced, a 16-letter name broken after its hyphen, emoji and accents whole,
    factors symmetric and largest in the middle); `shortName`; every line has `{name}` once
    and none talks to the player.
  - `game.spec.js`: with Ann and Ben ready and Cleo not, the bubble naming Cleo shows on Ann's
    and Ben's phones at once and not on Cleo's; it goes when Ben taps Change and comes back
    when he says Yes again; the game then starts as before. On the smallest phone it stays
    inside the screen and the page does not scroll.
- Pass 2: the lobby's, `main.js`'s, `store.js`'s, `state.js`'s, `view.js`'s and `rules.js`'s
  headers; README (`web/js/`: `nudge.js`).

### Commit 3: room: the last Yes can come confirmed

Status: done (25 November 2026; its decisions in section 11).

Read: `src/game/rules.js`, `src/game/state.js`, `src/game/view.js`, `src/room.js`,
`web/shared/api.js`, `test/unit/rules.test.js`, `test/unit/view.test.js`, `test/helpers.js`,
`test/integration/room.test.js`.

- `rules.js`:
  - `sending(room, { playerId, upload, start })`: as today, then, when `start` is true,
    `confirmStart(room)`. Its docstring: "Yes, start" on the last phone; why it travels with
    the Yes (section 4).
  - `confirmStart(room)` (new, one place): when `startMode(room)` is not 'auto' and everyone
    said Yes, `room.start = 'auto'`. The `start` handler's `go` branch calls it.
  - Header: the first game's rule rewritten: the last Yes asks on its own phone and comes
    confirmed; the room asks every phone only when everyone said Yes without that (the last one
    left or was removed, two at once, an older app), then "Start now" after a No.
- `state.js`: the room shape documents the new meaning of `start` 'ask' (only the fallback
  asks everyone).
- `room.js`: `sending: (m) => ({ upload: m.upload, start: m.start === true })`.
- `api.js`: `sending {upload, start}` documented (`start`: the last Yes, confirmed on its
  phone).
- Tests:
  - `rules.test.js`: in a first game (`asks` apps), the last Yes with `start` begins the start
    at once (phase 'countdown', `start` 'auto'); the same Yes without `start` makes the room
    ask (as today); a Yes with `start` that is not the last one changes only the Yes (still
    'ask'; the next plain last Yes then asks); after "No, wait" ('button') the last Yes with
    `start` begins. Keep the existing ask and "Start now" tests (the fallback).
  - `room.test.js` (integration, over the real socket): a confirmed last Yes leads to a
    `countdown` view with no lobby view in between in which `start.everyone` is true.
  - `test/helpers.js`: the `asks` doc line names the fallback.

### Commit 4: lobby: Yes left with the START stamp for the last one, "No →" in ice, "Is everyone here?" on the last phone

Status: done (25 November 2026; its decisions in section 11).

Read: `web/js/views/lobby.js`, `views/sheets.js`, `views/overlays.js`, `web/js/main.js`,
`web/js/nudge.js`, `web/js/store.js`, `web/js/ui.js`, `styles/app.css`,
`test/e2e/game.spec.js`, `speed.spec.js`, `bots.js`, `scripts/helpers/store-images.mjs`,
`scripts/helpers/demo-players.mjs`, `docs/guides/demo-players.md`, `drafts/README.md`.

- `styles/app.css`: `--color-ice: #c2e6ff; /* "No →" in the lobby, with navy text */` in the
  signals or surfaces group of the theme (wherever it reads best, with its comment).
  `--animate-stamp`'s comment names the START badge too. `--animate-breathe`'s comment: "Start
  now", the fallback.
- `web/js/nudge.js`: `startsWith(view, photos)` next to `lastToSayYes` (whether this phone's
  Yes, or its "Play without photos", would start the game), unit-tested.
- `views/lobby.js` `actions(view)`: the Yes button first, then "No →". The Yes carries
  `data-start` and the badge markup when this phone is the last one (`data-cell="start"`,
  section 3.1, `animate-stamp`, `motion-reduce:animate-none`), its aria-label "Yes, start the
  game"; "No →" with `bg-ice text-navy`, aria-label "No, other photos". `startNow`: only when
  `view.start.mode` is 'button' and `view.start.everyone`. Header: the new start, the buttons.
- `views/sheets.js`: the 'start' sheet (section 3.2), "Yes, start" as `data-act="yesstart"`,
  "No, wait" as `data-act="close"`; header lists it.
- `views/overlays.js`: `ASK` and `startScreen`'s header: the room-wide question is the
  fallback now (when, why).
- `main.js`:
  - `readyWith(count, blobsOf, start = false)`: sends `{ type: 'sending', upload, start }`.
  - One entry for both ways of saying Yes, `sayYes(kind)` ('yes' or 'guess'): the last one in
    a first game (`view.start.mode` 'ask') opens the 'start' sheet and remembers the kind
    (`session.confirm`); otherwise it says Yes, with `start` when this phone is the last one
    (`startsWith`). Actions `yes` and `guess` call it; `yesstart` closes the sheet and says
    the remembered Yes with `start: true` (the count is computed then, from the latest view).
  - `onMessage`: the 'start' sheet closes when this phone is no longer the last one, the
    room's mode is no longer 'ask', or the lobby is over.
  - `hello`'s docstring: `asks` now means "can show the room-wide question (the fallback)".
- `store.js`: `session.sheet` lists 'start'; `session.confirm` documented.
- Tests and scripts:
  - `game.spec.js`: `choosePhotos` taps `[data-act="yes"]` (the last one's Yes has another
    name now). The main test: Cleo is last, her Yes shows the START badge, the others' do not;
    her tap opens "Is everyone here?" on her phone only (the other phones show no cover);
    "No, wait" closes it and nothing starts; "Yes, start" starts (the leader's cover on every
    phone). The badge does not change the Yes button's height; Yes is left of "No →". The
    fallback in its own test: in a first game, the host removes the one player who is not
    ready, so every phone asks "Is everyone here?"; "No, wait" shows "Start now" (enabled, all
    said Yes); "Change" hides it; Yes again shows it; "Start now" starts. The smallest-phone
    test checks the sheet fits instead of the cover.
  - `speed.spec.js`: the last Yes is the START Yes; `asked` becomes "the START Yes until its
    sheet" (local: a limit of about 300 ms, with its reason), `yes` stays "Yes, start until the
    3-2-1".
  - `store-images.mjs`: taps `[data-act="yes"]`, then "Yes, start" in the sheet.
  - `demo-players.mjs`: a test player taps Yes only while its Yes has no START badge
    (`[data-act="yes"]:not([data-start])`), so the start stays the person's; header and
    comment say so. `docs/guides/demo-players.md`: say Yes after the test players; your Yes
    then carries START and asks "Is everyone here?": tap "Yes, start".
- Pass 2: README ("A game's life"), the lobby's, overlays', `rules.js`'s, `main.js`'s headers.

### Commit 5: photo choice: the swap shows what is left and pops the new photo, "No →" slides the set, the hint line goes

Status: done (25 November 2026; its decisions in section 11).

Read: `web/js/photos.js`, `views/lobby.js`, `main.js` (actions `no`, `swap`, `HOLDS.tile`),
`styles/app.css`, `views/sheets.js` (`helpBody`), `test/e2e/game.spec.js` (the choosing test,
`gridEdges`, `fits`), `speed.spec.js` (`TILE`, `no`).

- `photos.js`:
  - `swap`: the new entry gets `anim: 'swap'`, `from` (the old preview, as today) and `left`
    (the swaps left after this one). A refusal records `photos.refused = { index, n, none }`
    (`n` grows with every refusal so each one is a new element; `none`: no swaps left, which
    shows the ✕). `photos.refusals` goes.
  - `roll`: when a set is on screen (not the first set, not after "Change"), the new set's
    tiles get `anim: 'slide'` and the old set's previews stay as `photos.leaving` until the
    slide is done; a newer roll releases a still leaving set at once. `ENTRANCE_MS` gets
    `swap` (about 800) and `slide` (about 450); `settleLater` also drops `photos.leaving`.
  - Header: the swap's card, the slide, why the old previews stay loaded.
- `views/lobby.js`:
  - `swapsLine` goes; in the choosing state the `note` part is empty.
  - `chosenTiles`: a swapping tile is three layers on a turning card: the old photo (front,
    turning away), and on the back (pre-turned, `rotate-y-180`) the number card (`bg-raised`,
    the number in yellow or the ✕ in red, `data-cell="count"`) with the new photo over it,
    popping after the turn. A refused tile carries the shake and the ✕ layer
    (`data-cell="nope"`, `data-try` with `n`). The tile is a size container, so the number is
    sized to it.
  - `grid`: while a set slides, the leaving grid (same layout, `data-cell="leaving"`,
    `aria-hidden`) over the new one, each with its animation; the pick part's wrapper clips
    sideways at the screen's edges (spans the screen's width with negative margins and padding
    so the grid keeps its place).
  - Header: the hint line is gone, the swap, the refusal, the slide.
- `styles/app.css`: the animations, each with a comment saying its moment: the card turn
  (`swap-turn`, replaces `flip`), the number's bump (reuse `bump`, comment updated), the new
  photo's pop (`swap-pop`, delayed so it starts after the turn), the ✕ flash (`nope`, opacity
  only), the set out to the right and in from the left with its snap (`set-out`, `set-in`, the
  app's spring easing). A utility for the number's size relative to its tile (container
  units, for example `font-size: 50cqmin`). `--animate-jiggle`'s comment: a refused swap.
  `--animate-deal` stays for the first set.
- `views/sheets.js` `helpBody`: after the 📷 step, `['👆', 'Tap a photo to swap just that
  one. Hold it to see it big.']`.
- `main.js`: the `swap` action's docstring (the card, the ✕); `no` unchanged in behaviour.
- Tests:
  - `game.spec.js`, the choosing test rewritten: no "Tap to swap" line anywhere; a tap shows
    the count 2 on that tile, then the new photo (the count gone within a second); then 1;
    the third swap shows ✕; a fourth tap is refused: the ✕ layer appears, the photo stays,
    `felt` is LIGHT, LIGHT, LIGHT, MEDIUM, MEDIUM; "No →" (by role name) shows a new set at
    once, the leaving grid is gone within a second, and the next tap shows 2 again.
    `gridEdges` with Yes on the left.
  - `speed.spec.js`: "No →" by name; the `no` limit still holds (the slide does not delay the
    new set's tiles being there).
- Pass 2: README ("Photos": the swap and hold still exist), `config.js` comment on
  `swapsPerSet`, `phone.js` and `main.js` vibration notes (a swap's turn, its refusal).

### Commit 6: the 3-2-1 loads in its film leader; "Get ready" goes

Status: done (25 November 2026; its decisions in section 11).

Read: `views/overlays.js`, `main.js` (`paintStart`, `sendShare`, `render`),
`web/js/countdown.js`, `styles/app.css`, `drafts/countdown_animations/app.js` and its
`draft.js`, `test/e2e/game.spec.js` (the cover checks), `speed.spec.js` (the cover
observation), `test/unit/countdown.test.js`.

- `views/overlays.js` `startScreen(view, leftMs, share)`: in the countdown phase, the layout
  is the leader's frame (crosshairs, the two circles, the weave; static), with three parts:
  `ring` (while loading: the outer circle drawn again in `ink` with a dash of `share`,
  `role="progressbar"` named "Getting the photos ready", `aria-valuenow`), `hand` (while
  loading: the hand turning endlessly, hidden with Reduce Motion) and `count` (from the 3:
  today's per-number markup, the shadow, the one-turn hand and the number with `data-count`).
  `leader(n)` becomes that per-number markup; the "Get ready" words, the spinner and the
  progress bar go. Header rewritten.
- `main.js`: `startShare(v)`: while `view.uploads` says photos are still on their way,
  `sendShare(v)`; else 1 (dealt, the first photo coming); rounded to whole percents.
  `paintStart` feels a number only when the `count` part changed and holds a number; header
  lines on "Get ready" and "the start shows how far" updated.
- `styles/app.css`: `--animate-hand-loop: turn 1s linear infinite` (the loading hand); the
  leader's comment names the loading; `bg-page`'s comment (the 3-2-1 and its loading).
- `countdown.js`: header: the leader also loads; `onTheClock` moves only one-shot animations,
  so the loading hand is never touched (already true: it keeps endless ones as they are).
- `drafts/countdown_animations/app.js`: its call of `startScreen` passes the new arguments;
  `drafts/README.md`'s countdown entry stays true.
- Tests: `game.spec.js`: on the first start, before the first number, the cover shows the
  progress bar "Getting the photos ready" and no text "Get ready"; the cover stays opaque;
  `felt` unchanged (the loading is not felt). `speed.spec.js`: the cover's numbers are still
  "3 2 1"; a new measure "Yes, start until the leader is on screen" with a limit and its
  reason.
- Pass 2: README ("A game's life": *Get ready*; "Photos": "the start shows how far it is only
  if the group waits for it" becomes the leader's ring), `rules.js` header wording if it says
  "Get ready".

### Commit 7: rating: the phone's own window after a close game from the group's 3rd game, and a quiet link

Status: done (25 November 2026; its decisions in section 11).

Read: `web/js/phone.js`, `main.js` (`startPodium`), `web/js/podium.js`, `views/end.js`,
`views/sheets.js`, `web/shared/config.js` (`STORES`, `SCORING`), `ios/App/App/PhonePlugin.swift`,
`android/app/src/main/java/com/hivedone/whoshotit/PhonePlugin.java`,
`android/app/build.gradle`, `android/variables.gradle`, `web/legal.html`,
`web/vendor/capacitor.LICENSE.txt`, `docs/apps.md`, AGENTS.md §6 and §7,
`test/e2e/fake-phone.js`, `test/unit/config.test.js`. Web-search the current stable version
of `com.google.android.play:review` and Apple's `AppStore.requestReview` first (AGENTS.md §4).

- Native twins (same method, same answer):
  - Swift: `import StoreKit`; `requestReview` in `pluginMethods`; on the main thread, the
    foreground-active `UIWindowScene`; iOS 16 and newer `AppStore.requestReview(in:)`, else
    `SKStoreReviewController.requestReview(in:)`; always `call.resolve()`. Header: what it does
    and that the system decides whether it shows.
  - Java: `requestReview`: `ReviewManagerFactory.create(getContext())`, `requestReviewFlow()`,
    on success `launchReviewFlow(getActivity(), info)`; resolve when done or failed, never
    reject. Header likewise.
  - `android/app/build.gradle`: `implementation "com.google.android.play:review:<exact>"`
    with a comment (the store's own rating window, Google's terms, the approved exception).
- `phone.js`: `askForRating()` (fire and forget, nothing without the plugin) and
  `platform()`; header lists both; the twins' method documented here.
- `config.js`: `reviewLink(platform)` next to `STORES` (iPhone: the write-review page; Android:
  the Play page once set; else null), its docstring.
- `web/js/review.js` (new): `RATING` (`fromGame` 3, `afterMs` 2000), `closeGame(final)`
  (two players at least, the lead under `SCORING.max`), `rateNow({ games, final })`, the
  once-per-app-start memory; header with the rules, the stores' limits and why nothing is
  saved.
- `podium.js`: `playPodium` resolves when its story has ended (or the screen was left).
- `main.js` `startPodium`: once per end screen (`session.shown`), schedules the check: after
  the story plus `RATING.afterMs` (or `afterMs` without the story); the check runs only if
  the same end screen is still shown (phase 'end' or this phone on results, same code) and
  `rateNow` holds; then `askForRating()`. Header: the rating moment.
- `views/sheets.js` `helpBody`: the two quiet lines (section 3.7), only when
  `reviewLink(platform())` gives a link.
- Legal and licences: `web/legal.html` "The app stores" sentence; "Open-source licences"
  becomes "Licences", with Google Play In-App Review (Android app; Google's Play Core Software
  Development Kit Terms of Service; link to the notice file); the page's date and
  `LEGAL.version`. `web/vendor/google-play-review.LICENSE.txt`: name, version, source, the
  terms' link, that it ships only in the Android app.
- AGENTS.md §6 (dependency management: native code from the pinned `@capacitor/*` packages
  and, on Android, Google's pinned review library) and §7 (the one approved exception);
  `docs/apps.md` (the native table, "no Google services" except the review library, how to
  test the rating on each phone).
- Tests: `test/unit/review.test.js` (close or not, ties, one player, the 3rd game, once per
  app start); `fake-phone.js`: `requestReview` counts in `window.rated`, `getPlatform`
  returns 'ios'; `game.spec.js`: the first game's end does not ask (`rated` 0 after the
  podium plus a moment); "How to play" shows "⭐ Rate the game" with the write-review link.
  `config.test.js` keeps the legal date in step.
- Pass 2: `main.js` header (the moments the app reacts to), README (`web/js/` list: `nudge.js`,
  `review.js`), `docs/apps.md`.

### Commit 8: release: version 1.0.9, store texts and images, docs

Status: planned.

- `package.json` and `APP.version` to 1.0.9 (the test keeps them equal).
- `store/ios_listing.js`: What's New (the start with the START stamp, the bubble, the photo
  choice, the 3-2-1's loading; in plain words, no dashes); How to test (the last Yes with
  START and its "Is everyone here?"); review note 1 (the recording shows the new start, or say
  what differs); the screenshots redrawn with `--store-images` (the photo choice).
- README: everything above that is still not true after commits 2 to 7 (one more pass).
- `docs/guides/demo-players.md`: the review recording steps for the new start.
- This plan: status line, Operator handoff (what is done, what is left), the decision log.
- **Try on both phones** (`./scripts/dev.sh ios|android`, with the test players), what the
  browser tests cannot feel: the START stamp landing and the Yes moving left; the sheet;
  "No →"'s slide (snappy, no flicker, nothing scrolls); a swap's turn, number and pop, the ✕
  on the last swap and on a refused tap, with the vibrations; the bubble (pop, float, the
  bulging fat text, translucency over photos, a 16-letter name, the iPhone SE size and an
  iPad); the 3-2-1's loading on a slow network (Low Data Mode or a throttled Wi-Fi) and the
  cut to the 3; Reduce Motion on each; the rating window on an iPhone build from Xcode after
  a close 3rd game; on Android that the call completes silently.

## 9. Things to pay attention to

- **Overflow**: the bubble's line is fitted after the paint to the photo area (never a
  guessed font size); test the longest line with a 16-letter name of wide letters on 360 x 640
  and on a tablet (the root font is 125% there). Its slide starts outside the screen's edge and
  is clipped by the page (`#app` clips), never making it scroll; its rock and pop stay inside
  the screen (the bubble at most 80% wide); the small bubbles sit inside the screen. The slide
  clips sideways; the swap's pop (1.06) stays inside the tile's gap. The START badge must not
  change the Yes button's height (check in a test) and must fit next to "Yes" in a half-width
  button on a 360 px phone with the tablet scale too.
- **Repaints**: a part that holds an endless animation (the bubble's float, the loading hand)
  must not change its markup for unrelated reasons, or the animation restarts: keep changing
  values (the ring's share, the line) in their own parts or out of that markup.
- **One painter, one action table**: no listeners on elements, no second render path; the
  bubble's timing comes through `context()` and the existing four repaints a second.
- **Same on every phone**: the bubble's line, side and chorus from the shared seed; its
  rhythm from each phone's own start of the wait (the views reach the phones together, so they
  agree within the network's delay). The rating at the same moment from the same end screen.
- **Reduce Motion** on every new animation (`motion-reduce:`), except opacity-only fades.
- **Colours** only by token (`bg-ice`, `text-navy`, `bg-yellow`, `text-red`, `stroke-ink`);
  `color-mix` on tokens in `styles/app.css` for the bubble's edge and extrude; no colour value
  in a view or an inline style (`test/unit/config.test.js` checks).
- **No long dash** anywhere, no short dash as a pause in what users read; ranges as "1 to 4".
- **Texts**: "No →", "START", "Is everyone here?", "Anyone who joins later plays without
  photos.", "Yes, start", "No, wait", the bubble's lines and calls, "⭐ Rate the game", "It
  helps other groups find it.", "Tap a photo to swap just that one. Hold it to see it big."
  exactly as written here.
- **Tests find elements** by role, name, text or `data-*` (`data-start`, `data-cell="start"`,
  `count`, `nope`, `leaving`, `data-part="nudge"`, `data-cell="line"` and `call`, the bubble's
  status line, the progress bar's name), never by a class.
- **The parallel work** on the leaderboard (`web/js/board.js`, `TIMING.boardStoryMs`): build on
  it, do not undo it; `main.js` and `styles/app.css` change in both.

## 10. Not part of this plan (ask before doing)

- A rating prompt of our own, a "Do you like the app?" question, a feedback form, a
  notification, or saving anything on the phone for the rating.
- A vibration for the START stamp, the bubble or the slide.
- Pointing the bubble's tail at the player's own pill, or a bubble that follows a scrolled row.
- Changing the number of swaps per set, or the swap and hold behaviour itself.
- New fonts, translations, or the bubble on the last player's own phone.
- Removing the room-wide "Is everyone here?" or `asks` (still needed as the fallback and by
  apps 1.0.5 to 1.0.8).

## 11. Decision log

(Filled in while implementing: dated entries, what was decided, how and why.)

**25 November 2026, commit 2 (the bubble; the room counts the group's games)**

- **The bulge is milder than section 3.3 says**: 0.82 to 1.18 across a row of the big
  bubble's line (0.88 to 1.12 on a small bubble's call), not 0.76 to 1.24. In the app's
  screenshots a capital at a row's end, next to the bigger letters of the row's middle, read
  as a small letter ("cleo is" for "Cleo is"); the milder curve still shows the ball.
- **The slide-in takes 0.75 s** (section 3.3: about 0.6 s), with a gentler start: at 0.6 s the
  bubble was almost in place after 150 ms and the slide from the side did not read as one.
- **The tails**: one small SVG per tail whose units are the bubble's outline (three units are
  the border: the big bubble's tail is 1.75rem wide for its 0.19rem outline, a small bubble's
  1.4rem for 0.15rem), drawn as a bent wedge whose base runs through the middle of the
  outline's band, its fill reaching one unit into the bubble so it covers the outline under
  its base, its two sides stroked with the outline's width. It always sits on a straight part
  of the edge (`max(2rem, 22%)` on the big bubble with its 1.75rem corners, `max(1rem, 18%)`
  on the pills), so it meets the edge cleanly at every width. A first, smaller tail (1.375rem)
  looked like a fin.
- **The rhythm** is one cycle of 15 s from the start of an appearance: 5 s on screen, then
  0.35 s leaving and the rest of the 10 s away. It comes from the four paints a second
  (`nudgeAt` asked at each), so an appearance starts or leaves up to a quarter second late,
  and the bubble has no timer of its own.
- **Leaving is one more paint** with the exit's classes; the rock and the turning rays would
  start over there, so the leaving markup resumes them 5 s into their cycle
  (`animation-delay: -5000ms`, from `NUDGE.showMs`), and they do not jump.
- **The small bubbles' callers** are the other players including this phone's own (the table
  is talking), in the appearance's shared random order; with two players there is one.
- **Sizes**: the line fits 78% of the photo area's width and 36% of its height, at most 2rem
  (`FIT` in `nudge.js`, measured once per paint of the part); the big bubble is at least
  13rem wide, so the two small bubbles below it never meet even for a short line ("Classic
  Cleo."). The bubble lies over the photos only (the `pick` part), not over "✓ Ready" and
  "Change", its middle at 40% of their height.
- **The order**: each run through the 14 lines is a fresh shuffle (seeded with the wait and
  the run's number), so a very long wait never repeats the same sequence.
- **`seeded` (web/shared/random.js) repeats the generator of `seededRandom` in
  `test/helpers.js`** (mulberry32, there seeded by a number). The test helper stays as it is,
  so every existing test keeps its random sequence.
- **The full-table e2e test** names its third phone "Cleopatra-Marlen" (the longest name a
  player can have), so the bubble's longest case is checked on the smallest phone, and every
  other screen of that test now shows a 16-letter name too.

**25 November 2026, commit 3 (the last Yes can come confirmed)**

- **One function decides that the group said Yes** (`confirmStart` in `rules.js`): the
  confirmed last Yes (`sending` with `start`) and the room-wide question's Yes or "Start now"
  (`start {go}`) both call it, so both obey the same rule (only while everyone said Yes and
  the room would otherwise ask).
- **The flag counts only on the message that makes the player say Yes**: a repeated
  `sending` with the same id is ignored as a whole (as before), so it cannot start a game
  later on its own.
- **No new capability flag in the hello**: the room needs no word from the app beyond the
  flag on its Yes; an app that never sends it (every installed one) gets the room-wide
  question exactly as before, and the room keeps honouring `asks` for it.

**25 November 2026, commit 4 (Yes with START, "No →" in ice, "Is everyone here?" on the last phone)**

- **One entry for both ways of saying Yes** (`sayYes` in `main.js`, 'yes' or 'guess'):
  "Play without photos" by the last player asks too when it would start the game (someone
  else has photos in); when nobody has any, it is a plain Yes (it cannot start the game).
- **The START Yes's accessible name is "Yes, start the game"**: screen readers say what it
  does. A test or script that looks for the sheet's "Yes, start" must match it exactly, or it
  finds both buttons (the store images script and the tests do).
- **The badge keeps the button's height**: one pixel of padding and no line gap make it a
  little lower than the button's text line (52 px with or without it, checked in the e2e
  test).
- **"No, wait" on the last phone sends nothing**: the player stays not ready and keeps START;
  the sheet closes by itself when that Yes would no longer start the game (`onMessage`).
- **After "No, wait" on the room-wide question** ('button'), the last player's START Yes starts
  the game without the sheet: the group already said it is waiting for someone (the e2e
  fallback test plays this).
- **The test players never take the Yes stamped START** (`demo-players.mjs`), so the start and
  its question stay the person's; the guide says to say Yes after them, or Change and Yes
  again.
- **The store images script** waits for the last phone's START before it taps it, so it always
  takes the sheet's path (not the room-wide question).
- **`gridEdges`** (the e2e check that the photos line up with the buttons) now measures from
  Yes's left edge to "No →"'s right edge.

**25 November 2026, commit 5 (the swap shows what is left, "No →" slides the set, the hint line goes)**

- **Both sets of the slide move on one timing** (0.42 s, overshooting a hair): the old one
  slides out to the right, the new one comes in right behind it, so they travel as one strip.
  A first try let the old set start slowly (ease-in, 0.3 s) while the new one started fast,
  and the two overlapped for a moment.
- **The screen clips sideways** (`overflow-x-clip` on the lobby's screen) instead of a wrapper
  spanning the screen with negative margins: on a phone the set leaves at the screen's edge,
  on a tablet at the column's, nothing scrolls, and the players' glow stays inside its
  padding. The bubble's slide is clipped the same way.
- **Which sets slide**: every set replacing one on screen ("No →", and a new photo count or
  "Which photos"). The first set of a game fades in, also after "Play again" (the last game's
  set is spent, not on screen).
- **A refused tap on a tile still turning** (within 0.85 s of its swap) is only felt: the tile
  finishes its turn, so no shake and no ✕ cut into it. Otherwise a refusal shakes the tile,
  and with no swap left a red ✕ fades in and out over it.
- **Reduce Motion**: a swap shows the new photo at once (no turn, no number); the ✕ of a
  refusal still fades in and out (opacity only); "No →" swaps the set without a slide.
- **Sizes and timings**: the number on the card is 48% of the tile's shorter side
  (`tile-count`, a container size), so it reads on a 5 x 5 grid as on a 2 x 2; a swap's
  entrance ends after 0.85 s, a slide's after 0.5 s (`ENTRANCE_MS`), when the tile or the grid
  is painted plain.

**25 November 2026, `main` merged into the branch (before commit 6)**

- The leaderboard and streak work reached `main` while this branch was under way. It was
  merged into the branch before commit 6 rather than at the very end: commit 7 changes
  `podium.js` and `main.js` `startPodium`, which that work had changed too, and commit 8
  releases both pieces together. Three conflicts (the README's and the drafts' lists, the
  vibrations in `main.js`'s header), each keeping both sides; the full suite passed before the
  merge was committed.

**25 November 2026, commit 6 (the 3-2-1 loads in its film leader)**

- **The leader's frame is the cover's layout**, its parts the loading's ring and hand and the
  number (`views/overlays.js`): the frame and its weave stay untouched from the start's first
  moment to the first photo; the ring's whole-percent steps repaint only the ring. The two
  outline circles moved from the number's drawing into the frame; they are drawn above the
  number's shadow (later in the page, all positioned), exactly as before.
- **The ring is the outer circle drawn again in white**, one unit of the 80-unit drawing wide
  (3 px on a phone), so it covers the 2 px outline under it and reads as filling; its dash
  is computed from the circle's own length, like the number's shadow, rather than relying on
  `pathLength`.
- **`startShare`** (main.js) replaces `sendShare`: the share of the group's photos in while
  uploads run, and 1 (full) once every photo is in. It only grows within one start without
  any memory: the count of players stays the same (anyone leaving or unreadying ends the
  start), and this phone's upload counts as sent until the room counts it in.
- **The slow-phone e2e test** now also holds back Ben's upload: the start waits in its leader
  with the ring at half (Ann's photos in), no words, no number; once the upload goes through
  the 3 cuts in and the ring is gone. The main test's vibrations stay the three numbers and
  the first photo's tap (the loading is felt nowhere).
- **The speed test measures "Yes, start" until the leader** (limit 1 s: one message's round
  trip at a phone network's delay, then a paint). A first run on a heavily loaded computer
  (other sessions' servers and tests, a load average above 20) measured 1048 ms, with every
  other wait slow too ("No" failed its own limit there); the limit stays well above a healthy
  run, like the others.
- **The countdown draft's "Film leader, in the app"** shows the loading during its lead (the
  ring filling over 0.3 s) instead of an empty cover, so it plays what the app plays.

**25 November 2026, commit 7 (the rating)**

- **Google's library is `com.google.android.play:review` 2.0.2** (the current release, from
  Google's Maven repository). It brings three Google pieces with it: Play Core Common 2.0.4
  (the same Play Core terms) and Google Play services Basement 18.4.0 and Tasks 18.2.0 (the
  Android Software Development Kit License). All four are named in
  `web/vendor/google-play-review.LICENSE.txt` and in one line on the legal page. Google states
  that these Play services libraries collect no end-user data, and that a rating given in the
  card is the player's own review on Google Play; so the Data safety answers, the iPhone's
  privacy label and the privacy manifest stay as they are, and the privacy policy gets the one
  sentence planned ("The app stores").
- **A close game needs a winner with points**: a 0 to 0 end is a tie by the numbers but no
  moment players are happy about.
- **The rule reads the view of the moment it asks** (2 s after the story), and asks only while
  that phone still shows the same end screen (the same room, phase 'end' or still on its
  results); the wait holds nothing.
- **The review link is computed once at the start** (`RATE_LINK` in main.js, from
  `reviewLink(platform())`) and reaches "How to play" through `context()`, so the views never
  ask the phone anything.
- **Swift**: `Task { @MainActor in … }` around StoreKit's call, which is main-actor isolated;
  `AppStore.requestReview(in:)` from iOS 16, `SKStoreReviewController.requestReview(in:)` on
  15.4 to 15.x, the scene the player sees. **Java**: the review flow's ticket, then the card;
  every path resolves, also without Google Play.
- **Both twins were compiled on this Mac** (Xcode 26.6 for the iPhone simulator, Gradle's Java
  compile with the library downloaded); nothing native has an automated test, so the window
  itself is tried by hand (Operator handoff, to do 3).
- **No end-to-end test plays three games** to reach a rating (over a minute more per run): the
  unit tests hold the rule (close, the 3rd game, once per app start), the e2e test that a first
  game never asks, and that "How to play" shows the App Store's write-review link (the fake
  phone says it is an iPhone).
- **"How to play" on the smallest phone** now scrolls a little (the legal link sits just below
  the fold inside the sheet), as a long sheet does; on usual phones everything fits.
- **The legal page's date moves to 25 November 2026** (`LEGAL.version`); 1.0.9 shows the terms
  once more anyway, as every new version does.
