/**
 * Vitest runs the unit tests (pure game logic and pure browser helpers) and the
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
  },
});
