#!/usr/bin/env bash
# The deployed environments as the scripts need them: what each is called, where it is, the
# number of its builds, and the one writer of a build's environment into the app.
#
# Purpose: staging (the test builds and their own Worker) and production (the store apps, the
# website) are defined once, in ENVIRONMENTS in web/shared/config.js, which the app and the
# server read too; this file reads that table instead of restating it, so a renamed Worker or
# a moved address changes every script at once. Local development is deliberately no
# environment here: ./scripts/dev.sh and the tests run on this computer, and a script asked
# about "local" fails instead of answering something plausible.
#
# Mechanisms: ./scripts/deploy.sh picks the Worker (`environment_value <env> worker`),
# ./scripts/release-apps.sh the build number (`app_build_number`) and the environment written
# into the native project's copy of the game (`mark_app_environment`, put back with
# `restore_app_environment`); preflight.sh checks a name against the table
# (`check_environment`) and that a server answers (`check_server_up`).
#
# Invariants:
# - Sourcing has no side effects: functions only, safe under `set -euo pipefail`.
# - web/js/environment.js in web/ always says production. Only `mark_app_environment` writes
#   another environment, and only into a native project's copy (ios/App/App/public,
#   android/app/src/main/assets/public, both git-ignored and refreshed by every
#   `npx cap sync`), checking the result before a build may use it; `restore_app_environment`
#   copies web/ back over it, so a build made later by hand can only ever be production.
# - Expects to be called from the repo root (as every script in scripts/ is).

# The environments' names, in the table's order ("production staging").
environment_names() {
  node --input-type=module -e "import { ENVIRONMENTS } from './web/shared/config.js'; console.log(Object.keys(ENVIRONMENTS).join(' '));"
}

# One field of an environment from the table: origin, worker or build (its build-number digit).
environment_value() {
  node --input-type=module -e "
    import { ENVIRONMENTS } from './web/shared/config.js';
    const value = ENVIRONMENTS[process.argv[1]]?.[process.argv[2]];
    if (value === undefined) process.exit(1);
    console.log(value);
  " "$1" "$2"
}

# The build number for this version (package.json) built for an environment (`buildNumber`).
app_build_number() {
  node --input-type=module -e "
    import { readFileSync } from 'node:fs';
    import { buildNumber } from './web/shared/config.js';
    console.log(buildNumber(JSON.parse(readFileSync('package.json', 'utf8')).version, process.argv[1]));
  " "$1"
}

# Where a platform's native project keeps its copy of web/ (written by `npx cap sync`).
app_copy_dir() {
  case "$1" in
    ios) echo "ios/App/App/public" ;;
    android) echo "android/app/src/main/assets/public" ;;
  esac
}

# Writes the environment of the build about to be made into the platform's copy of
# web/js/environment.js, then checks the copy says exactly that (the line test/unit/phone.test.js
# pins in web/), so a build never starts against another server than the one it was asked for.
mark_app_environment() {
  local environment=$1 file
  file="$(app_copy_dir "$2")/js/environment.js"
  [ -f "$file" ] || fail "The $2 project has no copy of the game yet ($file)." "Run the release again: npx cap sync writes the copy first."
  sed -i '' -E "s/^export const ENVIRONMENT = '[a-z]+';$/export const ENVIRONMENT = '$environment';/" "$file"
  grep -qx "export const ENVIRONMENT = '$environment';" "$file" \
    || fail "The $2 build could not be set to $environment ($file)." "Check that web/js/environment.js still has its line: export const ENVIRONMENT = 'production';"
  echo "→ $2: this build talks to $environment ($(environment_value "$environment" origin))"
}

# Copies web/ back into the platform's project, so its copy says production again.
restore_app_environment() {
  npx cap copy "$1" >/dev/null 2>&1 || echo "! Could not refresh the $1 project's copy of the game: run npx cap copy $1 before building it by hand." >&2
}
