#!/usr/bin/env bash
# Deploys to Cloudflare. Refuses while an operator value is missing (TODO_OPERATOR) or
# this machine is not logged in, runs every test, then uploads the Worker, the Durable
# Object migration and the static files in one `wrangler deploy`.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh
preflight_deploy

./scripts/test.sh
echo "→ Deploying to Cloudflare"
# Wrangler prints the live address (workers.dev or the domain, as set in wrangler.jsonc).
npx wrangler deploy
echo "✓ Deployed. The live address is listed above."
