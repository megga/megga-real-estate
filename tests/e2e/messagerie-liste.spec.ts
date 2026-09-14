/**
 * La ligne de la liste ne se peint plus sur elle-même (constaté au banc le 14.09.2026).
 *
 * L'objet ne rétrécissait jamais : dans une liste étroite ou sur un long objet, il débordait
 * de sa cellule sur la colonne de la date, et les deux textes se superposaient. Puis, rendus
 * en deux boîtes flex, l'objet et l'aperçu s'abrégeaient ENSEMBLE — l'objet cédait une
 * fraction de pixel, assez pour ses points de suspension. Ils forment désormais une seule
 * ligne de texte : l'objet en entier d'abord, l'aperçu coupé à la fin.
 */
import { test, expect, type Page } from '@playwright/test'

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')

async function ouvrir(page: Page, largeur: number) {
  await page.setViewportSize({ width: largeur, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie')}`)
  await ecran(page).locator('[role="row"]').first().waitFor({ timeout: 30_000 })
}

/** Pour chaque ligne : combien le texte de la cellule « objet » dépasse sa cellule, et si l'objet tient en entier. */
const mesurer = (page: Page) => ecran(page).locator('[role="row"]').evaluateAll((rows) => rows.map((r) => {
  const cellule = r.children[2] as HTMLElement
  const texte = cellule.lastElementChild as HTMLElement
  const objet = texte.firstElementChild as HTMLElement
  return {
    depasse: Math.round(texte.getBoundingClientRect().right - cellule.getBoundingClientRect().right),
    objetEntier: objet.getBoundingClientRect().right <= texte.getBoundingClientRect().right + 0.5,
  }
}))

test('une liste étroite ne superpose jamais l’objet et la date', async ({ page }) => {
  await ouvrir(page, 1024)
  const lignes = await mesurer(page)
  expect(lignes.length).toBeGreaterThan(5)
  expect(lignes.filter((l) => l.depasse > 0)).toEqual([])
})

test('à 1280 px, l’objet s’affiche EN ENTIER ; c’est l’aperçu qui s’abrège', async ({ page }) => {
  await ouvrir(page, 1280)
  const lignes = await mesurer(page)
  expect(lignes.filter((l) => l.depasse > 0)).toEqual([])
  // Les objets du banc tiennent tous dans la colonne à cette largeur : aucun ne doit être coupé.
  expect(lignes.filter((l) => !l.objetEntier)).toEqual([])
})
