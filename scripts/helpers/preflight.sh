#!/usr/bin/env bash
# Preflight checks shared by every script in scripts/. Each check is one function that
# prints a short reason and the exact fix when it fails; each script runs its bundle
# (preflight_setup, preflight_test, preflight_dev, preflight_drafts, preflight_deploy,
# preflight_android, preflight_ios, preflight_stores) before doing anything; release-apps.sh
# adds check_play_upload_key, check_app_store_key and check_server_up. The deployed
# environments come from scripts/helpers/environments.sh (sourced here): a script that
# reaches one takes it by name (check_environment), production only from a clean main
# (check_production_source), and what reaches people only after a typed phrase
# (confirm_phrase; `--confirm "<phrase>"` gives it in advance, add_confirmation). Sourced,
# never run directly. Expects to be called from the repo root.

source "$(dirname "${BASH_SOURCE[0]}")/environments.sh"

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

# The environment a script was asked for, by name: staging or production (ENVIRONMENTS in
# web/shared/config.js). There is no default, so nothing reaches a server by being forgotten.
check_environment() {
  local names
  names=$(environment_names)
  case " $names " in
    *" ${1:-none} "*) ;;
    *) fail "Which environment? Name one: ${names// / or } (got: ${1:-nothing})." "Run it again with the environment, for example: $2" ;;
  esac
}

# Production is made only from what is on main and committed: what players get is a commit
# anyone can look at again. Staging takes any branch, so work is tried there first.
check_production_source() {
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)
  [ "$branch" = main ] || fail "Production is made only from main (this is $branch)." "Merge into main and run it from there; try a branch on staging instead."
  [ -z "$(git status --porcelain)" ] || fail "There are uncommitted changes:
$(git status --short)" "Commit them (or remove them), then run it again."
}

# The environment's server answers (its website), so no build is made for a server that is
# not there yet.
check_server_up() {
  local origin
  origin=$(environment_value "$1" origin)
  curl -fsS -o /dev/null --max-time 20 "$origin/" \
    || fail "The $1 server does not answer ($origin)." "Deploy it first: ./scripts/deploy.sh $1"
}

# Phrases given in advance with `--confirm "<phrase>"`, one per use of the flag.
CONFIRMED=()
add_confirmation() {
  [ -n "${1:-}" ] || fail "--confirm needs the exact phrase a step asks for." "For example: --confirm \"deploy to production\""
  CONFIRMED+=("$1")
}

# Asks for an exact phrase before a step that reaches people (a production deploy, App Review,
# Google Play's production track): typed at the prompt, or given in advance with --confirm.
# Only that exact phrase counts; without a terminal and without it in advance, it refuses.
confirm_phrase() {
  local phrase=$1 typed given
  echo "! $2"
  for given in ${CONFIRMED[@]+"${CONFIRMED[@]}"}; do
    if [ "$given" = "$phrase" ]; then
      echo "  Confirmed in advance: $phrase"
      return 0
    fi
  done
  [ -t 0 ] || fail "This step needs your typed confirmation." "Run it in a terminal, or give it in advance: --confirm \"$phrase\""
  read -r -p "  Type \"$phrase\" to go on: " typed
  [ "$typed" = "$phrase" ] || fail "Not confirmed (it needs exactly: $phrase)." "Run it again when you are sure."
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

# App Store Connect is reached with a team API key (docs/apps.md, Keys in secrets/): the
# iPhone uploads' checks, TestFlight's groups, App Review and the status.
check_app_store_key() {
  [ -f secrets/app-store-connect.p8 ] && [ -f secrets/app-store-connect.json ] || fail "The App Store Connect API key is missing (secrets/app-store-connect.p8 and .json)." "Create it as described in docs/apps.md (Keys in secrets/), or build without uploading: --no-upload"
}

# Uploads to Google Play sign in with a service account key (docs/apps.md, Google Play).
check_play_upload_key() {
  [ -f secrets/google-play.json ] || fail "The Google Play upload key is missing (secrets/google-play.json)." "Create it once as described in docs/apps.md (Google Play), or build only: ./scripts/release-apps.sh <staging|production> android --no-upload"
}

# A draft is a folder of drafts/ with a draft.js (drafts/README.md); `dev.sh drafts` needs one to show.
check_drafts() {
  ls drafts/*/draft.js >/dev/null 2>&1 || fail "There is no draft yet (a folder in drafts/ with a draft.js)." "Copy drafts/demo to drafts/<name> (drafts/README.md, \"A new draft\")."
}

preflight_setup() { check_node; }
preflight_test() { check_node; check_dependencies; check_test_browser; }
preflight_dev() { check_node; check_dependencies; }
preflight_drafts() { check_node; check_dependencies; check_drafts; }
preflight_deploy() { check_node; check_dependencies; check_test_browser; check_operator_todos; check_cloudflare_login; }
preflight_stores() { check_node; check_dependencies; check_app_store_key; }
preflight_android() { check_node; check_dependencies; check_test_browser; check_operator_todos; check_java; check_android_sdk; }
preflight_ios() { check_node; check_dependencies; check_test_browser; check_operator_todos; check_xcode; check_ios_team; }
