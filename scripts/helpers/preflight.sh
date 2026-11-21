#!/usr/bin/env bash
# Preflight checks shared by every script in scripts/. Each check is one function that
# prints a short reason and the exact fix when it fails; each script runs its bundle
# (preflight_setup, preflight_test, preflight_dev, preflight_deploy) before doing anything.
# Sourced, never run directly. Expects to be called from the repo root.

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
  left=$(grep -rn "TODO_OPERATOR:" web src wrangler.jsonc 2>/dev/null || true)
  [ -z "$left" ] || fail "Some values only the operator can provide are still missing:
$left" "Fill them in (README, Deploy), then deploy again."
}

preflight_setup() { check_node; }
preflight_test() { check_node; check_dependencies; check_test_browser; }
preflight_dev() { check_node; check_dependencies; }
preflight_deploy() { check_node; check_dependencies; check_test_browser; check_operator_todos; check_cloudflare_login; }
