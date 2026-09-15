/**
 * Les logos des expéditeurs dans la Messagerie (14.09.2026, Julien : « un icône relié aux
 * logos des entreprises, comme Spark »), éprouvés sur le banc `/dev/crm` : trois sociétés
 * fictives y portent un logo, les particuliers (`@exemple.ch`) n'en ont pas.
 *
 * ⚠ Ce que ce test prouve est l'AFFICHAGE — la liste, le lecteur, le repli sur les
 * initiales. La résolution (BIMI, icônes du site) et le cache sont éprouvés ailleurs, hors
 * réseau (`_shared/mail/logos.test.ts`, `tests/backend/mail-logos.spec.ts`).
 */
import { test, expect, type Page } from '@playwright/test'

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
const ligne = (page: Page, nom: string) => ecran(page).locator('[role="row"]', { hasText: nom }).first()

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie')}`)
  await ligne(page, 'Banque Exemple SA').waitFor({ timeout: 30_000 })
})

test('une société montre son logo, une particulière ses initiales', async ({ page }) => {
  const logo = ligne(page, 'Banque Exemple SA').locator('[data-logo-expediteur] img')
  await expect(logo).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/)
  // Chargée pour de vrai : un `<img>` cassé garde sa place et n'affiche rien.
  await expect.poll(() => logo.evaluate((i) => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)

  const zoe = ligne(page, 'Zoé Exemple')
  await expect(zoe.locator('[data-logo-expediteur]')).toHaveCount(0)
  await expect(zoe).toContainText('ZE')
})

test('le lecteur reprend le logo de l’expéditeur en tête du fil', async ({ page }) => {
  await ligne(page, 'Banque Exemple SA').click()
  await expect(ecran(page).getByRole('heading', { name: 'Attestation de financement' })).toBeVisible()
  await expect(ecran(page).locator('[data-logo-expediteur] img').first()).toHaveAttribute('src', /^data:image\/svg\+xml;base64,/)
})
