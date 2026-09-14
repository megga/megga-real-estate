/**
 * Le × du sélecteur de boîtes (Julien, 14.09.2026 : « il s'agit de la suppression — une
 * confirmation avant, puis une notification pour dire que ça a été fait »). Éprouvé au
 * banc `/dev/crm` : la modale retient le geste, Annuler et Échap ne déconnectent rien, la
 * confirmation retire la boîte du sélecteur.
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
})

test('confirmée, la boîte quitte le sélecteur', async ({ page }) => {
  await selecteur(page).click()
  await croix(page, 'facturation@agence-exemple.ch').click()
  await modale(page).getByRole('button', { name: 'Déconnecter', exact: true }).click()
  await expect(modale(page)).toHaveCount(0)
  await selecteur(page).click()
  await expect(croix(page, 'facturation@agence-exemple.ch')).toHaveCount(0)
  await expect(croix(page, 'contact@agence-exemple.ch')).toBeVisible()
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
