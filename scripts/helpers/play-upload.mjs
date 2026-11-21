/**
 * Uploads an Android App Bundle to Google Play and releases it on a track, through the
 * Google Play Developer API (androidpublisher v3). Run by `./scripts/release-apps.sh`:
 *   node scripts/helpers/play-upload.mjs <bundle.aab> <internal|production> <version>
 *
 * Signs in as the service account in `secrets/google-play.json` (git-ignored; created in
 * the Google Cloud console and invited to the Play Console, docs/apps.md) with a signed
 * JWT, so it needs no extra package. One "edit" uploads the bundle, puts its version code
 * on the track as a completed release (Google reviews it, then it goes live) and commits.
 *
 * Invariants: the key and the access token are never printed; errors show only Google's
 * own message. Google accepts API uploads only for an app whose first release was made in
 * the Play Console by hand.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const [bundle, track, version] = process.argv.slice(2);
const key = JSON.parse(fs.readFileSync('secrets/google-play.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('capacitor.config.json', 'utf8')).appId;
const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}`;
const UPLOAD = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${pkg}`;

/** An access token for the Play Developer API (OAuth 2.0 service account flow). */
async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const claims = { iss: key.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 };
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part(claims)}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Google sign-in failed: ${body.error_description || body.error || res.status}`);
  return body.access_token;
}

const token = await accessToken();

async function call(step, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const text = await res.text();
  if (!res.ok) {
    let message = text;
    try {
      message = JSON.parse(text).error.message;
    } catch {}
    throw new Error(`Google Play, ${step}: ${message}`);
  }
  return text ? JSON.parse(text) : {};
}

try {
  const edit = await call('opening an edit', `${API}/edits`, { method: 'POST' });
  const uploaded = await call('uploading the bundle', `${UPLOAD}/edits/${edit.id}/bundles?uploadType=media`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: fs.readFileSync(bundle),
  });
  await call(`releasing on the ${track} track`, `${API}/edits/${edit.id}/tracks/${track}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track, releases: [{ name: version, versionCodes: [String(uploaded.versionCode)], status: 'completed' }] }),
  });
  await call('committing', `${API}/edits/${edit.id}:commit`, { method: 'POST' });
  console.log(`✓ Google Play: version ${version} (code ${uploaded.versionCode}) released on the ${track} track; Google reviews it, then it goes live.`);
} catch (error) {
  console.error(`✗ ${error.message}`);
  console.error('  Fix: see docs/apps.md (Google Play). The very first release must be made by hand in the Play Console.');
  process.exit(1);
}
