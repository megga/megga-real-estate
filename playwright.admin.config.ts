import { defineConfig, devices } from '@playwright/test'
import { localSupabaseStubServer, localSupabaseWebServerEnv } from './playwright.local-supabase'

// Config séparée pour la couverture super-admin. La console n'est plus une
// application à part : elle vit dans le CRM sous `/dashboard/admin/*`. On lance
// donc le serveur du CRM, mais sur un AUTRE PORT et avec
// VITE_DEV_BYPASS_ROLE=super_admin — c'est le RÔLE qui distingue cette suite de
// la principale, plus le bundle.
//
// Sans ce rôle, `AdminConsoleRoute` redirige vers /dashboard : la suite
// passerait à vide en testant 17 fois la même page.
//
// La suite principale (playwright.config.ts) tourne sur :5173 en role=agent.
// Les deux coexistent — ports et env distincts, aucun conflit.
//
// Run with: npm run test:e2e:admin

export default defineConfig({
  testDir: './tests/e2e-admin',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // ⚠ Deux serveurs, dans cet ordre : la paille Supabase (ou l'instance locale réelle si
  // elle tourne déjà), puis le serveur de dev qui la vise. Voir playwright.local-supabase.ts.
  webServer: [localSupabaseStubServer(), {
    command: 'npm run dev -- --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // ⛔ Cible Supabase LOCALE, jamais le projet cloud (cf. playwright.local-supabase.ts).
      // Cette suite frappait la production avec les RPC de la console super-admin.
      ...localSupabaseWebServerEnv(),
      VITE_DEV_BYPASS_AUTH: 'true',
      VITE_DEV_BYPASS_ROLE: 'super_admin',
      VITE_PASSWORD_GATE_BYPASS: 'true',
    },
  }],
})
