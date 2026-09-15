/**
 * Les e-mails et le Calendrier (Julien, 15.09.2026 : « on ne peut pas créer d'événements…
 * il faudrait que les mails soient aussi connectés avec le calendrier »).
 *
 * « Planifier » dans un e-mail ouvre le Calendrier dans un onglet neuf, sur la création
 * pré-remplie ; créé, l'événement garde son titre et son type (il partait en relance et
 * revenait « Tâche »), et sa bulle ramène à l'e-mail d'origine.
 */
import { test, expect, type Page } from '@playwright/test'

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
const SUJET = 'Visite de samedi · confirmation'

async function planifier(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie')}`)
  await ecran(page).locator('[role="row"]').first().waitFor({ timeout: 30_000 })
  const commande = page.locator('button[title$="/dashboard/messagerie"]').first()
  if (await commande.isVisible()) await page.locator('button', { hasText: 'Aperçu' }).first().click()
  await ecran(page).locator('[role="row"]', { hasText: SUJET }).first().click()
  await ecran(page).getByRole('button', { name: 'Planifier' }).click()
  await page.getByRole('button', { name: 'Créer', exact: true }).waitFor({ timeout: 15_000 })
}

test('« Planifier » ouvre le Calendrier, dans un onglet neuf, sur la création pré-remplie', async ({ page }) => {
  await planifier(page)
  // La Messagerie reste ouverte dans son onglet ; le Calendrier est l'onglet actif.
  await expect(page.getByRole('tab', { name: /Messagerie/ })).toHaveAttribute('aria-selected', 'false')
  await expect(page.getByRole('tab', { name: /Calendrier/ })).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator('input[value="' + SUJET + '"]')).toBeVisible()
  await expect(page.getByText(/E-mail de Zoé Exemple <zoe@exemple\.ch> du \d{2}\.\d{2}\.\d{4}/)).toBeVisible()
})

test('créé, l’événement garde son titre et son type — et sa bulle ramène à l’e-mail', async ({ page }) => {
  await planifier(page)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(ecran(page).getByText(SUJET).first()).toBeVisible()
  // ⛔ Quitter le Calendrier, puis y revenir : l'écran repart de ce que la base a gardé, pas
  // de sa copie optimiste — une création refusée en silence resterait sinon à l'écran.
  await ecran(page).getByRole('link', { name: 'Contacts' }).or(ecran(page).getByRole('button', { name: 'Contacts', exact: true })).first().click()
  await ecran(page).getByRole('link', { name: 'Calendrier' }).or(ecran(page).getByRole('button', { name: 'Calendrier', exact: true })).first().click()
  const bloc = ecran(page).getByText(SUJET).first()
  await expect(bloc).toBeVisible()
  await bloc.click()
  // Le type saisi (« Autre »), pas « Tâche » : l'événement a été relu tel qu'écrit.
  await expect(page.getByText('Autre', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: "Ouvrir l'e-mail d'origine" }).click()
  await expect(ecran(page).getByRole('heading', { name: SUJET })).toBeVisible({ timeout: 15_000 })
})
