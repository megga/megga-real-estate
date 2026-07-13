// Phase C (part 2) — Couverture super-admin (16 pages + détail agence mock).
// Cette suite tourne avec un serveur Vite séparé sur :5174 avec
// VITE_DEV_BYPASS_ROLE=super_admin (cf playwright.admin.config.ts).
// Les routes /dashboard/admin/* sont wrappées dans SuperAdminGuard,
// donc inaccessibles avec le role 'agent' par défaut.

import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from '../e2e/helpers/console'

const MOCK_UUID = '00000000-0000-0000-0000-000000000000'

interface RouteSpec {
  path: string
  label: string
}

const ADMIN_ROUTES: RouteSpec[] = [
  { path: '/dashboard/admin', label: 'Admin dashboard' },
  { path: '/dashboard/admin/agencies', label: 'Admin > Agences' },
  { path: `/dashboard/admin/agencies/${MOCK_UUID}`, label: 'Admin > Agence detail (mock)' },
  { path: '/dashboard/admin/users', label: 'Admin > Users' },
  { path: '/dashboard/admin/monitoring', label: 'Admin > Monitoring' },
  { path: '/dashboard/admin/marketplace', label: 'Admin > Marketplace' },
  { path: '/dashboard/admin/compliance', label: 'Admin > Compliance' },
  { path: '/dashboard/admin/changelog', label: 'Admin > Changelog' },
  { path: '/dashboard/admin/feature-flags', label: 'Admin > Feature flags' },
  { path: '/dashboard/admin/plans', label: 'Admin > Plans / billing' },
  { path: '/dashboard/admin/live', label: 'Admin > Live feed' },
  { path: '/dashboard/admin/security', label: 'Admin > Security audit' },
  { path: '/dashboard/admin/nps', label: 'Admin > NPS' },
  { path: '/dashboard/admin/autonomy', label: 'Admin > Autonomie WhatsApp' },
  { path: '/dashboard/admin/tool-usage', label: 'Admin > Outils IA' },
  { path: '/dashboard/admin/learning', label: 'Admin > Apprentissage' },
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

      // La route admin doit VRAIMENT rendre (pas se faire rediriger vers
      // /dashboard par SuperAdminGuard). Garde la régression exacte qui faisait
      // que la suite testait « Aujourd'hui » au lieu des pages admin.
      expect(
        page.url(),
        `${route.path}: redirigé hors de /dashboard/admin (URL=${page.url()})`
      ).toContain('/dashboard/admin')

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
