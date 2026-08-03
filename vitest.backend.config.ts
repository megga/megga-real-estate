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
//      ⚠ Plusieurs instances Supabase locales peuvent coexister (autre projet,
//      autre worktree). Les specs qui écrivent en SQL direct passent par
//      tests/backend/helpers/local-sql.ts, qui vise le conteneur du `project_id`
//      de supabase/config.toml et refuse de deviner : si SUPABASE_TEST_URL et le
//      conteneur désignent deux instances différentes, il lève au lieu de semer
//      dans la mauvaise base. Forcer au besoin avec SUPABASE_TEST_DB_CONTAINER.
//   3. Env vars in .env.test.local (or in shell):
//        SUPABASE_TEST_URL=http://127.0.0.1:54321
//        SUPABASE_TEST_ANON_KEY=<from `supabase status`>
//        SUPABASE_TEST_SERVICE_ROLE_KEY=<from `supabase status`>
//      Optionnel : SUPABASE_TEST_SERVICE_ROLE_JWT=<SERVICE_ROLE_KEY, le JWT legacy>
//      Obligatoire uniquement si SUPABASE_TEST_SERVICE_ROLE_KEY porte le NOUVEAU
//      format (sb_secret_...) : les edge functions gardees par une comparaison
//      litterale au SUPABASE_SERVICE_ROLE_KEY du runtime n'acceptent que le JWT
//      legacy. C'est le cas en CI (.github/workflows/backend.yml) ; en local,
//      .env.test.local porte deja le JWT legacy et le repli suffit.
//      EXCEPTION depuis le 01.08.2026 : agency-verification-run accepte les DEUX
//      formats (isTrustedServiceCaller -- env d'abord, app_config.service_role_key en
//      repli), parce que son appelant reel est net.http_post, qui rejoue en Bearer la
//      valeur d'app_config et non celle du runtime. Les autres fonctions gardees de la
//      meme facon (kyc-screening, idx-syndicate) n'ont pas encore ete alignees : la
//      variable reste donc necessaire.
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
