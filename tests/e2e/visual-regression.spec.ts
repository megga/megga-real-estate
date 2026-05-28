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
const PAGES_TO_SNAPSHOT = [
  { path: '/dashboard', name: 'dashboard-agent' },
  { path: '/dashboard/pipeline', name: 'dashboard-pipeline' },
  { path: '/portal', name: 'seller-portal' },
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
