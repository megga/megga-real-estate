/**
 * Les menus du CLIC DROIT s'ouvrent — Messagerie et Calendrier, sur les bancs.
 *
 * ⛔ POURQUOI UN NAVIGATEUR RÉEL ET NON JSDOM. Mesuré le 13.09.2026 : aucun des
 * deux menus de la Messagerie ne s'ouvrait — ni celui d'un libellé du rail, ni
 * celui d'un fil. Le clic droit d'ouverture remontait jusqu'au `document`, où
 * l'écouteur « clic dehors » venait d'être posé, et refermait le menu dans la même
 * frame (`useFermetureMenu` en porte le correctif). Un test jsdom restait VERT sur
 * l'ancien code : il ne délivre pas l'événement comme Chromium. C'est la seule
 * preuve qui voie le défaut.
 */
import { test, expect, type Page } from '@playwright/test'

async function ouvrirEcranBancCrm(page: Page, chemin: string) {
  // Entrée DIRECTE sur l'écran (`?entree=`) : depuis le 16.09.2026 les commandes du banc
  // sont repliées en une pastille, et plus aucun bouton « Aperçu » ne les déplie. Le menu
  // replié ne couvre plus le coin bas droit, où s'ouvrent les menus d'un bloc de fin de
  // journée.
  await page.goto(`/dev/crm?entree=${encodeURIComponent(chemin)}`)
  await page.locator('button[aria-label="Megga, Agent IA"]:visible').first().waitFor({ timeout: 30_000 })
  await expect(page.getByRole('menu')).toHaveCount(0)
}

test.describe('Clic droit — Messagerie', () => {
  test('un libellé du rail ouvre Renommer · Changer la couleur · Supprimer', async ({ page }) => {
    await page.goto('/dev/messagerie')
    await page.getByText('Banques', { exact: true }).first().click({ button: 'right' })
    await expect(page.getByRole('menu')).toContainText('Changer la couleur')
  })

  test('un fil ouvre son menu (Archiver, libellés)', async ({ page }) => {
    await page.goto('/dev/messagerie')
    await page.getByText('Zoé Exemple').first().click({ button: 'right' })
    await expect(page.getByRole('menu')).toContainText('Archiver')
  })
})

test.describe('Clic droit — libellés du Calendrier', () => {
  test.beforeEach(async ({ page }) => {
    // Un mardi matin : la visite et les rappels du banc tombent dans la semaine affichée.
    await page.clock.setFixedTime(new Date('2026-09-15T08:30:00'))
    await ouvrirEcranBancCrm(page, '/dashboard/calendar')
  })

  /** La couleur du carré d'un libellé dans le rail — la référence de ce que doit peindre le bloc. */
  const couleurDuLibelle = (page: Page, nom: string) =>
    page.locator('aside button[aria-pressed]', { hasText: nom }).locator('span').first().evaluate((s) => getComputedStyle(s).backgroundColor)

  test('poser un libellé par clic droit sur un événement donne au bloc SA couleur', async ({ page }) => {
    const visite = page.locator('button', { hasText: 'Visite —' }).first()
    const attendue = await couleurDuLibelle(page, 'Personnel')
    expect(await visite.evaluate((b) => getComputedStyle(b).backgroundColor), 'point de départ : la visite porte « Urgent »').not.toBe(attendue)
    await visite.click({ button: 'right' })
    await page.getByRole('menuitemradio', { name: 'Personnel' }).click()
    // ⚠ ÉGALE à la couleur du libellé choisi, pas seulement « différente » : un
    // libellé RETIRÉ changerait aussi la couleur, et passerait une assertion lâche.
    await expect.poll(() => visite.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe(attendue)
  })

  test('le clic qui ferme le menu ne déclenche pas ce qu’il y a dessous', async ({ page }) => {
    const visite = page.locator('button', { hasText: 'Visite —' }).first()
    await visite.click({ button: 'right' })
    await expect(page.getByRole('menu')).toBeVisible()
    // Un créneau VIDE, à GAUCHE de la visite (lundi, même heure) : le menu s'ouvre
    // vers la droite du curseur, et remonte quand la visite est basse — à droite ou
    // au-dessus, le clic tombait DANS le menu. Sans voile, ce clic créait un
    // événement (ou, sur un en-tête de jour, basculait la vue sur ce jour).
    const r = (await visite.boundingBox())!
    await page.mouse.click(r.x - 30, r.y + r.height / 2)
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Créer', exact: true }), 'aucune création ne doit s’ouvrir').toHaveCount(0)
    await expect(visite, 'la vue ne doit pas avoir changé').toBeVisible()
  })

  test('un libellé se supprime par clic droit dans le rail', async ({ page }) => {
    const lignes = page.locator('aside button[aria-pressed]').filter({ hasText: /^(Urgent|Client VIP|Personnel)/ })
    await expect(lignes).toHaveCount(3)
    await page.locator('aside button[aria-pressed]', { hasText: 'Personnel' }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Supprimer' }).click()
    // ⚠ Supprimé, pas remplacé par le créateur en ligne (« Renommer » fait disparaître
    // la ligne aussi) : deux lignes restent, et aucun champ de saisie n'est ouvert.
    await expect(lignes).toHaveCount(2)
    await expect(page.getByPlaceholder('Nom du libellé')).toHaveCount(0)
  })
})

test.describe('Clic droit — Pipeline', () => {
  test.beforeEach(async ({ page }) => {
    await ouvrirEcranBancCrm(page, '/dashboard/pipeline')
  })

  /** La colonne de phase qui porte un titre donné (son en-tête est un `span` exact). */
  const colonne = (page: Page, phase: string) =>
    page.locator('div[style*="flex: 1 1 0"]').filter({ has: page.getByText(phase, { exact: true }) }).first()

  test('une carte ouvre le menu de l’affaire, et « Déplacer vers » la change de colonne', async ({ page }) => {
    await page.getByText('Julie Morand', { exact: true }).first().click({ button: 'right' })
    const menu = page.getByRole('menu').first()
    await expect(menu).toContainText('Ouvrir dans un nouvel onglet')
    await expect(menu).toContainText('Marquer conclu')
    await page.getByRole('menuitem', { name: 'Déplacer vers' }).hover()
    // La phase en cours est cochée, et ne se choisit pas.
    await expect(page.getByRole('menuitemradio', { name: 'Recherche' })).toHaveAttribute('aria-checked', 'true')
    await page.getByRole('menuitemradio', { name: 'Offre' }).click()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(colonne(page, 'Offre')).toContainText('Julie Morand')
  })

  test('le clic qui ferme le menu n’ouvre pas la carte dessous', async ({ page }) => {
    const theo = (await page.getByText('Théo Baumgartner', { exact: true }).first().boundingBox())!
    await page.getByText('Léa Martin', { exact: true }).first().click({ button: 'right' })
    await expect(page.getByRole('menu')).toBeVisible()
    await page.mouse.click(theo.x + 20, theo.y + 8)
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(page.getByText('Prospects', { exact: true }).first(), 'on reste sur le board').toBeVisible()
  })

  test('⇧ + clic droit et le champ de recherche gardent le menu du navigateur', async ({ page }) => {
    await page.getByText('Léa Martin', { exact: true }).first().click({ button: 'right', modifiers: ['Shift'] })
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.getByPlaceholder(/Rechercher/).click({ button: 'right' })
    await expect(page.getByRole('menu')).toHaveCount(0)
  })

  test('une ligne de la Timeline ouvre le même menu, et le clavier le pilote', async ({ page }) => {
    await page.getByRole('button', { name: 'Timeline' }).first().click()
    await page.getByText('Luca Bernasconi', { exact: true }).first().click({ button: 'right' })
    await expect(page.getByRole('menu').first()).toContainText('Replanifier')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('menuitem', { name: 'Ouvrir dans un nouvel onglet' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
  })

  test('la fiche d’affaire a son menu', async ({ page }) => {
    await ouvrirEcranBancCrm(page, '/dashboard/transactions/d10')
    // ⚠ La fiche d'abord : pendant son chargement, l'écran d'attente n'a pas de menu.
    const historique = page.getByText('Historique', { exact: true }).first()
    await historique.waitFor()
    await historique.click({ button: 'right' })
    const menu = page.getByRole('menu').first()
    await expect(menu).toContainText('Retour au Pipeline')
    await expect(menu).toContainText('Marquer perdu')
  })
})
