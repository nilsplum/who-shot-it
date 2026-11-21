# The apps (iPhone and Android)

Both store apps are the game in `web/` wrapped by [Capacitor](https://capacitorjs.com) 8:
a native shell shows `web/index.html` in the phone's web view and adds what a web page
cannot do. The server (`src/`, Cloudflare) is the same for both.

## What is native, and where

| What | Android | iPhone |
|---|---|---|
| The app's own plugin `Phone` (photo access, random photo, settings page, screen on) | `android/app/src/main/java/com/hivedone/whoshotit/PhonePlugin.java` | `ios/App/App/PhonePlugin.swift` |
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
     (install it on your iPhone with Apple's TestFlight app). To publish: App Store
     Connect, the app, the version, pick the build, **Submit for Review**.
   - **Android:** to Google Play, released on the production track: Google reviews it
     (hours to a few days), then it goes live. `--android-track internal` releases to the
     internal test track instead.

   `--no-upload` only builds (`dist/who-shot-it-<version>.aab`, `dist/ios/App.ipa`).

**Tools:** Android needs Android Studio (it brings Java and the SDK). iPhone needs a Mac with
Xcode 26 or newer (from April 2027 Apple accepts only builds made with Xcode 27 or newer),
signed in to the Apple developer account (Xcode, Settings, Accounts);
the team is set in the project (`DEVELOPMENT_TEAM`, AG58VXA9TW).

**Keys in `secrets/`** (git-ignored; back the folder up in a password manager):
- `android-upload.jks` and `android-upload.properties`: the Android upload key, created by
  the first Android build. With Play App Signing (the default) Google signs what players
  install, and a lost upload key can be replaced through Google support.
- `google-play.json`: the key of the service account that uploads to Google Play.

## First release (once per store, by hand)

**App Store:** in App Store Connect create the app (My Apps, +, New App: iOS, name
`Who Shot It?`, language English, bundle ID `com.hivedone.whoshotit`, SKU `whoshotit`).
Then `./scripts/release-apps.sh ios` uploads the first build. Fill in the version page,
App Privacy, age rating and the EU trader details with the answers below, then Submit for
Review.

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

**Review notes (both stores):**
> The game needs at least two phones in the same game. Install the app on two devices,
> accept the terms, enter a name, tap Create game, Start game, then join on the second
> device with the 4-letter code. Allow photo access when asked (both devices need a few
> photos). Content moderation: every player confirms their own photos (Yes/No); the flag
> on each photo deletes it for everyone at once; the host can remove players (tap a
> player), who cannot rejoin; nicknames with blocked words are replaced; every player
> accepts the terms (16+) before playing; contact: whoshotit.info@gmail.com.

**Screenshots:** use only your own photos, or photos of people who agreed.
