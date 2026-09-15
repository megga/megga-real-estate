/**
 * Le × du sélecteur de boîtes (Julien, 14.09.2026 : « il s'agit de la suppression — une
 * confirmation avant, puis une notification pour dire que ça a été fait »). Éprouvé au
 * banc `/dev/crm` : la modale retient le geste, Annuler et Échap ne déconnectent rien, la
 * confirmation retire la boîte du sélecteur et l'annonce.
 */
import { test, expect, type Page } from '@playwright/test'

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
/** Le bouton de boîte courante, en tête du rail. */
const selecteur = (page: Page) => ecran(page).locator('button[aria-expanded]', { hasText: '@agence-exemple.ch' }).first()
const modale = (page: Page) => page.getByRole('dialog', { name: 'Déconnecter cette boîte ?' })
const croix = (page: Page, email: string) => ecran(page).getByRole('menuitem', { name: `Déconnecter ${email}`, exact: true })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie')}`)
  await ecran(page).locator('[role="row"]').first().waitFor({ timeout: 30_000 })
  // Replier les commandes du banc : ouvertes, elles couvrent le coin bas droit.
  const commande = page.locator('button[title$="/dashboard/messagerie"]').first()
  if (await commande.isVisible()) await page.locator('button', { hasText: 'Aperçu' }).first().click()
  await expect(commande).toBeHidden()
})

test('le × demande confirmation — Annuler et Échap ne déconnectent rien', async ({ page }) => {
  await selecteur(page).click()
  await croix(page, 'facturation@agence-exemple.ch').click()
  await expect(modale(page)).toBeVisible()
  await expect(modale(page)).toContainText('facturation@agence-exemple.ch')
  // Le focus s'ouvre sur « Annuler » : Entrée par réflexe ne déconnecte rien.
  await expect(modale(page).getByRole('button', { name: 'Annuler' })).toBeFocused()
  await modale(page).getByRole('button', { name: 'Annuler' }).click()
  await expect(modale(page)).toHaveCount(0)

  await selecteur(page).click()
  await croix(page, 'facturation@agence-exemple.ch').click()
  await expect(modale(page)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(modale(page)).toHaveCount(0)

  await selecteur(page).click()
  await expect(croix(page, 'facturation@agence-exemple.ch')).toBeVisible()
  await expect(page.getByText('Boîte déconnectée')).toHaveCount(0)
})

test('confirmée, la boîte quitte le sélecteur et une notification le dit', async ({ page }) => {
  await selecteur(page).click()
  await croix(page, 'facturation@agence-exemple.ch').click()
  await modale(page).getByRole('button', { name: 'Déconnecter', exact: true }).click()
  await expect(modale(page)).toHaveCount(0)
  // Court : « Boîte déconnectée », rien d'autre (Julien, 14.09.2026).
  const notification = ecran(page).locator('[data-mail-bento] [data-mail-notification]')
  await expect(notification).toHaveText('Boîte déconnectée')
  // En BAS du cadre, centrée (« il faudrait la mettre en bas ») : 24 px au-dessus de son
  // bord intérieur — le filet du cadre en plus. Mesuré une fois la capsule posée, le
  // ressort la faisant monter.
  await expect.poll(() => notification.evaluate((el) => {
    const cadre = el.closest<HTMLElement>('[data-mail-bento]')!
    const c = cadre.getBoundingClientRect()
    const n = el.getBoundingClientRect()
    const filet = parseFloat(getComputedStyle(cadre).borderBottomWidth)
    return { bas: Math.round(c.bottom - filet - n.bottom), decentre: Math.abs(Math.round((n.left + n.right) / 2 - (c.left + c.right) / 2)) }
  })).toEqual({ bas: 24, decentre: 0 })

  await selecteur(page).click()
  await expect(croix(page, 'facturation@agence-exemple.ch')).toHaveCount(0)
  await expect(croix(page, 'contact@agence-exemple.ch')).toBeVisible()
  // Elle s'efface seule.
  await page.mouse.move(0, 0)
  await expect(notification).toHaveCount(0, { timeout: 8_000 })
})

/**
 * L'écran passe à la boîte suivante.
 *
 * ⚠ Ce test ne prouve PAS la course que `confirmerDeconnexion` écarte — contrôle négatif
 * fait le 14.09.2026 : l'ancien `select-account: null` le passe aussi. Au banc, la liste
 * se relit sans latence ; en production, elle est encore en vol quand l'écran repart de
 * `null`, et l'effet de sélection reprenait la première boîte — celle qu'on venait de
 * déconnecter, si c'était elle.
 */
test('déconnecter la boîte OUVERTE fait passer l’écran à la suivante', async ({ page }) => {
  await expect(selecteur(page)).toContainText('contact@agence-exemple.ch')
  await selecteur(page).click()
  await croix(page, 'contact@agence-exemple.ch').click()
  await modale(page).getByRole('button', { name: 'Déconnecter', exact: true }).click()
  await expect(modale(page)).toHaveCount(0)
  await expect(selecteur(page)).toContainText('facturation@agence-exemple.ch')
  await selecteur(page).click()
  await expect(croix(page, 'contact@agence-exemple.ch')).toHaveCount(0)
})
