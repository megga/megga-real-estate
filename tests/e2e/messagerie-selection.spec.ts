/**
 * Plusieurs messages d'un coup (Julien, 15.09.2026 : « ça se passe comment si l'utilisateur
 * veut supprimer plusieurs mails d'un coup ? »).
 *
 * La pastille d'expéditeur devient une case (au survol, et partout dès qu'une ligne est
 * cochée) ; Maj+clic coche une plage ; la case « tout » coche la page. La barre des gestes
 * remplace alors celle de la recherche. Chaque geste est relu par une AUTRE requête — le
 * total du pager, le compteur d'un dossier — ce qui prouve qu'il est écrit, pas seulement
 * peint dans le cache.
 */
import { test, expect, type Page } from '@playwright/test'

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
const lignes = (page: Page) => ecran(page).locator('[role="row"]')
const cocher = (page: Page, n: number, plage = false) => lignes(page).nth(n).getByRole('checkbox').click(plage ? { modifiers: ['Shift'] } : undefined)
const barre = (page: Page) => ecran(page).getByRole('toolbar', { name: 'Gestes sur la sélection' })
const dossier = (page: Page, nom: RegExp) => ecran(page).getByRole('navigation', { name: 'Dossiers' }).getByRole('button', { name: nom })
const compte = async (page: Page, nom: RegExp) => Number(((await dossier(page, nom).innerText()).match(/\d+/) ?? ['0'])[0])
const total = async (page: Page) => Number(((await ecran(page).getByText(/ sur \d+/).first().innerText()).match(/sur (\d+)/) ?? ['', '0'])[1])

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie')}`)
  await lignes(page).first().waitFor({ timeout: 30_000 })
  // Replier les commandes du banc : ouvertes, elles couvrent le coin bas droit.
  const commande = page.locator('button[title$="/dashboard/messagerie"]').first()
  if (await commande.isVisible()) await page.locator('button', { hasText: 'Aperçu' }).first().click()
  await expect(commande).toBeHidden()
})

test('cocher une ligne fait paraître la barre ; la décocher, ou changer de dossier, la retire', async ({ page }) => {
  await cocher(page, 1)
  await expect(lignes(page).nth(1).getByRole('checkbox')).toHaveAttribute('aria-checked', 'true')
  await expect(barre(page)).toContainText('1 sélectionné')
  await cocher(page, 1)
  await expect(barre(page)).toHaveCount(0)
  await cocher(page, 2)
  await dossier(page, /^Archivé/).click()
  await expect(barre(page)).toHaveCount(0)
})

test('Maj+clic coche une plage ; la case « tout » vide la sélection, puis coche la page', async ({ page }) => {
  await cocher(page, 1)
  await cocher(page, 4, true)
  await expect(barre(page)).toContainText('4 sélectionnés')
  await ecran(page).getByRole('checkbox', { name: 'Tout désélectionner' }).click()
  await expect(barre(page)).toHaveCount(0)
  await ecran(page).getByRole('checkbox', { name: 'Tout sélectionner' }).click()
  await expect(barre(page)).toContainText(`${await lignes(page).count()} sélectionnés`)
})

test('supprimer trois messages d’un coup : une confirmation qui les nomme, puis ils quittent la liste', async ({ page }) => {
  const avant = await total(page)
  await cocher(page, 0)
  await cocher(page, 2, true)
  await barre(page).getByRole('button', { name: 'Supprimer' }).click()
  const modale = page.getByRole('dialog', { name: 'Supprimer ces 3 messages ?' })
  await expect(modale).toBeVisible()
  await expect(modale.locator('li')).toHaveCount(3)
  await modale.getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.getByText('3 messages supprimés')).toBeVisible()
  await expect.poll(() => total(page)).toBe(avant - 3)
})

test('archiver deux messages : ils rejoignent « Archivé », et son compteur suit', async ({ page }) => {
  const avant = await compte(page, /^Archivé/)
  await cocher(page, 0)
  await cocher(page, 1)
  await barre(page).getByRole('button', { name: 'Archiver' }).click()
  await expect(page.getByText('2 messages archivés')).toBeVisible()
  await expect.poll(() => compte(page, /^Archivé/)).toBe(avant + 2)
})

test('dans « Spam », la barre rend les messages à la Réception — et n’offre pas d’archiver', async ({ page }) => {
  await dossier(page, /^Spam/).click()
  await expect(lignes(page).first()).toBeVisible()
  const n = await lignes(page).count()
  await ecran(page).getByRole('checkbox', { name: 'Tout sélectionner' }).click()
  await expect(barre(page).getByRole('button', { name: 'Archiver' })).toHaveCount(0)
  await barre(page).getByRole('button', { name: "Ce n'est pas un spam" }).click()
  await expect(page.getByText(`${n} messages rendus à la boîte de réception`)).toBeVisible()
  await expect.poll(() => compte(page, /^Spam/)).toBe(0)
})
