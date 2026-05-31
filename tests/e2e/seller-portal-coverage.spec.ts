// Couverture du portail vendeur — page unique « Votre vente » (dev mock).
// L'ancien découpage en sous-routes (/portal/visits, /offers, /documents, /messages,
// /analytics) a été remplacé par une PAGE UNIQUE. On vérifie ici que ses blocs clés
// sont rendus, sans erreur console. PortalDevWrapper injecte les mock seller data.

import { test, expect } from '@playwright/test'
import { collectConsoleErrors } from './helpers/console'

test.describe('Seller portal — page unique « Votre vente »', () => {
  test('rend les blocs clés (parcours, offres, nouvelles, agent) sans erreur console', async ({ page }) => {
    const collector = collectConsoleErrors(page)
    await page.goto('/portal')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: /où en est votre vente/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /^offres$/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /dernières nouvelles/i })).toBeVisible()
    await expect(page.getByText(/écrire sur whatsapp/i)).toBeVisible()

    expect(
      collector.errors,
      `Blocking console errors:\n${collector.errors.join('\n')}`
    ).toEqual([])
  })
})
