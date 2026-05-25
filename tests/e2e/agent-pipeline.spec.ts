import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

test.describe('Agent pipeline', () => {
  test('renders the pipeline page with title', async ({ page }) => {
    await page.goto('/dashboard/pipeline')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/dashboard\/pipeline/)
    await expect(
      page.getByRole('heading', { name: /^pipeline$/i, level: 1 })
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
