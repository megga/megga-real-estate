import { test, expect, type Page } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

/**
 * Le Pipeline à cinq phases (refonte du 27.09.2026) sous le contournement d'auth : sa
 * structure, son état vide, sa console.
 *
 * ⛔ Ce fichier attendait les HUIT colonnes d'étape de l'ancien board et son « Glisser un deal
 * ici » : l'un et l'autre sont partis avec lui.
 *
 * ⚠ LE GLISSER N'EST PAS ÉPROUVÉ ICI. Sous le contournement, l'agence fictive porte l'id
 * `dev-mock-agency`, que le serveur de paille refuse comme la production (400, uuid invalide) :
 * `usePipelineScreen` échoue, et le board s'affiche sans affaire, bandeau d'erreur en tête. Les
 * gestes sur des affaires se jouent sur le banc `/dev/crm`, qui a ses données
 * (`menus-clic-droit.spec.ts` › Pipeline).
 */

/**
 * Une agence SANS affaire, que la paille ne sait pas rendre (elle refuse l'agence fictive) :
 * chaque lecture rend une liste vide, et la lecture d'un objet unique « aucune ligne » (406).
 */
async function agenceSansAffaire(page: Page) {
  await page.route('**/rest/v1/**', (route) => {
    const req = route.request()
    if (!['GET', 'HEAD'].includes(req.method()) || req.url().includes('/rest/v1/rpc/')) return route.fallback()
    if ((req.headers()['accept'] ?? '').includes('vnd.pgrst.object')) {
      return route.fulfill({
        status: 406,
        json: { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' },
      })
    }
    return route.fulfill({ status: 200, json: [], headers: { 'content-range': '*/0', 'access-control-expose-headers': '*' } })
  })
}

test.describe('Agent pipeline — structure & empty state', () => {
  test('les cinq phases, de gauche à droite', async ({ page }) => {
    await page.goto('/dashboard/pipeline')
    await page.waitForLoadState('networkidle')

    const x: number[] = []
    for (const nom of ['Prospects', 'Recherche', 'Visites', 'Offre', 'Signature']) {
      const entete = page.getByText(nom, { exact: true }).first()
      await expect(entete, `phase « ${nom} »`).toBeVisible()
      x.push((await entete.boundingBox())?.x ?? -1)
    }
    expect(x).toEqual([...x].sort((a, b) => a - b))
    // « Signature » ne se crée pas à la main : on y arrive par une offre acceptée.
    await expect(page.getByRole('button', { name: 'Ajouter', exact: true })).toHaveCount(4)
  })

  test('sans aucune affaire : l’état vide, et « Nouveau deal » qui ouvre la création', async ({ page }) => {
    await agenceSansAffaire(page)
    await page.goto('/dashboard/pipeline')

    await expect(page.getByText('Aucun deal en cours')).toBeVisible()
    // Deux « Nouveau deal » : celui de l'en-tête, et l'action de l'état vide.
    const nouveau = page.getByRole('button', { name: 'Nouveau deal', exact: true })
    await expect(nouveau).toHaveCount(2)
    await nouveau.last().click()
    await expect(page.getByRole('dialog', { name: 'Nouveau deal' })).toBeVisible()
  })

  test('no blocking console errors on pipeline load', async ({ page }) => {
    const collector = collectConsoleErrors(page)
    await page.goto('/dashboard/pipeline')
    await page.waitForLoadState('networkidle')

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
