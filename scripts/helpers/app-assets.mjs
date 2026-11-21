/**
 * Draws every app icon and launch screen of both apps, and the store graphics, from the
 * one logo `web/icons/icon.svg` in the app's colours (the tokens in `web/css/app.css`).
 * Run by `./scripts/build-apps.sh` before every build, so the native projects always show
 * the current logo; the output is identical for identical input, so an unchanged logo
 * changes no file.
 *
 * Renders with the end-to-end tests' Chromium (Playwright), so it needs no image tool.
 * Writes into the native projects (committed, so Android Studio and Xcode open complete
 * projects) and into `dist/store/` (the store listing graphics, uploaded by hand).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = path.join(import.meta.dirname, '..', '..');
const at = (...parts) => path.join(ROOT, ...parts);

const logo = fs.readFileSync(at('web/icons/icon.svg'), 'utf8').replace('<svg ', '<svg width="100%" height="100%" ');
const css = fs.readFileSync(at('web/css/app.css'), 'utf8');
/** A colour token of the app (`:root` in web/css/app.css), the one home of every colour. */
const token = (name) => css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,6})`))[1];
const background = token('bg');
const font = fs.readFileSync(at('web/fonts/bricolage-grotesque-800.woff2')).toString('base64');

/** A centred logo, `share` of the shorter side, on the background (or transparent). */
const centred = (share, transparent = false) => `<body style="margin:0;height:100vh;display:grid;place-items:center;background:${transparent ? 'transparent' : background}">
  <div style="width:${share * 100}vmin;height:${share * 100}vmin">${logo}</div></body>`;

const featureGraphic = `<style>@font-face{font-family:B;src:url(data:font/woff2;base64,${font})}</style>
  <body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;gap:48px;background:${background}">
  <div style="width:300px;height:300px">${logo}</div>
  <div style="font:800 96px/1 B;color:${token('white')};letter-spacing:-2px">Who<br><span style="color:${token('y')}">Shot It?</span></div></body>`;

const android = 'android/app/src/main/res';
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const splash = { mdpi: [320, 480], hdpi: [480, 800], xhdpi: [720, 1280], xxhdpi: [960, 1600], xxxhdpi: [1280, 1920] };

/** [file, width, height, html, transparent] */
const targets = [
  // iPhone: the App Store icon (opaque, iOS rounds the corners) and the launch screen.
  ['ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024, 1024, centred(0.82)],
  ...['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']
    .map((f) => [`ios/App/App/Assets.xcassets/Splash.imageset/${f}`, 2732, 2732, centred(0.16)]),
  // Android: the adaptive icon's foreground (108 dp, logo inside the 66 dp safe zone; the
  // background is the colour in values/ic_launcher_background.xml) and the launch screens.
  ...Object.entries(densities).map(([d, x]) => [`${android}/mipmap-${d}/ic_launcher_foreground.png`, 108 * x, 108 * x, centred(0.56, true), true]),
  [`${android}/drawable/splash.png`, 480, 320, centred(0.4)],
  ...Object.entries(splash).flatMap(([d, [w, h]]) => [
    [`${android}/drawable-port-${d}/splash.png`, w, h, centred(0.4)],
    [`${android}/drawable-land-${d}/splash.png`, h, w, centred(0.4)],
  ]),
  // Store listings (uploaded by hand, see README, Release).
  ['dist/store/app-store-icon-1024.png', 1024, 1024, centred(0.82)],
  ['dist/store/google-play-icon-512.png', 512, 512, centred(0.82)],
  ['dist/store/google-play-feature-graphic-1024x500.png', 1024, 500, featureGraphic],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, width, height, html, transparent = false] of targets) {
  await page.setViewportSize({ width, height });
  await page.setContent(html);
  fs.mkdirSync(path.dirname(at(file)), { recursive: true });
  await page.screenshot({ path: at(file), omitBackground: transparent });
}
await browser.close();
console.log(`✓ ${targets.length} icons and launch screens drawn from web/icons/icon.svg`);
