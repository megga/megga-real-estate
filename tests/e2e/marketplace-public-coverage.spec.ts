// Phase C (part 1) — Couverture de la marketplace publique et des landing
// pages. Routes accessibles sans authentification (ou avec bypass mock).
//
// Scope : pages "core" — homepage, marketplace, landing produit, légales,
// auth, annuaires, blog, help center root. Les sous-routes /help/:category
// et le design-system sont hors scope (internes/dev).

import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

const MOCK_TOKEN = 'dummy_token_mock'

interface RouteSpec {
  path: string
  label: string
}

const PUBLIC_ROUTES: RouteSpec[] = [
  // ── Homepage ───────────────────────────────────────────────────────────
  { path: '/', label: 'Homepage' },

  // ── Marketplace + ancien site marketing Property X ─────────────────────
  // Pivot CRM-first (juin 2026) puis extraction du marketing Property X
  // (2026-06-08) : /buy /rent /sell /services /estimates /contact /agents
  // /agencies… redirigent vers la vitrine megga.ch (hors domaine de test).
  // Redirections couvertes par marketplace-disabled.spec.ts. Les routes non
  // routées (/a-propos /blog /properties…) retombent sur la 404 in-app.

  // ── Légal ──────────────────────────────────────────────────────────────
  { path: '/privacy', label: 'Privacy / LPD' },

  // ── Help center ────────────────────────────────────────────────────────
  { path: '/help', label: 'Help center' },
  { path: '/help/glossary', label: 'Help > Glossaire' },

  // ── Auth pages (en bypass auth, peuvent rediriger vers /dashboard) ─────
  { path: '/login', label: 'Login' },
  { path: '/register', label: 'Register' },
  { path: '/reset-password', label: 'Reset password' },

  // ── Routes paramétrées (mock IDs / slugs) ──────────────────────────────
  { path: `/portal/${MOCK_TOKEN}`, label: 'Portail vendeur prod (mock token)' },
]

test.describe('Marketplace publique — parametric route coverage', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.label} loads cleanly`, async ({ page }) => {
      const collector = collectConsoleErrors(page)
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      // Wait until React has rendered enough content — replaces the flaky
      // `networkidle` wait that timed out on /agencies (Supabase realtime and
      // parallel agency-directory fetches keep the network perpetually active).
      // Public pages have no single shared shell element (PxNav vs
      // HomeStickyHeader vs AuthBentoApp vs PortalGateway vs NotFoundPage),
      // so we use the same condition that the assertion below verifies:
      // the page has meaningful text content.
      await page.waitForFunction(() => document.body.innerText.trim().length > 50, {
        timeout: 15000,
      })

      const bodyText = await page.locator('body').innerText()
      expect(
        bodyText.length,
        `${route.path}: body too small (${bodyText.length} chars) — likely a render crash`
      ).toBeGreaterThan(50)

      expect(
        collector.errors,
        `${route.path}: blocking console errors:\n${collector.errors.join('\n')}`
      ).toEqual([])
    })
  }
})
