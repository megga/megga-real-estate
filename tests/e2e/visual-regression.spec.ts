// Visual regression tests — Playwright `toHaveScreenshot()`.
//
// On first CI run the baselines don't exist yet — the snapshot directory will
// be empty and these tests will fail. Comment `/regenerate-visual-baselines`
// on any PR to trigger the dedicated workflow which generates the baselines
// in CI (Ubuntu, matches the runtime) and commits them on the PR branch.
//
// Threshold: 5% of pixels may differ. Tolerates anti-aliasing differences
// and minor animation residuals, catches structural breaks (layout shifted,
// component missing, color theme broken).
//
// Viewport fixed at 1280x720 — same as Playwright default Desktop Chrome.

import { test, expect } from '@playwright/test'

// `/` and `/rent` were dropped after the deploy split (#490): `/` now just
// redirects to `/dashboard`, and `/rent` lives on the V3 static storefront
// (megga.ch), not in this React app. Their old baselines no longer matched
// reality, so they're removed from the snapshot set.
//
// `/portal` (espace vendeur « Votre vente ») dropped too: la page a été
// entièrement refondue et affiche des dates relatives (« il y a 2 j ») qui
// dérivent dans le temps → impropre au diff pixel. Couverture fonctionnelle
// assurée par seller-portal.spec.ts.
//
// `/dashboard` (cockpit « Aujourd'hui ») retiré pour la même raison (refonte
// juin 2026) : page entièrement refondue, contenu dynamique (temps relatifs
// « dans X min », file de priorités, données live) → impropre au diff pixel.
// Couverture fonctionnelle assurée par agent-dashboard.spec.ts.
//
// Élargi (juil. 2026) lors de la bascule vers les icônes Iconly : une seule
// page ne couvrait rien d'un changement qui touche l'iconographie de tout le
// CRM. Les trois ajouts ont été vérifiés en 1280×720 avec le bypass agent —
// aucune date relative, aucune heure, aucune date absolue dans le rendu, donc
// pas de dérive dans le temps. Densité d'icônes au moment de l'ajout :
// settings 36, listings 23, journey 13.
//
// `/dashboard/kyc` écarté : il redirige vers `/kyc/bienvenue`, le nom de
// l'instantané ne correspondrait pas au chemin. Les surfaces `/admin/*` le sont
// aussi — le bypass de cette config est en rôle `agent`, elles sont hors
// d'atteinte.
const PAGES_TO_SNAPSHOT = [
  { path: '/dashboard/pipeline', name: 'dashboard-pipeline' },
  { path: '/dashboard/settings', name: 'dashboard-settings' },
  { path: '/dashboard/listings', name: 'dashboard-listings' },
  { path: '/dashboard/journey', name: 'dashboard-journey' },
] as const

test.describe('Visual regression — key pages', () => {
  for (const { path, name } of PAGES_TO_SNAPSHOT) {
    test(`${name} (${path})`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 })
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      // Let any mount animations settle before capturing.
      await page.waitForTimeout(800)

      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.05,
        // Mask any element that's inherently dynamic (timestamps, randomized data)
        // to avoid spurious diffs. Empty for now — add selectors if needed.
        mask: [],
      })
    })
  }
})
