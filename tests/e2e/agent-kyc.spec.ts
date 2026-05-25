import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

test.describe('Agent KYC', () => {
  test('renders the KYC list page', async ({ page }) => {
    await page.goto('/dashboard/kyc')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/dashboard\/kyc/)
    // KYC page renders if body content is present (no crash)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(50)
  })

  test('no blocking console errors on /dashboard/kyc load', async ({ page }) => {
    const collector = collectConsoleErrors(page)
    await page.goto('/dashboard/kyc')
    await page.waitForLoadState('networkidle')

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
