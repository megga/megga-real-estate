import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

test.describe('Agent dashboard', () => {
  test('renders the Today screen for a logged-in agent', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/dashboard(\?|$)/)
    await expect(
      page.getByRole('heading', { name: /aujourd'hui/i, level: 1 })
    ).toBeVisible()
  })

  test('no blocking console errors on dashboard load', async ({ page }) => {
    const collector = collectConsoleErrors(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
