/**
 * Le voile des modales de la Messagerie épouse le CADRE — le pager —, pas l'écran
 * (Julien, 14.09.2026 : « le flou doit épouser le pager, et non pas partout dans
 * l'écran » ; puis « quand on lit une pièce jointe, pareil »). Éprouvé sur le banc
 * `/dev/crm`, sur la rédaction d'un message et sur l'aperçu d'une pièce jointe.
 *
 * ⚠ Mesuré, pas supposé : le voile est un enfant du cadre, il en couvre la boîte (au
 * filet près), il en porte le rayon, il floute — et la barre latérale, sous le même
 * geste, reste hors de lui.
 */
import { test, expect, type Page } from '@playwright/test'

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')

async function voileEpouseLeCadre(page: Page) {
  const m = await ecran(page).locator('[data-mail-bento]').evaluate((cadre) => {
    const voile = cadre.querySelector<HTMLElement>(':scope > [data-mail-voile]')
    if (!voile) return null
    const c = cadre.getBoundingClientRect()
    const v = voile.getBoundingClientRect()
    // Un point franchement DANS la barre latérale, à mi-hauteur du cadre.
    const nav = document.elementFromPoint(Math.max(4, c.left - 40), c.top + c.height / 2)
    return {
      ecarts: [v.left - c.left, v.top - c.top, c.right - v.right, c.bottom - v.bottom].map((x) => Math.round(x)),
      rayonCadre: getComputedStyle(cadre).borderTopLeftRadius,
      rayonVoile: getComputedStyle(voile).borderTopLeftRadius,
      flou: getComputedStyle(voile).backdropFilter,
      barreSousLeVoile: !!nav?.closest('[data-mail-voile]'),
    }
  })
  expect(m, 'le voile doit vivre DANS le cadre').not.toBeNull()
  // Le voile se pose à l'intérieur du filet du cadre : 1 px au plus de chaque côté.
  for (const e of m!.ecarts) expect(Math.abs(e)).toBeLessThanOrEqual(1)
  expect(m!.rayonVoile).toBe(m!.rayonCadre)
  expect(m!.flou).toMatch(/blur/)
  expect(m!.barreSousLeVoile, 'la barre latérale reste hors du voile').toBe(false)
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie')}`)
  await ecran(page).locator('[role="row"]').first().waitFor({ timeout: 30_000 })
})

test('« Nouveau message » : le voile épouse le pager, la barre latérale reste nette', async ({ page }) => {
  await ecran(page).getByRole('button', { name: 'Nouveau message' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Nouveau message' })).toBeVisible()
  await voileEpouseLeCadre(page)
})

test('l’aperçu d’une pièce jointe : même voile, même cadre', async ({ page }) => {
  await ecran(page).locator('[role="row"]', { hasText: 'Banque Exemple SA' }).first().click()
  await ecran(page).getByRole('button', { name: /attestation-exemple\.pdf/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Aperçu de la pièce' })).toBeVisible()
  await voileEpouseLeCadre(page)
})
