#!/usr/bin/env bash
# Builds web/css/app.css, the one stylesheet of the app and the website, from
# styles/app.css with Tailwind: the theme, plus every class the views and pages use,
# minified (Lightning CSS, inside Tailwind, lowers it to the browsers Tailwind supports).
# Run by Wrangler before every `wrangler dev` and `wrangler deploy` and whenever a source
# changes while `wrangler dev` runs (wrangler.jsonc, build), and by ./scripts/release-apps.sh
# before web/ is copied into the apps. The output is git-ignored: it is always built from
# the sources, never edited.
set -euo pipefail
cd "$(dirname "$0")/../.."
npx tailwindcss --input styles/app.css --output web/css/app.css --minify
