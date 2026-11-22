/**
 * Vitest runs the unit tests (pure game logic, the shared config and pure app helpers) and the
 * integration tests (Worker + Durable Object over HTTP and WebSocket) inside the real
 * Workers runtime (workerd), configured from wrangler.jsonc by the Cloudflare plugin.
 * Run them through ./scripts/test.sh, never ad hoc.
 */
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' } })],
  test: {
    include: ['test/unit/**/*.test.js', 'test/integration/**/*.test.js'],
    // CSS files reach the tests as their text (test/unit/config.test.js reads the theme
    // and checks the dash rule); without this Vitest hands every CSS file over empty.
    css: { include: [/\.css\b/] },
  },
});
