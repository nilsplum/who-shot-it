# Drafts

Screens and animations tried out in the browser before they go into the app: each draft
shows on phone-sized screens with the app's real look (its views, theme, fonts and helpers),
side by side when there are several ideas to compare. Nothing here ships: the apps and the
server are built from `web/` and `src/` only.

## Start

| Command | What it does |
|---|---|
| `./scripts/dev.sh drafts` | Lists the drafts: type to narrow, ↑ ↓ to choose, Tab completes, Enter opens, Esc quits. |
| `./scripts/dev.sh drafts results` | Opens the one draft that fits right away. |

The chosen draft opens in the browser at `http://localhost:8789/<name>/` (8787 is the game,
8788 the store preview). While it runs, every draft has its address there, and
`http://localhost:8789/` lists them. A change to any file in `drafts/`, or to the app's code
and styles a draft shows (`web/js/`, `web/shared/`, `styles/`), reloads the open pages.
Started again while it runs, it only opens the draft.
Ctrl+C stops it. It checks Node, the dependencies and that there is a draft first
(`scripts/helpers/preflight.sh`); the server is `scripts/helpers/drafts.mjs`.

## The page

- The draft's screen in a phone frame per idea (its `frames`), scaled to fit the window.
- **Show**: all frames or one. **Phone**: 360 x 640, 375 x 667 or 393 x 852. **Reduce
  Motion**: the screen shows its final state at once, as the app does. Plus the draft's own
  controls. Every choice stays in the address.
- **Replay** under each phone, **Replay all** above them (or the R key).
- A browser cannot vibrate: when a screen plays one of the app's vibrations, its phone jolts
  and names it (light tap, firm pulse, two firm pulses, buzz, heavy thud).

## A draft

A folder `drafts/<name>/`, its name in lower case (letters, digits, underscores):

| File | What it is |
|---|---|
| `draft.js` | The page: `title`, `note`, `frames` (`[{ id, title, idea }]`, one phone each) and `controls` (`[{ key, label, options: [[value, label]], value }]`). |
| `screen.js` | The phone's screen: paints into `#app` like the app does, once per frame. |
| `style.css` | The screen's stylesheet, written like the app's `styles/app.css` and built by Tailwind the same way: it starts with `@import '../../styles/app.css';` and `@source '.';`, then adds what the app does not have yet (theme entries such as `--animate-…` with their `@keyframes`, `@utility`, plain CSS on the theme's variables). |
| anything else | Modules the screen imports, by relative path. |

A screen can use:
- `/kit/screen.js`: `options` (this frame's `frame` and every control's value, as strings),
  `reduceMotion`, `buzz(kind)` (the app's `tap`, `yes`, `no`, `count`, `land`) and `wait(ms)`.
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
