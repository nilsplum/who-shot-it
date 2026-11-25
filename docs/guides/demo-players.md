# Playing alone with test players (operator guide)

A game needs at least two players. The test players are computer opponents that join a real
game from this computer, so one person with one phone can try the app, show it to someone,
check a new TestFlight build or record a video for App Review. They are Leo 🐼, Zoe 🦄,
Max 🐸, Ida 🐙 and more, as many as the game holds (16 players, you included). Each one is
the real app page in a browser on this computer with drawn sample pictures
(`scripts/helpers/demo-photos.mjs`), so they never upload anybody's real photos. The
script is `scripts/helpers/demo-players.mjs`.

**Needs:** this computer with the repo, `./scripts/setup.sh` run once (it installs the test
browser), and internet. The computer must stay awake while they play.

## Play a game with them

1. On your phone: open the app, tap **Create game**, then **Start game**. The four letter
   code appears at the top of the lobby.
2. On the computer, with that code:

       node scripts/helpers/demo-players.mjs ABCD 3

   Or ask Claude: "Get me the test users: ABCD". They look for the game on the staging
   server (where a TestFlight build plays) and then on production (the App Store app), and
   join wherever it is.
3. After a few seconds they appear in the lobby, one after the other. Once the last one is
   in, they wait **half a minute** before they get ready, so there is time to show the
   lobby, for example to remove one (tap the name, then **Remove**).
4. Choose your photos (**Continue**), and say **Yes** after the test players are ready:
   the test players never take the Yes that would start the game, so yours then says
   **START**, and in the first game it asks **Is everyone here?**: tap **Yes, start**. (If you
   said Yes before them, tap **Change**, then **Yes** again once they are ready.)
5. In each round they tap a random player a few seconds after the photo appears.
6. After the podium they stay **two minutes**; when you tap **Play again** they join the next
   game. Otherwise they leave by themselves.

They also leave when you remove them or when the game is gone. Ctrl+C on the computer ends
them all at once.

**Options:** the number of players (1 to 15, default 2) and the server: `staging` or
`production` to look only there, or an address (default: staging, then production). Everyone
already in the game counts: with 15 they fill the game up to its 16 players, and the script
says when the game is full. With the local server of `./scripts/dev.sh android` or `ios`, add
its address: `node scripts/helpers/demo-players.mjs ABCD 3 http://localhost:8787`.

## Record the video for App Review

App Review asks new apps for a screen recording made on a real iPhone ("Guideline 2.1,
Information Needed"). It must start with opening the app and show the typical use,
including reporting a photo and removing a player. What worked:

1. **Before recording:** turn on a Focus mode (Do Not Disturb), so no banners or system
   messages appear in the video. Delete the app and install it again from TestFlight, so
   the terms screen shows: it appears only at the first start after installing.
2. Start the screen recording (Control Center, the round button), then open the app from
   the home screen.
3. Accept the terms, enter a name, **Create game**, keep **Classic**, **Start game**.
4. Start the test players with the code (above). Keep recording; waiting time can be cut.
5. Remove one of them (tap the name, **Remove**).
6. **Continue**, allow access to all photos, tap **No →** once. Only your own photos show up
   and only Apple sees the video: tap **No →** until harmless ones come. Once the test
   players are ready, tap **Yes** (it says **START**); the app asks **Is everyone here?**,
   tap **Yes, start**.
7. In the first round tap the flag on the photo, then **Delete photo**.
8. Play until the podium has revealed all three places and **Play again** appears (about
   ten seconds), then stop the recording.
9. Send it to the Mac (Photos, Share, AirDrop). Cut out waiting time and anything that is
   not the app, and save the result as `store/ios_review-video.mp4` (git-ignored: it shows
   your phone and your photos).
10. `node scripts/helpers/app-store.mjs submit` attaches it and sends the version to App
    Review. The notes Apple reads are in `store/ios_listing.js` (`reviewNotes`): when the
    video shows something different (for example what was cut), the first note says so.

## When something does not work

| You see | Why, and what to do |
|---|---|
| "No game with this code" in the script's output | A typo, or the game is closed. Start a new game and use its code. |
| "This game is full" in the script's output | The game already holds 16 players, everyone counted. Those who joined before it play as usual. |
| They never appear in the lobby | The computer is offline, or the test browser is missing: run `./scripts/setup.sh`. |
| They join but never get ready | Wait the half minute. If it takes longer, Ctrl+C and start them again. |
| The game does not start | Someone is not ready yet: the lobby says who ("Waiting on …"). |
