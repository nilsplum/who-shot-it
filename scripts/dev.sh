#!/usr/bin/env bash
# Runs the game, or the store pages, locally to look at:
#   ./scripts/dev.sh            the server at http://localhost:8787 (the website in a browser)
#   ./scripts/dev.sh android    also the app on a connected Android phone or emulator
#   ./scripts/dev.sh ios        also the app on a connected iPhone or the simulator (Mac with Xcode)
#   ./scripts/dev.sh store      both store pages (texts, icons, screenshots) at http://localhost:8788,
#                               as players will see them (scripts/helpers/store-preview.mjs)
# With a platform, the app loads the game straight from this computer (Capacitor's live
# reload), so a change in web/ or styles/ shows on the phone at once (wrangler dev rebuilds
# the stylesheet, wrangler.jsonc), and it talks to this local server instead of the real
# one. The phone must be on the same Wi-Fi. The store pages restart by themselves when a
# listing in store/ changes (node --watch); reload the browser to see it.
set -euo pipefail
cd "$(dirname "$0")/.."
source scripts/helpers/preflight.sh
target="${1:-}"
case "$target" in
  '' | store) preflight_dev ;;
  android) preflight_dev; check_java; check_android_sdk ;;
  ios) preflight_dev; check_xcode ;;
  *) fail "Unknown option: $target" "Use: ./scripts/dev.sh [android|ios|store]" ;;
esac

if [ "$target" = store ]; then
  exec node --watch scripts/helpers/store-preview.mjs
fi
ip=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)
if [ -z "$target" ]; then
  echo "→ Open http://localhost:8787 (the website; the game itself runs in the apps)"
  exec npx wrangler dev --ip 0.0.0.0 --port 8787
fi
[ -n "$ip" ] || fail "This computer has no Wi-Fi address." "Connect it to the same Wi-Fi as the phone."
npx wrangler dev --ip 0.0.0.0 --port 8787 &
server=$!
trap 'kill $server 2>/dev/null' EXIT
echo "→ Starting the app on $target against http://$ip:8787"
npx cap run "$target" --live-reload --host "$ip" --port 8787
wait $server
