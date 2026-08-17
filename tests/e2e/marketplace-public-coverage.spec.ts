// Phase C (part 1) — Couverture de la marketplace publique et des landing
// pages. Routes accessibles sans authentification (ou avec bypass mock).
//
// Scope : pages "core" — homepage, marketplace, landing produit, légales,
// auth, annuaires, blog, help center root. Les sous-routes /help/:category
// et le design-system sont hors scope (internes/dev).

import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

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
  // Plus de page in-app : `/privacy` sort au bord vers megga.ch (301), comme
  // `/aide`. La vitrine sert la page canonique, et `src/lib/consents.ts` y
  // pointait DÉJÀ le consentement nLPD — celle de l'app en était un doublon
  // court que plus rien ne liait. Retirée le 17 août 2026.

  // ── Help center ────────────────────────────────────────────────────────
  // Plus de page in-app : /help/* et /aide/* sortent vers intercom.help/megga/fr
  // (hors domaine de test), comme les routes marketplace. Le corpus vit dans
  // Intercom depuis le 2026-07-20 ; les 12 pages SPA ont été retirées.

  // ── Auth ───────────────────────────────────────────────────────────────
  // Le modal de connexion vit sur la vitrine (megga.ch/login) : /login,
  // /register, /auth/login… redirigent hors app → voir marketplace-disabled.
  // ⛔ CE COMMENTAIRE DISAIT « /reset-password reste in-app (cible des e-mails de
  // réinitialisation) » : mesuré le 17 août 2026, c'est FAUX, et ça l'était déjà.
  // La récupération de l'app pose `redirectTo: /auth/callback?type=recovery`
  // (`useAuth.tsx`), et `AuthCallbackPage` route ce cas sur
  // `/auth/forgot-password/reset` ; celle de la vitrine part sur
  // `megga.ch/reset-password` (`megga-auth.js`, quatre langues). AUCUN e-mail ne
  // visait cette route. La page est retirée et l'URL redirigée au bord vers
  // l'écran vivant de même fonction — un fragment de session survit au 301.
]

test.describe('Marketplace publique — parametric route coverage', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route.label} loads cleanly`, async ({ page }) => {
      const collector = collectConsoleErrors(page)
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      // Wait until React has rendered enough content — replaces the flaky
      // `networkidle` wait that timed out on /agencies (Supabase realtime and
      // parallel agency-directory fetches keep the network perpetually active).
      // Public pages have no single shared shell element (PublicPageHeader vs
      // AuthBentoApp vs NotFoundPage),
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
