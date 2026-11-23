#!/usr/bin/env bash
# Builds the store apps from the game in web/ and the native projects, and uploads them:
#   ./scripts/release-apps.sh ios         to App Store Connect (then TestFlight for the team;
#                                          --submit sends it on). Mac with Xcode.
#   ./scripts/release-apps.sh android     to Google Play, released on the production track
#                                          (Google reviews it, then it goes live).
#   ./scripts/release-apps.sh             both
# Options:
#   --no-upload               only build: dist/who-shot-it-<version>.aab and dist/ios/App.ipa
#   --android-track internal  release to Google Play's internal test track instead
#   --store-images            also redraw the store screenshots in store/images/ (when the
#                             app's look or a caption changed)
#   --submit                  after the iPhone upload, fill in the App Store page from the
#                             listings in store/ and send the version to App Review and to
#                             the public TestFlight link (scripts/helpers/app-store.mjs,
#                             with the API key in secrets/)
#
# Every run first runs all tests, draws the icons from web/icons/icon.svg, builds the
# stylesheet web/css/app.css (scripts/helpers/styles.sh) and copies web/ into the native
# projects (npx cap sync). The version is package.json's "version"; raise
# it before every upload (both stores refuse a version number twice).
#
# Signing and uploading: the iPhone app is signed and uploaded with the App Store Connect
# API key in secrets/ when it is there (works unattended, even when Xcode's own sign-in has
# expired), otherwise with the Apple account signed in to Xcode (Settings, Accounts); the
# team is the one in the iPhone project. The Android
# app is signed with the upload key in secrets/ (git-ignored; the first Android build
# creates it: back up secrets/) and uploaded with the Google Play service account key
# secrets/google-play.json. Google only accepts uploads through its API after the first
# release was made by hand in the Play Console (docs/apps.md, First release).
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh

platforms=()
upload=true
track=production
store_images=false
submit=false
while [ $# -gt 0 ]; do
  case "$1" in
    android | ios) platforms+=("$1") ;;
    --no-upload) upload=false ;;
    --android-track) shift; track="${1:-}" ;;
    --store-images) store_images=true ;;
    --submit) submit=true ;;
    *) fail "Unknown option: $1" "Use: ./scripts/release-apps.sh [android] [ios] [--no-upload] [--android-track internal|production] [--store-images] [--submit]" ;;
  esac
  shift
done
[ ${#platforms[@]} -gt 0 ] || platforms=(android ios)
case "$track" in internal | production) ;; *) fail "Unknown Google Play track: $track" "Use internal or production." ;; esac
for p in "${platforms[@]}"; do
  "preflight_$p"
  [ "$p" = android ] && [ "$upload" = true ] && check_play_upload_key
  [ "$p" = ios ] && [ "$submit" = true ] && check_app_store_key
done
[ "$submit" = false ] || [ "$upload" = true ] || fail "--submit needs the upload." "Leave out --no-upload."

version=$(node -p "require('./package.json').version")
build=$(node -p "const [a, b, c] = require('./package.json').version.split('.').map(Number); a * 10000 + b * 100 + c")
mkdir -p dist

./scripts/test.sh
echo "→ Drawing icons and launch screens"
node scripts/helpers/app-assets.mjs
echo "→ Building the stylesheet"
scripts/helpers/styles.sh
if [ "$store_images" = true ]; then
  echo "→ Drawing the store screenshots"
  node scripts/helpers/store-images.mjs
fi

# The upload key: made once, kept in secrets/ (never committed).
ensure_android_upload_key() {
  local key=secrets/android-upload.jks props=secrets/android-upload.properties
  [ -f "$key" ] && [ -f "$props" ] && return 0
  [ ! -e "$key" ] && [ ! -e "$props" ] || fail "secrets/ has only half of the Android upload key." "Restore both files (android-upload.jks and android-upload.properties) from your backup."
  echo "→ Creating the Android upload key in secrets/ (first Android build only)"
  mkdir -p secrets
  local password
  password=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
  "$JAVA_HOME/bin/keytool" -genkeypair -keystore "$key" -storetype PKCS12 -alias upload -keyalg RSA -keysize 4096 -validity 10000 \
    -storepass "$password" -keypass "$password" -dname "CN=HiveDone UG, O=HiveDone UG, C=DE" >/dev/null
  printf 'password=%s\n' "$password" > "$props"
  chmod 600 "$key" "$props"
  echo "! Back up the secrets/ folder now (for example in a password manager). Every update needs this key."
}

release_android() {
  ensure_android_upload_key
  local password aab="dist/who-shot-it-$version.aab"
  password=$(sed -n 's/^password=//p' secrets/android-upload.properties)
  echo "→ Android: copying the game into the app"
  npx cap sync android
  echo "→ Android: building and signing the app bundle ($version)"
  (cd android && ./gradlew --no-daemon --quiet :app:bundleRelease \
    -Pandroid.injected.signing.store.file="$PWD/../secrets/android-upload.jks" \
    -Pandroid.injected.signing.store.password="$password" \
    -Pandroid.injected.signing.key.alias=upload \
    -Pandroid.injected.signing.key.password="$password")
  cp android/app/build/outputs/bundle/release/app-release.aab "$aab"
  if [ "$upload" = true ]; then
    echo "→ Android: uploading to Google Play ($track track)"
    node scripts/helpers/play-upload.mjs "$aab" "$track" "$version"
  else
    echo "✓ $aab: upload it in the Google Play Console (docs/apps.md)."
  fi
}

release_ios() {
  echo "→ iPhone: copying the game into the app"
  npx cap sync ios
  # The API key (if present) signs in instead of Xcode's account. "${auth[@]+...}" keeps an
  # empty list working under `set -u` in the bash that ships with macOS.
  local auth=()
  if [ -f secrets/app-store-connect.p8 ] && [ -f secrets/app-store-connect.json ]; then
    auth=(-authenticationKeyPath "$PWD/secrets/app-store-connect.p8"
      -authenticationKeyID "$(node -p "require('./secrets/app-store-connect.json').keyId")"
      -authenticationKeyIssuerID "$(node -p "require('./secrets/app-store-connect.json').issuerId")")
  fi
  echo "→ iPhone: archiving ($version, build $build)"
  rm -rf dist/ios
  xcodebuild -quiet -project ios/App/App.xcodeproj -scheme App -configuration Release \
    -destination 'generic/platform=iOS' -archivePath dist/ios/App.xcarchive -allowProvisioningUpdates \
    ${auth[@]+"${auth[@]}"} MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$build" archive
  # "upload" sends the signed app straight to App Store Connect; "export" writes App.ipa.
  local destination=export
  [ "$upload" = true ] && destination=upload
  cat > dist/ios/export.plist <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$destination</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
PLIST
  echo "→ iPhone: signing and $([ "$upload" = true ] && echo "uploading to App Store Connect" || echo "exporting")"
  xcodebuild -quiet -exportArchive -archivePath dist/ios/App.xcarchive -exportPath dist/ios \
    -exportOptionsPlist dist/ios/export.plist -allowProvisioningUpdates ${auth[@]+"${auth[@]}"}
  if [ "$submit" = true ]; then
    echo "→ iPhone: filling in the App Store page and sending it to App Review and the public TestFlight link"
    node scripts/helpers/app-store.mjs submit --wait
  elif [ "$upload" = true ]; then
    echo "✓ Uploaded $version ($build). In about 15 minutes it is in TestFlight for the team. For the public TestFlight link: node scripts/helpers/app-store.mjs testflight; to publish: node scripts/helpers/app-store.mjs submit (does both)"
  else
    echo "✓ dist/ios/App.ipa: upload it with Apple's Transporter app."
  fi
}

for p in "${platforms[@]}"; do
  "release_$p"
done
echo "✓ Everything the stores get is in store/; see both store pages: ./scripts/dev.sh store"
