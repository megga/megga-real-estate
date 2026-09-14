/**
 * Le menu du compte, ouvert depuis la pastille en haut à droite de la bande, se
 * loge dans le coin haut-droit du cadre de page — même coin, même rayon.
 *
 * Demande de Julien (14.09.2026) : « le dropdown doit épouser l'arrondi du pager ».
 * ⚠ Deux écrans, parce que les cadres n'ont PAS tous le même rayon : 26 px sur
 * « Aujourd'hui », 24 sur le Calendrier (mesuré le jour même). Un menu au rayon
 * écrit en dur passerait sur l'un et laisserait dépasser un croissant sur l'autre —
 * c'est pour ça que `useCoinDuCadre` lit le rayon du cadre au lieu de le supposer.
 *
 * L'oracle du cadre est pris MENU FERMÉ, et par un autre chemin que le hook (la
 * remontée des ancêtres depuis un point du cadre, là où le hook lit la pile de
 * `elementsFromPoint`) : un test qui recopierait la règle du code validerait ses
 * erreurs avec elle.
 */
import { test, expect, type Page } from '@playwright/test'

interface Coin { top: number; right: number; rayon: string }

/** Le coin haut-droit du cadre sous la bande, menu fermé. */
async function coinDuCadre(page: Page): Promise<Coin> {
  const coin = await page.evaluate(() => {
    const bande = document.querySelector('[role="tablist"]')?.parentElement?.getBoundingClientRect()
    if (!bande) return null
    let el = document.elementFromPoint(bande.right - 40, bande.bottom + 40) as HTMLElement | null
    let cadre: HTMLElement | null = null
    for (; el; el = el.parentElement) {
      const r = el.getBoundingClientRect()
      if (Math.abs(r.right - bande.right) <= 2 && r.top >= bande.bottom && parseFloat(getComputedStyle(el).borderTopRightRadius) >= 12) cadre = el
    }
    if (!cadre) return null
    const r = cadre.getBoundingClientRect()
    return { top: r.top, right: r.right, rayon: getComputedStyle(cadre).borderTopRightRadius }
  })
  expect(coin, 'aucun cadre arrondi sous la bande').not.toBeNull()
  return coin!
}

/** La coque du menu : le bloc dont « Se déconnecter » est un enfant direct. */
const menuDuCompte = (page: Page) => page.locator('div:has(> button:has-text("Se déconnecter"))')

async function coinDuMenu(page: Page): Promise<Coin> {
  return menuDuCompte(page).evaluate((m) => {
    const r = m.getBoundingClientRect()
    return { top: r.top, right: r.right, rayon: getComputedStyle(m).borderTopRightRadius }
  })
}

for (const [ecran, chemin] of [['Aujourd’hui', '/dashboard'], ['Calendrier', '/dashboard/calendar']] as const) {
  test(`${ecran} : le menu du compte épouse le coin du cadre — même coin, même rayon`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 })
    await page.goto(`/dev/crm?entree=${encodeURIComponent(chemin)}`)
    const pastille = page.getByRole('button', { name: 'Mon compte' }).first()
    await pastille.waitFor({ timeout: 30_000 })

    const cadre = await coinDuCadre(page)
    await pastille.click()
    await expect(menuDuCompte(page)).toBeVisible()
    // ⚠ `poll` : le coin se mesure en microtâche puis à la frame — la coque attend
    // hors de l'écran le temps de la première mesure.
    await expect.poll(async () => {
      const m = await coinDuMenu(page)
      return Math.abs(m.top - cadre.top) <= 1 && Math.abs(m.right - cadre.right) <= 1
    }, { message: 'le coin haut-droit du menu doit être celui du cadre' }).toBe(true)
    expect((await coinDuMenu(page)).rayon, 'le rayon du menu doit être celui du cadre').toBe(cadre.rayon)
  })
}

test('Échap referme le menu du compte et rend le focus à la pastille', async ({ page }) => {
  await page.goto('/dev/crm')
  const pastille = page.getByRole('button', { name: 'Mon compte' }).first()
  await pastille.click()
  await expect(pastille).toHaveAttribute('aria-expanded', 'true')
  await expect(menuDuCompte(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menuDuCompte(page)).toHaveCount(0)
  await expect(pastille).toBeFocused()
})
