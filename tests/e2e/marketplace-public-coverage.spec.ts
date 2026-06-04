// Phase C (part 1) — Couverture de la marketplace publique et des landing
// pages. Routes accessibles sans authentification (ou avec bypass mock).
//
// Scope : pages "core" — homepage, marketplace, landing produit, légales,
// auth, annuaires, blog, help center root. Les sous-routes /help/:category
// et le design-system sont hors scope (internes/dev).

import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

const MOCK_UUID = '00000000-0000-0000-0000-000000000000'
const MOCK_SLUG = 'test-slug-mock'
const MOCK_TOKEN = 'dummy_token_mock'

interface RouteSpec {
  path: string
  label: string
}

const PUBLIC_ROUTES: RouteSpec[] = [
  // ── Homepage & landing ─────────────────────────────────────────────────
  { path: '/', label: 'Homepage' },
  { path: '/sell', label: 'Vendre (landing)' },
  { path: '/services', label: 'Services' },
  { path: '/estimates', label: 'Estimations' },

  // ── Marketplace ────────────────────────────────────────────────────────
  // Pivot CRM-first (juin 2026) : marketplace PUBLIQUE désactivée — /buy /rent
  // /propriete/:id /listing/:id redirigent vers la vitrine megga.ch (hors
  // domaine de test). Redirection couverte par marketplace-disabled.spec.ts.
  { path: '/properties', label: 'Marketplace Properties' },

  // ── Info / about / legal ───────────────────────────────────────────────
  { path: '/a-propos', label: 'À propos' },
  { path: '/contact', label: 'Contact' },
  { path: '/faq', label: 'FAQ' },
  { path: '/privacy', label: 'Privacy / RGPD' },
  { path: '/coming-soon', label: 'Coming soon' },

  // ── Annuaires ──────────────────────────────────────────────────────────
  { path: '/agencies', label: 'Annuaire agences' },
  { path: '/agents', label: 'Annuaire agents' },

  // ── Blog ───────────────────────────────────────────────────────────────
  { path: '/blog', label: 'Blog' },

  // ── Help center ────────────────────────────────────────────────────────
  { path: '/help', label: 'Help center' },
  { path: '/help/glossary', label: 'Help > Glossaire' },

  // ── Auth pages (en bypass auth, peuvent rediriger vers /dashboard) ─────
  { path: '/login', label: 'Login' },
  { path: '/register', label: 'Register' },
  { path: '/reset-password', label: 'Reset password' },

  // ── Publier ────────────────────────────────────────────────────────────
  { path: '/publish-listing', label: 'Publier un bien' },

  // ── Routes paramétrées (mock IDs / slugs) ──────────────────────────────
  // /propriete/:id + /listing/:id désactivées (redirigent vers la vitrine) —
  // voir marketplace-disabled.spec.ts.
  { path: `/agencies/${MOCK_SLUG}`, label: 'Agence profile (mock slug)' },
  { path: `/agents/${MOCK_SLUG}`, label: 'Agent profile (mock slug)' },
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
