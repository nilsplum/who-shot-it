/**
 * Talks to App Store Connect through its API, so a release needs no clicking:
 *   node scripts/helpers/app-store.mjs status   builds, TestFlight beta check, public link, versions
 *   node scripts/helpers/app-store.mjs submit   fills the App Store page and sends it to App Review
 *   node scripts/helpers/app-store.mjs testflight   fills TestFlight's test information (also part of submit)
 * `./scripts/release-apps.sh ios --submit` runs `submit --wait` right after the upload.
 *
 * `submit` takes every text (name, subtitle, description, keywords, URLs, copyright, review
 * contact and notes) from `store/listing.md`, the screenshots from `store/images/app-store/`,
 * the screen recording for App Review from `store/review-video.mp4` (git-ignored; skipped if
 * missing), and the version from `package.json`; it attaches the uploaded build with that version and
 * sets categories, content rights, age rating, price (free) and countries. Running it again
 * updates the same version until Apple reviews it; after a rejection it sends the same
 * submission back, with the rejection marked as answered. Once a version is live, the next
 * run starts the new one (with "What's New"); while one is with Apple, it refuses. Two settings have no API and are made by
 * hand once (store/listing.md): App Privacy and the EU trader status; until then Apple
 * refuses the submission and this script prints Apple's reason.
 *
 * Signs in with the team API key in `secrets/` (`app-store-connect.p8` and
 * `app-store-connect.json` with keyId and issuerId; git-ignored). The key and the token
 * are never printed.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const BUNDLE_ID = JSON.parse(read('capacitor.config.json')).appId;
const VERSION = JSON.parse(read('package.json')).version;
const BUILD = String(VERSION.split('.').map(Number).reduce((n, part, i) => n + part * [10000, 100, 1][i], 0));
/** `--wait`: the build was just uploaded, so wait until Apple has processed it. */
const WAIT = process.argv.includes('--wait');
/** The screen recording App Review asks new apps for (git-ignored: it shows a real phone). */
const REVIEW_VIDEO = path.join(ROOT, 'store/review-video.mp4');

// ---------- The API ----------

function token() {
  const { keyId, issuerId } = JSON.parse(read('secrets/app-store-connect.json'));
  const part = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${part({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${part({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })}`;
  const signature = crypto.sign('sha256', Buffer.from(unsigned), { key: read('secrets/app-store-connect.p8'), dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${signature.toString('base64url')}`;
}
const TOKEN = token();

async function api(method, url, body) {
  const res = await fetch(url.startsWith('http') ? url : `https://api.appstoreconnect.apple.com${url}`, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    // Apple lists what blocks a submission under each error's meta.associatedErrors.
    const describe = (e) => [e.title, e.detail].filter(Boolean).join(': ');
    const reasons = (json.errors || []).flatMap((e) => [describe(e), ...Object.values(e.meta?.associatedErrors || {}).flat().map((a) => `  ${describe(a)}`)]).join('\n  ');
    throw new Error(`${method} ${url.split('?')[0]} (${res.status})\n  ${reasons}`);
  }
  return json;
}
const get = (url) => api('GET', url);
const patch = (type, id, attributes, relationships) => api('PATCH', `/v1/${type}/${id}`, { data: { type, id, ...(attributes ? { attributes } : {}), ...(relationships ? { relationships } : {}) } });
const ref = (type, id) => ({ data: { type, id } });

// ---------- The texts (store/listing.md) ----------

const listing = read('store/listing.md');

/**
 * The indented block under a bold label in store/listing.md, without the indentation: the
 * label's own lines are skipped, then indented lines (and blank lines between them) are
 * collected until the text goes on unindented.
 */
function field(label) {
  const start = listing.indexOf(`**${label}**`);
  if (start < 0) throw new Error(`store/listing.md has no "${label}"`);
  const block = [];
  for (const line of listing.slice(start).split('\n')) {
    if (line.startsWith('    ')) block.push(line.slice(4));
    else if (block.length && line.trim() === '') block.push('');
    else if (block.length) break;
  }
  return block.join('\n').trim();
}
const url = (label) => listing.match(new RegExp(`${label}: \`([^\`]+)\``))[1];
const copyright = listing.match(/\*\*Copyright:\*\* `([^`]+)`/)[1];

// ---------- status ----------

async function findApp() {
  const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE_ID}`)).data[0];
  if (!app) throw new Error(`No app with bundle ID ${BUNDLE_ID} in App Store Connect (docs/apps.md, First release).`);
  return app;
}

async function status() {
  const app = await findApp();
  console.log(`${app.attributes.name} (${app.attributes.bundleId})`);
  const builds = await get(`/v1/builds?filter[app]=${app.id}&include=buildBetaDetail,preReleaseVersion&sort=-uploadedDate&limit=5`);
  for (const b of builds.data) {
    const detail = builds.included.find((x) => x.type === 'buildBetaDetails' && x.id === b.relationships.buildBetaDetail.data.id);
    const version = builds.included.find((x) => x.type === 'preReleaseVersions' && x.id === b.relationships.preReleaseVersion.data.id);
    const review = (await get(`/v1/betaAppReviewSubmissions?filter[build]=${b.id}`)).data[0];
    console.log(`  build ${version.attributes.version} (${b.attributes.version}): ${b.attributes.processingState}, TestFlight internal ${detail.attributes.internalBuildState}, external ${detail.attributes.externalBuildState}${review ? `, beta check ${review.attributes.betaReviewState}` : ''}`);
  }
  for (const g of (await get(`/v1/apps/${app.id}/betaGroups`)).data) {
    const a = g.attributes;
    console.log(`  TestFlight group ${a.name} (${a.isInternalGroup ? 'internal' : 'external'})${a.publicLinkEnabled ? `: public link ${a.publicLink}` : ''}`);
  }
  for (const v of (await get(`/v1/apps/${app.id}/appStoreVersions`)).data) console.log(`  App Store version ${v.attributes.versionString}: ${v.attributes.appStoreState}`);
}

// ---------- submit ----------

/** Age rating answers (Apple's questionnaire): user content and contests yes, nothing else; 16+ like the terms. */
const AGE_RATING = {
  advertising: false, ageAssurance: false, datingAndRelationships: false, gambling: false, healthOrWellnessTopics: false,
  lootBox: false, messagingAndChat: false, parentalControls: false, sharedLocation: false, socialMedia: false,
  socialMediaAgeRestricted: false, unrestrictedWebAccess: false, userGeneratedContent: true,
  contests: 'FREQUENT_OR_INTENSE',
  alcoholTobaccoOrDrugUseOrReferences: 'NONE', gamblingSimulated: 'NONE', gunsOrOtherWeapons: 'NONE', horrorOrFearThemes: 'NONE',
  matureOrSuggestiveThemes: 'NONE', medicalOrTreatmentInformation: 'NONE', profanityOrCrudeHumor: 'NONE',
  sexualContentGraphicAndNudity: 'NONE', sexualContentOrNudity: 'NONE', violenceCartoonOrFantasy: 'NONE',
  violenceRealistic: 'NONE', violenceRealisticProlongedGraphicOrSadistic: 'NONE',
  ageRatingOverrideV2: 'SIXTEEN_PLUS',
};

async function appInfo(app) {
  const infos = (await get(`/v1/apps/${app.id}/appInfos`)).data;
  return infos.find((i) => i.attributes.state !== 'READY_FOR_DISTRIBUTION') || infos[0];
}

async function setAppDetails(app, info) {
  await patch('apps', app.id, { contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT' });
  const loc = (await get(`/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find((l) => l.attributes.locale === 'en-US');
  await patch('appInfoLocalizations', loc.id, { name: field('Name'), subtitle: field('Subtitle'), privacyPolicyUrl: url('Privacy Policy URL') });
  await patch('appInfos', info.id, null, {
    primaryCategory: ref('appCategories', 'GAMES'),
    primarySubcategoryOne: ref('appCategories', 'GAMES_TRIVIA'),
    primarySubcategoryTwo: ref('appCategories', 'GAMES_CASUAL'),
    secondaryCategory: ref('appCategories', 'ENTERTAINMENT'),
  });
  const age = (await get(`/v1/appInfos/${info.id}/ageRatingDeclaration`)).data;
  await patch('ageRatingDeclarations', age.id, AGE_RATING);
  console.log('✓ name, subtitle, privacy policy, categories, content rights, age rating');
}

async function setVersion(app) {
  const versions = (await get(`/v1/apps/${app.id}/appStoreVersions`)).data;
  let version = versions.find((v) => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(v.attributes.appStoreState));
  if (!version) {
    // Apple keeps one version on its way at a time: the next one starts once the last is live.
    const busy = versions.find((v) => !['READY_FOR_SALE', 'REMOVED_FROM_SALE', 'DEVELOPER_REMOVED_FROM_SALE', 'REPLACED_WITH_NEW_VERSION'].includes(v.attributes.appStoreState));
    if (busy) throw new Error(`Version ${busy.attributes.versionString} is still with Apple (${busy.attributes.appStoreState}); a new one can follow once it is live.`);
    // App Store Connect copies the texts and screenshots of the live version into the new one.
    version = (await api('POST', '/v1/appStoreVersions', { data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: VERSION }, relationships: { app: ref('apps', app.id) } } })).data;
  }
  // "What's New" exists only for updates: Apple refuses it on an app's first version.
  const update = versions.some((v) => v.id !== version.id && v.attributes.appStoreState === 'READY_FOR_SALE');
  // Apple processes an upload for about 15 minutes; right after an upload, wait for it (at
  // most 40 minutes, asking once a minute), otherwise stop with the reason.
  let builds = [];
  for (let minute = 0; minute <= (WAIT ? 40 : 0); minute++) {
    builds = (await get(`/v1/builds?filter[app]=${app.id}&filter[version]=${BUILD}&filter[processingState]=VALID`)).data;
    if (builds.length || !WAIT) break;
    if (minute === 0) console.log(`… waiting for Apple to process build ${BUILD}`);
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }
  if (!builds.length) throw new Error(`Build ${VERSION} (${BUILD}) is not uploaded or not processed yet: ./scripts/release-apps.sh ios, then wait about 15 minutes.`);
  await patch('appStoreVersions', version.id, { versionString: VERSION, copyright, releaseType: 'AFTER_APPROVAL' }, { build: ref('builds', builds[0].id) });
  const loc = (await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === 'en-US');
  await patch('appStoreVersionLocalizations', loc.id, {
    description: field('Description:'), keywords: field('Keywords'), promotionalText: field('Promotional text'),
    marketingUrl: url('Marketing URL'), supportUrl: url('Support URL'),
    ...(update ? { whatsNew: field('What’s New') } : {}),
  });
  console.log(`✓ version ${VERSION} with build ${BUILD}, description, keywords, promotional text, URLs, copyright${update ? ', what’s new' : ''}`);
  return { version, loc };
}

async function setReviewDetails(version) {
  const [name, phone, email] = field('App Review contact').split(', ');
  const [first, ...last] = name.split(' ');
  // Apple's questions answered first, then the same test steps TestFlight's beta review gets.
  const notes = `${field('App Review notes')}\n\n${field('How to test')}`;
  const attributes = { contactFirstName: first, contactLastName: last.join(' '), contactPhone: phone, contactEmail: email, demoAccountRequired: false, notes };
  const existing = (await get(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
  const detail = existing
    ? (await patch('appStoreReviewDetails', existing.id, attributes)).data
    : (await api('POST', '/v1/appStoreReviewDetails', { data: { type: 'appStoreReviewDetails', attributes, relationships: { appStoreVersion: ref('appStoreVersions', version.id) } } })).data;
  console.log('✓ App Review contact and notes');
  await setReviewVideo(detail);
}

/** Apple's file upload: create the file, send its parts where Apple says, then confirm it. */
async function upload(type, attributes, relationships, bytes) {
  const file = (await api('POST', `/v1/${type}`, { data: { type, attributes: { ...attributes, fileSize: bytes.length }, relationships } })).data;
  for (const op of file.attributes.uploadOperations) {
    const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`Uploading ${attributes.fileName} failed (${res.status})`);
  }
  await patch(type, file.id, { uploaded: true, sourceFileChecksum: crypto.createHash('md5').update(bytes).digest('hex') });
}

/**
 * The screen recording as the review's only attachment. Each version has its own review
 * details, so a new version gets it again; a run that finds the same file already attached
 * (same checksum) leaves it.
 */
async function setReviewVideo(detail) {
  if (!fs.existsSync(REVIEW_VIDEO)) {
    console.log('… no store/review-video.mp4, so no screen recording attached (docs/apps.md, First release)');
    return;
  }
  const bytes = fs.readFileSync(REVIEW_VIDEO);
  const checksum = crypto.createHash('md5').update(bytes).digest('hex');
  const attached = (await get(`/v1/appStoreReviewDetails/${detail.id}/appStoreReviewAttachments`)).data;
  if (attached.length === 1 && attached[0].attributes.sourceFileChecksum === checksum) {
    console.log('✓ screen recording for App Review (already attached)');
    return;
  }
  for (const old of attached) await api('DELETE', `/v1/appStoreReviewAttachments/${old.id}`);
  await upload('appStoreReviewAttachments', { fileName: path.basename(REVIEW_VIDEO) }, { appStoreReviewDetail: ref('appStoreReviewDetails', detail.id) }, bytes);
  console.log(`✓ screen recording for App Review (${Math.round(bytes.length / 1e6)} MB)`);
}

async function setScreenshots(loc) {
  const dir = path.join(ROOT, 'store/images/app-store');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  const type = 'APP_IPHONE_67';
  let set = (await get(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`)).data.find((s) => s.attributes.screenshotDisplayType === type);
  if (!set) set = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: type }, relationships: { appStoreVersionLocalization: ref('appStoreVersionLocalizations', loc.id) } } })).data;
  for (const old of (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data) await api('DELETE', `/v1/appScreenshots/${old.id}`);
  for (const file of files) {
    await upload('appScreenshots', { fileName: file }, { appScreenshotSet: ref('appScreenshotSets', set.id) }, fs.readFileSync(path.join(dir, file)));
  }
  console.log(`✓ ${files.length} screenshots (iPhone 6.9 inch)`);
}

async function setPriceAndCountries(app) {
  const schedule = await get(`/v1/apps/${app.id}/appPriceSchedule?include=manualPrices`).catch(() => null);
  if (!schedule || !(schedule.included || []).length) {
    const free = (await get(`/v1/apps/${app.id}/appPricePoints?filter[territory]=USA&limit=200`)).data.find((p) => Number(p.attributes.customerPrice) === 0);
    await api('POST', '/v1/appPriceSchedules', {
      data: { type: 'appPriceSchedules', relationships: { app: ref('apps', app.id), baseTerritory: ref('territories', 'USA'), manualPrices: { data: [{ type: 'appPrices', id: '${free}' }] } } },
      included: [{ type: 'appPrices', id: '${free}', attributes: { startDate: null }, relationships: { appPricePoint: ref('appPricePoints', free.id) } }],
    });
  }
  const hasAvailability = await get(`/v1/apps/${app.id}/appAvailabilityV2`).then(() => true, () => false);
  if (!hasAvailability) {
    // Every country but China mainland, where games need a government licence. Apple wants
    // every territory listed, China as not available.
    const territories = (await get('/v1/territories?limit=200')).data.map((t) => t.id);
    await api('POST', '/v2/appAvailabilities', {
      data: { type: 'appAvailabilities', attributes: { availableInNewTerritories: true }, relationships: { app: ref('apps', app.id), territoryAvailabilities: { data: territories.map((id) => ({ type: 'territoryAvailabilities', id: `\${${id}}` })) } } },
      included: territories.map((id) => ({ type: 'territoryAvailabilities', id: `\${${id}}`, attributes: { available: id !== 'CHN' }, relationships: { territory: ref('territories', id) } })),
    });
  }
  console.log('✓ free, every country except China mainland');
}

/**
 * TestFlight's test information, which Apple's beta check reads: what the app is, where
 * feedback goes, the privacy policy, the same contact as the App Review, and its test steps
 * as notes (a reviewer needs to know that a game takes two phones).
 */
async function setTestFlightInfo(app) {
  const [name, phone, email] = field('App Review contact').split(', ');
  const [first, ...last] = name.split(' ');
  const detail = (await get(`/v1/apps/${app.id}/betaAppReviewDetail`)).data;
  await patch('betaAppReviewDetails', detail.id, { contactFirstName: first, contactLastName: last.join(' '), contactPhone: phone, contactEmail: email, demoAccountRequired: false, notes: field('How to test') });
  const description = `${field('Subtitle')}: ${field('Promotional text')}`;
  const attributes = { description, feedbackEmail: email, privacyPolicyUrl: url('Privacy Policy URL'), marketingUrl: url('Marketing URL') };
  const loc = (await get(`/v1/apps/${app.id}/betaAppLocalizations`)).data.find((l) => l.attributes.locale === 'en-US');
  if (loc) await patch('betaAppLocalizations', loc.id, attributes);
  else await api('POST', '/v1/betaAppLocalizations', { data: { type: 'betaAppLocalizations', attributes: { locale: 'en-US', ...attributes }, relationships: { app: ref('apps', app.id) } } });
  console.log('✓ TestFlight test information (description, feedback email, privacy policy, review contact and notes)');
}

async function sendToReview(app, version) {
  // An open submission is either not sent yet, or one Apple sent back (a rejection or a
  // question): that one goes back to Apple with its rejected items marked as answered.
  const open = (await get(`/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES`)).data[0];
  const submission = open || (await api('POST', '/v1/reviewSubmissions', { data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: ref('apps', app.id) } } })).data;
  const items = (await get(`/v1/reviewSubmissions/${submission.id}/items`)).data;
  if (!items.length) await api('POST', '/v1/reviewSubmissionItems', { data: { type: 'reviewSubmissionItems', relationships: { reviewSubmission: ref('reviewSubmissions', submission.id), appStoreVersion: ref('appStoreVersions', version.id) } } });
  for (const item of items.filter((i) => i.attributes.state === 'REJECTED')) await patch('reviewSubmissionItems', item.id, { resolved: true });
  await patch('reviewSubmissions', submission.id, { submitted: true });
  console.log(`✓ Version ${VERSION} sent to App Review. It goes live by itself after approval (usually within a day).`);
}

async function submit() {
  const app = await findApp();
  await setTestFlightInfo(app);
  await setAppDetails(app, await appInfo(app));
  const { version, loc } = await setVersion(app);
  await setReviewDetails(version);
  await setScreenshots(loc);
  await setPriceAndCountries(app);
  await sendToReview(app, version);
}

const command = process.argv[2];
try {
  if (command === 'status') await status();
  else if (command === 'submit') await submit();
  else if (command === 'testflight') await setTestFlightInfo(await findApp());
  else throw new Error('Use: node scripts/helpers/app-store.mjs status|submit|testflight');
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}
