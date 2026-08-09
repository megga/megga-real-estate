// Visual regression tests — Playwright `toHaveScreenshot()`.
//
// On first CI run the baselines don't exist yet — the snapshot directory will
// be empty and these tests will fail. Comment `/regenerate-visual-baselines`
// on any PR to trigger the dedicated workflow which generates the baselines
// in CI (Ubuntu, matches the runtime) and commits them on the PR branch.
//
// Seuil : 1% des pixels peuvent différer — abaissé depuis 5% le 9 août 2026,
// sur mesure et non au jugé.
//
// ⚠ Le seuil de 5% prétendait attraper un « color theme broken ». Il ne le
// faisait pas : la bascule de direction artistique du CRM (accent noir → bleu
// #424bfb, DM Sans → Inter Tight, fond #EEF1F5 → #f9f9f9) est passée AU VERT.
// Diff mesuré entre les deux références, au seuil par pixel de Playwright
// (0.2, inchangé) : 28 356 px sur 921 600, soit **3,08%**. Sous la barre.
//
// 1% laisse donc 3× de marge sous ce changement-là, tout en restant très
// au-dessus du bruit d'anti-aliasing sur un runner fixe (typiquement < 0,1%).
// Le seuil PAR PIXEL n'est délibérément pas touché : à 0.02 le même diff monte
// à 59%, ce qui est du bruit, et je n'ai pas de mesure du plancher réel.
//
// Viewport fixed at 1280x720 — same as Playwright default Desktop Chrome.

import { test, expect } from '@playwright/test'

// `/` and `/rent` were dropped after the deploy split (#490): `/` now just
// redirects to `/dashboard`, and `/rent` lives on the V3 static storefront
// (megga.ch), not in this React app. Their old baselines no longer matched
// reality, so they're removed from the snapshot set.
//
// `/portal` (espace vendeur) : la route et la fonctionnalité ont été retirées
// le 2026-07-26 — plus rien à photographier.
//
// `/dashboard` (cockpit « Aujourd'hui ») retiré pour la même raison (refonte
// juin 2026) : page entièrement refondue, contenu dynamique (temps relatifs
// « dans X min », file de priorités, données live) → impropre au diff pixel.
// Couverture fonctionnelle assurée par agent-dashboard.spec.ts.
const PAGES_TO_SNAPSHOT = [
  { path: '/dashboard/pipeline', name: 'dashboard-pipeline' },
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
        maxDiffPixelRatio: 0.01,
        // Mask any element that's inherently dynamic (timestamps, randomized data)
        // to avoid spurious diffs. Empty for now — add selectors if needed.
        mask: [],
      })
    })
  }
})
