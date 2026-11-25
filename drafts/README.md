# Drafts

Screens and animations tried out in the browser before they go into the app: each draft
shows on phone-sized screens with the app's real look (its views, theme, fonts and helpers),
side by side when there are several ideas to compare. One draft is one kind of thing (the
countdown, the reveal, the podium): its ideas are its frames, and a different kind gets a
folder of its own. Nothing here ships: the apps and the server are built from `web/` and
`src/` only.

## Start

| Command | What it does |
|---|---|
| `./scripts/dev.sh drafts` | Lists the drafts: type to narrow, ↑ ↓ to choose, Tab completes, Enter opens, Esc quits. |
| `./scripts/dev.sh drafts results` | Opens the one draft that fits right away. |

The chosen draft opens in the browser at `http://localhost:8789/<name>/` (8787 is the game,
8788 the store preview); `http://localhost:8789/` opens the first. While it runs, every
draft is one click away in the page's top bar. A change to any file in `drafts/`, or to the
app's code and styles a draft shows (`web/js/`, `web/shared/`, `styles/`), reloads the open
pages. Started again while it runs, it only opens the draft.
Ctrl+C stops it. It checks Node, the dependencies and that there is a draft first
(`scripts/helpers/preflight.sh`); the server is `scripts/helpers/drafts.mjs`.

## The page

- **Top bar:** every draft by its folder (the current one marked), and **Play all** (or the
  R key).
- **Choices:** on the left the draft's own, **Show** (all frames or one) and its controls;
  on the right the viewer's, **Phone** (360 x 640, 375 x 667 or 393 x 852) and **Reduce
  motion** (the screen shows its final state at once, as the app does). Every choice stays
  in the address; the phone and Reduce motion stay when you switch to another draft.
- **The phones:** the draft's screen in a phone frame per idea (its `frames`), each with its
  title and **Play** under it, as big as the window allows: side by side when they fit at
  half size or more, else shared out evenly over the rows (one per row on a phone).
- Nothing plays by itself: opened, after a choice or after a change, every phone shows its
  screen's final state, so a page with several phones never starts them all at once.
- A browser cannot vibrate: when a screen plays one of the app's vibrations, its phone jolts
  and names it beside its Play (light tap, firm pulse, two firm pulses, buzz, heavy thud).

## A draft

A folder `drafts/<name>/`, its name in lower case (letters, digits, underscores):

| File | What it is |
|---|---|
| `draft.js` | The page: `title` (the browser tab), `frames` (`[{ id, title }]`, one phone each) and `controls` (`[{ key, label, options: [[value, label]], value }]`). What each idea does is said in the header comment of the file that plays it. |
| `screen.js` | The phone's screen: paints into `#app` like the app does, once per frame. |
| `style.css` | The screen's stylesheet, written like the app's `styles/app.css` and built by Tailwind the same way: it starts with `@import '../../styles/app.css';` and `@source '.';`, then adds what the app does not have yet (theme entries such as `--animate-…` with their `@keyframes`, `@utility`, plain CSS on the theme's variables). |
| anything else | Modules the screen imports, by relative path. |

A screen can use:
- `/kit/screen.js`: `options` (this frame's `frame` and every control's value, as strings),
  `play` (Play started this frame and Reduce Motion is off: play the story; otherwise
  show the final state), `reduceMotion`, `buzz(kind)` (the app's `tap`, `yes`, `no`,
  `count`, `land`) and `wait(ms)`.
- The app's own modules at the app's paths, the real ones: `/js/ui.js`, `/js/views/*.js`,
  `/js/render.js`, `/shared/config.js`. A draft shows what the app would.
- Every class and theme value of the app, and every Tailwind class the draft writes
  (its `style.css` imports the app's and scans the draft's folder). Write markup the way
  the app's views do: whole class names, states through `data-*` variants
  (`data-go:animate-demo-pop`), so a chosen draft moves into the app as it is.

**A new draft:** copy `demo/` to `drafts/<name>/` and change it. It is there at once, at
`http://localhost:8789/<name>/`; `test/unit/drafts.test.js` checks its shape.

## Rules

- Stand-in content only: invented players, drawn or no photos, never real people.
- The app's design: colours only by their theme names (`var(--color-…)`, `bg-card`),
  never a colour value (`test/unit/config.test.js` checks the drafts too); the app's fonts
  and easings.
- Nothing from elsewhere: no CDN, font or library from the internet (the page's policy
  blocks them). A new library goes through AGENTS.md §7 like any other.
- Like every file in the repo: a header comment (AGENTS.md §2), no long dash.

## From draft to app

A draft is a proposal. The one that is chosen is built into the app like any other change
(AGENTS.md: a plan when it is big, tests, tried on both phones): its markup into the view in
`web/js/views/`, its theme entries and utilities into `styles/app.css` (they are written the
same way), its timeline into the app's code, as the app plays an entrance (the view paints
the final state, the story is played over it once). The draft can then show the app's own
code beside the proposal (as "Supercharge, in the app" does), and stay as a record or go.

## The drafts

| Draft | What it tries out |
|---|---|
| `demo` | The example to copy: a small lobby whose players arrive in two different ways. |
| `results_animations` | Five ways to reveal the podium at the end of a game, each building up for third, second and first place, with fireworks for the winner, on the end screen as it was then (`end_before.js`). Shared: `stage.js` (the scene and the moves), `fx.js` (sparks and light), `fireworks.js`. Left of the draft "Supercharge", the chosen one as the app plays it: the app's own end screen and `web/js/podium.js`. |
| `reveal_animations` | The answer of a round, in the style of Supercharge and Jackpot: first the owner's card turns green, then (when I was wrong) my card turns red, then my own card pops in the colour of my result (green with gold coins and my points rising, or red with "Wrong"). The chosen one: beside it as the app plays it (`app.js`: `web/js/reveal.js` over the app's own round screen). |
| `leaderboard_animations` | The leaderboard between two rounds: coins rolling up the totals like a slot machine, and the gold medal flying to the new leader. `views.js` is the board built like the app's, the light is the app's own `web/js/sparks.js`. It was chosen and is built into the app; beside it, the app as it plays it (`app.js`: `web/js/board.js` over the app's own board screen), which differs in having no timer bar, a closer spread of coins at big tables and the medal only for a leader with points. |
| `streak_animations` | A streak (right answers in a row) on the reveal and the leaderboard: my points stay above a badge at the bottom of the photo and slide aside, a second number, the bonus, appears next to them under a tower of blocks (a block for every number, each later and livelier, adding +100 to the bonus), and the bonus slides into my points, which count up. The leaderboard shows the streaks as small badges on the avatars. The chosen one, beside it as the app plays it (`app.js`: `web/js/reveal.js` and `web/js/streak.js` over the app's own screens), which is smaller and gentler. |
| `bubble_animations` | Three ways for the lobby to tease the one player the group still waits for (docs/plans/2026-11-25-lobby-and-start.md): a big bubble with the line, in very fat white text that bulges as if printed on a ball, and smaller bubbles with the player's name. Soap bubbles (an iridescent soap bubble, small ones rising past it and popping), Comic chorus (a pop-art speech bubble in the player's colour, the others' small bubbles calling the name in turn; the chosen one; the plan's section 3.3 names what it changes in the app) and Gummy orbit (a glossy jelly sweet, glass marbles with the name circling it in 3D). Over the app's own lobby (`lobby.js`); shared: `bulge.js` (the bulging text), `stage.js` (the lines, the moves). |
| `countdown_animations` | Four ways to play the 3-2-1 before the first photo: Lens (a ring that fills like a clock, an iris that clicks open onto the photo), Self-timer (focus brackets, the blinking lamp, a shutter in the photo's frame), Film leader (the cinema countdown, cut to the photo; the chosen one, beside it as the app plays it: `web/js/countdown.js` and its cover in `views/overlays.js`) and Pulse (a heartbeat, released as a wave). All on one clock (`stage.js`): the numbers on the room's seconds, the release on the start of the round; the round under them is the app's own (`round.js`). |
