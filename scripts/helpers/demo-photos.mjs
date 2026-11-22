/**
 * Drawn stand-in photos (simple scenes: sunset, mountains, city, pizza, forest, party; no
 * people, no real photos) for the store images (`store-images.mjs`) and the demo players
 * (`demo-players.mjs`), so nothing shows anybody's private pictures and nothing needs an
 * image licence. `drawLibrary` renders them as JPEGs, base64 encoded the way the app's
 * photo plugin hands photos over.
 */

/** Simple drawn scenes standing in for holiday, food and party photos. */
export const SCENES = [
  '<rect width="1080" height="1350" fill="#ff9a62"/><rect y="800" width="1080" height="550" fill="#2b6cb0"/><circle cx="540" cy="760" r="210" fill="#ffd23f"/><rect y="800" width="1080" height="20" fill="#ffe08a" opacity=".6"/>',
  '<rect width="1080" height="1350" fill="#9be7ff"/><polygon points="0,1350 360,520 720,1350" fill="#4a5568"/><polygon points="380,1350 760,380 1080,1000 1080,1350" fill="#2d3748"/><polygon points="660,560 760,380 860,560" fill="#fff"/>',
  '<rect width="1080" height="1350" fill="#1a1a40"/><circle cx="860" cy="220" r="90" fill="#fdf6c3"/><g fill="#2c2c5a"><rect x="60" y="700" width="220" height="650"/><rect x="320" y="520" width="260" height="830"/><rect x="620" y="760" width="200" height="590"/><rect x="850" y="600" width="180" height="750"/></g><g fill="#ffd23f"><rect x="100" y="760" width="40" height="40"/><rect x="380" y="600" width="40" height="40"/><rect x="460" y="700" width="40" height="40"/><rect x="680" y="840" width="40" height="40"/><rect x="900" y="680" width="40" height="40"/></g>',
  '<rect width="1080" height="1350" fill="#f6e7c1"/><circle cx="540" cy="675" r="430" fill="#e8a33d"/><circle cx="540" cy="675" r="370" fill="#f4c542"/><g fill="#c0392b"><circle cx="420" cy="560" r="60"/><circle cx="660" cy="520" r="55"/><circle cx="560" cy="760" r="62"/><circle cx="380" cy="800" r="50"/><circle cx="720" cy="780" r="58"/></g><g fill="#27ae60"><circle cx="520" cy="640" r="18"/><circle cx="640" cy="660" r="18"/><circle cx="470" cy="700" r="18"/></g>',
  '<rect width="1080" height="1350" fill="#3ddc97"/><rect y="980" width="1080" height="370" fill="#2f9e6e"/><g fill="#1e6b4a"><polygon points="140,1000 260,560 380,1000"/><polygon points="420,1000 560,420 700,1000"/><polygon points="720,1000 840,600 960,1000"/></g><circle cx="880" cy="200" r="100" fill="#fff6b0"/>',
  '<rect width="1080" height="1350" fill="#b388ff"/><g><circle cx="200" cy="260" r="40" fill="#ffd23f"/><circle cx="860" cy="340" r="50" fill="#ff5a5f"/><circle cx="320" cy="980" r="46" fill="#4cc9f0"/><circle cx="780" cy="1080" r="38" fill="#3ddc97"/><circle cx="540" cy="200" r="30" fill="#fff"/><circle cx="140" cy="700" r="34" fill="#ff8fab"/><circle cx="960" cy="760" r="42" fill="#ffd23f"/></g><rect x="390" y="520" width="300" height="360" rx="40" fill="#fff"/><rect x="430" y="440" width="220" height="110" rx="30" fill="#ff5a5f"/><rect x="455" y="620" width="170" height="20" rx="10" fill="#b388ff"/><rect x="455" y="700" width="170" height="20" rx="10" fill="#ffd23f"/>',
];

/** The scenes as base64 JPEGs, rendered in `browser` (a Playwright Chromium). */
export async function drawLibrary(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  const library = [];
  for (const scene of SCENES) {
    await page.setContent(`<body style="margin:0"><svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">${scene}</svg></body>`);
    library.push((await page.screenshot({ type: 'jpeg', quality: 85 })).toString('base64'));
  }
  await page.close();
  return library;
}
