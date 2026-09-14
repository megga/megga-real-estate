/**
 * Ouvrir un onglet neuf ne fait plus passer l'écran au noir.
 *
 * ⛔ Le défaut (14.09.2026, Julien : « quand j'ouvre un nouvel onglet, j'ai un bug
 * d'affichage »). Filmé image par image : au premier « + », l'écran ENTIER disparaissait
 * ~300 ms — bande d'onglets, barre latérale, cadre — derrière un spinner. Le chunk de la
 * page d'onglet neuf n'était pas chargé, et le squelette de repli non plus. Correctif :
 * `src/lib/pagesPrechargeables.ts` (préchargement au repos + `lazyPrechargeable`).
 *
 * La mesure est prise dans la page, à CHAQUE image (rAF) : un défaut qui dure 300 ms
 * passe entre deux captures d'écran, pas entre deux frames. Le banc est servi par un
 * serveur de développement, où un chunk manquant coûte plusieurs centaines de
 * millisecondes — ce test rougit donc franchement si le préchargement disparaît.
 */
import { test, expect } from '@playwright/test'

interface Echantillon { images: number; trous: number; fin: boolean }

test('ouvrir un onglet neuf garde la bande d’onglets à l’écran, image après image', async ({ page }) => {
  await page.goto('/dev/crm')
  const plus = page.getByRole('button', { name: 'Nouvel onglet' }).first()
  await plus.waitFor({ timeout: 30_000 })
  // Le préchargement part au repos du navigateur (≤ 2 s) : on lui laisse le temps d'aboutir.
  await page.waitForTimeout(2500)
  await page.waitForLoadState('networkidle')

  await page.evaluate(() => {
    const w = window as unknown as { __onglet: Echantillon }
    w.__onglet = { images: 0, trous: 0, fin: false }
    const tick = () => {
      const s = w.__onglet
      // Une bande VISIBLE : les écrans vivants cachés sont en `visibility: hidden`.
      const bandes = [...document.querySelectorAll<HTMLElement>('[role="tablist"][aria-label="Onglets ouverts"]')]
      if (!bandes.some((el) => el.checkVisibility({ visibilityProperty: true }))) s.trous++
      s.images++
      if (!s.fin) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })

  await plus.click()
  await expect(page.getByPlaceholder('Rechercher ou demander', { exact: false }).first()).toBeVisible()
  await page.waitForTimeout(500)

  const s = await page.evaluate(() => {
    const w = window as unknown as { __onglet: Echantillon }
    w.__onglet.fin = true
    return w.__onglet
  })
  expect(s.images, 'l’échantillonneur n’a pas tourné').toBeGreaterThan(10)
  expect(s.trous, `images sans bande d’onglets pendant l’ouverture (sur ${s.images})`).toBe(0)
})
