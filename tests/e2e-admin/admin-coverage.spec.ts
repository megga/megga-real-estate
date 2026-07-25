// Phase C (part 2) — Couverture super-admin (17 pages).
// La console vit sur son PROPRE bundle (index.admin.html / AdminApp) : cette
// suite lance donc `npm run dev:admin` sur :5174, avec
// VITE_DEV_BYPASS_ROLE=super_admin (cf playwright.admin.config.ts). Les routes
// y sont à la RACINE (`/users`, plus `/dashboard/admin/users`), et AdminAuthGate
// rend un écran de refus au lieu de la console si le rôle ne passe pas.

import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from '../e2e/helpers/console'

const MOCK_UUID = '00000000-0000-0000-0000-000000000000'

interface RouteSpec {
  path: string
  label: string
}

const ADMIN_ROUTES: RouteSpec[] = [
  { path: '/', label: 'Admin dashboard' },
  { path: '/agencies', label: 'Admin > Agences' },
  { path: `/agencies/${MOCK_UUID}`, label: 'Admin > Agence detail (mock)' },
  { path: '/users', label: 'Admin > Users' },
  { path: '/end-users', label: 'Admin > Clients finaux' },
  { path: '/monitoring', label: 'Admin > Monitoring' },
  { path: '/marketplace', label: 'Admin > Marketplace' },
  { path: '/compliance', label: 'Admin > Compliance' },
  { path: '/changelog', label: 'Admin > Communication' },
  { path: '/feature-flags', label: 'Admin > Feature flags' },
  { path: '/plans', label: 'Admin > Plans / billing' },
  { path: '/live', label: 'Admin > Live feed' },
  { path: '/security', label: 'Admin > Security audit' },
  { path: '/nps', label: 'Admin > NPS' },
  { path: '/autonomy', label: 'Admin > Autonomie WhatsApp' },
  { path: '/tool-usage', label: 'Admin > Outils IA' },
  { path: '/learning', label: 'Admin > Apprentissage' },
]

test.describe('Super-admin — parametric route coverage', () => {
  for (const route of ADMIN_ROUTES) {
    test(`${route.label} (${route.path}) loads cleanly`, async ({ page }) => {
      const collector = collectConsoleErrors(page)
      await page.goto(route.path) // waitUntil 'load' par défaut

      // Attente de CONTENU d'abord (retour immédiat dès que le shell rend) :
      // `networkidle` n'est pas fiable sur ces pages data-heavy (cf.
      // agent-dashboard.spec.ts), donc on ne s'appuie pas dessus pour le rendu.
      await expect
        .poll(async () => (await page.locator('body').innerText()).length, {
          timeout: 10_000,
        })
        .toBeGreaterThan(50)

      // La console doit VRAIMENT rendre : ni redirection, ni écran de refus.
      // Garde la régression exacte qui faisait que la suite testait un écran
      // d'accueil au lieu des pages admin.
      expect(
        page.url(),
        `${route.path}: URL inattendue (URL=${page.url()})`
      ).toContain(route.path)
      expect(
        await page.locator('body').innerText(),
        `${route.path}: écran « Accès refusé » au lieu de la console`
      ).not.toContain('Accès refusé')

      // Laisse les requêtes data émettre d'éventuelles erreurs console avant de
      // vérifier. `networkidle` borné (retour anticipé dès que le réseau est
      // calme) — plafond court pour ne pas approcher le timeout de 30s du test.
      await page
        .waitForLoadState('networkidle', { timeout: 4_000 })
        .catch(() => {})

      const bodyText = await page.locator('body').innerText()
      expect(
        bodyText.length,
        `${route.path}: body too small (${bodyText.length} chars)`
      ).toBeGreaterThan(50)

      expect(
        collector.errors,
        `${route.path}: blocking console errors:\n${collector.errors.join('\n')}`
      ).toEqual([])
    })
  }
})
