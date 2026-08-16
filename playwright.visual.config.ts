// Visual-regression-only Playwright config.
//
// playwright.config.ts has `testIgnore: ['**/visual-regression.spec.ts']` so
// the smoke suite (`npm run test:e2e`) never tries to run visual regression —
// it'd fail with "missing baselines" everywhere it's invoked locally.
//
// This config overrides that: testIgnore is empty and testMatch narrows the
// run to the single visual-regression spec. Use it via:
//
//   npm run test:e2e:visual                                        (smoke)
//   playwright test --config=playwright.visual.config.ts \         (CI baseline
//     --update-snapshots=all                                        regen)
//
// The visual-baselines.yml workflow uses the second form when triggered by
// the /regenerate-visual-baselines slash command on a PR.

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/visual-regression.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5198',
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
    command: 'npm run dev -- --port 5198 --strictPort',
    url: 'http://localhost:5198',
    // ⛔ PORT DÉDIÉ, ET AUCUNE RÉUTILISATION — mesuré le 15 août 2026.
    // Avec `reuseExistingServer` et le port 5173, une régénération lancée en
    // local a photographié le serveur d'un AUTRE worktree : trois `vite`
    // tournent en permanence sur la machine de développement et occupent
    // 5173/5174 pour d'autres checkouts. La capture produite aurait décrit un
    // code que personne n'a écrit ici, et rien ne l'aurait signalé.
    // En CI le drapeau valait déjà `false` ; c'est en LOCAL que la référence
    // pouvait naître fausse.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_DEV_BYPASS_AUTH: 'true',
      VITE_DEV_BYPASS_ROLE: 'agent',
      VITE_PASSWORD_GATE_BYPASS: 'true',
    },
  },
})
