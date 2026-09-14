/**
 * Le dossier « Spam » au banc (Julien, 14.09.2026 : « tu as oublié les spams »).
 *
 * Ce que ces tests tiennent, relu chaque fois par une AUTRE requête (un autre dossier, le
 * compteur du rail) : un fil signalé quitte la Réception et rejoint « Spam » ; rendu, il
 * revient ; le spam n'apparaît dans aucun autre dossier ; et le lecteur n'offre sur un spam
 * ni « Répondre » ni le rapprochement d'une adresse.
 */
import { test, expect, type Page } from '@playwright/test'

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
const VISITE = 'Visite de samedi · confirmation'
const COLIS = 'Votre colis est en attente de livraison'
const lignes = (page: Page, texte: string) => ecran(page).locator('[role="row"]', { hasText: texte })
const dossier = (page: Page, nom: RegExp) => ecran(page).getByRole('navigation', { name: 'Dossiers' }).getByRole('button', { name: nom })
const compteSpam = async (page: Page) => Number(((await dossier(page, /^Spam/).innerText()).match(/\d+/) ?? ['0'])[0])

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie')}`)
  await ecran(page).locator('[role="row"]').first().waitFor({ timeout: 30_000 })
  // Replier les commandes du banc : ouvertes, elles couvrent le coin bas droit.
  const commande = page.locator('button[title$="/dashboard/messagerie"]').first()
  if (await commande.isVisible()) await page.locator('button', { hasText: 'Aperçu' }).first().click()
  await expect(commande).toBeHidden()
})

test('le spam n’apparaît que dans « Spam » — ni en Réception, ni en Archivé, ni dans Suivis', async ({ page }) => {
  await expect(lignes(page, COLIS)).toHaveCount(0)
  for (const nom of [/^Archivé/, /^Suivis/, /^Envoyés/]) {
    await dossier(page, nom).click()
    await expect(ecran(page).locator('[role="row"]').first()).toBeVisible()
    await expect(lignes(page, COLIS)).toHaveCount(0)
  }
  await dossier(page, /^Spam/).click()
  await expect(lignes(page, COLIS)).toBeVisible()
  expect(await ecran(page).locator('[role="row"]').count()).toBe(await compteSpam(page))
  // Pas d'étoile sur un spam : « Suivis » l'exclut, le geste semblerait sans effet.
  await expect(lignes(page, COLIS).getByRole('button', { name: 'Suivre', exact: true })).toHaveCount(0)
})

test('signalé depuis le menu : le fil quitte la Réception, rejoint « Spam », et le rail le compte', async ({ page }) => {
  const avant = await compteSpam(page)
  await lignes(page, VISITE).first().click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Signaler comme spam' }).click()
  await expect(page.getByText('Signalé comme spam')).toBeVisible()
  await expect(lignes(page, VISITE)).toHaveCount(0)
  await expect.poll(() => compteSpam(page)).toBe(avant + 1)
  await dossier(page, /^Spam/).click()
  await expect(lignes(page, VISITE)).toBeVisible()
  // Au spam, le menu n'offre plus ni « Suivre » ni « Archiver » ni les libellés.
  await lignes(page, VISITE).first().click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'Archiver' })).toHaveCount(0)
  await expect(page.getByRole('menuitem', { name: 'Suivre' })).toHaveCount(0)
  // « Ce n'est pas un spam » : il revient en Réception.
  await page.getByRole('menuitem', { name: "Ce n'est pas un spam" }).click()
  await expect(page.getByText('Rendu à la boîte de réception')).toBeVisible()
  await expect(lignes(page, VISITE)).toHaveCount(0)
  await expect.poll(() => compteSpam(page)).toBe(avant)
  await dossier(page, /^Boîte de réception/).click()
  await expect(lignes(page, VISITE)).toBeVisible()
})

test('ouvert, un spam se lit sans « Répondre » ni rapprochement — et se rend à la Réception d’un geste', async ({ page }) => {
  await dossier(page, /^Spam/).click()
  await lignes(page, COLIS).first().click()
  await expect(ecran(page).getByText('Dans le spam : ce message n\'est rattaché à aucun contact.')).toBeVisible()
  await expect(ecran(page).getByRole('button', { name: 'Répondre' })).toHaveCount(0)
  await expect(ecran(page).getByRole('button', { name: 'Rapprocher' })).toHaveCount(0)
  // Deux « Ce n'est pas un spam » : le bandeau et la barre d'actions. Celui de la barre.
  await ecran(page).getByRole('button', { name: "Ce n'est pas un spam" }).last().click()
  await expect(page.getByText('Rendu à la boîte de réception')).toBeVisible()
  await dossier(page, /^Boîte de réception/).click()
  await expect(lignes(page, COLIS)).toBeVisible()
})
