/**
 * Talks to App Store Connect through its API, so a release needs no clicking. Run only by
 * `./scripts/release-apps.sh` (the one way to use it), which checks the environment and asks
 * for the typed confirmations first:
 *   status                     the newest builds with their environment, TestFlight, versions (release-apps.sh status)
 *   uploaded <environment>     exit 0 when this version's build for that environment is in App
 *                              Store Connect, 10 when not (release-apps.sh asks before it builds)
 *   testflight staging         puts the staging build into every TestFlight group (the team at once, the public link after Apple's beta check)
 *   submit                     fills the App Store page and sends the production build to App Review
 *   withdraw                   takes the version in App Review back, to send a newer build (release-apps.sh withdraw)
 * `--wait`: the build was just uploaded, so wait until Apple has processed it.
 *
 * Builds are found by their number, which carries the environment (`buildNumber` in
 * web/shared/config.js: 1.0.9 is 100090 for staging, 100091 for production), so `submit`
 * can only ever attach a production build to the App Store version.
 *
 * `submit` takes the iPhone listing from `listing.mjs` (LISTINGS.ios and IMAGES.ios, from
 * `store/android_ios_listing.js`, `store/ios_listing.js` and `store/images/ios_*`): every
 * text, the links, copyright, categories, review contact and notes, the screenshots and the
 * screen recording for App Review (git-ignored; skipped if missing); the version from
 * `package.json` and the age from LEGAL.minAge. It refuses while `problems` finds anything
 * (a text over its limit, a missing image), so what `./scripts/dev.sh store` shows is what
 * Apple gets. It attaches the uploaded build with that version and sets content rights,
 * age rating, price (free) and countries. Running it again updates the same version until
 * Apple reviews it; after a rejection it sends the same submission back, with the rejection
 * marked as answered. Once a version is live, the next run starts the new one (with "What's
 * New"); while one is with Apple, it refuses (`withdraw` takes a version Apple has not
 * approved yet back, so a newer build can take its place). Two settings have no API and
 * are made by hand once (store/ios_listing.js): App Privacy and the EU trader status; until
 * then Apple refuses the submission and this script prints Apple's reason.
 *
 * TestFlight carries only staging builds, so every build a tester installs plays on the
 * staging server; production builds go to App Review alone. Apple puts a build into an
 * internal group by itself only when that group gets every build automatically, production
 * builds included, so the groups are set up without that (docs/apps.md, First release) and
 * `testflight` refuses while one is not: it puts each staging build into every group itself,
 * where the team has it at once and the public link (the external groups) after Apple's beta
 * check (usually within a day).
 *
 * Signs in with the team API key in `secrets/` (`app-store-connect.p8` and
 * `app-store-connect.json` with keyId and issuerId; git-ignored). The key and the token
 * are never printed.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ENVIRONMENTS, LEGAL, buildNumber } from '../../web/shared/config.js';
import { IMAGES, LISTINGS, problems } from './listing.mjs';

const ROOT = path.join(import.meta.dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const BUNDLE_ID = JSON.parse(read('capacitor.config.json')).appId;
const VERSION = JSON.parse(read('package.json')).version;
const [command, named] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
/** The environment of the build this run is about: App Review only ever gets production's. */
const ENVIRONMENT = command === 'submit' ? 'production' : named;
const BUILD = ENVIRONMENTS[ENVIRONMENT] ? String(buildNumber(VERSION, ENVIRONMENT)) : null;
const WAIT = process.argv.includes('--wait');

/** The environment a build number was made for; builds before environments had a digit (10007 and lower) were all production. */
function environmentOf(number) {
  const n = Number(number);
  if (n < 100000) return 'production, before staging';
  return Object.keys(ENVIRONMENTS).find((name) => ENVIRONMENTS[name].build === n % 10) || 'unknown';
}
/** Everything the iPhone store gets (store/android_ios_listing.js and store/ios_listing.js). */
const listing = LISTINGS.ios;
const contact = listing.reviewContact;
/** The screen recording App Review asks new apps for (git-ignored: it shows a real phone). */
const REVIEW_VIDEO = path.join(ROOT, listing.reviewVideo);

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
    console.log(`  build ${version.attributes.version} (${b.attributes.version}, ${environmentOf(b.attributes.version)}): ${b.attributes.processingState}, TestFlight internal ${detail.attributes.internalBuildState}, external ${detail.attributes.externalBuildState}${review ? `, beta check ${review.attributes.betaReviewState}` : ''}`);
  }
  for (const g of (await get(`/v1/apps/${app.id}/betaGroups`)).data) {
    const a = g.attributes;
    const every = a.isInternalGroup && a.hasAccessToAllBuilds ? ', gets every build by itself: production builds too (docs/apps.md, First release)' : '';
    console.log(`  TestFlight group ${a.name} (${a.isInternalGroup ? 'internal' : 'external'}${every})${a.publicLinkEnabled ? `: public link ${a.publicLink}` : ''}`);
  }
  for (const v of (await get(`/v1/apps/${app.id}/appStoreVersions`)).data) console.log(`  App Store version ${v.attributes.versionString}: ${v.attributes.appStoreState}`);
}

// ---------- submit ----------

/**
 * Age rating answers (Apple's questionnaire): user content and contests yes, nothing else;
 * raised to the terms' minimum age (LEGAL.minAge), which Apple offers as 13+, 16+ or 18+.
 */
const AGE_RATING = {
  advertising: false, ageAssurance: false, datingAndRelationships: false, gambling: false, healthOrWellnessTopics: false,
  lootBox: false, messagingAndChat: false, parentalControls: false, sharedLocation: false, socialMedia: false,
  socialMediaAgeRestricted: false, unrestrictedWebAccess: false, userGeneratedContent: true,
  contests: 'FREQUENT_OR_INTENSE',
  alcoholTobaccoOrDrugUseOrReferences: 'NONE', gamblingSimulated: 'NONE', gunsOrOtherWeapons: 'NONE', horrorOrFearThemes: 'NONE',
  matureOrSuggestiveThemes: 'NONE', medicalOrTreatmentInformation: 'NONE', profanityOrCrudeHumor: 'NONE',
  sexualContentGraphicAndNudity: 'NONE', sexualContentOrNudity: 'NONE', violenceCartoonOrFantasy: 'NONE',
  violenceRealistic: 'NONE', violenceRealisticProlongedGraphicOrSadistic: 'NONE',
  ageRatingOverrideV2: { 13: 'THIRTEEN_PLUS', 16: 'SIXTEEN_PLUS', 18: 'EIGHTEEN_PLUS' }[LEGAL.minAge],
};

/**
 * The uploaded build of this version for this run's environment (BUILD) once Apple has
 * processed it, which takes about 15 minutes. Right after an upload (`--wait`) it waits for
 * it (at most 40 minutes, asking once a minute); otherwise it stops with the reason.
 */
async function findBuild(app) {
  let builds = [];
  for (let minute = 0; minute <= (WAIT ? 40 : 0); minute++) {
    builds = (await get(`/v1/builds?filter[app]=${app.id}&filter[version]=${BUILD}&filter[processingState]=VALID`)).data;
    if (builds.length || !WAIT) break;
    if (minute === 0) console.log(`… waiting for Apple to process build ${BUILD}`);
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }
  if (!builds.length) throw new Error(`Build ${VERSION} (${BUILD}, ${ENVIRONMENT}) is not uploaded or not processed yet: ./scripts/release-apps.sh ${ENVIRONMENT} ios, then wait about 15 minutes.`);
  return builds[0];
}

/** Whether this version's build for this run's environment was uploaded already (processed or not): exit 0 if so, 10 if not. */
async function uploaded() {
  const app = await findApp();
  const found = (await get(`/v1/builds?filter[app]=${app.id}&filter[version]=${BUILD}`)).data[0];
  console.log(found ? `Build ${VERSION} (${BUILD}, ${ENVIRONMENT}) is in App Store Connect (${found.attributes.processingState}).` : `Build ${VERSION} (${BUILD}, ${ENVIRONMENT}) is not uploaded yet.`);
  process.exit(found ? 0 : 10);
}

async function appInfo(app) {
  const infos = (await get(`/v1/apps/${app.id}/appInfos`)).data;
  return infos.find((i) => i.attributes.state !== 'READY_FOR_DISTRIBUTION') || infos[0];
}

async function setAppDetails(app, info) {
  await patch('apps', app.id, { contentRightsDeclaration: 'USES_THIRD_PARTY_CONTENT' });
  const loc = (await get(`/v1/appInfos/${info.id}/appInfoLocalizations`)).data.find((l) => l.attributes.locale === listing.locale);
  await patch('appInfoLocalizations', loc.id, { name: listing.name, subtitle: listing.subtitle, privacyPolicyUrl: listing.privacyPolicyUrl });
  const { primary, subcategories: [one, two], secondary } = listing.categories;
  await patch('appInfos', info.id, null, {
    primaryCategory: ref('appCategories', primary),
    primarySubcategoryOne: ref('appCategories', one),
    primarySubcategoryTwo: ref('appCategories', two),
    secondaryCategory: ref('appCategories', secondary),
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
    if (busy) throw new Error(`Version ${busy.attributes.versionString} is still with Apple (${busy.attributes.appStoreState}); a new one can follow once it is live, or take it back first: ./scripts/release-apps.sh withdraw`);
    // App Store Connect copies the texts and screenshots of the live version into the new one.
    version = (await api('POST', '/v1/appStoreVersions', { data: { type: 'appStoreVersions', attributes: { platform: 'IOS', versionString: VERSION }, relationships: { app: ref('apps', app.id) } } })).data;
  }
  // "What's New" exists only for updates: Apple refuses it on an app's first version.
  const update = versions.some((v) => v.id !== version.id && v.attributes.appStoreState === 'READY_FOR_SALE');
  const build = await findBuild(app);
  await patch('appStoreVersions', version.id, { versionString: VERSION, copyright: listing.copyright, releaseType: 'AFTER_APPROVAL' }, { build: ref('builds', build.id) });
  const loc = (await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data.find((l) => l.attributes.locale === listing.locale);
  await patch('appStoreVersionLocalizations', loc.id, {
    description: listing.description, keywords: listing.keywords, promotionalText: listing.promotionalText,
    marketingUrl: listing.website, supportUrl: listing.supportUrl,
    ...(update ? { whatsNew: listing.whatsNew } : {}),
  });
  console.log(`✓ version ${VERSION} with build ${BUILD}, description, keywords, promotional text, URLs, copyright${update ? ', what’s new' : ''}`);
  return { version, loc };
}

async function setReviewDetails(version) {
  // The notes answer Apple's questions first, then give the test steps TestFlight's beta review gets too.
  const attributes = {
    contactFirstName: contact.firstName, contactLastName: contact.lastName, contactPhone: contact.phone, contactEmail: contact.email,
    demoAccountRequired: false, notes: listing.reviewNotes,
  };
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
    console.log(`… no ${listing.reviewVideo}, so no screen recording attached (docs/apps.md, First release)`);
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
  const { files } = IMAGES.ios.screenshots;
  const type = 'APP_IPHONE_67';
  let set = (await get(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets`)).data.find((s) => s.attributes.screenshotDisplayType === type);
  if (!set) set = (await api('POST', '/v1/appScreenshotSets', { data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: type }, relationships: { appStoreVersionLocalization: ref('appStoreVersionLocalizations', loc.id) } } })).data;
  for (const old of (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data) await api('DELETE', `/v1/appScreenshots/${old.id}`);
  for (const file of files) {
    await upload('appScreenshots', { fileName: path.basename(file) }, { appScreenshotSet: ref('appScreenshotSets', set.id) }, fs.readFileSync(path.join(ROOT, file)));
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
 * This version's staging build for TestFlight. First the test information Apple's beta check
 * reads: what the app is, where feedback goes, the privacy policy, the same contact as the
 * App Review, and its test steps as notes (a reviewer needs to know that a game takes two
 * phones). Then the build's "What to Test", which testers see too (`whatsNew`), the build in
 * every group, and the build sent to the beta check: the team has it at once, the public
 * link once Apple approves it (usually within a day). Running it again only updates the
 * texts: a build already in a group or sent to the check stays as it is. It refuses a
 * production build, and a group that would get every build by itself.
 */
async function sendToTestFlight(app) {
  if (ENVIRONMENT !== 'staging') throw new Error('TestFlight carries only staging builds; a production build goes to App Review: ./scripts/release-apps.sh production ios --submit');
  const groups = (await get(`/v1/apps/${app.id}/betaGroups`)).data;
  const every = groups.find((g) => g.attributes.isInternalGroup && g.attributes.hasAccessToAllBuilds);
  if (every) throw new Error(`The TestFlight group ${every.attributes.name} gets every build by itself, production builds too: set it up again without that (docs/apps.md, First release).`);
  if (!groups.some((g) => !g.attributes.isInternalGroup)) throw new Error('No external TestFlight group: create one with a public link in App Store Connect (the app, TestFlight, External Testing, +).');
  const detail = (await get(`/v1/apps/${app.id}/betaAppReviewDetail`)).data;
  await patch('betaAppReviewDetails', detail.id, {
    contactFirstName: contact.firstName, contactLastName: contact.lastName, contactPhone: contact.phone, contactEmail: contact.email,
    demoAccountRequired: false, notes: listing.howToTest,
  });
  const description = `${listing.subtitle}: ${listing.promotionalText}`;
  const attributes = { description, feedbackEmail: contact.email, privacyPolicyUrl: listing.privacyPolicyUrl, marketingUrl: listing.website };
  const loc = (await get(`/v1/apps/${app.id}/betaAppLocalizations`)).data.find((l) => l.attributes.locale === listing.locale);
  if (loc) await patch('betaAppLocalizations', loc.id, attributes);
  else await api('POST', '/v1/betaAppLocalizations', { data: { type: 'betaAppLocalizations', attributes: { locale: listing.locale, ...attributes }, relationships: { app: ref('apps', app.id) } } });
  console.log('✓ TestFlight test information (description, feedback email, privacy policy, review contact and notes)');

  const build = await findBuild(app);
  const toTest = (await get(`/v1/builds/${build.id}/betaBuildLocalizations`)).data.find((l) => l.attributes.locale === listing.locale);
  if (toTest) await patch('betaBuildLocalizations', toTest.id, { whatsNew: listing.whatsNew });
  else await api('POST', '/v1/betaBuildLocalizations', { data: { type: 'betaBuildLocalizations', attributes: { locale: listing.locale, whatsNew: listing.whatsNew }, relationships: { build: ref('builds', build.id) } } });
  for (const group of groups) await api('POST', `/v1/betaGroups/${group.id}/relationships/builds`, { data: [{ type: 'builds', id: build.id }] });
  const check = (await get(`/v1/betaAppReviewSubmissions?filter[build]=${build.id}`)).data[0];
  if (!check) await api('POST', '/v1/betaAppReviewSubmissions', { data: { type: 'betaAppReviewSubmissions', relationships: { build: ref('builds', build.id) } } });
  const names = groups.map((g) => g.attributes.name).join(', ');
  console.log(`✓ TestFlight: build ${VERSION} (${BUILD}) with “What to Test” in ${names}, ${check ? `beta check ${check.attributes.betaReviewState}` : 'sent to Apple’s beta check; the public link has it once approved (usually within a day)'}`);
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

// ---------- withdraw ----------

/**
 * App Store Connect's "Remove from Review": the version waiting for or in App Review comes
 * back (as "Developer Rejected"), so nothing goes live by itself, and the next `submit`
 * attaches the current build to the same version, updates its page and sends it again.
 * For a newer build that should take the place of one Apple has not approved yet; the
 * review starts over then. Apple needs a moment to finish taking it back: a `submit` right
 * after it may still find the version "with Apple" and simply needs running again.
 */
async function withdraw() {
  const app = await findApp();
  const open = (await get(`/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=WAITING_FOR_REVIEW,IN_REVIEW`)).data[0];
  if (!open) throw new Error('No version is waiting for or in App Review.');
  await patch('reviewSubmissions', open.id, { canceled: true });
  console.log('✓ Taken back from App Review; ./scripts/release-apps.sh production ios --submit sends the current version in its place.');
}

async function submit() {
  // A listing a store would refuse stops here, before anything at Apple changes.
  const found = problems((file) => fs.existsSync(path.join(ROOT, file)));
  if (found.length) throw new Error(`The listing is not ready (./scripts/dev.sh store shows it):\n  ${found.join('\n  ')}`);
  if (!AGE_RATING.ageRatingOverrideV2) throw new Error(`Apple has no ${LEGAL.minAge}+ rating (13, 16 or 18): LEGAL.minAge in web/shared/config.js`);
  const app = await findApp();
  await setAppDetails(app, await appInfo(app));
  const { version, loc } = await setVersion(app);
  await setReviewDetails(version);
  await setScreenshots(loc);
  await setPriceAndCountries(app);
  await sendToReview(app, version);
}

try {
  if (['uploaded', 'testflight'].includes(command) && !BUILD) throw new Error(`${command} needs the environment: ${Object.keys(ENVIRONMENTS).join(' or ')}`);
  if (command === 'status') await status();
  else if (command === 'uploaded') await uploaded();
  else if (command === 'submit') await submit();
  else if (command === 'testflight') await sendToTestFlight(await findApp());
  else if (command === 'withdraw') await withdraw();
  else throw new Error('Use ./scripts/release-apps.sh (it runs this with status, uploaded, testflight, submit or withdraw).');
} catch (error) {
  console.error(`✗ ${error.message}`);
  process.exit(1);
}
