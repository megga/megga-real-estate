// Phase B — Couverture étendue du portail vendeur (dev mock).
// L'index /portal est déjà couvert dans seller-portal.spec.ts ; ici on
// ajoute les 5 sub-routes principales. PortalDevWrapper injecte les
// mock seller data, donc toutes les pages doivent render.

import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

interface RouteSpec {
  path: string
  label: string
}

const SELLER_PORTAL_ROUTES: RouteSpec[] = [
  { path: '/portal/visits', label: 'Visites' },
  { path: '/portal/offers', label: 'Offres' },
  { path: '/portal/documents', label: 'Documents' },
  { path: '/portal/messages', label: 'Messages' },
  { path: '/portal/analytics', label: 'Analyse' },
]

test.describe('Seller portal — parametric route coverage', () => {
  for (const route of SELLER_PORTAL_ROUTES) {
    test(`${route.label} (${route.path}) loads cleanly`, async ({ page }) => {
      const collector = collectConsoleErrors(page)
      await page.goto(route.path)
      await page.waitForLoadState('networkidle')

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
