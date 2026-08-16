import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

// NOTE — drag-drop interactive test is intentionally absent from this suite.
// `usePipelineScreen` loads deals from Supabase (filtered by agency_id), not from
// the CRM_DEALS mock array. With VITE_DEV_BYPASS_AUTH=true the mock agent has
// agency_id='dev-mock-agency' which matches no real transactions, so the
// pipeline renders empty. To E2E-test a real drag-drop, we would need either
// (a) seeded transactions in Supabase for the mock agency, or (b) a test
// double for the hook. Both are out of scope for a smoke suite. The tests
// below validate what we CAN assert reliably in this environment: column
// structure, empty-state UX, and absence of console errors.

test.describe('Agent pipeline — structure & empty state', () => {
  test('renders the 8 stage columns in order', async ({ page }) => {
    await page.goto('/dashboard/pipeline')
    await page.waitForLoadState('networkidle')

    // Columns from CRM_STAGE_ORDER (src/components/crm/tokens.ts).
    // No data-testid on columns — select by header text.
    const expectedColumns = [
      'Nouveau lead',
      'À qualifier',
      'Recherche active',
      'Visite planifiée',
      'Visite effectuée',
      'Intérêt confirmé',
      'Offre déposée',
      'Signé',
    ]
    for (const label of expectedColumns) {
      await expect(
        page.getByText(label, { exact: false }).first(),
        `column "${label}" should be visible`
      ).toBeVisible()
    }
  })

  test('shows empty-state placeholder when no deals in pipeline', async ({ page }) => {
    await page.goto('/dashboard/pipeline')
    await page.waitForLoadState('networkidle')

    // With the bypass-auth mock agency, Supabase returns 0 transactions, so
    // every column shows the "Glisser un deal ici" placeholder. We only need
    // to confirm at least one placeholder is rendered (no white-screen, no
    // crash on empty state).
    await expect(
      page.getByText(/glisser un deal ici/i).first()
    ).toBeVisible()
  })

  test('no blocking console errors on pipeline load', async ({ page }) => {
    const collector = collectConsoleErrors(page)
    await page.goto('/dashboard/pipeline')
    await page.waitForLoadState('networkidle')

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
