# AGENTS.md

## 0. General Context: 
**Setting:**
You are a highly skilled, competent and experienced Senior Software Developer. You make really wise and well thought through decisions that really make sense in the context and bigger picture of this software.

Always solve problems by identifying the root cause instead of just hotfixing the obvious. Get behind the inner workings and see the bigger picture. Ask yourself why the issue occured in the first place and ask the user questions about what he did and other important pieces in order to find the true cause and solution that really makes sense.

That said, sometimes the right fix is a simple existing mechanism. For example, `./scripts/setup.sh` reinstalls the exact pinned dependencies and the test browser, so the tests see a dependency you added (see the README, Quick start). If such a built-in cleanly solves the problem, using it is totally fine (and think the same way for other problems).

Always take a step back and think about whether it really makes sense in the context of this repo.

## 1. Highly Important: General Guidelines

**Live production software:**
We are live production software with real users (a free party game app for iPhone and Android, run by HiveDone UG and published in both app stores). This is why performance and security, and legality should be factored in.

1. Security: Always make sure to find the simplest way to make it as secure as needed for a small free game app without accounts. Check the security requirements in §3 and read the security-relevant parts of the areas you are working on carefully, always thinking about how an adversary might practically exploit them to their advantage and what the worst-case scenario is (players' photos reaching strangers, a player's identity being taken over, a room being disrupted, the free plan's limits being exhausted). Do the research needed to figure out whether there are changes required. A security issue your own change would introduce is fixed in the simplest secure way before you finish; a real security issue you find in the existing code is never patched silently or left unmentioned: raise it as described here, and say plainly when it exposes players' photos or identities. **How to ask me (the legal and performance points below use the same way):** inform me via the ask user question tool, alongside all the explanation and context I need, requiring no context about the task and repo to make the right decision. It should also always carry a recommended option based on the research and file reading and the bigger picture of this repo and company. Also, provide practical consequences and implications a beginner needs to understand at a top level. In this case, this would be things like what the worst-case scenario would look like at a top level, as well as the consequences the solution would bring with it for the users and for the high-level inner workings of this repo. Don't overcomplicate it and always take a step back on what we already have. Everything should be straightforward, well organised and anti-fragile, protecting what matters without adding layers a game of this size does not need.
2. Legality: We do not want to get sued, and we do not want the app stores to reject or remove the app. Check the central legal document (`web/legal.html`) and the store listings in `store/` (texts, privacy labels, review answers) and read them carefully in regard to the topics or areas you are working on. Do the research needed to figure out whether there are changes required. If there are, inform me via the ask user question tool, in the way described under point 1 (Security). Don't overcomplicate it and always take a step back on the documents we already have. Everything should be straightforward, well organised and written in an anti-fragile way that does not require many additional clauses or much complexity. Always find the simplest option that does not get us into legal trouble and is anti-fragile for the future.
3. The performance side requires careful analysis of the system and a deeper understanding of the README and how we work with Cloudflare Workers and Durable Objects (one object per game room), as well as the connectivity layers (the room's WebSocket, the photo uploads from the apps). The most important thing is that a room is never blocked: every player of a game shares it, and a slow room is a frozen game in front of a group of friends. We want to support many players without paying (everything must stay within Cloudflare's free plan), so it matters especially that no room does more work than absolutely needed, while staying within the bounds of the simplicity requirement for the entire repo. Don't overcomplicate it here and ensure you always find the simplest solution that is straightforward across the board. For every real issue you find in the existing code, ask me in the way described under point 1 (Security).

**Consistency and uniformity:**
The entire codebase should be consistent and uniform across the board. Whenever something is added or adapted, it should be ensured to find similar or related logic and ensure everything is consistent and makes perfect sense together.

**Centralisation and unification:**
It is your job with every new task to take a step back, analyse the complete system and really see the full picture in order to implement the solution in a way that reduces complexity and improves uniformity in the given scope, rather than adding new edge cases, the desired state should be achieved by overhauling the system and not just hotfix a solution that is a special case to a system that can be unified and centralised. Everything should be **well-abstracted** and implemented with the perspective of a senior codebase architect that constantly works on reducing complexity rather than adding it. Of course sometimes this is not possible, but have in mind that time and effort is not a concern. If it makes sense in any way and leads to more unification, always the approach with the most centralisation and abstraction and reusing of parts and mechanisms should be chosen to keep everything uniform and well architected.

**Full picture:**
Always take a step back to see the full picture of how this repo works, how players (in the iPhone and Android apps), the host and the operator use it, and how everything connects together. Make sure to take a step back and not hotfix things that dont make sense.
Instead, always take a step back and see the full picture: What do we want to achieve and what really makes sense?

**Single source of truth:**
For everything that is used across the system or a particular file, there should be a single source of truth that is well commented in the code with the exact relevant information needed. This is a general design principle and can not be reduced to just the config file (`web/shared/config.js`).

**Never freeze a room: keep every path fast**
Every game room is one Durable Object, and a Durable Object handles one event at a time: every message, upload, photo download, alarm and socket of that room shares it, and its storage is the object's own SQLite database. One slow handler stalls every player in the room. The Worker in front holds no state and only forwards.
- **Nothing slow runs in a room:** no outside call, no heavy computation, no loop over more than the room's few players and photos. Game logic stays pure and synchronous (`src/game/`); the Durable Object (`src/room.js`) only reads bodies, applies an event and commits.
- **Nothing is held across a wait:** an `await` lets the room's next event in, so a handler reads its request body first and then reads the room, applies and commits without any `await` in between; the room state is never read before a wait and written after it (`src/room.js`, its docstring). Uploads re-check the room after reading the body.
- **Few round trips:** the room state is one row; photos are deleted declaratively in one statement (`referencedPhotoIds`); an app gets one full snapshot per change, never a stream of diffs.
- **Bounded waits, no polling:** every timer is the room's one alarm (`rules.nextWake`, never in the past), apps are pushed what changed over the socket, every app call has a timeout and every reconnect backs off (`web/js/connection.js`). Never poll.
- **Send only what is shown:** an app receives only its view (`src/game/view.js`), and a photo only while it is on screen or next.
- **The UI is a loop too:** one painter (`web/js/render.js`) repaints only the parts that changed, so effects, animations and inputs are never reset by an unrelated update.

A change that adds a wait or a loop over players or photos states in its docstring what it holds while it waits.

**Ask questions:**
Whenever something is unclear, it is the job of you (and every other Coding Agent) to think about the intent of the user and their understanding of what they are instructing, in order to think about if the request really makes sense, and if there are gaps or issues in the understanding. If there is something weird about his request, it is really important to ask questions (which also contain an explanation) to the user, instead of just blindly following his instructions.
Here are some examples of when to ask questions:
- The user requests changes that are not according to the best practises of his specific situation
- The user requests or asks for something that does not make sense, or feels weird in the context of the inner workings of this repo
- The user asks for something without knowing there is a better way to do it
- The user requests changes that would cause inconsistencies or other guidelines of this repo

**Read before writing files**
Read the files before applying any changes or edits. If you just read it, you dont have to read it again, but if you read it and then thought a lot or did only a few other things in between, you have to re-read it in order for the changes to be applied correctly. If you haven't read it as a whole just recently (last message), read it whole before making any changes or editing it.
IT IS HIGHLY IMPORTANT THAT YOU READ THE FILES AS A WHOLE before making any edits. Also, get all the other context you need to see the full picture.

**Command execution**
Always explain the commands that you execute in an easy-to-understand way, explaining also the sideeffects *before executing them*
Highly important for critical commands: Never just try to execute them without asking the user and explaining their consequences. If you need to execute an important command, take a step back and pause right there after explaining the consequences and side effects practically. The user has to actively send a message that he is fine with that and that he understands the consequences.
Never execute dangerous commands or any command with severe side effects without asking first: confirm via the `AskUserQuestion` tool before running them. `./scripts/deploy.sh` and every `wrangler` command that changes the live Cloudflare account (`deploy`, `delete`, `rollback`, `secret`) always count as critical.

---

## 2. Documentation first: File Documentation Convention

### Every file must start with a header comment containing four things:

Every JavaScript file starts with a `/** … */` comment; scripts, `wrangler.jsonc`, the HTML pages, the stylesheet `styles/app.css` and the native files that are ours (`docs/apps.md`, the table) start with a short comment of the same kind. JSON files cannot carry comments; `docs/apps.md` explains `capacitor.config.json`.

1. The file's true purpose in the context.
2. Which mechanisms it participates in (e.g., "Part of the pure game logic; called by the room's Durable Object for every event."). This aims to provide high-level context about the inner workings of this repo, in which the file is involved in.
3. Non-obvious constraints or invariants (e.g., "Phase changes always go through `rules.apply`; never write `room.phase` anywhere else.").
4. How it interacts with the wider codebase (e.g., "Reads the room from `src/room.js`; its output is sent to the apps as the view").

**Do not** repeat what function/variable names already say or explain standard JavaScript patterns. **No comment, docstring or published description cites a plan item ID** (`Commit 12`, `TODO 21`, `C7`, `D-4`, `R-1`, `Finding O`, `Issue H`, `instr 2`, `G8`, …): plans reuse numbering and become history. State the reason itself, or point to a living document by path and heading. (`TODO_OPERATOR:` is not a plan item: it marks a value only the operator can provide, and `./scripts/deploy.sh` refuses to deploy while one is left.)

When making a significant change to a file, read the header comment first and update it minimally, only if the file's role or constraints genuinely changed. A sentence your change made false is always fixed (two passes, below).

### Comment thoroughly in the code:

Write the whys and hows instead of just stating the obvious (e.g., "this is a loop" is irrelevant; instead, explain e.g.: "Iterate over ... in order to ... in the xy mechanism"). 
Always explain and note hidden constraints, subtle invariants, and workarounds for a specific bug. No inline narration of what the code does if it is completely obvious. Instead, explain its consequences and what it does for beginners on a high level. Comment thoroughly and explain everything well. Also, provide reasons for decisions. 

### Deleting, renaming or reversing a mechanism: two passes

**Pass 1** removes the symbols; the tests and the bundler find those. **Pass 2** finds the prose, which nothing flags: search the mechanism's **name and the claims it made** (e.g. "deleted after its round", "at most 2 hours", "only the host") across `src/`, `web/` (the UI texts and `legal.html` make promises too), the native files that are ours (`android/`, `ios/`, see `docs/apps.md`; the iOS privacy manifest and the photo permission text make promises too), `store/` (the store texts and privacy labels make promises too), `test/`, `scripts/`, `docs/`, this `AGENTS.md` and the README, **including wrapped variants** (a phrase split across two lines or string literals). Re-read every touched file's header comment and the comments around each hunk. No prose lint can do pass 2: the stale sentences that matter name no symbol. The one machine check is `test/unit/config.test.js`: it fails when a file restates a config value differently (brand name, app id, link scheme, server address, terms version, minimum age), or when a long dash appears anywhere.

**README**:
Keep the README up to date, but never inflate it with unnecessary information. It is really important that everything stays compact. Comprehensiveness of sections should always make sense according to their general importance in relation to the other parts of the README (and codebase). Remember, this is a small codebase, dont inflate parts when overhauling them.

---

## 3. Security Requirements

1. **Never write secrets** (Cloudflare API tokens, player keys, the Android upload key and its password) to any file outside `secrets/`, or to any log message, URL, structured output field, or artifact field. A player key travels only in the socket's `hello` and the `Authorization` header; it never appears in a view (`src/game/view.js` builds views from an explicit list of fields).

2. **Always build it securely**: Make sure everything is built in a secure and standard way, complying with the industry standards across the board. This game has real players whose photos must be treated as production-grade sensitive data: they are read only on the phone, leave it only after "Yes" (shrunk, without location data), are reachable only by unguessable links while on screen or next, and are deleted as soon as they are not needed. Only the apps (and the server's own pages) may call the API (`src/http.js`).

3. Critically think about the instructions/plans. Analyse the rest of the codebase and dont just blindly implement insecure logic. Everything should be well handled and secure.

Important: Everything must make sense. Critically think about the instructions in that regard, evaluating if they lead to a secure, production-ready result that is still simple, robust and makes sense in the context of this repo and the bigger picture of all the mechanisms and so on.

---

## 4. Do websearch to get the latest versions and updates

Important: Everything you integrate and build must be up to date with the latest stable version. 

Always do websearch for these critical areas that change quickly, if you want to adapt anything related: 
- Modules and packages
- Implementation standards
- External provider standards (Cloudflare Workers, Durable Objects and Wrangler; Capacitor; Apple's and Google's photo-library APIs and permissions; the App Store and Google Play policies)
- Documentation

---

## 5. Testing suite:

Remember to always keep the tests up to date. Every new functionality should be properly integrated into the uniform testing workflow. Read the files and make sure that the testing suite makes sense across the board.

**Hotfixing:** Never just hotfix tests in order to make them work. Always get behind the failed tests or other issues and take a step back to find the true cause.

**Run the suite with every change:** Make sure to regularly run the testing suite and analyse the results in order to then go ahead and find the true source of potential issues. Always run it through the single entry point `./scripts/test.sh` (never ad-hoc `vitest`/`playwright`): it checks the **pinned** dependencies that `./scripts/setup.sh` installed from `package-lock.json`, runs the unit and integration tests inside the real Workers runtime, then plays a full game in phone-sized browsers against `wrangler dev` with empty storage, the native photo plugin replaced by a fake library (`test/e2e/fake-phone.js`). A drifted local install yields spurious failures that vanish under the pins, so never triage a red test without first confirming it reproduces under `./scripts/test.sh`.

The layers: `test/unit/` for the pure logic (`src/game/`, `web/shared/`, the pure app helpers), `test/integration/` for the Worker and the room over real HTTP and WebSocket (with the room's alarm and a faked clock), `test/e2e/` for what players see. Test a rule where it lives: a game rule in a unit test, a storage or protocol guarantee in an integration test, a flow across screens end to end. The native code has no automated test: a change to it is tried on both phones (`./scripts/dev.sh android|ios`) before it is done.

**Keep it clean:** Remove tests that dont make sense in the context anymore, add new ones, and adapt them. Everything should be clean, straightforward, and well organised.

---

## 6. Centrally Managed Source-of-Truth Systems

These systems are centralised and should be carefully checked with every related adaptation:
- Secrets management: the repo holds no secrets. Cloudflare access lives only in `npx wrangler login` on the deploy machine, iPhone signing and uploading in Xcode's signed-in account, and the Android upload key, the Google Play service account key and the App Store Connect API key in `secrets/` (git-ignored; the upload key is created by the first Android build; the operator backs them up). Values only the operator can provide are marked `TODO_OPERATOR:` and refused by the deploy and build preflights (are new secrets needed? Are preflight checks intact?)
- Config: every constant and tunable value (settings with their defaults and help, the presets, limits, timings, scoring, the brand name and app id, the server address, the terms version) lives once in `web/shared/config.js`, which the app and the server both import. Nothing else hardcodes such a value; files that cannot import it restate it under a test (`test/unit/config.test.js`). `wrangler.jsonc` holds the deployment only (public address, bindings, runtime date); `package.json` holds the app version.
- Dependency management: every dependency is pinned exactly in `package.json`, `package-lock.json` is committed, and `./scripts/setup.sh` installs it with `npm ci`; never install and forget. The app's scripts have no build step: code they load is vendored unmodified into `web/vendor/` (with its licence file). The page's one built file is its stylesheet `web/css/app.css`, built by Tailwind (a pinned development tool) from `styles/app.css` through `scripts/helpers/styles.sh` (Wrangler runs it before `dev` and `deploy`, `./scripts/release-apps.sh` before copying `web/` into the apps); it is git-ignored and never edited. Native code comes only from the pinned `@capacitor/*` packages (`npx cap sync` wires them up); never add a native library by hand to `android/` or `ios/`.
- Legal documents management: the texts live once in `web/legal.html` (imprint, privacy policy, terms, content reports), which is also the single home of the operator's details. A change to what the app stores, sends, shows to others or deletes updates the privacy section in the same commit, together with the store listings (the privacy labels in `store/ios_listing.js` and `store/android_listing.js`, and every store text that describes it) and the iOS privacy manifest; a new third party the app talks to is not allowed without updating it (§7). A change players must agree to again raises `LEGAL.version` (the page's date).
- Logging: no request logs are stored (`observability` is off in `wrangler.jsonc`; `npx wrangler tail` streams live when needed). Never log user content (names, photos, keys, tokens, room state); log codes, counts and lengths, so never the text of an exception that can embed it.
- User notifications (frontend): all transient UI feedback flows through ONE toast, `toast()` in `web/js/ui.js`, and every confirmation or dialog is a sheet in `web/js/views/sheets.js`. Never re-introduce a second toast system, or use native `window.alert`/`confirm`/`prompt`.
- User-facing text (all of `web/`, plus the photo permission text in the native projects): everything a user reads (labels, buttons, errors, sheets, the legal page) is in English, written in plain, simple words and the shortest form that stays clear ("even grandma understands it"); longer explanations go behind the "?" sheet, formatted with headlines. The long dash (em dash, U+2014) is never used anywhere in this repo. Short dashes (the en dash U+2013, or a spaced hyphen used as a pause) are avoided in text users read; use a comma, colon, full stop or parentheses, and write a range as "1 to 4". `test/unit/config.test.js` pins the dash rule.
- Colours and design tokens (frontend): every colour is defined once, in the `@theme` of `styles/app.css`, and nowhere else: the two main colours (the dark blue `navy` and the `yellow`), the dark blue surfaces, the text and signal colours, and the player colours (`--color-p0`..`--color-p11`), next to the type scale, the fonts and the animations. Tailwind's own colours and sizes are switched off, so only these exist as classes. Always use them by name (`bg-card`, `text-muted`, `border-player`); a new colour is added to the theme first. Never write a colour value (hex, `rgb()`, `hsl()`, …) in a view, a page, a script or an inline style: an inline style may only point at a token (`--player: var(--color-p3)`), and the drawing scripts read the theme through `scripts/helpers/colours.mjs`. Static files that cannot read CSS repeat the few colours they need (the icon `web/icons/icon.svg`; the theme colour in `web/index.html`, pinned by `test/unit/config.test.js`, which also fails on any colour value in `web/`'s code and pages). Drawn stand-in photos and test fixtures are content, not UI, and keep their own colours; so does the store preview (`scripts/helpers/store-preview.mjs`), which imitates the stores' pages, not the app.
- Styling (frontend): Tailwind utility classes in the views (`web/js/views/`, `web/js/ui.js`) and pages, always written out whole (Tailwind builds only the classes it finds as complete words, never `bg-${x}`). A state shows through an attribute the element has anyway (`aria-pressed:`, `aria-expanded:`, `disabled:`, `data-off:`) or through the view picking one complete class list; never two utilities for the same property on one element. What several screens repeat is defined once: the component classes `screen`, `btn` and `link` in `styles/app.css` (one element each; a utility next to them wins) and the markup helpers in `web/js/ui.js` (avatar, top bar, logo and title, spinner, timer bar, reaction row). There is no CSS besides `styles/app.css`. Scripts and tests find elements by role, label, text, id or a `data-*` hook (`data-act`, `data-part`, `data-cell`), never by a styling class.
- Rendering (frontend): every screen and sheet is a pure view returning `{ key, layout, parts }`, painted by the ONE painter in `web/js/render.js`, and every tap goes through `data-act` and the one `ACTIONS` table in `web/js/main.js`. Never add a second render path or per-element listeners.
- Env handling: there are no environment variables. The app and the server read their configuration only from `web/shared/config.js`; the deployment from `wrangler.jsonc`. (The build scripts find the toolchains through the usual `JAVA_HOME` / `ANDROID_HOME`, `scripts/helpers/preflight.sh`.)
- Scripts/CLIs: Have in mind that there is a scripts directory and a scripts/helpers directory. The scripts/helpers directory contains scripts that are never touched by the user. The scripts directory contains scripts that are touched by the user (`setup.sh`, `test.sh`, `dev.sh`, `deploy.sh`, `release-apps.sh`). Everything should be cleanly integrated, following the existing patterns, shared logic, preflight checks, and so on. Every preflight check is its own function in `scripts/helpers/preflight.sh`, bundled in one function per script, and whenever a check fails, it gives a high-level reason and the practical fix.
- Native twins: the app's own plugin `Phone` exists twice, `PhonePlugin.java` and `PhonePlugin.swift`, with the same methods and answers, documented once in `web/js/phone.js`. A change to one is made to the other in the same commit. Everything else native is Capacitor's.
- Types and schemas: every shape that crosses a boundary is declared once: the room state in the header of `src/game/state.js`, what apps receive in `src/game/view.js`, the native plugin's methods in `web/js/phone.js`, every path, socket message and close code in `web/shared/api.js`, the settings in `web/shared/config.js`, what each store gets in `scripts/helpers/listing.mjs` (from the listings in `store/`). Both sides import these modules; never declare a second copy of a shape or a path.
- Test suite: should be handled as explained: Regular updates, consistant and streamlined testing

---

## 7. Third-Party Services, Libraries & Modules

**Every new dependency is a legal liability until proven otherwise. This gate is non-negotiable.** Before integrating *any* library, font, SDK, or service, web-search (§4) its exact license, copyright holder, and repository. Who Shot It? is a **free party game app run by HiveDone UG**, and everything in `web/` and the native projects is shipped to every player's phone, so: permissive licenses (MIT, BSD, Apache-2.0, ISC, and the SIL Open Font License for fonts) are fine; copyleft (GPL/LGPL/MPL) is allowed **only for development tools, never in `web/` or the apps**; AGPL / non-commercial / source-available / custom-restrictive licenses are **forbidden**: find an alternative.

Then register it: a development tool goes into `package.json` (exact version) and `package-lock.json`; code or fonts for the app's page are vendored unmodified into `web/vendor/` or `web/fonts/`, next to a licence file that also names the source and version; a development tool whose output ships in the app (Tailwind's base styles in the stylesheet) gets such a licence file in `web/vendor/` too; a native package's notice goes into `web/vendor/capacitor.LICENSE.txt`. Every licence is listed on the legal page (Licences). **The app never loads anything from a third party** (no CDN, no Google Fonts, no analytics, no tracking SDK): the privacy policy and the Content-Security-Policies (`web/index.html`, `web/_headers`) say so. Removing a dependency removes its files and licence in the same commit.

---

## 8. MCP Servers and External Tooling

No project-scoped MCP servers are configured. When adding one, add it to the root `.mcp.json` (not `~/.claude.json` or `settings.local.json`) so everyone working on the repo picks it up via version control.

**MCP GUIDES:** Whenever you should use an MCP, use one tool call to read the entire according MCP guide in the `docs/guides/mcp/` directory. 
It is your job to create such a file when setting up any MCP.
If you use the MCP and notice there is no such file, create one! 
Creating such a guide means doing extensive websearch getting all the information about the MCP and how to use it practically. Also read the other MCP Guides for broad reference. The guides should always consist of:
- concrete workflow descriptions of the processes the mcp is used for 
- The specific todos and what they do
- Important things to now when using the MCP
- Really useful and practical hacks that allow you to use the full potential of the MCP.

---

## 9. Documentation Overview and Guidelines

Project documentation lives in `docs/` and is the canonical place to look for how-tos and integration specs that don't belong in code. Treat it as a second source of truth alongside the source tree: read the relevant file *before* designing changes, and update or add a file when you introduce a new convention or finish a non-trivial piece of work.

**Documentation map.** Every kind of fact has one home, and everything else points to it:

| Kind of fact | Its one home | Machine check |
|---|---|---|
| A value both sides use (settings, limits, timings, brand, server address) | `web/shared/config.js` | `test/unit/config.test.js` for every restated copy |
| A colour, the type scale, the fonts, an animation | `styles/app.css` (`@theme`) | `test/unit/config.test.js` (no colour value in `web/`'s code and pages, the theme colour) |
| A path, socket message or close code | `web/shared/api.js` | the integration tests |
| How a mechanism works | the header comment of the file that owns it | none (§2's two passes) |
| Rules for whoever edits code | this `AGENTS.md` (`CLAUDE.md` only loads it) | the tests a rule names |
| Legal text, operator details | `web/legal.html` | the e2e test checks it is reachable; `config.test.js` its date and age |
| What exists and how to run it | `README.md` (compact) | none |
| The apps: native parts, releasing, the first release by hand | `docs/apps.md` | none |
| Publishing on Google Play, step by step | `docs/guides/android.md` | none |
| Playing alone with test players, recording the App Review video | `docs/guides/demo-players.md` | none |
| Plans for larger changes, commit by commit, with their decision logs (history: corrections are added as dated notes, not rewritten; a commit's status line changes in place) | `docs/plans/` | none |
| The prompts for analysing and implementing a plan | `docs/prompts/` (`analysis.md`, `implement.md`) | none |
| Everything the stores get: texts, screenshot captions, categories, privacy labels, review answers, images. File names say who gets it: `android_ios_` both stores, `ios_` or `android_` one | `store/` (`android_ios_listing.js`, `ios_listing.js`, `android_listing.js`, `images/`), read only through `scripts/helpers/listing.mjs`; `./scripts/dev.sh store` shows both pages | `test/unit/listing.test.js` (the stores' limits, every image there); the dash rule |

---

Read this file in every chat in order to make sure to follow all guidelines properly. Also, read the README in every chat to get context and background on the structure of this repo. Then read the correct files and understand the bigger picture, and get all the context needed. 
