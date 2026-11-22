/**
 * Draws the phone screens among the text check's test images (`test/fixtures/text/`, see
 * its SOURCES.md): chats, emails, an article, lists, a document and code, light and dark,
 * which the game must leave out as full of text; and a meme, a story with a sticker, a game
 * and a photo viewer, which it must keep. Run it after changing a screen here:
 *   node scripts/helpers/text-fixtures.mjs
 *
 * Each screen is drawn at an iPhone's size (393 x 852 points, 3 pixels per point), then
 * turned into the preview the app gets from the phone (`phone.randomPhotos`: the longest
 * side LIMITS.previewSide pixels, JPEG LIMITS.previewQuality), so the tests see what the
 * app sees. Words come from a fixed list with a seeded random order, so every run draws
 * the same screens. The real photos next to them are not touched (the keep screens put
 * three of them into a meme, a story and a photo viewer).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { LIMITS } from '../../web/shared/config.js';

const DIR = path.join(import.meta.dirname, '..', '..', 'test', 'fixtures', 'text');
const photo = (name) => `data:image/jpeg;base64,${fs.readFileSync(path.join(DIR, name)).toString('base64')}`;

const words = 'the we you are meeting tomorrow thanks for your message please find attached report invoice project update lunch at noon see you soon sounds good let me know when can call about weekend plans dinner tickets booked train delayed sorry running late great idea sure no problem happy birthday congrats'.split(' ');
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const sentence = (n) => Array.from({ length: n }, () => words[Math.floor(rnd() * words.length)]).join(' ').replace(/^./, (c) => c.toUpperCase()) + '.';
const para = (n) => Array.from({ length: n }, () => sentence(6 + Math.floor(rnd() * 10))).join(' ');
const names = ['Anna Schmidt', 'Ben Lee', 'Clara Novak', 'David Ortiz', 'Emma Brown', 'Felix Wagner', 'Grace Kim', 'Hugo Martin', 'Ida Larsen', 'Jonas Weber', 'Kira Patel', 'Leo Rossi'];
const base = (dark) => `*{box-sizing:border-box}body{margin:0;width:393px;height:852px;overflow:hidden;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;background:${dark ? '#000' : '#fff'};color:${dark ? '#f2f2f2' : '#111'}}.status{height:54px;display:flex;justify-content:space-between;align-items:flex-end;padding:0 28px 8px;font-weight:600;font-size:16px}`;
const status = '<div class="status"><span>9:41</span><span>▂▄▆ 100%</span></div>';

const screens = {
  'skip-email-inbox': (d = false) => `<style>${base(d)}.it{padding:10px 16px;border-bottom:1px solid ${d ? '#333' : '#e5e5e5'}}.f{font-weight:600;font-size:16px;display:flex;justify-content:space-between}.f small{font-weight:400;color:#888;font-size:13px}.s{font-size:15px}.p{font-size:14px;color:#888;height:36px;overflow:hidden}h1{font-size:32px;margin:6px 16px}</style>${status}<h1>Inbox</h1>${names.map((n) => `<div class="it"><div class="f">${n}<small>${8 + Math.floor(rnd() * 4)}:${10 + Math.floor(rnd() * 49)}</small></div><div class="s">${sentence(4)}</div><div class="p">${para(2)}</div></div>`).join('')}`,
  'skip-email-inbox-dark': () => screens['skip-email-inbox'](true),
  'skip-email-message': (d = false) => `<style>${base(d)}h2{font-size:22px;margin:12px 16px}.m{margin:0 16px;font-size:16px;line-height:1.45}.from{margin:0 16px 14px;color:#888;font-size:14px}</style>${status}<h2>${sentence(5)}</h2><div class="from">From: ${names[0]} · To: me</div><div class="m"><p>Hi,</p><p>${para(4)}</p><p>${para(3)}</p><p>${para(4)}</p><p>Best,<br>Anna</p></div>`,
  'skip-email-message-dark': () => screens['skip-email-message'](true),
  'skip-chat': (d = false) => `<style>${base(d)}.c{padding:8px 12px;display:flex;flex-direction:column;gap:6px}.b{max-width:75%;padding:8px 12px;border-radius:18px;font-size:16px;line-height:1.3}.in{background:${d ? '#262628' : '#e9e9eb'};align-self:flex-start}.out{background:#0a84ff;color:#fff;align-self:flex-end}.hd{text-align:center;font-weight:600;padding:6px;border-bottom:1px solid ${d ? '#333' : '#ddd'}}</style>${status}<div class="hd">Clara</div><div class="c">${Array.from({ length: 14 }, (_, i) => `<div class="b ${i % 3 ? 'in' : 'out'}">${sentence(3 + Math.floor(rnd() * 12))}</div>`).join('')}</div>`,
  'skip-chat-dark': () => screens['skip-chat'](true),
  'skip-chat-green': () => `<style>${base(false)}body{background:#efe7de}.c{padding:8px 10px;display:flex;flex-direction:column;gap:5px}.b{max-width:80%;padding:6px 9px;border-radius:8px;font-size:16px;line-height:1.3;background:#fff}.out{background:#d9fdd3;align-self:flex-end}.in{align-self:flex-start}.hd{background:#f6f6f6;padding:10px 16px;font-weight:600}</style>${status}<div class="hd">Family group</div><div class="c">${Array.from({ length: 16 }, (_, i) => `<div class="b ${i % 4 === 1 ? 'out' : 'in'}"><b style="color:#c05;font-size:13px">${names[i % 12].split(' ')[0]}</b><br>${sentence(4 + Math.floor(rnd() * 10))}</div>`).join('')}</div>`,
  'skip-article': () => `<style>${base(false)}h1{font-family:Georgia,serif;font-size:28px;margin:10px 16px}.t{margin:0 16px;font-family:Georgia,serif;font-size:17px;line-height:1.5}.img{height:150px;margin:8px 16px;background:linear-gradient(135deg,#7aa,#335)}</style>${status}<h1>${sentence(8)}</h1><div class="img"></div><div class="t"><p>${para(4)}</p><p>${para(5)}</p></div>`,
  'skip-notes': () => `<style>${base(false)}body{background:#fffbe8}.t{margin:8px 18px;font-size:17px;line-height:1.45}h2{margin:8px 18px}</style>${status}<h2>Shopping and plans</h2><div class="t">${Array.from({ length: 18 }, () => `${sentence(3 + Math.floor(rnd() * 6))}<br>`).join('')}</div>`,
  'skip-settings': () => `<style>${base(false)}body{background:#f2f2f7}.g{background:#fff;margin:14px 16px;border-radius:10px}.r{display:flex;justify-content:space-between;padding:11px 14px;border-bottom:1px solid #e5e5ea;font-size:17px}.r span{color:#8e8e93}h1{margin:4px 16px;font-size:32px}</style>${status}<h1>Settings</h1>${[6, 5, 7].map((n) => `<div class="g">${Array.from({ length: n }, () => `<div class="r">${sentence(2).replace('.', '')}<span>${words[Math.floor(rnd() * words.length)]} ›</span></div>`).join('')}</div>`).join('')}`,
  'skip-bank': () => `<style>${base(false)}.r{display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #eee;font-size:15px}.r b{font-weight:500}.r small{display:block;color:#888;font-size:13px}.amt{font-variant-numeric:tabular-nums}h1{margin:6px 16px;font-size:28px}</style>${status}<h1>Transactions</h1>${Array.from({ length: 13 }, (_, i) => `<div class="r"><div><b>${names[i % 12]}</b><small>${sentence(3)}</small></div><div class="amt">-${(rnd() * 200).toFixed(2)} €</div></div>`).join('')}`,
  'skip-document': () => `<style>${base(false)}body{background:#888}.page{background:#fff;margin:60px 14px;padding:22px 20px;font-family:Times,serif;font-size:9px;line-height:1.35;height:650px;overflow:hidden}h3{font-size:12px;margin:0 0 8px}</style><div class="page"><h3>${sentence(6)}</h3>${Array.from({ length: 6 }, () => `<p>${para(5)}</p>`).join('')}</div>`,
  'skip-code': () => `<style>${base(true)}body{background:#1e1e1e}.l{font-family:Menlo,monospace;font-size:13px;line-height:1.5;padding:0 12px;white-space:pre;color:#ccc}.k{color:#c586c0}.s{color:#ce9178}</style>${status}${Array.from({ length: 30 }, (_, i) => `<div class="l">${' '.repeat((i % 4) * 2)}<span class="k">${['const', 'if', 'return', 'await'][i % 4]}</span> ${words[i % words.length]}(<span class="s">'${words[(i * 3) % words.length]}'</span>);</div>`).join('')}`,
  'skip-social': () => `<style>${base(false)}.p{display:flex;gap:10px;padding:12px 14px;border-bottom:1px solid #eee}.a{width:40px;height:40px;border-radius:50%;background:#9ab;flex:none}.n{font-weight:700;font-size:15px}.t{font-size:15px;line-height:1.35}</style>${status}${Array.from({ length: 7 }, (_, i) => `<div class="p"><div class="a"></div><div><div class="n">${names[i]}</div><div class="t">${para(2)}</div></div></div>`).join('')}`,
  'skip-calendar': () => `<style>${base(false)}.d{font-weight:700;padding:10px 16px 4px;font-size:15px;color:#d33}.e{display:flex;gap:10px;padding:6px 16px;font-size:15px}.e i{width:4px;background:#5b8;border-radius:2px}.e small{color:#888;display:block}</style>${status}${Array.from({ length: 6 }, (_, i) => `<div class="d">Monday ${10 + i} November</div>${Array.from({ length: 2 }, () => `<div class="e"><i></i><div>${sentence(4)}<small>${9 + i}:00 to ${10 + i}:30 · ${words[i]}</small></div></div>`).join('')}`).join('')}`,
  'skip-search': () => `<style>${base(false)}.q{margin:6px 14px;padding:10px 14px;border-radius:22px;background:#f1f3f4}.r{padding:10px 16px}.u{color:#1a0dab;font-size:18px}.s{font-size:14px;color:#4d5156;line-height:1.4}.l{font-size:12px;color:#006621}</style>${status}<div class="q">${sentence(4)}</div>${Array.from({ length: 6 }, () => `<div class="r"><div class="l">www.${words[Math.floor(rnd() * words.length)]}.com</div><div class="u">${sentence(5)}</div><div class="s">${para(1)}</div></div>`).join('')}`,
  // Not much text: these stay in the game.
  'keep-meme': () => `<style>${base(true)}.m{position:relative;margin-top:180px}img{width:393px;display:block}.c{position:absolute;left:0;right:0;text-align:center;font:900 34px Impact,Arial Black,sans-serif;color:#fff;-webkit-text-stroke:2px #000;text-transform:uppercase}</style>${status}<div class="m"><img src="${photo('keep-dog-2.jpg')}"><div class="c" style="top:6px">When the pizza</div><div class="c" style="bottom:6px">finally arrives</div></div>`,
  'keep-photo-viewer': () => `<style>${base(true)}img{width:393px;margin-top:220px;display:block}.bar{position:absolute;bottom:0;left:0;right:0;height:80px;display:flex;justify-content:space-around;align-items:center;font-size:24px}</style>${status}<img src="${photo('keep-park-7.jpg')}"><div class="bar">⬆︎ ♡ ⓘ 🗑</div>`,
  'keep-game': () => `<style>${base(true)}body{background:linear-gradient(#4ac,#7d5)}.s{position:absolute;top:60px;left:20px;font:800 28px Arial;color:#fff}.b{position:absolute;border-radius:14px}</style>${status}<div class="s">★ 1250</div>${Array.from({ length: 14 }, () => `<div class="b" style="left:${rnd() * 330}px;top:${150 + rnd() * 620}px;width:${30 + rnd() * 50}px;height:${30 + rnd() * 50}px;background:hsl(${rnd() * 360},80%,60%)"></div>`).join('')}`,
  'keep-story': () => `<style>${base(true)}img{width:393px;height:852px;object-fit:cover;position:absolute;inset:0}.t{position:absolute;top:520px;left:60px;padding:8px 14px;background:#fff;color:#000;font:700 26px Arial;border-radius:8px;transform:rotate(-4deg)}</style><img src="${photo('keep-lunch-2.jpg')}"><div class="t">Best day ever!</div>`,
};

const browser = await chromium.launch();
const shot = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
const convert = await browser.newPage();

/** The preview the phone would hand over for this image. */
async function preview(dataUrl) {
  return convert.evaluate(async ([src, side, quality]) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * k);
    canvas.height = Math.round(img.naturalHeight * k);
    const g = canvas.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality).split(',')[1];
  }, [dataUrl, LIMITS.previewSide, LIMITS.previewQuality]);
}

for (const [name, html] of Object.entries(screens)) {
  await shot.setContent(html());
  const png = await shot.screenshot();
  fs.writeFileSync(path.join(DIR, `${name}.jpg`), Buffer.from(await preview(`data:image/png;base64,${png.toString('base64')}`), 'base64'));
}
await browser.close();
console.log(`✓ ${Object.keys(screens).length} drawn test images in test/fixtures/text/`);
