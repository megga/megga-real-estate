import { defineConfig, devices } from '@playwright/test'

/**
 * Tests FONCTIONNELS des bancs `/dev/*` (Messagerie, CRM) — des gestes, pas des
 * captures.
 *
 * ⛔ SANS `VITE_DEV_BYPASS_AUTH`, et c'est toute la raison de ce fichier. Sous le
 * contournement, `useAuth` rend `MOCK_PROFILE`, dont l'agence est
 * `dev-mock-agency` : les requêtes du Calendrier filtrent par agence, les fixtures
 * du banc portent celle d'`AGENCE_BANC`, et le Calendrier du banc sortait VIDE —
 * aucun bloc à cliquer. Le banc sème sa propre session (`semerSessionBanc`) et n'a
 * besoin d'aucun contournement. Mesuré le 13.09.2026 : 4/4 sans, 3/4 avec.
 *
 * Port à part (`--strictPort`) : un serveur de développement déjà lancé ne doit
 * pas être réutilisé à la place de celui-ci — il pourrait, lui, porter le
 * contournement.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/menus-clic-droit.spec.ts', '**/menu-compte.spec.ts', '**/onglet-neuf.spec.ts', '**/cloche.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5199',
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
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_PASSWORD_GATE_BYPASS: 'true',
    },
  },
})
