// Pivot CRM-first (juin 2026) : la marketplace PUBLIQUE est désactivée sur
// l'app React (app.megga.ch). Les routes d'affichage des annonces redirigent
// vers la vitrine megga.ch via MarketplaceDisabledRedirect (window.location).
// market_listings + cron Flatfox + matching restent intacts (hors UI publique).
//
// Remplace l'ancien marketplace-rent.spec.ts (qui attendait l'AFFICHAGE de /rent).
// Comportement attendu = redirection externe vers megga.ch. On NE peut pas
// exiger que megga.ch réponde (domaine externe, password-gated, hors réseau de
// test) : on vérifie donc que l'app a QUITTÉ sa propre route marketplace
// (window.location pointe vers megga.ch ou la nav externe a démarré), et qu'AUCUN
// contenu marketplace SPA n'est rendu sur le baseURL local.
import { test, expect } from '@playwright/test'

const DISABLED_ROUTES = [
  '/buy',
  '/rent',
  '/search',
  '/propriete/00000000-0000-0000-0000-000000000000',
  '/listing/00000000-0000-0000-0000-000000000000',
  '/acheter',
  '/louer',
  // Ancien site marketing Property X extrait du repo (2026-06-08) — ces routes
  // redirigent désormais aussi vers la vitrine megga.ch.
  '/about',
  '/contact',
  '/sell',
  '/estimates',
  '/services',
  '/agents',
  '/agencies',
]

test.describe('Marketplace publique désactivée → vitrine megga.ch', () => {
  for (const path of DISABLED_ROUTES) {
    test(`${path} ne rend plus la marketplace (redirige hors app)`, async ({ page, baseURL }) => {
      // La redirection externe (window.location.replace vers megga.ch) interrompt
      // souvent la navigation — c'est le signal attendu, pas une erreur.
      await page.goto(path, { waitUntil: 'commit' }).catch(() => {})
      await page.waitForTimeout(2500)

      const current = page.url()
      const host = baseURL ? new URL(baseURL).host : 'localhost:5173'
      // Succès si l'app a quitté le baseURL local (redirection externe déclenchée).
      const leftApp = !current.includes(host)
      expect(
        leftApp,
        `${path} → l'app aurait dû rediriger hors de ${host} (URL actuelle: ${current})`,
      ).toBeTruthy()
    })
  }
})
