import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

test.describe('Seller portal (dev mock)', () => {
  test('renders the seller landing page', async ({ page }) => {
    await page.goto('/portail')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/portail/)
    await expect(
      page.getByRole('heading', { name: /tout avance,? sereinement/i })
    ).toBeVisible()
  })

  test('no blocking console errors on /portail load', async ({ page }) => {
    const collector = collectConsoleErrors(page)
    await page.goto('/portail')
    await page.waitForLoadState('networkidle')

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
