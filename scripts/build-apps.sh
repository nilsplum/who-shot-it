#!/usr/bin/env bash
# Builds the files you upload to the stores, from the game in web/ and the native projects:
#   ./scripts/build-apps.sh android   dist/who-shot-it-<version>.aab   (Google Play Console)
#   ./scripts/build-apps.sh ios       dist/ios/App.ipa                 (App Store Connect; Mac with Xcode)
#   ./scripts/build-apps.sh           both
# Every run first runs all tests, draws the icons from web/icons/icon.svg and copies web/
# into the native projects (npx cap sync). The version is package.json's "version"; raise
# it before every store upload (the stores refuse a version number twice).
#
# Android release builds are signed with the upload key in secrets/ (git-ignored). The
# first Android build creates it with a random password: back up secrets/ somewhere safe
# (a password manager). Google re-signs the app for players (Play App Signing), so a lost
# upload key can be replaced through Google support, but that takes days.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh

platforms=("$@")
[ ${#platforms[@]} -gt 0 ] || platforms=(android ios)
for p in "${platforms[@]}"; do
  case "$p" in
    android) preflight_android ;;
    ios) preflight_ios ;;
    *) fail "Unknown platform: $p" "Use: ./scripts/build-apps.sh [android] [ios]" ;;
  esac
done

version=$(node -p "require('./package.json').version")
build=$(node -p "const [a, b, c] = require('./package.json').version.split('.').map(Number); a * 10000 + b * 100 + c")
mkdir -p dist

./scripts/test.sh
echo "→ Drawing icons and launch screens"
node scripts/helpers/app-assets.mjs

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

build_android() {
  ensure_android_upload_key
  local password
  password=$(sed -n 's/^password=//p' secrets/android-upload.properties)
  echo "→ Android: copying the game into the app"
  npx cap sync android
  echo "→ Android: building and signing the app bundle ($version)"
  (cd android && ./gradlew --no-daemon --quiet :app:bundleRelease \
    -Pandroid.injected.signing.store.file="$PWD/../secrets/android-upload.jks" \
    -Pandroid.injected.signing.store.password="$password" \
    -Pandroid.injected.signing.key.alias=upload \
    -Pandroid.injected.signing.key.password="$password")
  cp android/app/build/outputs/bundle/release/app-release.aab "dist/who-shot-it-$version.aab"
  echo "✓ dist/who-shot-it-$version.aab: upload it in the Google Play Console (README, Release)."
}

build_ios() {
  echo "→ iPhone: copying the game into the app"
  npx cap sync ios
  echo "→ iPhone: archiving and exporting ($version, build $build)"
  rm -rf dist/ios
  xcodebuild -quiet -project ios/App/App.xcodeproj -scheme App -configuration Release \
    -destination 'generic/platform=iOS' -archivePath dist/ios/App.xcarchive -allowProvisioningUpdates \
    MARKETING_VERSION="$version" CURRENT_PROJECT_VERSION="$build" archive
  cat > dist/ios/export.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>method</key><string>app-store-connect</string><key>signingStyle</key><string>automatic</string></dict></plist>
PLIST
  xcodebuild -quiet -exportArchive -archivePath dist/ios/App.xcarchive -exportPath dist/ios \
    -exportOptionsPlist dist/ios/export.plist -allowProvisioningUpdates
  echo "✓ dist/ios/App.ipa: upload it with Apple's Transporter app (README, Release)."
}

for p in "${platforms[@]}"; do
  "build_$p"
done
echo "✓ Store graphics: dist/store/"
