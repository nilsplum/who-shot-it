#!/usr/bin/env bash
# The one entry point for all tests:
#   1. unit + integration tests (Vitest inside the real Workers runtime), then
#   2. end-to-end tests (three phone browsers playing against `wrangler dev`).
# Usage: ./scripts/test.sh            everything
#        ./scripts/test.sh --no-e2e   skip the browser tests (quick check while coding)
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh
preflight_test

echo "→ Unit and integration tests"
npx vitest run

if [ "${1:-}" = "--no-e2e" ]; then
  echo "✓ Unit and integration tests passed (browser tests skipped)"
  exit 0
fi

echo "→ End-to-end tests (starts a local server with empty storage)"
rm -rf .wrangler/e2e test-results
npx playwright test
echo "✓ All tests passed"
