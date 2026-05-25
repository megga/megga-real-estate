import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

test.describe('Marketplace /louer', () => {
  test('renders the rent marketplace page', async ({ page }) => {
    await page.goto('/louer')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/louer/)
    // Page rendered if the body has measurable content (no white-screen crash)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.length).toBeGreaterThan(50)
  })

  test('no blocking console errors on /louer load', async ({ page }) => {
    const collector = collectConsoleErrors(page)
    await page.goto('/louer')
    await page.waitForLoadState('networkidle')
    // Give infinite-query a beat to settle
    await page.waitForTimeout(1500)

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
