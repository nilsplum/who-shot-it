/**
 * Vitest runs the unit tests (pure game logic, the shared config and pure app helpers) and the
 * integration tests (Worker + Durable Object over HTTP and WebSocket) inside the real
 * Workers runtime (workerd), configured from wrangler.jsonc by the Cloudflare plugin.
 * Run them through ./scripts/test.sh, never ad hoc.
 *
 * The Worker gets a version gate here (`GATE`, which `./scripts/deploy.sh` gives a deployed
 * one), so the integration tests see its refusals: 1.0.8 and newer may play (the tests' own
 * players say no version and count as `SILENT_VERSION`), and a newer iPhone version is out.
 */
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [cloudflareTest({
    wrangler: { configPath: './wrangler.jsonc' },
    miniflare: { bindings: { GATE: JSON.stringify({ min: '1.0.8', newest: { ios: '1.0.12', android: null } }) } },
  })],
  test: {
    include: ['test/unit/**/*.test.js', 'test/integration/**/*.test.js'],
    // CSS files reach the tests as their text (test/unit/config.test.js reads the theme
    // and checks the dash rule); without this Vitest hands every CSS file over empty.
    css: { include: [/\.css\b/] },
  },
});
