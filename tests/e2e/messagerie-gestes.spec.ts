/**
 * Les gestes sur un fil TIENNENT au banc (Julien, 14.09.2026 : « l'étoile ne reste pas, et
 * c'est pareil pour les autres »). L'écran les montrait (mise à jour optimiste), puis la
 * liste se relisait dans des fixtures inchangées et les reprenait. Les fixtures gardent
 * désormais les gestes le temps de la page (`fxAgir`), comme la base en production.
 *
 * ⚠ Chaque test relit le fil par une AUTRE requête (un autre dossier, le compteur du rail) :
 * c'est ce qui prouve que le geste est écrit, et pas seulement peint dans le cache.
 */
import { test, expect, type Page } from '@playwright/test'

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
const VISITE = 'Visite de samedi · confirmation'
const ligne = (page: Page) => ecran(page).locator('[role="row"]', { hasText: VISITE }).first()
const dossier = (page: Page, nom: RegExp) => ecran(page).getByRole('navigation', { name: 'Dossiers' }).getByRole('button', { name: nom })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie')}`)
  await ecran(page).locator('[role="row"]').first().waitFor({ timeout: 30_000 })
  // Replier les commandes du banc : ouvertes, elles couvrent le coin bas droit.
  const commande = page.locator('button[title$="/dashboard/messagerie"]').first()
  if (await commande.isVisible()) await page.locator('button', { hasText: 'Aperçu' }).first().click()
  await expect(commande).toBeHidden()
})

test('une étoile posée reste posée, et le fil rejoint « Suivis »', async ({ page }) => {
  await ligne(page).getByRole('button', { name: 'Suivre', exact: true }).click()
  await expect(ligne(page).getByRole('button', { name: 'Ne plus suivre' })).toHaveAttribute('aria-pressed', 'true')
  await dossier(page, /^Suivis/).click()
  await expect(ligne(page)).toBeVisible()
  await dossier(page, /^Boîte de réception/).click()
  await expect(ligne(page).getByRole('button', { name: 'Ne plus suivre' })).toHaveAttribute('aria-pressed', 'true')
  // Et l'inverse tient aussi.
  await ligne(page).getByRole('button', { name: 'Ne plus suivre' }).click()
  await dossier(page, /^Suivis/).click()
  await expect(ecran(page).locator('[role="row"]', { hasText: VISITE })).toHaveCount(0)
})

test('archivé depuis le menu, le fil quitte la Réception et rejoint « Archivé »', async ({ page }) => {
  await ligne(page).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Archiver' }).click()
  await expect(ecran(page).locator('[role="row"]', { hasText: VISITE })).toHaveCount(0)
  await dossier(page, /^Archivé/).click()
  await expect(ligne(page)).toBeVisible()
})

test('marqué lu, le fil le reste — et le compteur de la Réception avec lui', async ({ page }) => {
  const compte = async () => Number(((await dossier(page, /^Boîte de réception/).innerText()).match(/\d+/) ?? ['0'])[0])
  const avant = await compte()
  await ligne(page).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Marquer comme lu' }).click()
  await expect.poll(compte).toBe(avant - 1)
  await dossier(page, /^Suivis/).click()
  await dossier(page, /^Boîte de réception/).click()
  await expect.poll(compte).toBe(avant - 1)
})
