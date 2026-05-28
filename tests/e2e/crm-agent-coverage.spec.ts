// Parametric smoke coverage of the CRM agent (all routes under AgentSugarLayout
// that don't take a URL parameter). For each route we assert:
//   1. the page renders something visible (body has > 50 chars of text)
//   2. no blocking console errors land in the browser console
// This is intentionally minimal — it's the safety net that catches "we broke
// a route entirely" regressions. Page-specific deep tests live in their own
// spec files (agent-dashboard.spec.ts, agent-pipeline.spec.ts, etc.).
//
// Routes with URL params (:id, :dossierId, …) are out of scope for this file
// because they need seed data — they're covered in Phase B with a different
// strategy (mock IDs + expected 404/empty-state assertions).

import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

interface RouteSpec {
  path: string
  /** Short label used in test titles (shorter than the path). */
  label: string
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
  { path: '/dashboard/documents', label: 'Documents' },
  { path: '/dashboard/settings', label: 'Paramètres' },
  { path: '/dashboard/kyc', label: 'KYC' },
  { path: '/dashboard/network', label: 'Réseau agences' },
  { path: '/dashboard/audit', label: 'Audit' },
  { path: '/dashboard/analytics', label: 'Analytics' },
  { path: '/dashboard/julien', label: 'Julien IA' },

  // ── Sub-routes statiques (sans paramètre) ───────────────────────────────
  { path: '/dashboard/contacts/import', label: 'Contacts > Import' },
  { path: '/dashboard/listings/new', label: 'Listings > Nouveau bien' },
  { path: '/dashboard/import-lead', label: 'Import lead IA' },
  { path: '/dashboard/visits/nouveau', label: 'Visites > Nouvelle' },
  { path: '/dashboard/documents/generate', label: 'Documents > Générer' },
  { path: '/dashboard/documents/templates/new', label: 'Documents > Nouveau template' },
  { path: '/dashboard/documents/view', label: 'Documents > Viewer' },
  { path: '/dashboard/support', label: 'Support' },
  { path: '/dashboard/onboarding', label: 'Onboarding' },
  { path: '/dashboard/premier-jour', label: 'Premier jour' },
]

test.describe('CRM agent — parametric route coverage', () => {
  for (const route of CRM_AGENT_ROUTES) {
    test(`${route.label} (${route.path}) loads cleanly`, async ({ page }) => {
      const collector = collectConsoleErrors(page)
      await page.goto(route.path)
      await page.waitForLoadState('networkidle')

      // 1. Page rendered something (no white screen / suspended forever)
      const bodyText = await page.locator('body').innerText()
      expect(
        bodyText.length,
        `${route.path}: body has only ${bodyText.length} chars of text — likely a render crash`
      ).toBeGreaterThan(50)

      // 2. No blocking console errors (helpers/console.ts filters known noise)
      expect(
        collector.errors,
        `${route.path}: blocking console errors:\n${collector.errors.join('\n')}`
      ).toEqual([])
    })
  }
})
