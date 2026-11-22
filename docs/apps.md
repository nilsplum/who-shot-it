# The apps (iPhone and Android)

Both store apps are the game in `web/` wrapped by [Capacitor](https://capacitorjs.com) 8:
a native shell shows `web/index.html` in the phone's web view and adds what a web page
cannot do. The server (`src/`, Cloudflare) is the same for both.

## What is native, and where

| What | Android | iPhone |
|---|---|---|
| The app's own plugin `Phone` (photo access, random previews and the chosen photos, settings page, screen on) | `android/app/src/main/java/com/hivedone/whoshotit/PhonePlugin.java` | `ios/App/App/PhonePlugin.swift` |
| Registering it | `MainActivity.java` | `MainViewController` in `PhonePlugin.swift`, used by `SceneDelegate.swift` |
| Permissions, invite links `whoshotit://join/<CODE>`, portrait only | `AndroidManifest.xml` | `Info.plist` |
| Privacy manifest | (none on Android) | `PrivacyInfo.xcprivacy` |
| Version (from `package.json`) | `android/app/build.gradle` | passed in by `./scripts/release-apps.sh` |
| Icons and launch screens | drawn from `web/icons/icon.svg` by `scripts/helpers/app-assets.mjs` | same |

Official plugins: `@capacitor/app` (invite links, Android back button, resume) and
`@capacitor/share` (share sheet). The page reaches every plugin as
`window.Capacitor.Plugins.<name>` (`web/js/phone.js`); there is no build step.

The two `PhonePlugin` files are twins: a change to one is made to the other in the same
commit, and `web/js/phone.js` documents the methods both offer.

**Changes made to Capacitor's generated projects:** Android minimum version 10 (API 29,
for the photo decoder), no cloud backups, no FileProvider, no Google services, no template
tests; iPhone only (runs scaled on iPads), portrait only. `npx cap sync` (run by the build
script) copies `web/` in and updates the plugin lists; it never undoes these changes.

**Updating Capacitor:** raise all `@capacitor/*` versions in `package.json` together, then
`npm install`, `./scripts/setup.sh`, `./scripts/test.sh` and a test on both phones
(`./scripts/dev.sh android|ios`). Capacitor 9 (in release candidate since November 2026)
needs `npx cap migrate` once and newer tools (Node 24, Xcode 27).

## Releasing

**Every release:**
1. Raise `"version"` in `package.json` (for example `1.0.0` to `1.0.1`). The stores refuse a
   version number twice.
2. If the server changed: `./scripts/deploy.sh` first. Installed apps update slowly, so the
   server must keep understanding the previous app version.
3. `./scripts/release-apps.sh` (or `ios` / `android` only). It runs every test, builds,
   signs and uploads:
   - **iPhone:** to App Store Connect. About 15 minutes later the build is in TestFlight
     (install it on your iPhone with Apple's TestFlight app). With `--submit` the script
     then fills in the App Store page from `store/listing.md` and sends the version to
     App Review; it goes live by itself after approval. `node scripts/helpers/app-store.mjs
     status` shows where things stand (builds, TestFlight beta check, review).
   - **Android:** to Google Play, released on the production track: Google reviews it
     (hours to a few days), then it goes live. `--android-track internal` releases to the
     internal test track instead.

   `--no-upload` only builds (`dist/who-shot-it-<version>.aab`, `dist/ios/App.ipa`).

**Tools:** Android needs Android Studio (it brings Java and the SDK). iPhone needs a Mac with
Xcode 26 or newer (from April 2027 Apple accepts only builds made with Xcode 27 or newer),
and either the App Store Connect API key in `secrets/` (below; it signs and uploads, also
unattended) or Xcode signed in to the Apple developer account (Xcode, Settings, Accounts);
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
column App Privacy, Get Started: "Yes, we collect data", tick Photos or Videos and User ID,
each for App Functionality only, not linked, no tracking, Publish) and the **EU trader
status** (Business, Agreements, Compliance, Digital Services Act, Complete Compliance
Requirements). Then `./scripts/release-apps.sh ios --submit` does the rest.

**App Review asks new apps for a screen recording** ("Guideline 2.1, Information Needed"):
made on an iPhone with the TestFlight build, from launching the app through a whole game,
including reporting a photo and removing a player. The answers to its other questions are
the review notes in `store/listing.md`. To play alone, start computer opponents that join
your game: `node scripts/helpers/demo-players.mjs <CODE> 3` (drawn photos, ready after half
a minute so there is time to remove one). Save the video as `store/review-video.mp4`
(git-ignored); `node scripts/helpers/app-store.mjs submit` attaches it to every submission
and sends a rejected version back to App Review.

**Google Play:** step by step in [guides/android.md](guides/android.md) (account, forms,
the first upload by hand, the key for automatic uploads).

## Store listing

The texts, icons and screenshots for both store pages: [store/listing.md](../store/listing.md).

## Store forms (answers that match the app and the privacy policy)

**Links for both stores:** privacy policy `https://<server>/legal#privacy`, terms
`https://<server>/legal#terms`, support and imprint `https://<server>/legal#imprint`. Put
the imprint link in the store description too.

**Apple, App Privacy:** Data used to track you: none. Data collected, not linked to you,
for App Functionality only: *Photos or Videos*, *User ID*. (Matches `PrivacyInfo.xcprivacy`.)

**Google, Data safety:** Collected (not shared, not processed ephemerally, required, for
App functionality): *Photos*; *Name* (the nickname); *Device or other IDs* (the random
per-game key). Encrypted in transit: yes. Deletion: by email (the data is gone after a day
at the latest anyway).

**Age:** 16+ everywhere (the terms say 16). Apple: answer the questionnaire (user-generated
content: yes; contests: yes; everything else: no), then override the rating to 16+. Google:
target audience 16 and older, no children.

**Google, photo and video permissions declaration (READ_MEDIA_IMAGES):**
> Who Shot It? is a party game whose core feature is guessing whose photo it is. For each
> game the app picks random photos from the player's whole library on the device; the
> player sees them and confirms or redraws. A picker cannot provide random photos from the
> whole library, which is the point of the game. Only photos the player confirms leave the
> device; they are shown to the players in that private game and deleted after their round.

**Review notes and contact (both stores):** in [store/listing.md](../store/listing.md).

**Screenshots:** use only your own photos, or photos of people who agreed.
