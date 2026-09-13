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
  await page.goto('/dev/crm')
  await page.locator('button[aria-label="Megga, Agent IA"]:visible').first().waitFor({ timeout: 30_000 })
  const aller = page.locator(`button[title$="${chemin}"]`).first()
  if (!(await aller.isVisible())) await page.locator('button', { hasText: 'Aperçu' }).first().click()
  await aller.click()
  // Replier les commandes du banc : ouvertes, elles couvrent le coin bas droit —
  // là où s'ouvrent les menus d'un bloc de fin de journée.
  await page.locator('button', { hasText: 'Aperçu' }).first().click()
  await expect(aller).toBeHidden()
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
