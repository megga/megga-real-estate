import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // Exclude visual regression — needs baselines generated in CI Ubuntu, run
  // separately via `npm run test:e2e:visual` after baselines are committed.
  // Exclude onboarding-identite — needs REAL Supabase auth (login/logout/relogin)
  // against a local `supabase start` instance, which VITE_DEV_BYPASS_AUTH (below)
  // defeats by construction (useAuth() would keep returning the mock profile
  // regardless of the real session). Run separately via `npm run test:e2e:kyb`
  // (playwright.kyb.config.ts, its own dev server, no bypass).
  testIgnore: ['**/visual-regression.spec.ts', '**/onboarding-identite.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5173',
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

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_DEV_BYPASS_AUTH: 'true',
      VITE_DEV_BYPASS_ROLE: 'agent',
      VITE_PASSWORD_GATE_BYPASS: 'true',
    },
  },
})
