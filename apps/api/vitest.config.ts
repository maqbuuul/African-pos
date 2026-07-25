import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./src/test/setup-env.ts'],
    // Real Postgres + Redis (docker compose) round-trips — slower than pure unit tests.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // These tests share one Postgres instance and mutate shared org/permission
    // rows via withTenantContext transactions — run files serially to avoid
    // cross-test interference from parallel workers.
    fileParallelism: false,
  },
})
