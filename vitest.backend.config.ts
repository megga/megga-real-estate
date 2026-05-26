import { defineConfig } from 'vitest/config'
import path from 'path'

// Vitest config — backend integration tests.
// Hits a local Supabase instance (started via `supabase start`) — checks
// RLS policies, RPCs, triggers, and the actual SQL behavior. Distinct from
// vitest.config.ts which is for frontend unit tests (jsdom).
//
// Prerequisites:
//   1. Docker engine running (Colima or Docker Desktop)
//   2. `supabase start` from the project root → exposes local URL on
//      http://127.0.0.1:54321 with seeded migrations
//   3. Env vars in .env.test.local (or in shell):
//        SUPABASE_TEST_URL=http://127.0.0.1:54321
//        SUPABASE_TEST_ANON_KEY=<from `supabase status`>
//        SUPABASE_TEST_SERVICE_ROLE_KEY=<from `supabase status`>
//
// Run with: npm run test:backend

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/backend/**/*.{spec,test}.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**', 'tests/e2e-admin/**', 'tests/ai/**', 'tests/unit/**'],
    setupFiles: ['./vitest.backend.setup.ts'],
    globals: true,
    // Backend tests touch a real DB → serial execution to avoid race conditions
    // on shared rows (until we implement per-test isolation via transactions).
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
