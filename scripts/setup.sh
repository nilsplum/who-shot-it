#!/usr/bin/env bash
# One-time (and after every dependency change) setup: installs the exact pinned
# dependencies from package-lock.json and the browser the end-to-end tests use.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh
preflight_setup

echo "→ Installing dependencies (exact versions from package-lock.json)"
npm ci --no-audit --no-fund
echo "→ Installing the test browser (Chromium for Playwright)"
npx playwright install chromium
echo "✓ Setup done. Next: ./scripts/test.sh, ./scripts/dev.sh or ./scripts/deploy.sh"
