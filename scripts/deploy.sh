#!/usr/bin/env bash
# Deploys the server to one environment on Cloudflare (ENVIRONMENTS in web/shared/config.js):
#   ./scripts/deploy.sh staging      the Worker the test builds talk to (TestFlight, Google
#                                    Play's internal track). Any branch: try work here first.
#   ./scripts/deploy.sh production   the Worker the store apps and the website use. Only from a
#                                    clean main, and only after typing "deploy to production".
# Options:
#   --min <version>                  the oldest app version that may create or join a game
#                                    there ("none": every version)
#   --newest <ios|android>=<version> the newest version people can install for that server, by
#                                    platform ("none": no hint); once per platform
#   --confirm "<phrase>"             a typed confirmation given in advance (for a run without a
#                                    terminal)
#
# There is no default environment: a deploy names where it goes. Refuses while an operator
# value is missing (TODO_OPERATOR) or this machine is not logged in. Then the version gate
# (normalizeGate in web/shared/config.js): it shows which app versions the live server lets
# play and the newest out, and asks for each (Enter keeps it; the options above answer in
# advance, and without a terminal the live values are kept); raising production's minimum
# needs the typed phrase "raise the minimum to <version>". Every question comes before the
# tests, so nobody is asked after minutes of waiting. Then it runs every test and uploads the
# Worker, the Durable Object migration and the static files in one `wrangler deploy` (`--env
# staging` for staging, wrangler.jsonc), with the gate as the Worker's GATE value, and reads
# the gate back from the live server (scripts/helpers/gate.mjs). The gate is never stored in
# the repo: the live server is its one source of truth, and Cloudflare keeps it with each
# deployed version. A deploy that only changes the gate still deploys the code it runs from.
# Production must keep understanding every app version its gate lets play (README, Release).
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh

usage="./scripts/deploy.sh staging   (or: ./scripts/deploy.sh production)"
environment=""
gate_options=()
while [ $# -gt 0 ]; do
  case "$1" in
    --confirm) shift; add_confirmation "${1:-}" ;;
    --min | --newest)
      [ $# -ge 2 ] || fail "$1 needs a value." "For example: --min 1.0.11 or --newest ios=1.0.11"
      gate_options+=("$1" "$2")
      shift ;;
    -*) fail "Unknown option: $1" "Use: $usage [--min <version>] [--newest ios=<version>] [--confirm \"<phrase>\"]" ;;
    *) [ -z "$environment" ] || fail "One environment at a time (got $environment and $1)." "Use: $usage"; environment=$1 ;;
  esac
  shift
done
check_environment "$environment" "$usage"
preflight_deploy
[ "$environment" != production ] || check_production_source

# The gate this deploy gives the Worker (line 1, JSON) and the new minimum if it went up (line 2).
answer=$(node scripts/helpers/gate.mjs ask "$environment" ${gate_options[@]+"${gate_options[@]}"})
gate=$(sed -n 1p <<< "$answer")
raised=$(sed -n 2p <<< "$answer")
if [ "$environment" = production ]; then
  confirm_phrase "deploy to production" "This replaces the server every player's game runs on ($(environment_value production origin)). It must still understand every app version its gate lets play."
  if [ -n "$raised" ]; then
    confirm_phrase "raise the minimum to $raised" "Apps older than $raised can no longer create or join a game on production: they are asked to update (a game they are in goes on)."
  fi
fi

./scripts/test.sh
echo "→ Deploying to $environment ($(environment_value "$environment" worker))"
if [ "$environment" = production ]; then
  npx wrangler deploy --var "GATE:$gate"
else
  npx wrangler deploy --env "$environment" --var "GATE:$gate"
fi
node scripts/helpers/gate.mjs verify "$environment" "$gate"
echo "✓ Deployed to $environment: $(environment_value "$environment" origin)"
