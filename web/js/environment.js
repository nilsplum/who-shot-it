/**
 * The environment this copy of the app was built for (`ENVIRONMENTS` in
 * web/shared/config.js), which decides the server the store apps talk to
 * (`phone.serverOrigin`).
 *
 * Mechanisms: it says production here, and so in everything that takes web/ as it is: the
 * website, `./scripts/dev.sh`, the tests and an app built any other way than by the release
 * script. `./scripts/release-apps.sh staging|production` alone writes the environment of the
 * build it makes into the native project's copy of this file (scripts/helpers/environments.sh),
 * checks it before building, and copies web/ back over it afterwards, so a later build made by
 * hand can only ever be production.
 *
 * Invariants: the line below is the one the release script rewrites, so it stays a single line
 * in exactly this form (test/unit/phone.test.js pins it). A page in a browser ignores it: the
 * website and local development talk to the server they came from.
 */
export const ENVIRONMENT = 'production';
