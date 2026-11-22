#!/usr/bin/env bash
# Runs the server locally (Worker, Durable Objects, the website) with live reload:
#   ./scripts/dev.sh            the server at http://localhost:8787 (the website in a browser)
#   ./scripts/dev.sh android    also the app on a connected Android phone or emulator
#   ./scripts/dev.sh ios        also the app on a connected iPhone or the simulator (Mac with Xcode)
# With a platform, the app loads the game straight from this computer (Capacitor's live
# reload), so a change in web/ or styles/ shows on the phone at once (wrangler dev rebuilds
# the stylesheet, wrangler.jsonc), and it talks to this local server instead of the real
# one. The phone must be on the same Wi-Fi.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh
platform="${1:-}"
case "$platform" in
  '') preflight_dev ;;
  android) preflight_dev; check_java; check_android_sdk ;;
  ios) preflight_dev; check_xcode ;;
  *) fail "Unknown platform: $platform" "Use: ./scripts/dev.sh [android|ios]" ;;
esac

ip=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)
if [ -z "$platform" ]; then
  echo "→ Open http://localhost:8787 (the website; the game itself runs in the apps)"
  exec npx wrangler dev --ip 0.0.0.0 --port 8787
fi
[ -n "$ip" ] || fail "This computer has no Wi-Fi address." "Connect it to the same Wi-Fi as the phone."
npx wrangler dev --ip 0.0.0.0 --port 8787 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
echo "→ Starting the app on $platform against http://$ip:8787"
npx cap run "$platform" --live-reload --host "$ip" --port 8787
wait $server
