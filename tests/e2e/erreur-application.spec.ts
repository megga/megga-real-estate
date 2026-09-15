/**
 * L'écran d'erreur de l'application, atteint par une VRAIE erreur de rendu (Julien,
 * 15.09.2026 : « refaire et améliorer le design de cette page d'erreur »).
 *
 * Le banc monte `/dashboard/erreur-rendu`, qui lève pendant le rendu ; l'`ErrorBoundary`
 * qui enroule le banc attrape, comme en production. Ce que ces tests tiennent : les deux
 * issues et le centre d'aide, l'action primaire en accent, le thème sombre lu au montage,
 * et aucune référence d'incident quand Sentry ne tourne pas — elle ne mènerait à rien.
 */
import { test, expect, type Page } from '@playwright/test'

const ENTREE = `/dev/crm?entree=${encodeURIComponent('/dashboard/erreur-rendu')}`
const titre = (page: Page) => page.getByRole('heading', { name: "Cette page n'a pas pu s'afficher" })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
})

test('les deux issues, le centre d’aide — et pas de référence sans Sentry', async ({ page }) => {
  await page.goto(ENTREE)
  await expect(titre(page)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('link', { name: 'Retour au tableau de bord' })).toHaveAttribute('href', '/dashboard')
  await expect(page.getByRole('link', { name: "Centre d'aide" })).toHaveAttribute('href', /intercom\.help/)
  await expect(page.getByText(/Référence de l'incident/)).toHaveCount(0)
  // L'action primaire porte l'accent (CLAUDE.md §3), la secondaire non.
  const fond = (nom: string) => page.getByRole(nom === 'Recharger la page' ? 'button' : 'link', { name: nom })
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(await fond('Recharger la page')).toBe('rgb(66, 75, 251)')
  expect(await fond('Retour au tableau de bord')).toBe('rgba(0, 0, 0, 0)')
})

test('« Recharger la page » recharge, en contournant le cache', async ({ page }) => {
  await page.goto(ENTREE)
  await expect(titre(page)).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Recharger la page' }).click()
  await page.waitForURL(/[?&]_v=\d+/)
  await expect(titre(page)).toBeVisible({ timeout: 30_000 })
})

test('en sombre, l’écran suit le réglage de l’agent', async ({ page }) => {
  await page.addInitScript(() => { try { window.localStorage.setItem('megga.crm.dark', '1') } catch { /* stockage refusé */ } })
  await page.goto(ENTREE)
  await expect(titre(page)).toBeVisible({ timeout: 30_000 })
  const fondPage = await titre(page).evaluate((el) => {
    let n: HTMLElement | null = el as HTMLElement
    while (n && getComputedStyle(n).backgroundColor === 'rgba(0, 0, 0, 0)') n = n.parentElement
    return n ? getComputedStyle(n).backgroundColor : null
  })
  expect(fondPage).toBe('rgb(3, 3, 3)')
})
