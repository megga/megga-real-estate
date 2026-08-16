// Config du LOT 0 « garde visuelle » — MESURE, pas garde.
//
// ⚠ VOLONTAIREMENT HORS CI. Ce fichier produit les deux nombres qui décident du
// chantier ; il ne protège rien, et le brancher sur la CI ajouterait un job qui
// peut rougir sans qu'aucun écran soit cassé. Il se lance à la main :
//
//   npm run test:e2e:sensibilite
//
// ⚠ Les tests s'exécutent EN SÉRIE et dans un seul worker : ils écrivent dans un
// relevé partagé que la dernière clause lit. En parallèle, elle lirait un relevé
// à moitié rempli et conclurait sur du vide.
//
// `playwright.config.ts` l'ignore (`testIgnore`), comme la spec de régression
// visuelle — sans quoi la suite smoke essaierait de le jouer.

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['**/visual-sensibilite.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://localhost:5199',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'npm run dev -- --port 5199 --strictPort',
    url: 'http://localhost:5199',
    // ⛔ Les MÊMES bascules que `playwright.visual.config.ts` : sans elles,
    // `/dashboard/pipeline` ne monte pas du tout et on mesurerait un écran
    // blanc contre un écran blanc, c'est-à-dire zéro, c'est-à-dire « la garde
    // est aveugle » par vacuité.
    //
    // ⛔ PORT DÉDIÉ ET AUCUNE RÉUTILISATION. Trois serveurs `vite` tournent en
    // permanence sur cette machine et occupent 5173/5174 pour d'AUTRES
    // worktrees : `reuseExistingServer` aurait mesuré la composition d'un autre
    // checkout, et rendu un chiffre parfaitement crédible sur le mauvais code.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_DEV_BYPASS_AUTH: 'true',
      VITE_DEV_BYPASS_ROLE: 'agent',
      VITE_PASSWORD_GATE_BYPASS: 'true',
    },
  },
})
