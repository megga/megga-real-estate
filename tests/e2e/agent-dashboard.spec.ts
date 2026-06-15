import { test, expect, type Page } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

// La refonte « Aujourd'hui » (juin 2026) remplace l'écran KPI simple par un
// cockpit data-heavy (colonne Focus, Relances IA, Objectif, Pipeline, Agenda +
// page Catalogue montée dans le pager). Deux conséquences pour ce smoke :
//   1. `networkidle` n'est plus atteignable (nombreuses requêtes Supabase +
//      modules Vite dev en parallèle gardent le réseau actif) — même problème
//      déjà rencontré sur la marketplace publique. On attend donc le RENDU d'un
//      élément du cockpit plutôt que l'inactivité réseau.
//   2. Le `<h1>` « Aujourd'hui » a disparu (le libellé est passé dans l'onglet
//      de navigation) : le h1 de la page est désormais le message de bienvenue
//      « Bonjour … ».
const greeting = (page: Page) => page.getByRole('heading', { name: /bonjour/i, level: 1 })

test.describe('Agent dashboard', () => {
  test('renders the Today screen for a logged-in agent', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })

    await expect(page).toHaveURL(/\/dashboard(\?|$)/)
    await expect(greeting(page)).toBeVisible({ timeout: 20000 })
  })

  test('no blocking console errors on dashboard load', async ({ page }) => {
    const collector = collectConsoleErrors(page)
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
    await expect(greeting(page)).toBeVisible({ timeout: 20000 })
    // Laisse les requêtes data du cockpit émettre d'éventuelles erreurs avant
    // de vérifier (networkidle n'étant pas une option ici).
    await page.waitForTimeout(1500)

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
