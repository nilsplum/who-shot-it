/**
 * The pure parts of the app's phone bridge (web/js/phone.js): where the server is, seen
 * from each place the page runs and for each environment a build is made for, and which
 * invite links open a game.
 */
import { describe, expect, test } from 'vitest';
import { APP, ENVIRONMENTS, SERVER } from '../../web/shared/config.js';
import { ENVIRONMENT } from '../../web/js/environment.js';
import environmentJs from '../../web/js/environment.js?raw';
import { codeFromLink, serverOrigin } from '../../web/js/phone.js';

const SITE = ENVIRONMENTS.production.origin;

describe('the server origin', () => {
  test('inside the store apps it is the server of the build\'s environment; anywhere else the page\'s own origin', () => {
    for (const origin of SERVER.appOrigins) {
      expect(serverOrigin(origin)).toBe(SITE);
      expect(serverOrigin(origin, 'production')).toBe(SITE);
      expect(serverOrigin(origin, 'staging')).toBe(ENVIRONMENTS.staging.origin);
    }
    expect(serverOrigin('http://localhost:8799', 'staging')).toBe('http://localhost:8799');
    expect(serverOrigin('http://192.168.1.20:8787')).toBe('http://192.168.1.20:8787');
    for (const { origin } of Object.values(ENVIRONMENTS)) expect(serverOrigin(origin)).toBe(origin);
  });

  test('web/ says production: only the release script writes another environment, into the one build it makes', () => {
    expect(ENVIRONMENT).toBe('production');
    // The single line scripts/helpers/environments.sh rewrites in a native project's copy.
    expect(environmentJs.match(/^export const ENVIRONMENT = '[a-z]+';$/gm)).toEqual(["export const ENVIRONMENT = 'production';"]);
  });
});

describe('invite links', () => {
  test('the app link and the website link both give the code', () => {
    expect(codeFromLink(`${APP.scheme}://join/ABCD`)).toBe('ABCD');
    expect(codeFromLink(`${SITE}/ABCD`)).toBe('ABCD');
    expect(codeFromLink(`${SITE}/abcd/`)).toBe('ABCD');
  });

  test('anything else gives nothing', () => {
    expect(codeFromLink(`${APP.scheme}://join/AB0D`)).toBeNull();
    expect(codeFromLink(`${APP.scheme}://join/ABCDE`)).toBeNull();
    expect(codeFromLink(`${SITE}/legal`)).toBeNull();
    expect(codeFromLink('otherapp://join/ABCD')).toBeNull();
    expect(codeFromLink(null)).toBeNull();
  });
});
