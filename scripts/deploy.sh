#!/usr/bin/env bash
# Deploys the server to one environment on Cloudflare (ENVIRONMENTS in web/shared/config.js):
#   ./scripts/deploy.sh staging      the Worker the test builds talk to (TestFlight, Google
#                                    Play's internal track). Any branch: try work here first.
#   ./scripts/deploy.sh production   the Worker the store apps and the website use. Only from a
#                                    clean main, and only after typing "deploy to production".
# Options:
#   --confirm "<phrase>"   the typed confirmation given in advance (for a run without a terminal)
#
# There is no default environment: a deploy names where it goes. Refuses while an operator
# value is missing (TODO_OPERATOR) or this machine is not logged in, runs every test, then
# uploads the Worker, the Durable Object migration and the static files in one
# `wrangler deploy` (`--env staging` for staging, wrangler.jsonc). Production must keep
# understanding every app version players have installed (README, Release).
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh

usage="./scripts/deploy.sh staging   (or: ./scripts/deploy.sh production)"
environment=""
while [ $# -gt 0 ]; do
  case "$1" in
    --confirm) shift; add_confirmation "${1:-}" ;;
    -*) fail "Unknown option: $1" "Use: $usage [--confirm \"<phrase>\"]" ;;
    *) [ -z "$environment" ] || fail "One environment at a time (got $environment and $1)." "Use: $usage"; environment=$1 ;;
  esac
  shift
done
check_environment "$environment" "$usage"
preflight_deploy
if [ "$environment" = production ]; then
  check_production_source
  confirm_phrase "deploy to production" "This replaces the server every player's game runs on ($(environment_value production origin)). It must still understand every app version people have installed."
fi

./scripts/test.sh
echo "→ Deploying to $environment ($(environment_value "$environment" worker))"
if [ "$environment" = production ]; then
  npx wrangler deploy
else
  npx wrangler deploy --env "$environment"
fi
echo "✓ Deployed to $environment: $(environment_value "$environment" origin)"
