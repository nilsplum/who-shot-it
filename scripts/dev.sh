#!/usr/bin/env bash
# Runs the whole app locally (Worker, Durable Objects, static files) with live reload.
# Phones on the same Wi-Fi can join at http://<this computer's IP>:8787. Over plain http,
# phones skip the extras that need https (keeping the screen awake, the share sheet).
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh
preflight_dev

ip=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)
echo "→ Open http://localhost:8787${ip:+  (phones on this Wi-Fi: http://$ip:8787)}"
npx wrangler dev --ip 0.0.0.0 --port 8787
