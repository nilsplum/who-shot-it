# Game feel overhaul: layout, flag, timer, photos ahead, leaderboard, podium (plan)

Status: planned on 22 November 2026, implemented on the branch `feat/game-feel-overhaul`
(all thirteen commits, each with `docs/prompts/implement.md`, its decisions in the decision
log at the end) and merged into `main` on 22 November 2026. Not deployed and not released
yet: both are the operator's (Operator handoff, below).

## Operator handoff

What only the operator can do, and the decisions made while implementing that are worth
knowing. Kept up to date with every commit.

**To do by hand, in this order**
1. Try version 1.0.3 on a real iPhone and a real Android phone (`./scripts/dev.sh ios` and
   `android`); the browser tests cannot show or feel these:
   - The photo choice: the native `photo` call got `download` in commit 8 (AGENTS.md §5;
     the iPhone app compiles with it in the simulator). With "Optimize iPhone Storage" on,
     photos kept only in iCloud get their big version once they are on screen (watch that
     "Yes" still uploads them), and the bucket's first minute of work after the app starts
     should not make the phone warm or slow.
   - The vibrations (commit 6): the 3-2-1 is a 120 ms buzz, a new photo a light tap, a
     right guess one pulse, a wrong one two, FINAL ROUND a thud, the podium's ticks (the
     winner's drumroll speeds up to about ten light taps a second).
   - The animations (commits 10 to 12), which the phones' web views draw themselves: the
     swap's card turn, the leaderboard's overtaking, FINAL ROUND falling onto the screen,
     the podium's reveal.
   - The screen edges (commit 9): screens start right under the status bar and end right
     above the home indicator (checked in the iPhone simulator); also look on the iPad.
2. Deploy the server before releasing the apps (`./scripts/deploy.sh`, a critical command;
   section 6): the new server keeps the installed apps working.
3. Record the App Review video again with the 1.0.3 TestFlight build before sending it to
   review (`docs/guides/demo-players.md`, "Record the video for App Review"): the review
   notes say the attached video was made with the build under review, and the flag, the
   leaderboard and the end of a game look different now. If it is not needed any more
   (the app is already live), change the first review note in `store/ios_listing.js` instead.
4. Release the apps: `./scripts/release-apps.sh --submit` (the version is 1.0.3 already,
   the store screenshots are redrawn). Then in the Play Console by hand
   (`docs/guides/android.md`): the description (its party and privacy bullets changed) and
   the four redrawn screenshots `store/images/android_screenshot-{1,2,3,5}-*.png`;
   `./scripts/dev.sh store` shows both pages to copy from.

**Decisions worth knowing** (details in the decision log, section 12)
- Your own AGENTS.md edit got into my commit 2 by mistake (`git add -A`); I took it out
  again before you committed it yourself. From then on only the files of a commit are
  staged.
- Commit 3 fixed a bug found on the way: every tap in the settings sheet threw its list
  back to the top.
- Commit 4: the bar's jitter came from re-anchoring the countdown on every snapshot; the
  app now keeps one countdown per timer (`web/js/clock.js`).
- Commit 5: the flagger's report sheet is this phone's own intent; the room's views only
  close it. If the flagger's app restarts during a flag, the photo is deleted after 15 s
  (your rule), the sheet does not come back.
- Commit 5: two icons were Emoji 14 (🫥), an empty box on Android 10 to 12; replaced, and a
  test now fails on any emoji newer than Emoji 12.0 in the app.
- Commit 6: the browser tests check that each vibration is played at its moment; how it
  feels only a real phone shows (to do 1).
- Commit 7: the privacy policy now says that once a game starts, the players' apps load its
  photos in the background and keep them in memory only until each one's round is over.
  The page's date stays 22 November 2026 (it is today's); version 1.0.3 asks everyone to
  accept the terms again anyway. AGENTS.md's two photo rules say the same (a photo is
  reachable from its game's 3-2-1 until its round is over, only if it is played, never
  stored on the phones).
- Commit 8: the big versions prepared ahead come only from photos stored on the phone
  (no iCloud download); a photo kept only in iCloud downloads once it is on screen.
- Commits 9 and 10: no in-game screen scrolls as a page with 16 players on 360 x 640,
  375 x 667 and 393 x 852 (a browser test plays such a game on three phones with 13 light
  bots); commit 8 had briefly let the photos overlap No and Yes on small phones (fixed in
  commit 9).
- Commit 11: after the last photo the game goes from its reveal straight to the podium (no
  last leaderboard); the board before it shows only "Results are hidden" and FINAL ROUND.
- Commits 11 and 12: an animation that tells a story (the leaderboard, FINAL ROUND, the
  podium) is played over the screen's final state, once per screen, so a repaint or a
  reconnect never restarts or cuts it. AGENTS.md's rendering rule now says so.
- Commit 12: the podium takes about 6 s before "Play again" appears (third place, then
  second, then the winner). The App Review recording guide says to wait for it.
- Commit 13: the store description's player count is built from the config (like its
  links), the report sentences say what the flag does now, What's New describes 1.0.3,
  and the leaderboard screenshot is taken right after its animation, so its timer bar
  still shows (it was almost empty with the first try).

This plan turns the operator's request of 22 November 2026, and his answers to the
questions that followed, into thirteen commits. For every change it says what it is, why,
where it goes, how it looks and behaves for the players, and what to watch out for. The
repo's rules apply throughout: `AGENTS.md` (centralisation, one source of truth, never
freeze a room, documentation first, two passes, the dash rule) and the README.

## 1. What the operator asked for

### 1.1 The original request (verbatim)

> I want you to carefully plan and implement the following changes step by step. Start by reading almost every part of this codebase, gathering a lot of context and architectural and implementation details to see the bigger picture. Remember, when changing one thing in one area of the codebase, you always have to also look in the entire mechanism to figure out if everything makes sense and to recheck if everything is uniform, simple, and robust, with everything having a single source of truth across the board. Everything should be anti-fragile and robust in its inner nature. It shoula be well abstracted and make sense across the board. This is mostly the case but there are always some problem areas.
>
> Follow these steps:
> Step 1: Read all the files that are remotely relevant in general of this codebase and to the specific areas, mechansis and so on.
>
> Step 2: Go through all the things I described and analyse the code and behaviour more critically. Evaluate and trace, visualise and thikn about the states and logic and mechaisms and how everything looks like to the user, as well as how everything is architected and connected and if that all makes sense.
>
> Step 3: Ask questions if needed. Always explain the context and bigger picture and practical implications for the user, like how he practically experiences the changes. Explain it well, concisely, and practically. IF there is anything unclear, or much left for interpretation in my points below, I want you to make sure I can decide perfectly and see all the context and user-facing and architectual implications.
>
> Step 4: Write a planning document that is commit sequenced and contains my oringinal instructinos first. Then it should each contain all the context and implemen tational details needed to understand what to change, why, what to take into acconut, what to pay attention to, how it should look and behave to the user, how to ensure everything is uniform, centralised, well architected, robust, and thus anti-fragile and so on. The planning doucment should also correct other architectual or logical weaknesses, frgailities or other things that are simply not complying with the agents.md guidelines. If such a change could have real sideeffects or is a bigger architecutal change, use the ask question tool in step 3 in order to ask me for my approval, explaining practical implications and top level changes.
> Make sure that implementing the plan does not cause more fragilities. after implementing, the entire codebase should be stable and production ready, so I can publish it soon.
>
> Grid alignment and size:
> The image grid should be bigger, maxing out the width of the screen more. It should basically align with the left side of the No button and the right side of the Yes button. This should be achieved by simply rethinking the nesting of the divs and making sure that everything looks good and is responsive and makes sense without adding more complexity.
>
> Emoji section:
> Also, I have a problem with the furthest right emoji. I believe the gap to the right is not existant and its always or most of the times a little cut off the the right. Because of this, or maybe becaus of another reason, the animation does not fire from the position of the furthest right emoji but actually it fires from the center. For all other emojis this works fine, just not for the one at the end.
> Also, the arrow button of the emojis should just and simply scroll all the way to the right.
>
> Responsiveness, alignment and filling up the screen:
> The emojis should of course fall to the bottom if there is no „show again" is not there, to the bottom the space should also fill up more naturally.
> The same goes for the height of the screen which should also be better used. I noticed that on the ipda for example, there is a huge cap at the top of the screen to the x on the top left corner. Of course the header should align to the top, without any space so that content can fill the entire screen.
> I also have problems around the responsiveness when more players are spawned. Currently it leads to a weird visual state where the grid is big and some things are not visible anymore. More players means more rows, which means less space for the other items. Consider that and figure out a way to keep maximising the size of the grid here. Sometimes the app pages are scrollable even though they shouldnt be.
>
> Foto replacement
> Remove the x animation on the photos upon trying a fourth swap It should simply display a red x
>   instead of the grey "again" icon and a jiggeling animation when switching to "no swaps left". Also,
>   make the photo grid max out the area, reducing the gap size between the photos and making the grid
>   fill the space much better. Ensure everything is responsive and makes sense and work on any phone
>   dimensions. Dont make unrelated changes.
> Also, When flipping a photo, it should literally flip it on the screen. Make sure that this looks good and makes sense visually. Also, there should be a little haptic feedback here.
>
> Reveil now button:
> I dont know what the reveil now button is for but I believe it doesnt make sense and should be removed.
>
> Time-left bar:
> I dont know why the bar is slightly jumping when a new person selects an answer but this should of course not be the case and it should be resolved in the clean way that actually makes sense. It should all be very robust and well architected here and make truely sense. Look for similar issues like that. I dont like this kind of instabilities because it means the guidelines of simplicity, uniformity and anti-fragility are not in place.
> Also, the bar should switch to a blue/purple tone when all players did their guess and it now shows if the user was right or wrong. Because the bar is faster and symbolises the time users have to look up if they were right or wrong and not the time they have to choose. The timeleft bar should also be purple/blue in the results screen.
>
> Flag button and logic:
> Also, whenever a person clicks the flag button, the photo is immediately hidden to everyone else „someone flagged this image, waiting to continue" and the bar is paused. The person that flagged the image sees the same he sees now. When hits cancel, everything continues, when he hits delete, the photo should be cleanly removed from this round and the next photo should be processed in the same way all photos are processed. This logic should be carefully evaluated to ensure its implemented in a simple and robust way that reduces complexity and makes sure that everything is anti-fragile and makes complete sense across the board.
>
> Players not ready:
> players that are not active should not be greyed out or have this deactivated look. INstead they should have a dashed border. This should ensure users know they can remove them.
>
> Current Points Screen animation:
> Also, in the screen that shows the current points after each round of guessing, there should be a really nice animation where the player cards switch position in a nice way so that it's intuitive and can be easily watched what happens to the current state of the board. Like who overtakes whom and so on. And this should be done in a really simple and clever way to ensure it makes sense and is visually perfect. So take a step back on this issue and figure out how these things work usually, like from a logical standpoint, and how the UI should look like in order to make sense visually.
>
> 3, 2, 1 Screen:
> Currently it sits in front of a darkened background in which some grid state with no photos is displayed. This should be resolved in the way that actually makes sense. I believe the simplest thing is just to make the background entirely dark without any transparency. I am not sure if the other state in the backround makes architectual sense and is not just a weird artifact, keep it that way.
>
> Results screen:
> The results screen should be more attention grabbing with the first 3 places beeing reveiled one after another, with a jiggling tension animation and a little prickling haptic feedback. It should make the users always wait a bit so there is tension. Also, you can work with other animations like tension animations for the podium and so on. Figure out what the best way is to make the UX really have a lot of tension and prickling feel, while ensuring everyhting is simple and looks really nice. Come up with a really nice flow of this that makes user be hooked. Also, I believe the last results screen should be replaced by a „results are hidden:" in small and then a „FINAL ROUND" in big, that looks like its smashed onto the screen.
>
> Haptic feedback:
> So haptic feedback should be used but only in very few cases. For example, when user is right, it should have one haptical vibration, when he is wrong then it should vibrate two times. DUring the results animation, there should be also a little feedback but not so prominent. It should really enforce the UI and UX here, not beeing overshadowingly prominent. Another haptical feedback should be when the new image is shown, a short pulse. For the 3, 2, 1, ready, there should also be haptic feedback, a little longer this time.
>
> Loading feedback and latency reduction:
> Take a step back and look at the loading states and so on. Figure out how to improve the UX here, so whenever a loading process is active, it should show the actual loading animation or even a status bar with percent where possible. If needed, build a centralised integration for that. I can imagine just for the photo upload process after all players are ready, there should be a percentage bar to indicate the process of loading the images and preparing the game. This should all be very simple but actually make sense.
>
> Create a new branch in the main workingtree. Follow the guidelines of the AGENTS.md file.

### 1.2 The answers to the questions (verbatim, each with its question in short)

**What happens when the player who flagged a photo decides nothing?** "I want option 1,
delete in 15s. There should also be an "automatic deletion in 15s" in whiteish below the
delete photo text inside the delete button. The countdown should count down of course."
(Option 1: everyone waits at most that long, then the photo is deleted and the game goes
on, also when the flagger's phone goes offline.)

**"Reveal now":** "Remove everywhere".

**Which screen becomes "Results are hidden / FINAL ROUND"?** "I believe I mean option 1. I
figured that the last results screen spoils everything and should be replaced by the thing
I said.

Also, one unrelated addition: The "Tap a photo to swap it" should get much smaller and be
replaced by the text: "tap to swap (3 left), hold to preview". The icon should be removed.
I believe the "(n left)" should be green and number should get smaller when the user taps
and when its the last one, the number should be turn red and jiggle a bit around to make
sure the user sees that its related." (Option 1: the leaderboard after the second-to-last
photo becomes the FINAL ROUND screen; after the last photo's reveal the game goes straight
to the podium.)

**How the lobby shows many players:** "Today's pills, smaller", with the note: "I beleive
the current pills are fine, maybe they should just get smaller and arrange cleverly whern
there are more users in order to limit the space they take. Have in mind that there is no
real cap for the users per round. In reality, to be safe from ddos attacks, thre should be
a simple cap of 50 users, which should be cleanly implemented.."

**The player cap** (there is one already: 12, enforced by the room): "Raise it to 16 maybe,
or any amount that makes sense. There should by the way be many more emojis to select from
and it should be random every time its looked at to ensure that players choose truely
differnt emojis. IT should still be curated. Look at all emojis that are visible on both
andoroid and ios and curate all the ones that make sense as a players icon. When the user
first starts the app, the emoji should be selected by a random pick. It should be similarly
persistant as the name field. Make sure that everything makes sense here and everything is
simple and well thought through and architected in order to be simple, robust and comply
with teh other guidelines of the AGENTS.md file aswell."

**The swap counter** (green "(3 left)", counting down with a bounce, red and jiggling at 0
and on every refused tap, no cross on the photo): "Yes, red at 0 left (Recommended)".

**Where the dashed "waiting" border goes:** not answered (the answer field carried the next
request instead); this plan takes the recommended option, lobby pills and the "who has
answered" row (decision log).

**Big versions preloaded, buckets** (the answer that took the place of the previous one):
"ALso, I have one more change. There should be a preload functionality for the big images
aswell, loading always the big images 3 rows in the future (with propper termination of the
loading when the set is skipped). This should ensure that users get the highres version
when holding on an image to view it in full size. The full size should also be improving in
the standard way on android and ios, slowly getting a better resolution in the native way
until they are then accessed and move to priority queue which needs to be empty for the
other preloading to happen. This all should work uniformly and well centralised and
architected. Together with the other system, it should work more like buckets that fill up
constantly and not gamemode dependant. This should ensure that as soon as the app is
started and in ever screen or mode, the buckets are always filled up without a break. IT
should be very simple but robust and well architected across the board. Bucket size could
be 250 small images and of these, the first 100 in big size or so. They of course need to
be matched, so always the first of the 250 are in big size. Also, like I said they should
all gradually get higher resolution instead of jumping from non-existant to full
resolution. Everywhere the images are displayed, this should be the case. Also, I believe
that if some players are ready, their images can already get to the other users to reduce
the final upload time. I dont know whats currently in place and what not. Find a way to
make this be implemented in a way that makes perfect architectual sense without beeing
overcomplicated. It should be very simple and robust and centralised in the way that makes
absolute sense across the entire codebase. Make sure it also complies with our current
legal framework. Everything should uniform and reuse the same centralised logic and
mechanisms in the simple way that ensure the codebase stays clean and makes perfect sense
across the board."

**The bucket design** (one bucket of 250 checked previews, the first 100 also in big size,
one queue where whatever a player waits for goes first, big versions ahead only from photos
on the phone, everything stays on the phone until Yes): "Yes, 250 / 100 as designed
(Recommended)".

**Sending ready players' photos ahead:** "I believe it should be implemented as I said in my
previous response but maybe in a way that works well with the order of photos and players.
Figure out a way that makes sense so that in the end every user gets approximately the same
amount of his selected photos shown (so its equally distributed), while making sure that
whenever a user is ready, it can be already selected which photos of his selected will be
displayed and thus the preloading of this entire "selected" list fills up along the process
of the users getting ready and not all together in the end. The final state should be that
in most cases, when the last user gets ready, most of the selected photos are clear (of
course they should have a random order in the end). This means also that all these images
are probanly already cached on the users device, similarly to the current one. IN addition
to that there should be the priority queue active with the most high prio item which is the
current and the next 3 images.

Take a step back on this and figure out what actually makes sense and how this cluttered
mess can be implemented into a clean latency reducing architecutre that makes sense across
the board and that also is efficient for the server and so on. Really evaluate also what
makes sense for the game and what wouldnt make sense in order to ensure that there are no
predictable patterns or hacks or similar. Really evaluate the legal site aswell. I am
willing to change the privacy policy, it should just of course still comply with the
privacy policy rules of the contries we ship to (we ship internationally)."

**After the evaluation (photos flowing from each player's Yes would reveal every owner by
timing, and would put never-played photos on other phones):** "I want option 1, but it
should wait until the first 3 images are loaded into the users devices. During the game,
the result page should also always wait until this queue is full for every user. Also, I
just saw that there is a setting that ensures every gets more or less equal amounts of
images in the final game. This should not be the case. It should not be random aswell,
insteaad it should be restricted around a certain range of percentage with larger
deviations and always dependent of the total amount of images that have to be selected. it
could f.e range from 2-5 or similar. This is apart from the topic we are currently talking
about. Make sure that you process this afterwards." (Option 1: the server picks the played
photos and their random order when the 3-2-1 starts; every phone then loads them in play
order, the current one and the next 3 first.)

**Photo shares and the owner's own points:** "No, the fair random setting should stay, just
fair should get also more random, random should just be absolutely simply random. Fair
should be renamed to something more appropriate, like "a bit random" but in better. You can
think about the random title aswell. Dont bother me with questions regarding this.

by default, on their own photo, users should also get points of course, uniform with tapping
on the other photos, just slightly less maybe (-20%). There should however be a new setting
where this is explained in the "?" section. Figure out a way to make sense the settings
titles are intuitive and easy to understand here awell.

All setttings should of course make sense together in combination, keeping everything very
simple and well thought through and making perfect sense across the board."

## 2. Findings before planning

Everything below was traced in the code and, where it is about looks, measured: the real app
was played against `wrangler dev` with the test's fake photo library at five sizes (iPhone SE
375 x 667, Android 360 x 740, iPhone 15 393 x 852, Pro Max 430 x 932, iPad 820 x 1180) with
3 and with 10 players, and the iPhone app was run in the iPad and iPhone simulators with a
probe that printed the safe-area insets.

**The photo grid is narrower than No and Yes.** The grid is the largest square that fits its
box (`min(100cqw, 100cqh)` in `views/lobby.js`). On every phone whose free height is smaller
than its width the square is limited by the height: 231 px wide against 343 px of buttons on
the iPhone SE, 272 against 328 on a small Android, 144 against 343 on an SE with 10 players.
It is not a nesting problem: a square cannot be as wide as the buttons when the height is
missing. The fix is to let the tiles take the shape of the free space (section 4, Lobby).

**The rightmost emoji is cut off, and its reaction starts in the middle.** The reaction row
scrolls sideways and shows about five and a half buttons, so the button at the right edge is
always partly hidden (measured: the row ends at 339 px, the sixth button at 365 px). The
arrow scrolls by 80% of the width, which again ends on a half button. `floatEmoji`
(`web/js/ui.js`) starts a reaction at its button only when the button is fully visible and
otherwise from the bottom middle, so the half-visible button sends its emoji from the
middle. Root cause: a row that is not a whole number of buttons wide.

**The reactions on the reveal do not sit at the bottom.** The game screen's bottom area has a
fixed minimum height (`min-h-21`, 84 px) sized for "who has answered" plus the host's
"Reveal now"; the reactions row is 72 px, so it stops 12 px above the area's end, and the
area hangs from the top.

**The gap above ✕.** `.screen` adds 16 px to the safe-area inset instead of using the larger
of the two. Measured: the iPhone 17 reports 62 px (the Dynamic Island), so ✕ starts 78 px
down; the bottom gets 24 px plus 34 px. The iPad runs the iPhone-only app as an iPadOS 26
window with an iPhone SE sized page (375 x 667) and a 20 px inset: 36 px above ✕, and the
whole app behaves like an iPhone SE there (the `short:` layout).

**Pages that scroll.** Every in-game screen has the exact screen height (`h-dvh`) but content
with fixed minimum sizes, so with many players the content is taller than the screen and the
page scrolls: on an SE with 10 players the lobby is 716 px for 667 (the grid shrinks to
144 px, "Waiting on" falls off), the guessing screen 732 px (two columns of 64 px cards for 10
players push "who has answered" and the reactions below the fold, the photo shrinks to its
30% minimum). Capacitor already turns off iOS rubber-band scrolling
(`scrollView.bounces = false` in its bridge), so the scrolling is only this overflow.

**The player cap exists.** `LIMITS.maxPlayers` is 12; the room refuses the 13th player
(`CLOSE.full`, "This game is full."), and both the rules and the integration tests check it.

**Why the timer bar jumps.** Every snapshot from the room carries `left`, computed on the
server when it is sent, and the app re-anchors its countdown on it (`session.clock` in
`main.js`). Each answer broadcasts a new snapshot, and each arrives with a slightly different
network delay, so the bar moves back or forth by that difference. The countdown should only
be re-anchored when the timer itself changes. A second flaw: the app computes each timer's
total length itself (`frame()` in `main.js` repeats which phase runs how long), knowledge that
belongs to the server.

**Similar instabilities found.**
1. The leaderboard's slide restarts whenever its part is repainted (for example someone
   leaves during the board): the markup carries the start offsets, so a repaint puts every
   row back to its old place and animates again.
2. The report sheet is not tied to a photo. If the round moves on while it is open (time is
   up, someone else reported), "Delete photo" deletes the next photo.
3. The lobby's photo choice is one part: any change in it (the counter, uploading, access)
   repaints the whole grid, which would restart a running flip.
4. A game photo that fails to load leaves a spinner on the stage for the whole round.
5. Two reactions (🫣 and 🫠, Emoji 14) do not exist on Android 10 to 12, which the app
   supports (Android 10 is API 29): those phones show an empty box.
6. `docs/apps.md` lists only the App and Share plugins (Haptics is missing);
   `docs/guides/demo-players.md` still says the lobby shows "Waiting for …" (it says "Waiting
   on").

**Photos today.** The lobby keeps two sets of checked previews ready beyond the set on screen
(`LIMITS.setsAhead`), only while a lobby needs them, and prepares the big versions (1080 px,
for Yes and for holding a photo) only for the set on screen, one by one. Holding a photo
shows the big version if it is already there, else the preview, and never upgrades while
held. In the game each phone loads the round's photo and the next one (`round.next`), with an
`Image` and the HTTP cache (`Cache-Control: private, max-age=3600`, so a photo may stay in
the web view's disk cache for up to an hour). Only round 1 has to wait, after the 3-2-1.

**Sending photos from each player's Yes would break the game.** Photos that start flowing
right after Ann's Yes are Ann's: anyone who watches the app's traffic knows every owner
before the game starts (encryption does not help, the timing gives it away). It would also
put photos that are never played on other phones (Ann taps Change, someone leaves, the game
never starts), which data protection law counts against us (data minimisation). The
operator chose the clean alternative: the played photos and their order are fixed when the
3-2-1 starts, and from then on every phone loads them in play order.

**Owners score on their own photo.** Everyone answers, the owner included; the owner always
knows their photo and gets about full points. With equal shares that evens out; with
unequal shares it would not, hence the new "Own photo" setting (section 4).

## 3. The feel rules (how the new parts behave)

These rules apply to everything this plan adds or changes, on top of the grandmother rule of
the previous plan (big targets, colour plus shape, short words, calm motion, screen readers).

- **Never empty, never a jump.** Whatever waits shows what it waits for: a spinner when the
  time is unknown, a bar with a percentage when it is known. A photo is shown at the best
  quality the phone has and becomes sharper in place.
- **Cause, then effect.** Animations that explain a change show the reason first (points are
  added), then the result (rows overtake). Each moment is under a second; the podium's
  tension is the one deliberate exception.
- **Feel it only when it matters.** Five vibrations, each with one meaning (section 4,
  Haptics). Nothing else vibrates.
- **The screen fits.** No in-game screen scrolls as a page from 360 x 640 upward with 16
  players; what can grow (the leaderboard, the end ranking) scrolls inside its own area.
- **Reduce Motion** turns every new animation into an instant change, and the podium shows
  all places at once.

## 4. Decisions about the mechanisms

**One clock for the round, standing still while the round is held.** Today only "Show again"
pauses, and only the leaderboard's timer (`game.paused`, the remaining milliseconds). The new
flag needs the same for the answer time and the reveal. One mechanism for both: the round is
*held* while anyone holds "Show again" (`game.peeks`) or a flag is open (`game.flag`).
`settleClock` in `rules.js` derives the clock from that after every event: when the round
becomes held it notes `game.pausedAt = now`; when it is released it moves `room.deadline`
and `game.shownAt` by the time it stood still, so the answer time and the speed points stay
fair. While held, no round phase moves on by itself (show, reveal and board wait), answers
are still accepted but timed as at the pause, and `nextWake` ignores the frozen deadline
(the holds' own expiries wake the room). The view's `paused` is true in any phase while held,
`left` is the frozen remainder. A room saved by the previous server version may still carry
`game.paused` (milliseconds left on a held board): `settleClock` converts it once.

**The timer bar.** The view gains `total`, the full length of the running timer, next to
`left` and `paused` (one function `timer(room, now)` in `view.js` returns both, so they never
disagree); `main.js` stops repeating the lengths. The app anchors a timer once and keeps its
local deadline while the snapshots describe the same timer (same phase, round and paused
state) and agree within `TIMING.clockSlackMs` (500 ms); only a real change re-anchors it. So
answers no longer move the bar. The bar has two looks, chosen by the view as one complete
class list (`timerBar(kind)` in `ui.js`): *answer* (coral to yellow to green, the guessing
time) and *look* (blue to violet, the reveal and the leaderboard: time to look, not to
choose). Two new theme colours, `--color-blue` and `--color-violet`.

**The flag.** Tapping ⚑ sends `flag {round, on: true}`. The room notes `game.flag = { by,
until: now + TIMING.flagMs }` (15 s), which holds the round (clock above). Every other phone
replaces the photo with "⚑ Someone flagged this photo" and "Waiting…", and its cards are
disabled; the flagger keeps the photo with the report sheet over it, as today. The sheet's
red "Delete photo" carries a second, smaller, whitish line "Automatic deletion in 12 s",
counting down. Delete sends `report {round}`: the photo is deleted for everyone at once and
the game moves on exactly as today (while guessing: the next photo comes the usual way; on
the reveal: the photo disappears, the reveal and the leaderboard follow without it). Cancel
(the button, the dimmed backdrop or the back button) sends `flag {round, on: false}`: the
photo comes back and the clock runs on. When the 15 s pass, or the flagger leaves or is
removed, the room deletes the photo as if Delete was tapped (operator's choice: a flagged
photo never comes back by itself, and nobody can stop the game). One flag at a time; the
reporter stays anonymous to the others. The report sheet is now *derived from the room*: it
is open while the view says the flag is mine (`round.flag.mine`), so it can never outlive its
photo, and `report` and `flag` carry the round, which the room checks, so a late tap can never
hit the next photo. Apps before this version still send a plain `report`; it keeps working.
The flag is offered where ⚑ is today: on the photo while guessing and on the reveal.

**"Reveal now" goes, everywhere.** The button and the room's `resolve` event go (operator's
choice). In a game with "Time per photo: ∞", a player who never answers holds up the round
until the host removes them from the "who has answered" row; the help for ∞ already says "The
photo stays until everyone has answered". The rules tests that used `resolve` to end a round
let everyone answer or let the time run out instead.

**Haptics: one vocabulary.** `buzz(kind)` in `phone.js` plays one of five patterns from one
table, each with one meaning:

| Kind | Pattern | When |
|---|---|---|
| `tap` | one light impact | a new photo appears; a photo flips (swap); each tick of the podium's drumroll |
| `yes` | one medium impact | my guess was right |
| `no` | two medium impacts, 150 ms apart | my guess was wrong (or none); a refused swap |
| `count` | one 120 ms vibration | each number of the 3-2-1 |
| `land` | one heavy impact | a podium place is revealed; FINAL ROUND lands |

The room's transitions are felt in one function, `moments(previous, view)` in `main.js` (a
new photo when `show` starts, `yes`/`no` on the reveal); the 3-2-1 vibrates when its painted
number changes; the swap and the podium call `buzz` from their own steps. The Haptics plugin
is already in the app (`@capacitor/haptics` 8.0.2: `impact` LIGHT, MEDIUM, HEAVY and
`vibrate({ duration })` on both platforms).

**The 3-2-1.** It stays an overlay over the lobby (the countdown is part of the lobby phases,
and a change during it returns there at once). The overlay becomes opaque and uses the
page's own background, defined once as `bg-page` in `styles/app.css` (the body uses it too),
so it looks like a screen of its own instead of a veil over the grid.

**Game photos: dealt at the 3-2-1, loaded ahead in play order.** When everyone is ready and
the 3-2-1 starts, the room builds the game's plan (which photos are played, in which random
order) instead of when it ends; the players keep their photos until the 3-2-1 ends. Any
change during the 3-2-1 (someone unreadies, joins, leaves, is removed, goes offline, a
setting changes) returns to the lobby and drops the plan; the next 3-2-1 deals a fresh one.
From the 3-2-1 on, the view lists `upcoming`: the links of the current round's photo and
every later one, in play order (during the 3-2-1, all of them). The photo endpoint serves
exactly those (`isServablePhoto`), with `Cache-Control: no-store`. The app loads them with one
queue (`web/js/upcoming.js`): the photo on screen and the next `LIMITS.loadAhead` (3) first,
then the rest one by one; each one is a Blob in memory (an object URL), never on disk, and
is dropped as soon as it leaves `upcoming` (its round is over, it was deleted, the game
ended). Nothing in the list or its timing says whose a photo is: all of them become loadable
at the same moment, in a random order.

**The room waits for the photos.** A phone is *ready for round r* when it holds the photos
of rounds r to r + `LIMITS.readyAhead` (2), so three photos, or all that are left. It says so
with `loaded {round: r}` whenever that number grows (a cheap message, about one per round per
player, as today). Round 1's photo is shown once every connected phone is ready for round 1
(operator: "wait until the first 3 images are loaded"), at the latest after
`TIMING.loadMaxMs`; the leaderboard of round n ends only when its time is up and every
connected phone is ready for round n + 1 (operator: "the result page should also always wait
until this queue is full"), at the latest `TIMING.loadMaxMs` after its time. Offline phones
never hold anyone up. While the room waits, the view says `waiting: { ready, of }` (how many
of the connected phones are ready); the app shows a bar "Loading photos 72%" made of the
other phones' readiness plus its own exact progress, on the stage during `load` and in place
of the timer bar on a leaderboard that waits. Apps before this version say in their `hello`
nothing about loading ahead and report only the photo on screen: the room marks the players
that do (`hello {…, ahead: true}`, `player.ahead`) and waits for the others only for the photo
on screen, so a mixed room is never slowed down. `view.me.loaded` tells each app what the
room knows, so after a change of the plan (a player left and their later photos went) the
room forgets the marks and the apps simply report again.

**Photo buckets on the phone.** `photos.js` keeps one bucket of checked previews, filled to
`LIMITS.bucketPreviews` (250) whenever photo access is allowed: from the app's start, on every
screen, in and out of games. Each preview is checked once (screenshot mark and lines of text),
so the bucket works for every "Which photos" value; a set takes the first previews that fit
the room's value. The first `LIMITS.bucketFulls` (100) previews that fit the current value
(the room's, or this phone's own setting outside a game) also get their big version, from
photos on the phone only (the plugin's `photo` gets `download: false`); a photo kept only in
iCloud gets its big version when it is needed (on screen, held or Yes). One queue does all
phone work, built on one small primitive (`web/js/loader.js`, shared with the game photos):
a *now* lane for what a player waits for (the held photo, then the set on screen, then
previews for a set being dealt) and an *ahead* lane that runs only while the now lane has
nothing to do (big versions, then previews). No drops the skipped set's pending work.
Holding a photo shows its preview at once and its big version above it the moment it is
there. In the game the photos appear only when every phone has them (fairness), so they are
always shown in full at once. Everything stays on the phone until Yes.

**Photo mix and own photo.** The setting "Photo picks" becomes "Photo mix" (key `fair` kept,
so stored settings and older apps stay valid): *Balanced* (`true`, the default) draws each
player's number of photos at random between 60% and 140% of an equal share, rounded
(`LIMITS.balancedSpread` 0.4; 15 rounds and 4 players: 2 to 5 each), so counting never tells
whose photo is next; *Random* (`false`) is pure chance, as today. A new setting "Own photo"
(key `own`, the share of the points a right guess on your own photo earns): *Fewer points*
(80, the default: 20% fewer), *No points* (0), *Full points* (100). The answer still counts
as right (streak, the reveal's green card); only its points change, so tapping yourself stays
the natural thing to do and gives nobody away.

**Up to 16 players, about 140 avatars.** `LIMITS.maxPlayers` becomes 16. `EMOJIS` becomes a
curated list of about 140 single-character emojis that every supported phone shows (Unicode
Emoji 12.0 or older, for Android 10; iOS 15.4 has 14.0), each with its own look: animals,
friendly characters, food, nature, games and things. Left out: people and hands (skin tones,
genders), flags, anything religious, political, sexual, violent, alcohol or drug related, and
the emojis that already mean something in the app (the reactions, 👑 for the host, 📷 for
Show again). The avatar sheet shows them in a new random order every time it opens (kept while
it is open, so nothing jumps). A new player's avatar is a random pick and is saved like the
name (already the case in `store.js`). Colours stay one of 12 by emoji. `REACTIONS` replaces 🫣
and 🫠 (Emoji 14) with 😳 and 🤭.

**Screens that fit.** The screen padding becomes the larger of a small margin and the safe
area (`pt-safe`, `pb-safe` in `styles/app.css`, used by every screen and sheet). The guessing
screen sizes its cards by the number of options: up to 4 in two columns of big cards (as
today), 5 to 9 in three columns, 10 to 16 in four columns, compact (48 px), and a card too
narrow for avatar and name side by side stacks them (a container query on the card). The
bottom area has one fixed height, its content aligned to the bottom, so the reactions sit
where "Show again" and "Play again" sit on the other screens. The reaction row shows exactly
five whole buttons per page (ten reactions, two pages, snapping); the arrow scrolls all the
way to the end, and at the end back to the start; a reaction always rises from its button,
clamped to the visible row.

**The lobby.** Its choice is split into parts (`title`, `grid`, `note`, `actions`, `links`),
so a counter or a progress change never repaints the grid. The grid fills its box exactly:
`sqrt(n)` columns and rows that stretch, so it is always as wide as No and Yes; tiles get the
free space's shape (taller than wide on tall phones, wider on short ones), never taller than
4:3, gaps 4 px. Player pills keep their look, compact (smaller avatar and text) from 7
players on; a player the game waits for (not ready, or offline) has a dashed border instead
of being faded, a ready one a green border; the border is always 2 px, so nothing shifts. The
counter line is small: "Tap to swap (3 left), hold to preview", "(3 left)" in green, bouncing
as it counts down, red at "(0 left)" with a jiggle, and the jiggle again with the double
vibration on every refused tap; no cross on the photo any more. A swap flips the tile like a
card: the old photo turns away, the new one turns in (two faces, 0.5 s), with a `tap`.

**The leaderboard.** First the cause, then the effect: the rows stand in the old order with
the old totals (0.4 s), the totals count up with this round's points (0.7 s), then the rows
slide to their new places (0.7 s), the ones moving up lifted above the others (a little
bigger, a shadow) so everyone sees who overtakes whom, and the ranks change last with a small
pop. A repaint during or after the board shows the final state, never the start again
(`session.shown` remembers which entrance already ran). The board after the second-to-last
photo is the FINAL ROUND screen: "Results are hidden" small and muted, "FINAL ROUND" big and
yellow, smashed onto the screen (it falls in large and rotated, overshoots, settles, the
screen shakes once, `land`); the reactions, Show again and the host's Next stay. After the last
photo's reveal the room goes straight to the end screen (`reveal` of the last round ends the
game), so the standings stay secret until the podium.

**The podium.** The end screen reveals the places one by one: three empty blocks with a
dashed "?" on each; third place: the "?" trembles harder and harder for 1 s with light ticks
(`tap`), then the avatar, name and score pop in (`land`); second place the same, 1.4 s;
first place 2 s, the ticks speeding up, then the winner pops with confetti (`land`). Then
the fastest guess, the best fooler, the rest of the ranking and "Play again" fade in. About
6.5 s in all, once per game end (a repaint or a reconnect shows the final state), and at
once with Reduce Motion. With fewer than three players it reveals the places there are.

**Loading feedback.** Two helpers in `ui.js` show every wait: `SPINNER` (an unknown time,
with a short line of what it is doing: "Picking photos…", "Joining…") and `progress(share,
label)` (a known amount: a bar with the percentage). Where: the first deal ("Picking
photos…"), No while the bucket refills (the grid dims under a spinner), Yes ("Getting photos
ready 3 of 16", then "Sending 45%", in place of No and Yes, the upload counted with
`XMLHttpRequest` upload progress), "Start game" (a small spinner in the button), joining, the
round's `load` and a waiting leaderboard ("Loading photos 72%").

## 5. Security, performance and legal check

**Security.** Photos are reachable by unguessable links for longer than before (from the
3-2-1 until their round is over instead of while on screen or next), only from inside the
game (the links come only in the room's views), only the photos that are played, and never
stored on the phones (`no-store`, memory only). A troublemaker gains nothing new from the
flag: it lasts at most 15 s and ends in a deletion, which anyone can already cause with two
taps; the host can still remove a player while guessing. `flag`, `report`, `loaded` and the
`hello` field are validated like every other message (types, round numbers, the player
exists); no message carries a key. The owner of a photo is never derivable from `upcoming`,
`waiting` or `round.flag`.

**Performance (never freeze a room).** All new rules are pure and synchronous and loop at
most over the players and the plan (16 and at most 30 entries). Photo downloads are the same
number as today (each phone loads each played photo once), spread over the game instead of
two at a time; each phone loads one at a time, so a room serves at most one photo per phone
at once. `loaded` reports stay about one per round per player, so storage writes (the free
plan counts rows written) do not grow. The bucket's work runs on the phone only.

**Legal (web/legal.html, store/, the iOS privacy manifest).**
1. *Photos loaded ahead* (commit 7): the privacy policy's "Who receives it" gets one sentence:
   once a game starts, the players' apps load its photos in the background and keep them
   only in memory, never saved on the phone, until each photo's round is over. Purpose,
   recipients and retention are unchanged, only played photos are sent, so this is
   transparency, not new processing; it fits the GDPR (Art. 5, 13), the UK GDPR and the
   other privacy laws of the countries the app ships to (purpose limitation, minimisation,
   deletion, disclosure). `LEGAL.version` (the page's date) changes, so everyone accepts once
   more (the version bump does that anyway). README and AGENTS.md ("a photo only while it is
   on screen or next") follow in the same commit.
2. *The flag* (commit 5): "Report content" says what happens now: tap ⚑, the photo is hidden
   for everyone else at once, Delete photo deletes it (or it is deleted after 15 s). The
   terms' "it is then deleted for everyone at once" stays true. Store texts ("Report: the
   flag on a photo deletes it for everyone at once") are made exact in the release commit.
3. *Photo buckets* (commit 8): reading more previews ahead happens on the phone only, for the
   game; "This happens only on your phone. Nothing is sent before you tap Yes" stays true; the
   iPhone's permission text ("picks a few random photos on your phone for the game") and
   Google's photo permission declaration stay true. No change.
4. *16 players, avatars, settings, haptics, layout*: no data change. The store texts say "2 to
   16 players" (release commit).
5. *Privacy labels* (`store/ios_listing.js`, `store/android_listing.js`, `PrivacyInfo.xcprivacy`):
   unchanged (the same data types, collected for app functionality, not linked, no tracking;
   sharing with other players stays user initiated).

## 6. Compatibility with installed apps, and the deploy

The server keeps understanding the previous app version (docs/apps.md, Releasing). With this
plan's server, an app before 1.0.3 keeps working: it reports only the photo on screen and is
waited for only there (`player.ahead` false); it still sends a plain `report` (deletes at
once); its "Reveal now" does nothing any more; it does not hide a photo another phone flagged
(it pauses its bar, because `paused` is generic); it loads photos with `Image` and, because of
`no-store`, may load the photo on screen twice; it ignores `upcoming`, `total`, `waiting`,
`round.flag` and `me.loaded`; its 🫣 and 🫠 reactions are dropped; it shows "Photo picks" with
its old labels for the same values and does not show "Own photo" (the room uses the room's
value). No crash, no data issue. Deploy order: the server first (`./scripts/deploy.sh`, a
critical command the operator confirms), then the apps.

## 7. Affected areas (map)

| Area | Files |
|---|---|
| Config | `web/shared/config.js` (LIMITS, TIMING, EMOJIS, REACTIONS, SETTINGS, APP.version, LEGAL.version) |
| Protocol | `web/shared/api.js` (`flag`, `report {round}`, `loaded`, `hello.ahead`, `resolve` gone) |
| Game logic | `src/game/rules.js`, `state.js`, `view.js`, `plan.js`, `score.js` |
| Room shell | `src/room.js` (CLIENT_EVENTS, `hello`, the photo's cache header) |
| App | `web/js/main.js`, `store.js`, `photos.js`, `phone.js`, `api.js`, `ui.js`, new `loader.js` and `upcoming.js` |
| Views | `views/game.js`, `board.js`, `end.js`, `lobby.js`, `overlays.js`, `sheets.js`, `newgame.js`, `home.js` |
| Page and styles | `styles/app.css`, `web/index.html` |
| Native | `PhonePlugin.swift` and `PhonePlugin.java` (`photo` with `download`) |
| Legal | `web/legal.html` |
| Tests | `test/unit/*` (rules, view, plan, score, config, new loader and upcoming tests), `test/integration/room.test.js`, `test/e2e/game.spec.js`, `fake-phone.js`, new `test/e2e/bots.js` |
| Helpers | `scripts/helpers/demo-players.mjs`, `store-images.mjs` |
| Docs and store | README, `AGENTS.md`, `docs/apps.md`, `docs/guides/demo-players.md`, `store/*.js`, `store/images/` |

## 8. Commits

Every commit leaves the app working and runs `./scripts/test.sh` (unit, integration and the
browsers) before it is committed, does both passes of `AGENTS.md` §2 for everything it
renames, removes or reverses, and updates the header comment of every file whose role
changed. A commit that changes the native plugin is tried on both phones
(`./scripts/dev.sh android|ios`). Commit messages may name this plan's commit; code comments
never do.

### Commit 1: docs: the plan
Status: done.

This document.

### Commit 2: players: up to 16, about 140 avatars in a new order every time, reactions every phone shows
Status: done.

- `config.js`: `LIMITS.maxPlayers` 16 (its comment: why 16, the avatars and the guessing
  screen are made for it). `EMOJIS` becomes the curated list (about 140; the list itself in
  section 11), its comment stating the curation rules of section 4 (Emoji 12.0 or older,
  single character with emoji presentation, the categories left out, none of the reactions,
  👑 or 📷). `REACTIONS`: 😂 🙈 🔥 🤯 👀 😳 😩 🤭 🧐 🎉, the comment saying every phone
  can show them (Emoji 12.0 or older).
- `sheets.js` (avatar sheet): the emojis in `session.avatarOrder`, a fresh shuffle made when
  the sheet opens (`openSheet('avatar')` in `main.js`), so the order changes every time and
  stays still while the sheet is open; the sheet scrolls (it is taller than the screen now).
  `store.js`: unchanged mechanism (a random first avatar, saved with the name); its comment
  says so; an avatar no longer in the list (🔥) becomes a random one.
- `state.js`: the comments on `freeAvatar` (16 players, more avatars) stay true; the room
  shape comment unchanged.
- Tests: `config.test.js`: every avatar and reaction is one character with emoji presentation
  (`/^\p{Emoji_Presentation}$/u`), no duplicates, no reaction is an avatar, more avatars than
  `2 x maxPlayers`; `rules.test.js` and the integration test's "full room" use the new cap
  (they already read `LIMITS.maxPlayers`).
- Docs (pass 2): README ("2 to 12 players"), the store description ("2 to 12 players") in the
  release commit; the avatar picker in the previous plan is history.

### Commit 3: settings: Photo mix (Balanced or Random) and Own photo
Status: done.

- `config.js` SETTINGS: `fair` keeps its key and values; label "Photo mix", options
  `[true, 'Balanced']`, `[false, 'Random']`, help: Balanced "Everyone’s photos come up, some a
  bit more than others.", Random "Pure chance: some come up a lot, others hardly." New
  setting `own` (after `streak`): label "Own photo", options `[80, 'Fewer points']`,
  `[0, 'No points']`, `[100, 'Full points']`, default 80, help: Fewer points "Right on your
  own photo: 20% fewer points.", No points "Your own photo never gives points.", Full points
  "Your own photo counts like any other." `LIMITS.balancedSpread` 0.4 with its comment
  (60% to 140% of an equal share, why: counting must not tell whose photo is next). The
  presets follow the defaults by themselves.
- `plan.js`: `pickFair` becomes `pickBalanced(byOwner, count, rng)`: equal share `f = count /
  owners`; each owner starts at `max(0, round(f * 0.6))`, capped by their photos; the rest is
  handed out one photo at a time to a random owner still under `round(f * 1.4)` and with
  photos left; only if nobody is left under that cap may owners with spare photos go above it
  (a group where some brought few photos). "Random" keeps `shuffle(all).slice(0, count)`.
  `arrange` (no owner twice in a row when possible) is unchanged. Header comment rewritten.
- `score.js`: `pointsFor({ correct, ms, streak, own }, settings)`: a right answer on one's own
  photo earns `round(points * settings.own / 100)`; the streak counts it as right either way.
  `rules.js` `reveal` passes `own: p.id === owner`. Header comments of both.
- `newgame.js` and the settings sheet need nothing (they read SETTINGS); check that eleven
  rows and three-option rows fit at 320 px (the labels above are chosen for it).
- Tests: `plan.test.js`: Balanced shares stay within the range whenever the photos allow it,
  always sum to the rounds, differ between draws, and fall back sensibly when owners brought
  few photos; Random unchanged. `score.test.js`: own photo at 80, 0 and 100. `config.test.js`:
  the help lines stay short (existing test). `rules.test.js`: the owner's points on the
  reveal.
- Docs (pass 2): "Photo picks", "Fair", "equally often" in `plan.js`, README, the previous
  plan (history, left), store texts (none mention it).

### Commit 4: clock: one clock for the round, the timer's length from the room, a bar that never jumps
Status: done.

- `state.js` (Game shape): `pausedAt: ms | null` replaces `paused`; `flag` is added in commit
  5. Comments: what holds a round, what stands still.
- `rules.js`: `held(game)` (any peek; commit 5 adds the flag); `settleClock(room, now)` called
  from `settle` before the transitions: notes `pausedAt` when the round becomes held; when it
  is released moves `room.deadline` and `game.shownAt` by the time it stood still; converts a
  stored `game.paused` (the previous version's milliseconds left) once. `transition`: `show`,
  `reveal` and `board` do not move on while `pausedAt` is set. `answer`: the late check and
  the measured time use `pausedAt ?? now`. `peek` no longer touches the clock itself.
  `nextWake`: the deadline only while not paused; the holds' expiries always. Header
  invariant on "Show again" rewritten as the general rule.
- `view.js`: `timer(room, now)` returns `{ left, total }` for the countdown, the answer time
  (when timed), the reveal and the leaderboard (when automatic); `paused` true in any phase
  while held; `left` frozen at `pausedAt`. Header: `total` and `paused` documented.
- `main.js`: a small clock (one function pair, used again for the flag in commit 5): it keeps
  `{ key, end, total }` and re-anchors only when the key (phase, round, paused) changes or the
  new estimate differs by more than `TIMING.clockSlackMs`; `leftNow()` reads it; `frame()`
  takes `total` from the view.
- `ui.js`: `timerBar(kind)` (`answer` or `look`, two complete class lists); `TIMER_BAR` goes.
  `game.js` puts the bar in its own part (`timer`), so the reveal switches it to `look`;
  `board.js` uses `look`. `styles/app.css`: `--color-blue` and `--color-violet`, commented.
- `config.js`: `TIMING.clockSlackMs` 500, commented.
- Tests: rules (a peek pauses the board and resumes with the same remaining time, still
  green; answers while paused keep their time; a stored `paused` is converted), view (`total`
  per phase, `paused` and the frozen `left` in show), e2e (the bar's look changes on the
  reveal: the `#tbar` element carries the kind as `data-kind`, set by `timerBar`).

### Commit 5: flag: hide at once, wait up to 15 s, Delete or Cancel; Reveal now goes
Status: done.

- `config.js`: `TIMING.flagMs` 15000, commented (the operator's limit; a flag that ends
  without Cancel deletes the photo).
- `state.js`: Game gets `flag: { by, until } | null`. `rules.js`: `held` includes the flag;
  handler `flag(room, { playerId, round, on })`: on, in `show` or `reveal` of that round, the
  photo there, no flag open, the player in the room: `game.flag = { by, until }`; off, from
  `by` only: `game.flag = null`. `report(room, { playerId, round })`: ignored when a round is
  given and is not the current one; otherwise as today, through one `deletePhoto(room, now,
  rng)` that clears the flag and the peeks. `settle`: a flag past `until`, or whose player is
  gone, deletes the photo. `startRound` resets the flag. `nextWake`: `flag.until`. The
  `resolve` handler goes; the header's host-only list loses it.
- `view.js`: `round.flag: null | { mine, left }` (`left`: the milliseconds until the automatic
  deletion). Who flagged is never in it.
- `room.js` and `api.js`: CLIENT_EVENTS `flag: (m) => ({ round: m.round, on: m.on === true })`,
  `report: (m) => ({ round: m.round })`, `resolve` removed; the message list in `api.js`
  updated.
- App: `main.js` action `report` sends `flag {round, on: true}` and notes a pending flag for
  that round (so the sheet opens at once); the `report` sheet is open while
  `round.flag.mine` (or pending), closes when the room says otherwise; `close` and the back
  button on that sheet send `flag {on: false}`; `reportnow` sends `report {round}`. The sheet's
  "Delete photo" has a second line "Automatic deletion in N s" (smaller, whitish), counted
  down with the same clock as the timer. `game.js`: for everyone else, while `round.flag` is
  set and not mine, the stage shows "⚑ Someone flagged this photo" and "Waiting…" instead of
  the photo, and the cards are disabled; "Reveal now" and the `resolve` action go; the stage
  shows "This photo could not load" instead of an endless spinner (finding 4).
- `legal.html` "Report content", README "Keeping it friendly": the new flow (section 5,
  point 2); `LEGAL.version` and the page date to the commit's date.
- Tests: rules (a flag holds the round; Cancel resumes with the same time; Delete moves on;
  15 s without a decision deletes; the flagger leaving deletes; a second flag is ignored; a
  report for another round is ignored), view (`round.flag` mine and other, no id), integration
  (a flag over the sockets pauses `left`, the alarm deletes the photo after `TIMING.flagMs`
  and it is gone from storage), e2e (one phone flags: another sees "Someone flagged this
  photo" without the photo, the flagger sees the countdown line; Cancel brings it back;
  flag again and Delete moves on). The rules tests that used `resolve` use answers or time.
- Docs (pass 2): "Reveal now", `resolve`, "deleted for everyone at once" across `src/`,
  `web/`, `store/`, docs, tests.

### Commit 6: feel: one haptics vocabulary, the 3-2-1, a pulse for every new photo
Status: done.

- `phone.js`: `HAPTICS` table and `buzz(kind)` (section 4), the comment listing each kind's
  meaning and where it is used; nothing without the plugin (browser, tests).
- `main.js`: `moments(previous, view)` replaces the reveal's inline buzz (a new photo: `tap`
  when `show` starts for a new round; the reveal: `yes` or `no`); `setHtml` returns whether it
  changed, and the 3-2-1's paint vibrates `count` on every new number.
- `overlays.js` and `styles/app.css`: the countdown overlay opaque with `bg-page` (the
  body's background, now defined once as a utility); its comment says why it is an overlay.
- Tests: none for vibrations (native); the e2e test checks the 3-2-1 covers the lobby
  (the overlay is opaque: the grid is not visible through it).

### Commit 7: game photos: dealt at the 3-2-1, loaded ahead in play order, the room waits for three
Status: done.

- `config.js`: `LIMITS.loadAhead` 3 ("photos after the one on screen every phone loads
  first"), `LIMITS.readyAhead` 2 ("a phone is ready for a round when it holds its photo and
  this many after it"), `TIMING.photoFetchMs` (the longest wait for one game photo); the
  comment of `TIMING.loadMaxMs` (now the longest wait at the start of a round and after a
  leaderboard).
- `rules.js`: the lobby to 3-2-1 transition builds the plan into `room.game` (round 0); every
  way back to the lobby drops it; `removePlayer` during the 3-2-1 returns to the lobby (the
  countdown restarts, like a setting change); the 3-2-1's end starts the game from that plan.
  `game.loaded` becomes `{ [playerId]: round }` (kept across rounds; cleared when the plan
  changes); `loaded {round}` raises it. `ready(room, player, round)`: `ahead` players by their
  mark, others only for the photo on screen in `load`. `load` shows when every connected
  player is ready for the round or after `loadMaxMs`; `board` ends when due and every
  connected player is ready for the next round, or `loadMaxMs` after due. `nextWake`
  accordingly. `join` stores `ahead`.
- `state.js`: Player gets `ahead`; `referencedPhotoIds` unchanged in meaning (the players
  still own their photos during the 3-2-1); `isServablePhoto`: the plan's photos from the
  current round on, from the 3-2-1 on; shape comments.
- `view.js`: `upcoming` (links, `null` for a deleted photo), `waiting: { ready, of } | null`,
  `me.loaded`; `round.next` stays for older apps.
- `room.js`: `hello` passes `ahead`; the photo response `Cache-Control: no-store`; its comment.
  `api.js`: `hello {…, ahead}` and the new meaning of `loaded` documented.
- App: `web/js/loader.js` (new): one job at a time, the next one chosen by a function each
  time (so priority is always current), woken after each job and on demand; header comment.
  `web/js/upcoming.js` (new): the game's photos as object URLs, the queue's order (on screen,
  the next three, the rest), aborts (an `AbortController` per download) and drops what left
  `upcoming`, `photoUrl(link)`, `readyFor()` (pure, unit tested) and the local share for the
  progress bar. `main.js`: replaces `images`, `preload` and `acknowledge`; sends `loaded` when
  `readyFor()` is above `me.loaded`; the stage, the effects and Show again use `photoUrl`.
  `ui.js`: `progress(share, label)` (a bar with the percentage). `game.js`: the stage shows
  "Loading photos N%" during `load`; `board.js`: the same bar in place of the timer bar while
  the room waits.
- Legal: section 5, point 1 (`legal.html`, `LEGAL.version`), README (Photos), AGENTS.md (the
  two rules on when a photo may reach a phone).
- Tests: rules (the plan is dealt at the 3-2-1 and dropped when someone unreadies or is
  removed; round 1 waits for three photos on every `ahead` phone and only for the photo on
  screen on the others; the board waits after its time for the next round's photos, at most
  `loadMaxMs`; offline phones never hold up), view (`upcoming` from the current round, no
  owner, `waiting`), unit (`readyFor`, the loader's order), integration (the plan's photos are
  servable from the 3-2-1, the response is `no-store`, a photo is 404 once its round is over),
  e2e (a full game still runs; the board shows the loading bar when one phone is slowed).

### Commit 8: photo buckets: 250 previews and 100 big versions always ready, Yes with progress
Status: done.

- `config.js`: `LIMITS.bucketPreviews` 250 and `LIMITS.bucketFulls` 100 (comments: memory,
  why big versions ahead come only from photos on the phone); `LIMITS.setsAhead` goes.
- `phone.js`, `PhonePlugin.swift`, `PhonePlugin.java`: `photo(id, { download })` (default
  true); the iPhone asks Photos without network access when false and answers "unreadable";
  Android has no cloud and ignores it (documented in both twins and in `phone.js`). Tried on
  both phones.
- `photos.js` rewritten around the bucket: checked previews `{ id, blob, screenshot, lines,
  full }` in draw order; `seen` for this app run (a new game deals new photos); `unfit` for the
  current "Which photos"; two loaders (now, ahead) from `loader.js`; `start()` when access is
  full or limited (from the app's start and on resume, without asking: asking stays in the
  lobby's Continue); `roll`, `swap`, `hold` (the now lane's first job), `chosenBlobs(onProgress)`.
  The rules of the previous version stay: unseen photos first, then earlier ones, the set on
  screen last; a phone that does not answer three times counts as empty. Header comment
  rewritten (mechanisms, the two lanes, what is held while waiting).
- `main.js`: `checkAccess` at boot; the bucket survives leaving a room (only the set on screen
  is released); `HOLDS.tile` shows the held photo through `photos`, and `lookHtml` paints the
  preview with the big version layered above it (no inline handlers: the layer simply paints
  over when it is decoded). `api.js`: `uploadPhotos(code, key, blobs, onProgress)` with
  `XMLHttpRequest` (upload progress, the same timeout and header). `readyWith` feeds the
  progress into `session.progress`; `lobby.js` shows it in place of No and Yes.
- Tests: e2e (the choice still deals, swaps and holds; the hold shows the big version; Yes
  shows the progress; a second game deals photos not seen in the first); `fake-phone.js` takes
  `download`.

### Commit 9: screens that fit: safe area, the guessing screen for up to 16, the bottom row, the reaction row
Status: done.

- `styles/app.css`: `pt-safe` and `pb-safe` (`max(margin, env(safe-area-inset-*))`), used by
  `.screen` and the sheets (`SAFE_BOTTOM` goes); the toast and the banner keep their own
  offsets (they float). Comment: the iPad finding.
- `game.js`: card columns by the number of options (section 4), compact cards from 5, a card
  container query that stacks avatar and name when narrow; the stage `min-h-0` (it gives way
  last); the bottom area one fixed height, aligned to the bottom; "who has answered" with
  24 px avatars and a 4 px gap (16 fit in one row on most phones, two rows otherwise), a
  player who has not answered with a dashed ring instead of faded. `ui.js`: `avatar` gets the
  dashed look as a variant; `AVATAR_SIZES.sm` 24 px.
- `ui.js` `reactionsRow`: five slots per page (`w-1/5` items, snap), the arrow's action
  `reactmore` scrolls to the end, and from the end back to the start; `floatEmoji` starts at
  the button's centre clamped to the row. `main.js` comment of `reactmore`.
- e2e: new `test/e2e/bots.js`: light players over WebSocket and `fetch` from the test (no
  browser), with `hello {ahead: true}`, ready without photos, always reporting every photo
  loaded and answering at random. A layout test plays a short game with one phone and 15 bots
  at 360 x 640, 375 x 667 and 393 x 852 and checks on the lobby, the guessing screen, the
  reveal, the leaderboard and the end screen: the page does not scroll, the grid's edges are
  No's left and Yes's right edge, every reaction button in view is whole, and the arrow ends
  on the last reaction.

### Commit 10: lobby: the grid edge to edge, smaller pills, the swap line, the real flip
Status: done.

- `lobby.js`: the parts of section 4; the grid stretches (`grid-rows-N` and `grid-cols-N`,
  whole class names), tiles `rounded-lg`, gap 4 px, at most 4:3 portrait (container units; iOS
  15 without them: the full box); the ready grid the same. Pills: border 2 px always, green
  when ready, dashed (`border-line-strong`) when waiting or offline, compact from 7 players;
  the host taps a pill to remove (unchanged). The counter line (`note` part): "Tap to swap
  (N left), hold to preview", small; "(N left)" green, bouncing on each swap (its markup
  carries the count, so a new number is a new element and the animation plays), red with a
  jiggle at 0, jiggling again on each refused tap (`photos.refusals`, a counter that makes the
  markup new). The cross on refused photos goes; `refused` goes from `photos.js`.
- `photos.js` and `lobby.js`: a swapped tile keeps the old preview for its flip (`from`); the
  tile is a two-faced card (old face turning away, new face turning in, 0.5 s,
  `backface-visibility: hidden`); the old preview's URL is released after the flip. `main.js`
  `swap`: `tap` when it flips, `no` when refused. `styles/app.css`: the `flip`, `bounce` and
  `jiggle` animations, commented, with Reduce Motion.
- "Picking photos…" under the first deal's spinner; No with an empty bucket dims the grid
  under a spinner.
- Tests: e2e (the counter's text and colour state, no cross on a refused tap, the tile
  changes after a swap, the hold still works), the layout test (commit 9) covers the grid's
  edges.

### Commit 11: leaderboard: the overtaking animation, FINAL ROUND, straight to the podium
Status: done.

- `rules.js`: the reveal of the last round ends the game (no leaderboard after it); the
  header's phase list says so.
- `board.js`: the rows as today, plus `data-up` on rows that move up and the gained points as
  a chip; the entrance (section 4) run by `startBoard` in `main.js` in three steps; the final
  state when `session.shown` already holds this board's key (repaint safe). The FINAL ROUND
  variant when `round.n === round.total - 1`. `styles/app.css`: `lift` (rows moving up),
  `smash`, `shake`, `pop` for ranks; Reduce Motion. `main.js`: `land` on the smash.
- Tests: rules (the last reveal ends the game; with one round there is no leaderboard), e2e
  (the second-to-last board shows "FINAL ROUND" and no ranking; after the last photo the
  podium comes without a leaderboard; a normal board ends in the new order).
- Docs (pass 2): "a leaderboard after every photo" (README, store texts in the release
  commit, the previous plan is history).

### Commit 12: podium: the tension reveal
Status: done.

- `end.js`: places with `data-place`, a dashed "?" cover each, the facts, the ranking and
  "Play again" marked to appear after the sequence; the final state when `session.shown`
  holds this end screen's key. `main.js` `startPodium`: the timeline of section 4 with `tap`
  ticks and `land` reveals; Reduce Motion shows all at once. `styles/app.css`: `tense`
  (growing tremble), the winner's pop and confetti reused from the reveal.
- Tests: e2e (all places appear in order, then "Play again"; the demo players and the full
  game test wait for it). `demo-players.mjs`: waits for "Play again" to be visible.

### Commit 13: release: docs, store texts and images, demo players, version 1.0.3
Status: done.

- Pass 2 over everything above: README (game life: dealt at the 3-2-1, photos loaded ahead,
  FINAL ROUND, 16 players), `AGENTS.md` (the photo rules if not done in commit 7, the player
  colours note), `docs/apps.md` (the Haptics plugin, `photo`'s `download`),
  `docs/guides/demo-players.md` ("Waiting on", the podium's wait).
- Store (`store/*.js`): "2 to 16 players"; "A leaderboard between the photos, a secret final
  round and a podium at the end"; the report sentence ("Anyone can flag a photo: it is hidden
  at once and deleted for everyone."); `howToTest` and `reviewNotes` ("Report: the flag hides
  the photo for everyone else at once; Delete photo deletes it."); `whatsNew` for 1.0.3, plain
  and without dashes; the listing test passes.
- `store-images.mjs`: the slides still show what their captions say; redraw the screenshots
  (`node scripts/helpers/store-images.mjs`).
- Version 1.0.3 (`package.json`, `APP.version`). No deploy and no upload: both are the
  operator's (critical commands, section 6).

## 9. Things to pay attention to

- **One event at a time in the room.** Every new rule is pure and synchronous. `loaded` stays
  about one message per round per player; never send it per byte or per photo beyond what
  raises the mark.
- **Never stuck.** Every hold ends by itself: a peek after `peekHoldMs` without renewal, a flag
  after 15 s; every wait for photos ends after `loadMaxMs`; offline phones never hold up.
- **The painter.** Animations start only when their part is painted (`changed` from `paint`)
  and remember that they ran (`session.shown`), so a repaint shows the end state instead of
  restarting them. No timer text in a part that animates.
- **Memory.** The bucket (about 35 MB) and the game photos (about 4 MB) are Blobs; every
  object URL is revoked when its photo leaves; nothing is written to disk.
- **Compatibility.** Section 6; the server is deployed first and keeps every older message
  working.
- **Dash rule.** No long dash anywhere, no en dash in what users read (`config.test.js`).
- **Native twins.** `photo`'s `download` in both plugins and `phone.js`, in one commit.

## 10. Not part of this plan (ask before doing)

- More than 16 players, or more than 12 player colours.
- An iPad version of the app (it runs as the iPhone app in an iPadOS window; making it a
  native iPad app needs iPad screenshots and its own review).
- Native step-by-step sharpening of photos (Photos' opportunistic delivery would need native
  events); the app shows the preview, then the big version.
- Changes to the reveal, the settings sheet or the start screens beyond what is named here.

## 11. The avatars (commit 2)

About 140, in this order (the order sets each one's colour; the picker shuffles anyway):

🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦅 🦉 🦇 🐺 🐴 🦄 🐝 🐛 🦋 🐌 🐞
🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦞 🦀 🐠 🐬 🐳 🦈 🐊 🦓 🦍 🐘 🦛 🦏 🦒 🦘 🦙 🦚 🦜 🦢 🦩 🦝 🦦 🦥 🦔
🐲 👻 👽 👾 🤖 🎃 😎 🤓 🤠 🥳 🍕 🍔 🍟 🌭 🌮 🍩 🍪 🧁 🍦 🍭 🍿 🥨 🥐 🥑 🍉 🍓 🍒 🍍 🥥 🍄
🧀 🧇 🍣 🌵 🌴 🌲 🌻 🌸 🍀 🌈 ⭐ 🌙 🌞 ⚡ 🌊 🪐 🌋 ⛄ 🎸 🎺 🥁 🎹 🎧 🎮 🎲 🧩 🎯 ⚽ 🏀 🎾
🏓 🛹 🚀 🛸 🚗 ⛵ 🎈 🎁 🏆 💎 🔮 🎨 💡 🧲 🪁 🧸 🧊 🎪

The implementing commit checks each one against Emoji 12.0 and both platforms' current emoji
fonts, and removes any that look alike on one of them.

## 12. Decision log

| Question | Decision | Why |
|---|---|---|
| Flag without a decision | Deleted after 15 s, with a countdown in the Delete button | Operator's choice: nobody can stop the game, a flagged photo never comes back by itself. |
| Reveal now | Removed everywhere, with the room's `resolve` | Operator's choice. ∞ rounds wait for everyone; the host removes a player who never answers. |
| FINAL ROUND | The leaderboard before the last photo; after the last reveal straight to the podium | Operator's choice: the standings stay secret until the podium. |
| Player cap | 16 | Operator: "16 maybe, or any amount that makes sense"; the avatars, the guessing screen and the free plan's storage fit 16. |
| Lobby pills | Today's pills, compact from 7 players | Operator's choice. |
| Dashed "waiting" look | Lobby pills and the "who has answered" row | The question was not answered; the recommended option: one look for "the game waits on this person". |
| Swap counter | "Tap to swap (N left), hold to preview", green, red with a jiggle at 0 | Operator's wording and choice (first letter capitalised like every other line). |
| Buckets | 250 previews, the first 100 also big, one queue with a now lane | Operator's choice; numbers in the config. |
| Big versions ahead from iCloud | Only when needed | Hundreds of MB of mobile data otherwise. |
| Photos ahead in the game | From the 3-2-1, in play order, the next three first | Operator's choice after the evaluation: no owner leak, only played photos. |
| How long the room waits | Round 1: three photos on every phone; each leaderboard: the next round's three | Operator's words; at most `loadMaxMs` each, offline phones excluded. |
| Older apps and the wait | `hello.ahead` marks apps that load ahead; others are waited for only for the photo on screen | A mixed room is never slowed down. |
| Fair setting | "Photo mix": Balanced (60% to 140% of an equal share) and Random (pure chance) | Operator: Fair more random, Random simply random, better names. Key `fair` kept for compatibility. |
| Own photo | New setting, default 80% of the points; also 0% and 100% | Operator: own-photo points by default, slightly less, explained by "?". |
| 3-2-1 | Opaque overlay with the page's background | Operator's suggestion; the overlay itself is the right structure. |
| Reactions on Android 10 to 12 | 🫣 and 🫠 replaced by 😳 and 🤭 | Emoji 14 does not exist there. |
| Commit 2: one shuffle | `shuffle` moved from `src/game/plan.js` to `web/shared/random.js`, used by the game logic and the avatar sheet | The app cannot import from `src/`; a second shuffle in the app would be a second copy of the same rule. |
| Commit 2: the avatar sheet | Six columns, and the same shape as the settings sheet (the list scrolls, "Done" stays in reach), one helper `withFooter` for both | 137 avatars are three screens tall; five columns would be four. |
| Commit 2: the avatar list | 137 (🦑 left out: it looks like 🐙) | Section 11's list, checked: every one a single emoji of Emoji 12.0 or older (a unit test checks the single character). |
| Commit 2: "2 to 16 players" | Changed in the README and the shared store description now, not in the release commit | The listing's rule: every store sentence is true for the app as it is, so it changes with the feature. |
| Commit 3: rooms saved before a new setting | `apply` normalizes the room's settings on every event | A room created by the previous server has no `own`; normalizing gives every stored room each current setting's default, so no rule reads an undefined value (now and for any later setting). |
| Commit 3: more players than rounds | The lower bounds are handed out in the shuffled owners' order until the rounds are full | With 16 players and 15 rounds the lower bounds can add up to more than the rounds; who gets one is then random. |
| Commit 3: the settings sheet jumped to the top | A long sheet's scrolling box is part of its layout, only the list in it is a part | Found while checking the new row at 320 px: every tap repainted the box and reset its scroll, so a setting low in the list (now eleven) jumped away under the finger. An e2e check opens the "?" of Photo mix and expects it in view (it failed on the old code). |
| Commit 3: "Fewer points" at 320 px | Wraps to two lines, like "No screenshots" | Short enough on every other phone; a shorter word would say less. |
| Commit 4: how long each timer runs | One function, `timerMs(room)` in `state.js`, used by the rules for their deadlines and by the view for `total` | The mapping existed twice (the rules and `main.js` `frame()`); now the app knows none of it. |
| Commit 4: the app's countdown | A small pure module `web/js/clock.js` with the time source passed in, unit tested; `session.clock` goes | The same countdown is needed again for the flag's automatic deletion (commit 5). |
| Commit 4: a held board in "Host taps" mode | The clock stops too (there is just no deadline to move) | One rule for every held round; harmless without a deadline. |
| Commit 4: older apps | `left` and `paused` keep their names and meaning; `total` is new | 1.0.2 reads `left` and `paused` (its bar stops while held); it computes its own lengths. |
| Commit 5: the report sheet's lifetime | This phone's intent (opened by ⚑, ended by Delete, Cancel, the backdrop or the back button); the room's views only close it | Letting the room's flag reopen it would let a view that crosses a Cancel on the wire open it again; the photo's round, the photo and someone else's flag are all the sheet needs to know. A restarted app does not reopen it; the room deletes the photo after 15 s. |
| Commit 5: the toast after a deletion by time | Shown when the room had this phone's flag in the previous view and the photo is gone now | While guessing, the deletion also moves the round on, so "same round" alone would miss it. |
| Commit 5: the sheet's text | "Everyone waits while you decide." | True for every app in the room (an older app keeps showing the photo, but its clock stops too). |
| Commit 5: the cards while flagged | Disabled for everyone (faded like after a pick) | Nobody answers what they cannot see; the room would count such an answer as given when the clock stopped anyway. |
| Commit 5: a photo that could not load | The stage says "This photo could not load" and the cards can be used | Finding 4: it spun for the whole round. |
| Commit 5: Emoji 14 icons | 🫥 replaced (😕 on the stage, 🔍 for "No photos found"); a config test fails on emoji from U+1FA70 to U+1FAFF that are newer than Emoji 12.0 | Android 10 to 12 draw an empty box for them. |
| Commit 5: the legal page | "Report content" says: tap ⚑, then Delete photo; after 15 s it is deleted anyway. The date stays (22 November 2026 is today and already `LEGAL.version`) | Informational, and true for every app version. |
| Commit 6: where vibrations are triggered | The room's moments in one function, `moments(previous, view)` (a new photo, the reveal); the 3-2-1 when a new number is painted; the swap from its action | Each trigger sits where its moment is decided: the room's views, the clock-driven paint, the tap. A repaint never vibrates. |
| Commit 6: the swap's light tap | Added now (the flip itself becomes a real card flip in commit 10) | The vocabulary's meaning "a photo flips" holds from the start. |
| Commit 6: the page's background | One utility `bg-page` in `styles/app.css`, used by the body and the 3-2-1 | The 3-2-1 covers the lobby fully and looks like a screen of its own, without a second copy of the gradient. |
| Commit 6: testing vibrations | The fake phone records what the Haptics plugin would play (`window.felt`); the browser tests expect the 3-2-1's three buzzes, the light tap of a new photo, the verdict's pulse, the swap's taps and the refusal's two pulses | Vibrations cannot be felt in a browser, but when they are played can be checked. |
| Commit 7: when the 3-2-1's deal starts over | One rule: the countdown runs only while its deal holds (everyone ready, every dealt photo still in its owner's hands, `dealHolds`); otherwise back to the lobby, and the next 3-2-1 deals afresh in the same step | Covers every way a deal can break (unready, leave, removal, a new Yes, a dropped player) without a special case in each event. Removing a player without photos keeps the countdown running. |
| Commit 7: the leaderboard's wait | An explicit state, `game.waiting`, with its own deadline (`loadMaxMs`); no timer while it waits (`timerMs` gives none) | Deriving "time is up" from the clock would let `nextWake` return a time in the past (an alarm loop). |
| Commit 7: what `loaded` means | "This phone is ready for round r" (it holds that round's photo and the next `readyAhead`), a mark that only grows; the app decides it (`readyFor`), the room only compares | One number per phone, robust to messages in any order; old apps' "loaded for the round on screen" fits the same mark. |
| Commit 7: older apps | `hello.ahead` marks today's apps; the room waits for the others only in `load` for the photo on screen | Otherwise every leaderboard in a mixed room would wait the full `loadMaxMs` for an app that never reports ahead. |
| Commit 7: a changed plan | A player leaving removes their later rounds and clears every mark; the view's `me.loaded` drops and the apps report again | The round numbers after the current one shift, so the old marks would overstate. |
| Commit 7: a game saved by the previous server | `upgradeGame` gives it today's shape once (the held board's `paused`, `loaded` as a list, no `waiting`); the conversion of commit 4 moved there | One place for every upgrade of a stored game. |
| Commit 7: one job queue for photos | `web/js/loader.js`: one job at a time, the next one picked afresh after each (`pick`); the game's photos use it now, the photo buckets will in commit 8 | Priority is never stored, so nothing goes stale in a queue. |
| Commit 7: a failed photo | A second try, then it counts as done (never holds up the room); a 404 (deleted meanwhile) is not tried again | A network blip at the start does not cost a photo; a deleted photo is not fetched twice. |
| Commit 7: the loading bar | `ui.progress(share, label)`, as tall as the timer bar's slot; the board swaps one for the other, the stage shows it during `load` | No jump when a leaderboard starts waiting. The share is the other phones' readiness plus this phone's own exact progress. |
| Commit 8: what the bucket holds | Only previews that fit the current "Which photos", each with its check stored (lines of text, screenshot); a new filter re-sorts the bucket from the stored checks | Keeping previews that do not fit would let a phone full of chats fill all 250 places with them and dealing would stall. |
| Commit 8: the bucket's filter and the set's | Two facts: the filter the bucket gathers for (`gathering`, the room's or this phone's own) and the one the set on screen was dealt for (`photos.filter`, compared to deal anew) | One field for both made a new "Which photos" never deal a new set (caught by the browser test). |
| Commit 8: the set and the bucket | A dealt photo is the bucket's own entry, so a big version still being fetched for it lands in the set | A copy would fetch the same big version twice. |
| Commit 8: the two lanes | The ahead lane starts a job whenever the now lane has nothing more queued (its last job may still run) | Waiting for the now lane's last job to end too needed a second wake-up that never came: the ahead lane stalled for good (caught by the browser test). |
| Commit 8: a big version not stored on the phone | Ahead of time it is marked `ahead` and left; once its photo is on screen the now lane fetches it with the download | No mobile data for photos that may never be shown; the photos on screen are always complete. |
| Commit 8: the lobby's parts | Split now (title, pick, note, actions, links) instead of in commit 10 | The Yes progress repaints many times a second and must not repaint the grid. Each state places its content as before (cards and "✓ Ready" without photos at the top). |
| Commit 8: the upload | `XMLHttpRequest` with the same timeout and header; the label turns to "Sending photos 0%" as soon as the upload starts | `fetch` cannot report upload progress; the first progress event can come late. |
| Commit 8: when the bucket starts | Once the terms are accepted and the app may read photos (never with a question: asking stays with "Continue"); it survives leaving a room, access changes drop it | Reading photos before the terms are accepted would be wrong, and a new access may mean other photos. |
| Commit 8: the photo held big | Layers: the preview, and the big version above it once there (`heldLayers`, `lookHtml`); the tests find it as the image named "Photo" | It is never empty and gets sharp in place, without inline handlers (the CSP forbids them). |
| Commit 8: a name clash | The export is `holdPhoto` | `main.js` has its own `hold` (the hold-to-look state); the clash stopped the whole page from loading, which is why the first test run hung. |
| Commit 9: the lobby with 16 players | Not yet fitting on the two smallest sizes (the page scrolls, as before this plan); the layout test checks the lobby once the pills are compact (commit 10) | What makes the lobby fit is the pills and the stretching grid, both commit 10. Found and fixed here: commit 8's parts split had let the grid's box shrink below its minimum, so the photos overlapped No and Yes on small phones; the grid keeps its minimum again. |
| Commit 9: the layout test | Three phones (360 x 640, 375 x 667, 393 x 852) and 13 bots in one game, instead of one phone resized | The reveal lasts 3.5 s, too short to check three sizes one after another reliably; three phones also see each screen at the same moment. No clock and "Host taps" keep the other screens still. |
| Commit 9: the cards | `DENSITIES` in `views/game.js`: up to 4 two columns (as before), 5 to 9 three, 10 to 16 four compact (48 px, border 2 px); below 7.5rem a card stacks avatar and name, the ✓/✗ moves to the card's top corner | Measured with 16 players: the photo keeps 242 px on 360 x 640 (38 %), 269 px on 375 x 667, the same size on the guess and the reveal. |
| Commit 9: "who has answered" | 24 px avatars, 4 px gap, two rows for 16 on phones (16 in one row need 444 px; the plan's "one row on most phones" was wrong); waiting is a dashed grey ring on the card colour | Grey dashed against the players' colours reads as "not yet" at 24 px; dashed in the player's colour was too close to solid. |
| Commit 9: the reaction buttons | Each button is a fifth of the row and the whole fifth is the tap target (the round emoji inside) | Five whole buttons on every phone, a bigger target, and the arrow lands on whole buttons by snapping. |
| Commit 9: confetti at the edge | `#app` clips sideways overflow (`overflow-x: clip`) | In four columns the right card's confetti flies about 40 px past the screen and would let the page scroll sideways; clipping at the root keeps every screen still. iOS 15 ignores `clip` and behaves as before. |
| Commit 9: the safe area | Checked in the iPhone 17 simulator: the bottom button now sits right above the home indicator, the top bar right under the status bar | `max()` with `env()` works in the apps' web view. |
| Commit 10: the grid | Rows and columns stretch in a size container; the grid is the box's full width, its height at most `100cqw * 4/3` (a tile at most 3:4 portrait), centred in a taller box; gap 4 px, tiles `rounded-lg`; iOS 15 without container units keeps square tiles | Measured: the grid's edges are exactly No's left and Yes's right edge on 360 x 640, 375 x 667 and 393 x 852 with 16 players (the layout test checks it). |
| Commit 10: fitting 16 players in the lobby | Compact pills from 7 players (24 px avatar, 13 px text, no vertical padding) and, on short screens only, a grid minimum of 7rem instead of 9rem | Without the smaller minimum the lobby was still 39 px too tall on 360 x 640; the grid is a preview (holding a photo shows it whole). Now nothing scrolls on the three sizes. |
| Commit 10: the pills | Border always 2 px: green when ready, dashed grey (`line-strong`) while the game waits for the player (not ready, or offline); the ✓ stays for ready | The same "not yet" look as the dashed avatar ring in "who has answered". |
| Commit 10: the swap counter | "Tap to swap (N left), hold to preview", small; the count's markup carries the number and, at 0, `photos.refusals`, so each change is a new element whose animation plays once (`bump` while counting down, `jiggle` at 0) | No timers and no animation state in the view: the painter's normal repaint replays it. A refusal while swaps are left (the bucket ran dry, rare) only vibrates, since a bump there would look like a count. The animation is named `bump`, not `bounce` (Tailwind's own endless `animate-bounce`). |
| Commit 10: the turn | The tile is the card (`transform-3d`, keyframes with `perspective()`), the new photo its front face, the old preview a back face turned away (`rotate-y-180`, `backface-hidden`); the old preview's link is released when the turn ends (`settleLater`, timed with the CSS: `ENTRANCE_MS`) | A revoked link would show an empty back face; the big version of the old photo goes at once. Reduce Motion: no turn, the back face stays hidden. The cross on a refused photo and `refused` are gone, as is the `pop` animation it used. |
| Commit 11: the last round | The reveal of the round that is last in the plan as it is then ends the game (`transition`, `rules.js`); a player who leaves during a reveal can make it the last | Uses the existing plan shrinking (`removePlayer`) instead of a second notion of "last". Tested: a full game, a game of one photo (no leaderboard at all), a reveal that became the last. |
| Commit 11: entrances and repaints | The board's markup is always its final state (new order, ranks, totals), with the old values in `data-*`; `main.js` `startBoard` puts the start state over it in the same task as the paint and plays the steps, once per board (`session.shown`, cleared when this phone is back in a lobby) | The plan had the view read `session.shown`; but marking a board shown would then change the markup on the next repaint (every 250 ms) and cut the running entrance. With final markup a repaint can neither restart nor cut it, and a reconnect shows the end state. The same pattern serves the podium. |
| Commit 11: the board's steps | 0.4 s old order, 0.7 s count-up with the points chips popping in (`appear`), 0.7 s slide with the rows moving up lifted (`data-lift`: `scale-103`, `shadow-lift`, above the others), then the changed ranks pop; about 2 s | The round's points moved from the pick line ("✓ Ann +978") into a green chip beside the total, so they appear exactly when the total counts up; the screen reader label still says them. |
| Commit 11: FINAL ROUND | "Results are hidden" (muted) over FINAL ROUND (`text-8xl`, yellow, two lines by `w-min`), falling in at 2.6x and turned (`smash`, 0.6 s), landing at 45% with the screen's `shake` and the `land` vibration | Frames checked in Chrome; no new type size was needed. |
| Commit 11: animations never scroll the page | `#app` clips both ways (`overflow-clip`, was sideways only) | The shake moves the whole screen a few pixels down for 0.4 s, which would make the page scrollable meanwhile; `#app` grows with its screen, so only an animation's overshoot is clipped. |
| Commit 12: the podium's markup | Final state (everyone revealed), with the story played over it by `main.js` `startPodium` once per game end (`session.shown`): `data-covered` on each place (its dashed "?" shows, its player is invisible), `data-tense` on the "?" (its tremble, as long as the place's wait, `--tense-ms`), `data-go` on the player (pops in), `data-burst` on the winner (confetti); the facts, the ranking and "Play again" are hidden by `data-playing` on the screen and fade in with `data-ended` | The same pattern as the leaderboard. The hiding sits on the screen (layout) and reaches its parts through Tailwind's `in-*` variants, so "Play again" stays hidden even when its part is repainted mid-podium (someone else opened the next game). Hidden with `visibility`, so nothing moves when they appear. |
| Commit 12: the timeline | A 0.3 s breath, then third place trembles 1 s, second 1.4 s, the winner 2 s, 0.5 s after each reveal; ticks every 330 ms, the winner's from 400 ms down to 90 ms apart (about 13); a `land` at each reveal; about 6 s in all | The plan said about 6.5 s; the pauses are 0.5 s. |
| Commit 12: shared pieces | The confetti moved from the guessing screen into `ui.js` (`CONFETTI`), used by the reveal and the podium; `animate-winner` became `appear` for 0.6 s without its delay; the end screen's part is `results` (was `body`), the name `main.js` starts the podium by | One confetti, one pop; a part name no other screen uses. |
| Commit 12: the demo players | `demo-players.mjs` unchanged: its tap on "Play again" waits until the button is visible (Playwright does); `docs/guides/demo-players.md` says to stop the App Review recording once "Play again" appears | The plan listed a change to the script; it is not needed. |
| Commit 13: the player count in the store description | Built from `LIMITS.minPlayers` and `LIMITS.maxPlayers`, like the links from `SERVER.origin` (the listing's header says so); `config.js` names the README as the one written copy | One copy less of a config value. What's New stays written out: it describes this version only and is rewritten with the next. |
| Commit 13: the description's party bullet | "Reactions, a leaderboard between the photos, a secret final round and a podium at the end" | The plan's sentence left out the reactions the old bullet named; they are still part of the game. |
| Commit 13: the report sentences | Description: "Anyone can flag a photo: it is hidden at once and deleted for everyone." Test steps for the reviewers: tap the flag, the others stop seeing it at once, Delete photo deletes it for everyone, after `TIMING.flagMs` (15 s, built in) it is deleted anyway | A reviewer who waits sees the photo go by itself; the steps say why. The welcome screen and the terms speak of reporting (Delete photo), which still deletes at once (commit 5's decision). |
| Commit 13: What's New | Up to 16 players and over 130 avatars, photos ready faster, the swap's card turn, the overtaking leaderboard, the hidden scores of the final round, the podium, the flag, "Own photo" | What players notice first; plain words, no dashes. |
| Commit 13: the leaderboard screenshot | Taken 1.7 s after the rows appear (plus `snap`'s 0.5 s pause), when the entrance has just ended | With commit 11's 2.5 s wait the picture came 3 s into the 5 s board and its timer bar was almost empty (checked: the bar itself runs as before). Now it shows half, in the new blue to violet. |
| Commit 13: pass 2 | README: `clock.js`, `photos.js`, `upcoming.js` and `loader.js` in the app's file list, and both places of the version in Release; `docs/apps.md`: the `Phone` row names the big version and its iCloud choice (Haptics was named since commit 6); the demo guide: "Waiting on"; `ui.js` and `styles/app.css`: a big game shares the 12 player colours, the avatars tell players apart; AGENTS.md, Rendering: an entrance never changes a view's markup, `main.js` plays it over the final state once per screen key | The entrance pattern is a rule for the next change to an animation, so it belongs with the painter's rule. AGENTS.md's photo rules were updated in commit 7; its player colours note stays true. |
| Commit 13: version | 1.0.3 in `package.json`, its lock file and `APP.version` | Every player accepts the terms once more after the update (`termsToken`). No deploy and no upload: both are the operator's (Operator handoff). |
| Commit 13: the App Review video | Not recorded again here | It needs a real iPhone with the 1.0.3 TestFlight build; the review notes claim it shows the build under review (Operator handoff, to do 3). |
| Note of 23 November, at the deploy: a browser test failed once | The tests read a style through `styleOf` (`test/e2e/game.spec.js`), which finds the element and reads it in one step inside the page | The 16-player test found a dot of "who has answered" and read its ring in a second call; a bot's answer repainted the row in between, and the replaced dot read as an empty style. The app was right; the 3-2-1's background check had the same two-step read. `./scripts/deploy.sh` refused, as it should, and deployed after the fix. |
