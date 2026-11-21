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
npx wrangler deploy
domain=$(node -e "
  const text = require('fs').readFileSync('wrangler.jsonc', 'utf8');
  console.log((text.match(/\"pattern\":\s*\"([^\"]+)\"/) || [])[1] || '');
")
echo "✓ Live at https://${domain}"
