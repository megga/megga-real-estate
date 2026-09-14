/**
 * La cloche du CRM refaite (14.09.2026, Julien : « plus simple, lisible, des icônes plus
 * grandes ; enlève la pause de deux heures »), éprouvée sur le banc `/dev/crm`, dont les
 * fixtures portent un événement système ou IA par type de notification.
 */
import { test, expect, type Page } from '@playwright/test'

const cloche = (page: Page) => page.locator('button[aria-label^="Notifications"]').first()
const popover = (page: Page) => page.getByRole('dialog', { name: 'Notifications' })
/** Le nombre de non-lus que la cloche annonce (« Notifications · 17 non lues »). */
const nonLus = async (page: Page) => Number((await cloche(page).getAttribute('aria-label'))?.match(/(\d+)/)?.[1] ?? 0)

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/dev/crm')
  await cloche(page).waitFor({ timeout: 30_000 })
})

test('la cloche s’ouvre dans le coin du cadre, au même rayon que lui', async ({ page }) => {
  const cadre = await page.evaluate(() => {
    const bande = document.querySelector('[role="tablist"]')!.parentElement!.getBoundingClientRect()
    let el = document.elementFromPoint(bande.right - 40, bande.bottom + 40) as HTMLElement | null
    let retenu: HTMLElement | null = null
    for (; el; el = el.parentElement) {
      const r = el.getBoundingClientRect()
      if (Math.abs(r.right - bande.right) <= 2 && r.top >= bande.bottom && parseFloat(getComputedStyle(el).borderTopRightRadius) >= 12) retenu = el
    }
    const r = retenu!.getBoundingClientRect()
    return { top: r.top, right: r.right, rayon: getComputedStyle(retenu!).borderTopRightRadius }
  })
  await cloche(page).click()
  await expect(popover(page)).toBeVisible()
  await expect.poll(async () => {
    const r = await popover(page).evaluate((d) => { const b = d.getBoundingClientRect(); return { top: b.top, right: b.right } })
    return Math.abs(r.top - cadre.top) <= 1 && Math.abs(r.right - cadre.right) <= 1
  }).toBe(true)
  expect(await popover(page).evaluate((d) => getComputedStyle(d).borderTopRightRadius)).toBe(cadre.rayon)
})

test('une rafale anonyme se lit en une ligne « ×3 », et la pause de deux heures n’existe plus', async ({ page }) => {
  await cloche(page).click()
  await expect(popover(page).getByText('Correspondance suggérée')).toHaveCount(1)
  await expect(popover(page).getByText('×3')).toBeVisible()
  await expect(popover(page).getByText(/Pause/)).toHaveCount(0)
})

/**
 * « Pour les annonces qu'on publie, ou s'il y a un match qui arrive, synchroniser l'image »
 * (Julien, 14.09.2026). ⚠ Les photos du banc viennent d'Unsplash : servies ici par une
 * image locale, pour que le test ne dépende pas du réseau — une photo qui échoue retombe
 * sur le glyphe, et le test la croirait absente.
 */
test('un match et une diffusion montrent la photo du bien qu’ils désignent — un rappel garde son glyphe', async ({ page }) => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
  await page.route('**/images.unsplash.com/**', (r) => r.fulfill({ body: png, contentType: 'image/png' }))
  await cloche(page).click()
  const ligne = (texte: string) => popover(page).locator('section button', { hasText: texte })
  const match = ligne('Correspondance suggérée')
  await expect(match.locator('img')).toHaveAttribute('referrerpolicy', 'no-referrer')
  // Sans libellé serveur, le sujet d'un match est le bien qu'il désigne.
  await expect(match).toContainText('Appartement 3,5 pièces · Carouge')
  await expect(ligne('Bien diffusé sur un portail').locator('img')).toHaveCount(1)
  await expect(ligne('Rappel créé').locator('img')).toHaveCount(0)
})

test('lire une ligne la marque lue — le compteur baisse, la cloche reste ouverte', async ({ page }) => {
  const avant = await nonLus(page)
  expect(avant).toBeGreaterThan(0)
  await cloche(page).click()
  await popover(page).locator('section button').first().click()
  await expect.poll(() => nonLus(page)).toBe(avant - 1)
  await expect(popover(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(popover(page)).toHaveCount(0)
})
