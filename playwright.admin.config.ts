import { defineConfig, devices } from '@playwright/test'

// Separate config for super-admin tests. Runs a 2nd Vite dev server on port
// 5174 with VITE_DEV_BYPASS_ROLE=super_admin, so the MOCK profile gets the
// super_admin role and routes under SuperAdminGuard become accessible.
//
// The main suite (playwright.config.ts) runs on :5173 with role=agent.
// Both can coexist — different ports, different env, no conflict.
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

  webServer: {
    command: 'npm run dev -- --port 5174',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_DEV_BYPASS_AUTH: 'true',
      VITE_DEV_BYPASS_ROLE: 'super_admin',
      VITE_PASSWORD_GATE_BYPASS: 'true',
    },
  },
})
