/**
 * The invite QR code: friends at the same table scan the host's screen to join.
 *
 * Mechanisms: the invite sheet (`views/sheets.js`) shows `qrSvg(inviteLink)`. Uses the
 * vendored, unmodified qrcode-generator (`web/vendor/qrcode.mjs`, MIT).
 */

import qrcode from '../vendor/qrcode.mjs';

export function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'QR code to join the game' });
}
