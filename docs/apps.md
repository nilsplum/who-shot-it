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
| Version (from `package.json`) | `android/app/build.gradle` | passed in by `./scripts/build-apps.sh` |
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
3. `./scripts/build-apps.sh` (or `android` / `ios` only). It runs every test, then writes
   `dist/who-shot-it-<version>.aab` and `dist/ios/App.ipa`.
4. Upload: the `.aab` in the Google Play Console (Production, Create new release); the
   `.ipa` with Apple's free **Transporter** app. Then submit both for review.

**Tools:** Android needs Android Studio (it brings Java and the SDK). iPhone needs a Mac with
Xcode 26 or newer, signed in to the Apple developer account (Xcode, Settings, Accounts),
and the team chosen once for the app (open `ios/App/App.xcodeproj`, target App, Signing &
Capabilities, Automatically manage signing, pick the team; commit the change).

**Android upload key:** the first Android build creates `secrets/android-upload.jks` and
its password file. Back up `secrets/` (a password manager). Enrol in Play App Signing (the
default): Google signs what players install, and a lost upload key can be replaced
through Google support.

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
> accepts the terms (16+) before playing; contact: support@hive-done.com.

**Screenshots:** use only your own photos, or photos of people who agreed.
