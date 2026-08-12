// Parametric smoke coverage of the CRM agent (all routes under AgentSugarLayout
// that don't take a URL parameter). For each route we assert:
//   1. the page renders something visible (body has > 50 chars of text)
//   2. its `landmark`, WHEN one is declared — le seul point qui prouve que la
//      page visée a rendu, plutôt qu'un écran monté à sa place
//   3. no blocking console errors land in the browser console
//
// ⚠ Les points 1 et 3 ne distinguent PAS une page de son remplaçant : un garde de
// route, une frontière d'erreur ou une redirection les satisfont tous les trois.
// Une route sans `landmark` est donc dépistée contre l'écran blanc, pas vérifiée.
// This is intentionally minimal — it's the safety net that catches "we broke
// a route entirely" regressions. Page-specific deep tests live in their own
// spec files (agent-dashboard.spec.ts, agent-pipeline.spec.ts, etc.).
//
// Routes with URL params (:id, :dossierId, …) are out of scope for this file
// because they need seed data — they're covered in Phase B with a different
// strategy (mock IDs + expected 404/empty-state assertions).

import { test, expect, type Locator, type Page } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'
import { skipKycOnboarding } from './helpers/kyc'

interface RouteSpec {
  path: string
  /** Short label used in test titles (shorter than the path). */
  label: string
  /**
   * Repère PROPRE à la page — le seul moyen de prouver que c'est bien ELLE qui a
   * été rendue, et pas un écran de remplacement.
   *
   * Renseigné route par route, là où on l'a mesuré ; ⚠ une route qui n'en a pas
   * n'est PAS « vérifiée », elle est seulement dépistée contre l'écran blanc. Le
   * comptage de caractères plus bas est franchi par n'importe quel remplaçant —
   * garde, frontière d'erreur, redirection : c'est précisément ce qui a laissé
   * /dashboard/kyc « couvert » pendant des mois alors qu'un garde LAB montait à
   * sa place (02.08.2026, cf. l'en-tête de agent-kyc.spec.ts).
   */
  landmark?: (page: Page) => Locator
  /** État à poser AVANT la navigation (stockage local…), quand la page en dépend. */
  prepare?: (page: Page) => Promise<void>
}

const CRM_AGENT_ROUTES: RouteSpec[] = [
  // ── Core CRM ────────────────────────────────────────────────────────────
  { path: '/dashboard', label: 'Today' },
  { path: '/dashboard/pipeline', label: 'Pipeline' },
  { path: '/dashboard/contacts', label: 'Contacts' },
  { path: '/dashboard/listings', label: 'Mes biens' },
  { path: '/dashboard/matching', label: 'Matching' },
  { path: '/dashboard/journey', label: 'Parcours équipe' },
  { path: '/dashboard/calendar', label: 'Calendrier' },
  { path: '/dashboard/settings', label: 'Paramètres' },
  // Deux réglages indispensables ici, sans quoi cette ligne ne couvre rien :
  // `prepare` évite la redirection vers l'onboarding (cf. helpers/kyc.ts), et
  // `landmark` vise le titre du pager — que ni le garde LAB ni la frontière
  // d'erreur ne savent rendre.
  {
    path: '/dashboard/kyc',
    label: 'KYC',
    prepare: skipKycOnboarding,
    landmark: (page) => page.getByRole('heading', { name: 'KYC', exact: true }),
  },
  { path: '/dashboard/network', label: 'Réseau agences' },
  { path: '/dashboard/audit', label: 'Audit' },
  { path: '/dashboard/analytics', label: 'Analytics' },
  { path: '/dashboard/julien', label: 'Julien IA' },

  // ── Sub-routes statiques (sans paramètre) ───────────────────────────────
  { path: '/dashboard/listings/new', label: 'Listings > Nouveau bien' },
  { path: '/dashboard/import-lead', label: 'Import lead IA' },
  { path: '/dashboard/visits/nouveau', label: 'Visites > Nouvelle' },
]

test.describe('CRM agent — parametric route coverage', () => {
  for (const route of CRM_AGENT_ROUTES) {
    test(`${route.label} (${route.path}) loads cleanly`, async ({ page }) => {
      const collector = collectConsoleErrors(page)
      await route.prepare?.(page)
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      // `networkidle` n'est pas atteignable sur les pages data-heavy (ex. le
      // cockpit « Aujourd'hui » : nombreuses requêtes Supabase + modules Vite dev
      // gardent le réseau actif). On attend que React ait rendu du contenu —
      // même condition que l'assertion ci-dessous.
      await page.waitForFunction(() => document.body.innerText.trim().length > 50, { timeout: 20000 })

      // 1. Page rendered something (no white screen / suspended forever)
      const bodyText = await page.locator('body').innerText()
      expect(
        bodyText.length,
        `${route.path}: body has only ${bodyText.length} chars of text — likely a render crash`
      ).toBeGreaterThan(50)

      // 2. C'est bien CETTE page qui a été rendue, quand on a un repère à viser.
      if (route.landmark) {
        await expect(
          route.landmark(page),
          `${route.path}: repère de page absent — un écran de remplacement (garde, frontière d'erreur, redirection) a probablement pris sa place`
        ).toBeVisible()
      }

      // 3. No blocking console errors (helpers/console.ts filters known noise)
      expect(
        collector.errors,
        `${route.path}: blocking console errors:\n${collector.errors.join('\n')}`
      ).toEqual([])
    })
  }
})
