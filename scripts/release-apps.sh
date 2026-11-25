#!/usr/bin/env bash
# Builds the store apps from the game in web/ and the native projects for one environment
# (ENVIRONMENTS in web/shared/config.js), and uploads them; and shows where the stores stand.
#   ./scripts/release-apps.sh staging [ios] [android]
#       Test builds, talking to the staging server: the iPhone app to TestFlight (the team at
#       once, the public link after Apple's beta check), the Android app to Google Play's
#       internal test track. From any branch; never to App Review or the production track.
#   ./scripts/release-apps.sh production [ios] [android] [--submit]
#       Store builds, talking to the production server, only from a clean main: the iPhone app
#       to TestFlight's team (to try the exact build before review), the Android app to Google
#       Play's production track (after typing "release <version> on Google Play"). --submit
#       then fills in the App Store page from store/ and sends the version to App Review and
#       the public TestFlight link (after typing "submit <version> to App Review"); an iPhone
#       build of this version uploaded before is sent as it is, without building again.
#   ./scripts/release-apps.sh status
#       Which app versions each server lets play and the newest it offers (its version gate,
#       set by ./scripts/deploy.sh), then where App Store Connect stands: the newest builds
#       with their environment, TestFlight, the versions and App Review.
#   ./scripts/release-apps.sh withdraw
#       Takes the version waiting for or in App Review back (after typing "take it back from
#       App Review"), so a newer production build can take its place with --submit.
# Without a platform, both. Options:
#   --no-upload            only build: dist/who-shot-it-<version>-<environment>.aab and dist/ios/App.ipa
#   --store-images         also redraw the store screenshots in store/images/ (when the app's
#                          look or a caption changed)
#   --confirm "<phrase>"   a typed confirmation given in advance (for a run without a terminal)
#
# There is no default environment: a build names the server it talks to. Its number carries
# the environment (`buildNumber` in web/shared/config.js: 1.0.9 is 100090 for staging, 100091
# for production), so each version is uploaded once per environment, App Store Connect shows
# which build is which, and only a production build can reach App Review. The next upload to
# the same environment needs a higher version in package.json (and APP.version); an iPhone
# upload checks that before it builds. The build's environment is written into the native
# project's copy of the game for that build only (scripts/helpers/environments.sh), and the
# copy is put back to production afterwards, however the run ends.
#
# Every build first runs all tests, draws the icons from web/icons/icon.svg, builds the
# stylesheet web/css/app.css (scripts/helpers/styles.sh) and copies web/ into the native
# projects (npx cap sync).
#
# Signing and uploading: the iPhone app is signed and uploaded with the App Store Connect
# API key in secrets/ (it also runs the checks, the public TestFlight link and App Review;
# scripts/helpers/app-store.mjs); the team is the one in the iPhone project. The Android
# app is signed with the upload key in secrets/ (git-ignored; the first Android build
# creates it: back up secrets/) and uploaded with the Google Play service account key
# secrets/google-play.json (scripts/helpers/play-upload.mjs). Google only accepts uploads
# through its API after the first release was made by hand in the Play Console
# (docs/apps.md, First release).
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh

usage="./scripts/release-apps.sh staging|production [ios] [android] [--submit] [--no-upload] [--store-images] [--confirm \"<phrase>\"], or: status, withdraw"
mode=""
platforms=()
upload=true
store_images=false
submit=false
while [ $# -gt 0 ]; do
  case "$1" in
    android | ios) platforms+=("$1") ;;
    --no-upload) upload=false ;;
    --store-images) store_images=true ;;
    --submit) submit=true ;;
    --confirm) shift; add_confirmation "${1:-}" ;;
    -*) fail "Unknown option: $1" "Use: $usage" ;;
    *) [ -z "$mode" ] || fail "One environment or command at a time (got $mode and $1)." "Use: $usage"; mode=$1 ;;
  esac
  shift
done

# ---------- App Store Connect without building: status, withdraw ----------

if [ "$mode" = status ] || [ "$mode" = withdraw ]; then
  [ ${#platforms[@]} -eq 0 ] && [ "$submit" = false ] && [ "$store_images" = false ] && [ "$upload" = true ] \
    || fail "$mode takes no platform or option." "Use: ./scripts/release-apps.sh $mode"
  preflight_stores
  [ "$mode" = status ] || confirm_phrase "take it back from App Review" "The version waiting for or in App Review comes back; nothing goes live until a production build is submitted again (./scripts/release-apps.sh production ios --submit)."
  [ "$mode" = withdraw ] || node scripts/helpers/gate.mjs show
  exec node scripts/helpers/app-store.mjs "$mode"
fi

# ---------- A build: which environment, which platforms, what is allowed ----------

environment=$mode
check_environment "$environment" "./scripts/release-apps.sh staging ios"
[ ${#platforms[@]} -gt 0 ] || platforms=(android ios)
has() { case " ${platforms[*]} " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }
if [ "$submit" = true ]; then
  [ "$environment" = production ] || fail "Only a production build goes to App Review." "Use: ./scripts/release-apps.sh production ios --submit"
  [ "$upload" = true ] || fail "--submit needs the upload." "Leave out --no-upload."
  has ios || fail "--submit sends the iPhone app to App Review." "Add ios: ./scripts/release-apps.sh production ios --submit"
fi
[ "$environment" != production ] || check_production_source
for p in "${platforms[@]}"; do
  "preflight_$p"
  [ "$p" = android ] && [ "$upload" = true ] && check_play_upload_key
  [ "$p" = ios ] && [ "$upload" = true ] && check_app_store_key
done
[ "$upload" = false ] || check_server_up "$environment"

version=$(node -p "require('./package.json').version")
build=$(app_build_number "$environment")
track=internal
[ "$environment" = staging ] || track=production
mkdir -p dist

# An iPhone build of this version for this environment that is in App Store Connect already
# is never built again (Apple refuses a build number twice): --submit sends it as it is.
ios_uploaded=false
if has ios && [ "$upload" = true ]; then
  rc=0
  node scripts/helpers/app-store.mjs uploaded "$environment" || rc=$?
  case "$rc" in
    0) ios_uploaded=true ;;
    10) ;;
    *) fail "App Store Connect could not be asked about build $build." "Check the connection and the key in secrets/, then run it again." ;;
  esac
  if [ "$ios_uploaded" = true ] && [ "$submit" = false ]; then
    fail "Version $version is uploaded for $environment already (build $build)." "Raise the version in package.json and APP.version (web/shared/config.js) for a new upload$([ "$environment" = production ] && echo ", or send this build to App Review: ./scripts/release-apps.sh production ios --submit")."
  fi
fi

# The confirmations come before the long part, so nobody is asked after ten minutes of building.
if [ "$environment" = production ] && has android && [ "$upload" = true ]; then
  confirm_phrase "release $version on Google Play" "Version $version (code $build) goes to Google Play's production track: Google reviews it, then it goes live for everyone."
fi
if [ "$submit" = true ]; then
  confirm_phrase "submit $version to App Review" "Version $version (build $build) goes to App Review and goes live for everyone by itself once Apple approves it."
fi

echo "→ $version (build $build) for $environment, talking to $(environment_value "$environment" origin): ${platforms[*]}"
if [ "$ios_uploaded" = false ] || has android; then
  ./scripts/test.sh
  echo "→ Drawing icons and launch screens"
  node scripts/helpers/app-assets.mjs
  echo "→ Building the stylesheet"
  scripts/helpers/styles.sh
fi
if [ "$store_images" = true ]; then
  echo "→ Drawing the store screenshots"
  node scripts/helpers/store-images.mjs
fi

# Every platform whose copy of the game was set to this environment is put back to
# production when the run ends, however it ends (environments.sh).
marked=()
restore_copies() {
  for p in ${marked[@]+"${marked[@]}"}; do restore_app_environment "$p"; done
}
trap restore_copies EXIT

# The game copied into a platform's project, set to this build's environment.
copy_game() {
  echo "→ $1: copying the game into the app"
  npx cap sync "$1"
  marked+=("$1")
  mark_app_environment "$environment" "$1"
}

# The step after an upload: once people can install this version from where its platform
# updates ($2), the server learns it is the newest (its version gate), so older apps show
# "✨ Update" on their start screen.
tell_newest() {
  echo "→ Once it can be installed from $2: ./scripts/deploy.sh $environment --newest $1=$version (older apps then show \"✨ Update\")"
}

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
  local password aab="dist/who-shot-it-$version-$environment.aab"
  password=$(sed -n 's/^password=//p' secrets/android-upload.properties)
  copy_game android
  echo "→ Android: building and signing the app bundle ($version, code $build)"
  (cd android && ./gradlew --no-daemon --quiet :app:bundleRelease \
    -PbuildNumber="$build" \
    -Pandroid.injected.signing.store.file="$PWD/../secrets/android-upload.jks" \
    -Pandroid.injected.signing.store.password="$password" \
    -Pandroid.injected.signing.key.alias=upload \
    -Pandroid.injected.signing.key.password="$password")
  cp android/app/build/outputs/bundle/release/app-release.aab "$aab"
  if [ "$upload" = true ]; then
    echo "→ Android: uploading to Google Play ($track track)"
    node scripts/helpers/play-upload.mjs "$aab" "$track" "$version"
    tell_newest android "Google Play's $track track"
  else
    echo "✓ $aab: upload it in the Google Play Console (docs/apps.md)."
  fi
}

build_ios() {
  copy_game ios
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
}

release_ios() {
  if [ "$ios_uploaded" = true ]; then
    echo "→ iPhone: build $build ($version, $environment) is in App Store Connect already: sending it as it is"
  else
    build_ios
  fi
  if [ "$upload" = false ]; then
    echo "✓ dist/ios/App.ipa: upload it with Apple's Transporter app."
  elif [ "$submit" = true ]; then
    echo "→ iPhone: filling in the App Store page and sending it to App Review and the public TestFlight link"
    node scripts/helpers/app-store.mjs submit --wait
    tell_newest ios "the App Store, after Apple's approval"
  elif [ "$environment" = staging ]; then
    echo "→ iPhone: putting it on the public TestFlight link too"
    node scripts/helpers/app-store.mjs testflight staging --wait
    tell_newest ios "TestFlight"
  else
    echo "✓ Uploaded $version ($build). In about 15 minutes it is in TestFlight for the team, talking to production; to send it to App Review: ./scripts/release-apps.sh production ios --submit"
  fi
}

for p in "${platforms[@]}"; do
  "release_$p"
done
echo "✓ Everything the stores get is in store/; see both store pages: ./scripts/dev.sh store"
