/**
 * Draws every app icon and launch screen of both apps, and the store icons and graphic,
 * from the one icon `web/icons/icon.svg` in the app's colours (the theme in
 * `styles/app.css`, through `colours.mjs`). Run by `./scripts/release-apps.sh` before every
 * build, so the native projects always show the current icon; the output is identical for
 * identical input, so an unchanged icon changes no file.
 *
 * Renders with the end-to-end tests' Chromium (Playwright), so it needs no image tool.
 * Writes into the native projects (committed, so Android Studio and Xcode open complete
 * projects) and into `store/images/` (committed; uploaded by hand on the store pages).
 *
 * The icon has two layers, `#bg` and `#mark`: iPhone icons use both; Android's adaptive
 * icon gets them as separate images (background and foreground), with the mark inside the
 * 66 dp safe zone so no launcher mask cuts it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { colour } from './colours.mjs';

const ROOT = path.join(import.meta.dirname, '..', '..');
const at = (...parts) => path.join(ROOT, ...parts);

const icon = fs.readFileSync(at('web/icons/icon.svg'), 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');
const font = fs.readFileSync(at('web/fonts/bricolage-grotesque-800.woff2')).toString('base64');

/** The page that draws one image; `only` hides the other layer ('bg' or 'mark'). */
const page = (body, { background = 'transparent', only = null } = {}) => `<style>
  body { margin: 0; height: 100vh; display: grid; place-items: center; background: ${background}; }
  ${only === 'bg' ? '#mark { display: none; }' : ''} ${only === 'mark' ? '#bg { display: none; }' : ''}
  @font-face { font-family: B; src: url(data:font/woff2;base64,${font}); }
</style><body>${body}</body>`;

/** The icon at `share` of the shorter side, optionally with iOS-like rounded corners. */
const sized = (share, rounded = false) => `<div style="width:${share * 100}vmin;height:${share * 100}vmin;${rounded ? 'border-radius:22.37%;overflow:hidden;' : ''}">${icon}</div>`;

const fullIcon = page(sized(1));
const launch = (share) => page(sized(share, true), { background: colour('navy') });
/** Google Play's banner: the icon's own background, the icon, the name. */
const featureGraphic = page(`<div style="position:fixed;inset:0">${icon.replace('<svg ', '<svg preserveAspectRatio="none" ').replace('id="mark"', 'id="mark-hidden" style="display:none"')}</div>
  <div style="position:relative;display:flex;align-items:center;gap:56px">
    <div style="width:300px;height:300px;border-radius:22.37%;overflow:hidden;box-shadow:0 20px 50px color-mix(in srgb, ${colour('stage')} 25%, transparent)">${icon}</div>
    <div style="font:800 100px/1 B;color:${colour('white')};letter-spacing:-2px">Who<br>Shot It?</div></div>`);

const android = 'android/app/src/main/res';
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const splash = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };

/** [file, width, height, html, transparent] */
const targets = [
  // iPhone: the App Store icon (opaque, iOS rounds the corners) and the launch screen.
  ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024, fullIcon],
  ...['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']
    .map((f) => [`ios/App/App/Assets.xcassets/Splash.imageset/${f}`, 2732, 2732, launch(0.12)]),
  // Android: the adaptive icon's two layers (108 dp; the mark within the 66 dp safe zone)
  // and the launch screens.
  ...Object.entries(densities).flatMap(([d, x]) => [
    [`${android}/mipmap-${d}/ic_launcher_foreground.png`, 108 * x, 108 * x, page(sized(66 / 108), { only: 'mark' }), true],
    [`${android}/mipmap-${d}/ic_launcher_background.png`, 108 * x, 108 * x, page(sized(1), { only: 'bg' })],
  ]),
  [`${android}/drawable/splash.png`, 480, 320, launch(0.3)],
  ...Object.entries(splash).flatMap(([d, [w, h]]) => [
    [`${android}/drawable-port-${d}/splash.png`, w, h, launch(0.3)],
    [`${android}/drawable-land-${d}/splash.png`, h, w, launch(0.3)],
  ]),
  // Store listings (uploaded by hand, see store/listing.md).
  ['store/images/app-store-icon-1024.png', 1024, 1024, fullIcon],
  ['store/images/google-play-icon-512.png', 512, 512, fullIcon],
  ['store/images/google-play-feature-graphic-1024x500.png', 1024, 500, featureGraphic],
];

const browser = await chromium.launch();
const tab = await browser.newPage();
for (const [file, width, height, html, transparent = false] of targets) {
  await tab.setViewportSize({ width, height });
  await tab.setContent(html);
  fs.mkdirSync(path.dirname(at(file)), { recursive: true });
  await tab.screenshot({ path: at(file), omitBackground: transparent });
}
await browser.close();
console.log(`✓ ${targets.length} icons, launch screens and store graphics drawn from web/icons/icon.svg`);
