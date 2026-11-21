/**
 * The pure parts of the app's phone bridge (web/js/phone.js): where the server is, seen
 * from each place the page runs, and which invite links open a game.
 */
import { describe, expect, test } from 'vitest';
import { APP, SERVER } from '../../web/shared/config.js';
import { codeFromLink, serverOrigin } from '../../web/js/phone.js';

describe('the server origin', () => {
  test('inside the store apps it is the server; anywhere else the page\'s own origin', () => {
    for (const origin of SERVER.appOrigins) expect(serverOrigin(origin)).toBe(SERVER.origin);
    expect(serverOrigin('http://localhost:8799')).toBe('http://localhost:8799');
    expect(serverOrigin('http://192.168.1.20:8787')).toBe('http://192.168.1.20:8787');
    expect(serverOrigin(SERVER.origin)).toBe(SERVER.origin);
  });
});

describe('invite links', () => {
  test('the app link and the website link both give the code', () => {
    expect(codeFromLink(`${APP.scheme}://join/ABCD`)).toBe('ABCD');
    expect(codeFromLink(`${SERVER.origin}/ABCD`)).toBe('ABCD');
    expect(codeFromLink(`${SERVER.origin}/abcd/`)).toBe('ABCD');
  });

  test('anything else gives nothing', () => {
    expect(codeFromLink(`${APP.scheme}://join/AB0D`)).toBeNull();
    expect(codeFromLink(`${APP.scheme}://join/ABCDE`)).toBeNull();
    expect(codeFromLink(`${SERVER.origin}/legal`)).toBeNull();
    expect(codeFromLink('otherapp://join/ABCD')).toBeNull();
    expect(codeFromLink(null)).toBeNull();
  });
});
