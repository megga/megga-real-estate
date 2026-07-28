// Couverture super-admin (17 pages).
// La console vit DANS le CRM depuis juillet 2026 : les routes sont sous
// `/dashboard/admin/*` et la suite lance le serveur du CRM avec
// VITE_DEV_BYPASS_ROLE=super_admin (cf playwright.admin.config.ts). Sans ce
// rôle, `AdminConsoleRoute` redirige vers /dashboard et la suite testerait
// 17 fois la même page sans rien affirmer.

import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from '../e2e/helpers/console'

const MOCK_UUID = '00000000-0000-0000-0000-000000000000'

interface RouteSpec {
  path: string
  label: string
}

const BASE = '/dashboard/admin'

const ADMIN_ROUTES: RouteSpec[] = [
  { path: BASE, label: 'Admin dashboard' },
  { path: `${BASE}/agencies`, label: 'Admin > Agences' },
  { path: `${BASE}/agencies/${MOCK_UUID}`, label: 'Admin > Agence detail (mock)' },
  { path: `${BASE}/users`, label: 'Admin > Users' },
  { path: `${BASE}/end-users`, label: 'Admin > Clients finaux' },
  { path: `${BASE}/monitoring`, label: 'Admin > Monitoring' },
  { path: `${BASE}/marketplace`, label: 'Admin > Marketplace' },
  { path: `${BASE}/compliance`, label: 'Admin > Compliance' },
  { path: `${BASE}/changelog`, label: 'Admin > Communication' },
  { path: `${BASE}/feature-flags`, label: 'Admin > Feature flags' },
  { path: `${BASE}/plans`, label: 'Admin > Plans / billing' },
  { path: `${BASE}/live`, label: 'Admin > Live feed' },
  { path: `${BASE}/security`, label: 'Admin > Security audit' },
  { path: `${BASE}/nps`, label: 'Admin > NPS' },
  { path: `${BASE}/autonomy`, label: 'Admin > Autonomie WhatsApp' },
  { path: `${BASE}/tool-usage`, label: 'Admin > Outils IA' },
  { path: `${BASE}/learning`, label: 'Admin > Apprentissage' },
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

// Visiter des URL ne prouve rien des liens que la console REND : après la
// refusion dans le CRM, ils pointaient encore à la racine et le retour de la
// fiche agence éjectait vers la vitrine. On cible le lien par son `href` — le
// libellé est traduit, l'adresse est le contrat.
test.describe('Super-admin — navigation interne', () => {
  test('le retour de la fiche agence ramène à la liste de la console', async ({ page }) => {
    await page.goto(`${BASE}/agencies/${MOCK_UUID}`)

    // Rendu hors de la branche de chargement : présent même sans agence réelle.
    const back = page.locator(`a[href="${BASE}/agencies"]`).first()
    await expect(back, 'lien de retour absent ou non préfixé').toBeVisible({ timeout: 10_000 })

    await back.click()
    await expect(page).toHaveURL(new RegExp(`${BASE}/agencies$`))
  })
})
