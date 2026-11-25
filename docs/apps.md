# The apps (iPhone and Android)

Both store apps are the game in `web/` wrapped by [Capacitor](https://capacitorjs.com) 8:
a native shell shows `web/index.html` in the phone's web view and adds what a web page
cannot do. The server (`src/`, Cloudflare) is the same for both.

## What is native, and where

| What | Android | iPhone |
|---|---|---|
| The app's own plugin `Phone` (photo access, random previews, a photo in its upload size, from iCloud only when asked, settings page, screen on, the store's own rating window) | `android/app/src/main/java/com/hivedone/whoshotit/PhonePlugin.java` | `ios/App/App/PhonePlugin.swift` |
| Registering it | `MainActivity.java` | `MainViewController` in `PhonePlugin.swift`, used by `SceneDelegate.swift` |
| Permissions, invite links `whoshotit://join/<CODE>`, portrait only | `AndroidManifest.xml` | `Info.plist` |
| Privacy manifest | (none on Android) | `PrivacyInfo.xcprivacy` |
| Version (from `package.json`) | `android/app/build.gradle` | passed in by `./scripts/release-apps.sh` |
| Icons and launch screens | drawn from `web/icons/icon.svg` by `scripts/helpers/app-assets.mjs` | same |

Official plugins: `@capacitor/app` (invite links, Android back button, resume),
`@capacitor/haptics` (the app's five vibrations, `buzz` in `web/js/phone.js`) and
`@capacitor/share` (share sheet). The page reaches every plugin as
`window.Capacitor.Plugins.<name>` (`web/js/phone.js`). The page's scripts have no build
step; only its stylesheet is built (`scripts/helpers/styles.sh`), which
`./scripts/release-apps.sh` does before every copy of `web/` into the apps.

The two `PhonePlugin` files are twins: a change to one is made to the other in the same
commit, and `web/js/phone.js` documents the methods both offer.

**The store's rating window** (`requestReview`, asked at the moment `web/js/review.js`
picks): StoreKit's on the iPhone, Google Play's In-App Review card on Android, the one
library not from Capacitor (pinned in `android/app/build.gradle`, approved in AGENTS.md
§7, notice in `web/vendor/google-play-review.LICENSE.txt`). Neither tells the app whether it
showed. To see it: an iPhone build from Xcode (`./scripts/dev.sh ios`) usually shows it every
time (Apple's development mode), TestFlight never does; on Android it shows only in an app
installed from Google Play (the internal testing track), and a build from this Mac completes
silently.

**Changes made to Capacitor's generated projects:** Android minimum version 10 (API 29,
for the photo decoder), no cloud backups, no FileProvider, no Google services but the
rating window's library (above), no template tests; iPhone only (runs scaled on iPads), portrait only, at least iOS 15.4 (the stylesheet
needs cascade layers; phones on older iOS keep the last version that ran there). `npx cap sync` (run by the build
script) copies `web/` in and updates the plugin lists; it never undoes these changes.

**Updating Capacitor:** raise all `@capacitor/*` versions in `package.json` together, then
`npm install`, `./scripts/setup.sh`, `./scripts/test.sh` and a test on both phones
(`./scripts/dev.sh android|ios`). Capacitor 9 (in release candidate since November 2026)
needs `npx cap migrate` once and newer tools (Node 24, Xcode 27).

## Releasing

**Every release:**
1. Raise `"version"` in `package.json` (for example `1.0.0` to `1.0.1`) and `APP.version` in
   `web/shared/config.js` to the same (a test checks it). The stores refuse a version
   number twice, and every new version asks players to accept the terms once more.
2. If the server changed: `./scripts/deploy.sh` first. Installed apps update slowly, so the
   server must keep understanding the previous app version.
3. `./scripts/release-apps.sh` (or `ios` / `android` only). It runs every test, builds,
   signs and uploads:
   - **iPhone:** to App Store Connect. About 15 minutes later the build is in TestFlight
     for the team (install it on your iPhone with Apple's TestFlight app). With `--submit`
     the script then fills in the App Store page from the listings in `store/` and sends the
     version to App Review; it goes live by itself after approval. It also sends the build to
     the public TestFlight link (the "Friends" group), which gets it after Apple's beta check
     (usually within a day); `node scripts/helpers/app-store.mjs testflight` does only that,
     so friends can play a version before it goes to App Review. `node
     scripts/helpers/app-store.mjs status` shows where things stand (builds, TestFlight beta
     check, review); `withdraw` takes a version Apple has not approved yet back, so
     `--submit` can send a newer build in its place.
   - **Android:** to Google Play, released on the production track: Google reviews it
     (hours to a few days), then it goes live. `--android-track internal` releases to the
     internal test track instead.

   `--no-upload` only builds (`dist/who-shot-it-<version>.aab`, `dist/ios/App.ipa`).

**Tools:** Android needs Android Studio (it brings Java and the SDK). iPhone needs a Mac with
Xcode 26 or newer (from April 2027 Apple accepts only builds made with Xcode 27 or newer,
which needs macOS 26.6 or newer), and either the App Store Connect API key in `secrets/`
(below; it signs and uploads, also unattended) or Xcode signed in to the Apple developer
account (Xcode, Settings, Accounts);
the team is set in the project (`DEVELOPMENT_TEAM`, AG58VXA9TW).

**Keys in `secrets/`** (git-ignored; back the folder up in a password manager):
- `android-upload.jks` and `android-upload.properties`: the Android upload key, created by
  the first Android build. With Play App Signing (the default) Google signs what players
  install, and a lost upload key can be replaced through Google support.
- `google-play.json`: the key of the service account that uploads to Google Play.
- `app-store-connect.p8` and `app-store-connect.json` (`{ "keyId", "issuerId" }`): the App
  Store Connect team API key (Users and Access, Integrations, App Store Connect API, Team
  Keys, access Admin; the `.p8` can be downloaded only once). It signs and uploads the
  iPhone app and fills in and submits the App Store page. Revoke and replace it there if it
  ever leaks.

## First release (once per store, by hand)

**App Store:** in App Store Connect create the app (Apps, +, New App: iOS, name
`Who Shot It?`, language English, bundle ID `com.hivedone.whoshotit`, SKU `whoshotit`).
Two settings have no API and are made by hand once: **App Privacy** (Apps, the app, left
column App Privacy, Get Started: "Yes, we collect data", tick the data types of `privacy` in
`store/ios_listing.js`, each for App Functionality only, not linked, no tracking, Publish)
and the **EU trader status** (Business, Agreements, Compliance, Digital Services Act,
Complete Compliance Requirements). Then `./scripts/release-apps.sh ios --submit` does the
rest.

**App Review asks new apps for a screen recording** ("Guideline 2.1, Information Needed"):
made on an iPhone with the TestFlight build, from launching the app through a whole game,
including reporting a photo and removing a player; one phone and the test players are
enough ([guides/demo-players.md](guides/demo-players.md), step by step). The answers to
its other questions are the review notes in `store/ios_listing.js`. The video is
`store/ios_review-video.mp4` (git-ignored); `node scripts/helpers/app-store.mjs submit`
attaches it to every submission and sends a rejected version back to App Review.

**Google Play:** step by step in [guides/android.md](guides/android.md) (account, forms,
the first upload by hand, the key for automatic uploads).

## Store listings

Everything the stores get, texts, images and the answers for their forms, lives in
`store/`, and the file names say who gets it: `android_ios_` both stores, `ios_` only the
iPhone store, `android_` only the Android store.
[android_ios_listing.js](../store/android_ios_listing.js) has the name, description, links
and screenshot captions; [ios_listing.js](../store/ios_listing.js) the subtitle, keywords,
categories, privacy label and review notes;
[android_listing.js](../store/android_listing.js) the short description, tags, Data safety
and the photo permission declaration; `store/images/` the icons, banner and screenshots.
`scripts/helpers/listing.mjs` reads them for every script, so the upload and the preview
show the same. `./scripts/dev.sh store` shows both store pages as players will see them and
lists anything a store would refuse (a text over its limit, a missing image); the tests
fail on the same. The age is LEGAL.minAge (the terms' age) on both stores.
