#!/usr/bin/env bash
# Preflight checks shared by every script in scripts/. Each check is one function that
# prints a short reason and the exact fix when it fails; each script runs its bundle
# (preflight_setup, preflight_test, preflight_dev, preflight_deploy, preflight_android,
# preflight_ios) before doing anything; release-apps.sh adds check_play_upload_key. Sourced, never run directly. Expects to be called
# from the repo root.

fail() {
  echo "✗ $1" >&2
  echo "  Fix: $2" >&2
  exit 1
}

check_node() {
  command -v node >/dev/null 2>&1 || fail "Node.js is not installed." "Install Node.js (LTS) from https://nodejs.org, then run ./scripts/setup.sh."
  local wanted
  wanted=$(node -p "require('./package.json').engines.node.replace(/[^0-9.]/g, '')")
  node -e "
    const [a, b] = process.versions.node.split('.').map(Number);
    const [x, y] = '$wanted'.split('.').map(Number);
    process.exit(a > x || (a === x && b >= y) ? 0 : 1);
  " || fail "Node.js $(node -v) is too old (this repo needs $wanted or newer)." "Install the current Node.js LTS from https://nodejs.org."
}

check_dependencies() {
  npm ls --depth=0 >/dev/null 2>&1 || fail "Dependencies are missing or do not match package.json." "Run ./scripts/setup.sh."
}

check_test_browser() {
  node --input-type=module -e "
    import { chromium } from '@playwright/test';
    import { existsSync } from 'node:fs';
    process.exit(existsSync(chromium.executablePath()) ? 0 : 1);
  " 2>/dev/null || fail "The test browser is not installed." "Run ./scripts/setup.sh."
}

check_cloudflare_login() {
  npx wrangler whoami 2>/dev/null | grep -q "You are logged in" \
    || fail "This machine is not logged in to Cloudflare." "Run: npx wrangler login (opens the browser once)."
}

check_operator_todos() {
  local left
  left=$(grep -rn "TODO_OPERATOR:" web src wrangler.jsonc capacitor.config.json android/app/src ios/App/App 2>/dev/null || true)
  [ -z "$left" ] || fail "Some values only the operator can provide are still missing:
$left" "Fill them in (README, Release), then run the script again."
}

# Android builds need Java 21 or newer. Uses JAVA_HOME if it is set, else Android
# Studio's bundled Java, else any installed one; exports JAVA_HOME for Gradle.
check_java() {
  local candidates=("${JAVA_HOME:-}" "/Applications/Android Studio.app/Contents/jbr/Contents/Home")
  candidates+=("$(/usr/libexec/java_home -v 21+ 2>/dev/null || true)" "/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home")
  for home in "${candidates[@]}"; do
    [ -n "$home" ] && [ -x "$home/bin/java" ] || continue
    if "$home/bin/java" -version 2>&1 | head -1 | grep -Eq 'version "(2[1-9]|[3-9][0-9])'; then
      export JAVA_HOME="$home"
      return 0
    fi
  done
  fail "Java 21 or newer is missing (Android builds need it)." "Install Android Studio (it brings Java 21): https://developer.android.com/studio"
}

# The Android SDK: ANDROID_HOME, or Android Studio's default place. Writes it to
# android/local.properties (git-ignored), where Gradle looks for it.
check_android_sdk() {
  local sdk="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  [ -d "$sdk/platform-tools" ] || fail "The Android SDK is missing." "Install Android Studio and open it once (it installs the SDK), or set ANDROID_HOME."
  echo "sdk.dir=$sdk" > android/local.properties
}

check_xcode() {
  xcodebuild -version >/dev/null 2>&1 || fail "Xcode is missing (iPhone builds need a Mac with Xcode)." "Install Xcode from the Mac App Store, open it once, then run: sudo xcode-select -s /Applications/Xcode.app"
}

# Signing uses the Apple developer team set in the iPhone project (DEVELOPMENT_TEAM).
check_ios_team() {
  grep -q "DEVELOPMENT_TEAM = " ios/App/App.xcodeproj/project.pbxproj \
    || fail "No Apple developer team is set for the iPhone app." "Open ios/App/App.xcodeproj in Xcode, target App, Signing & Capabilities: tick 'Automatically manage signing' and pick your team. Commit the change."
}

# Uploads to Google Play sign in with a service account key (docs/apps.md, Google Play).
check_play_upload_key() {
  [ -f secrets/google-play.json ] || fail "The Google Play upload key is missing (secrets/google-play.json)." "Create it once as described in docs/apps.md (Google Play), or build only: ./scripts/release-apps.sh android --no-upload"
}

preflight_setup() { check_node; }
preflight_test() { check_node; check_dependencies; check_test_browser; }
preflight_dev() { check_node; check_dependencies; }
preflight_deploy() { check_node; check_dependencies; check_test_browser; check_operator_todos; check_cloudflare_login; }
preflight_android() { check_node; check_dependencies; check_test_browser; check_operator_todos; check_java; check_android_sdk; }
preflight_ios() { check_node; check_dependencies; check_test_browser; check_operator_todos; check_xcode; check_ios_team; }
