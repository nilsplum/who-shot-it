# Publishing the Android app (operator guide)

Everything for Android is built and tested: `./scripts/release-apps.sh android` builds the
signed app and uploads it. What is left are the Google Play account and the one-time forms.
Follow the steps in order; each says where to click and what to enter. The answers match
the app and the privacy policy; the texts and images come from the Android listing
(`store/android_ios_listing.js`, `store/android_listing.js` and `store/images/android_*`).
`./scripts/dev.sh store` (Android) shows the page they make, and is the easiest place to
copy the texts from.

## 1. The developer account (once)

Google offers two kinds. Pick **organization** as soon as the D-U-N-S number for HiveDone
UG (haftungsbeschränkt) has arrived:

| | Organization (recommended) | Personal |
|---|---|---|
| Needs | D-U-N-S number, 25 USD once | 25 USD once |
| Shown on Google Play | HiveDone UG | your name (and contact details) |
| Before the public release | nothing extra | a closed test with at least 12 testers for 14 days |

1. play.google.com/console, sign in with the Google account that should own the app, Create
   developer account, choose the type, pay the 25 USD.
2. Enter the organization's details exactly as in the D-U-N-S record and the imprint:
   HiveDone UG (haftungsbeschränkt), Zum Isetal 1, 38518 Gifhorn, Germany. Contact email
   for players: whoshotit.info@gmail.com. Phone: +49 177 2438912.
3. Verify identity and phone as Google asks (it can take a few days).
4. EU trader status (Digital Services Act): Settings, Developer account, declare that you
   are a trader; the contact details above are then shown on the store page in the EU.

## 2. Create the app (once)

All apps, Create app: name `Who Shot It? Photo Party Game`, default language English
(United States), **Game**, **Free**, accept the declarations, Create.

## 3. The app's forms (once; Dashboard, "Set up your app")

| Form | Answer |
|---|---|
| Privacy policy | `https://who-shot-it.nils-plum.workers.dev/legal#privacy` |
| App access | All functionality is available without special access (no login). |
| Ads | No ads. |
| Content rating | Fill in the questionnaire (category: game). Users share content with each other: yes (photos, only with the players in a private game). No violence, no gambling, no purchases. |
| Target audience | 16 to 17 and 18 and over only (the terms say 16+). Not designed for children. |
| News app, health, financial features, government app | No. |
| Data safety | As `dataSafety` in `store/android_listing.js` says (each data type also: not processed ephemerally, required, for app functionality). |
| Photo and video permissions | Declare READ_MEDIA_IMAGES with `photoPermission` from `store/android_listing.js`. |

Main store listing: name, short and full description, icon, banner (feature graphic) and
phone screenshots, category, tags, contact email and website, all from the Android listing
(above).

Countries: Production, Countries / regions, add all.

## 4. The first release (once, by hand)

1. On this Mac: `./scripts/release-apps.sh android --no-upload`. The first run creates the
   upload key in `secrets/`: **back up the `secrets/` folder now** (a password manager).
2. Personal account: Testing, Closed testing, create a track, add at least 12 testers
   (their Google account emails), upload `dist/who-shot-it-<version>.aab`, roll out; after
   14 days with 12 testers apply for production access. Organization account: go straight
   to Production, Create new release.
3. Upload `dist/who-shot-it-<version>.aab`, accept **Play App Signing** (Google signs what
   players install; a lost upload key can then be replaced). Release name: the version.
   Release notes: "First version." Save, Review release, Start rollout.
4. Google reviews the app (hours to a few days). Friends with Android can test earlier:
   Testing, Internal testing, add their emails, and share the link Google shows.
5. Once the app's page is public on Google Play, set `STORES.android` in
   `web/shared/config.js` to it and run `./scripts/deploy.sh`, so shared invite links show
   the Google Play button too (it stays hidden while the page would say "not found").

## 5. Automatic uploads from then on (once)

1. console.cloud.google.com: create a project (for example "who-shot-it"), APIs and
   services, enable **Google Play Android Developer API**.
2. IAM and admin, Service accounts, Create service account (name "play-upload"), no roles.
   Open it, Keys, Add key, JSON: a file downloads. Move it to `secrets/google-play.json`
   in this repo (never commit it; `secrets/` is git-ignored) and back it up with the
   upload key.
3. Play Console, Users and permissions, Invite new users: the service account's email
   (from the JSON file, `client_email`), app access "Who Shot It?", permissions "Release
   to production, exclude devices, and use Play App Signing" and "Release apps to testing
   tracks". Invite.

## 6. Every later release

Raise `"version"` in `package.json`, then `./scripts/release-apps.sh android` (or without
`android` for both stores). It tests, builds, signs and uploads to the production track;
Google reviews it and then it goes live. `--android-track internal` sends it to the
internal testers instead.
