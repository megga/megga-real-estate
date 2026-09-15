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

// ⛔ `?nouveau=1`, retiré aussitôt, rendait l'adresse d'un onglet Calendrier DÉJÀ ouvert : la
// barre l'activait, et la création s'ouvrait depuis l'écran devenu caché — Échap n'y faisait
// rien. Le premier « Planifier » ouvre ce Calendrier ; le second doit rester dans le sien.
test('⛔ un second « Planifier » : son onglet reste celui qu’on voit — la création s’y ouvre, et Échap la ferme', async ({ page }) => {
  await planifier(page)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Créer', exact: true })).toBeHidden()
  await page.getByRole('tab', { name: /Messagerie/ }).click()
  await ecran(page).getByRole('button', { name: 'Retour à la liste' }).click()
  const AUTRE = 'Attestation de financement'
  await ecran(page).locator('[role="row"]', { hasText: AUTRE }).first().click()
  await ecran(page).getByRole('button', { name: 'Planifier' }).click()
  await expect(page.getByRole('tab')).toHaveCount(3)
  await expect(page.getByRole('tab').nth(2)).toHaveAttribute('aria-selected', 'true')
  await expect(page.locator(`input[value="${AUTRE}"]`)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Créer', exact: true })).toBeHidden()
  await expect(page.getByRole('tab').nth(2)).toHaveAttribute('aria-selected', 'true')
})

// ⛔ `?fil=`, retiré aussitôt, rendait l'adresse de la Messagerie déjà ouverte : l'agent y
// atterrissait — sur sa liste, sans le fil — et l'onglet d'où il venait devenait une
// Messagerie cachée. Le test d'après ne le voyait pas : sa Messagerie d'origine montrait déjà
// le fil.
test('⛔ « Ouvrir l’e-mail d’origine » quand une Messagerie est ouverte ailleurs : le fil s’ouvre là où l’on est', async ({ page }) => {
  await planifier(page)
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await page.getByRole('tab', { name: /Messagerie/ }).click()
  await ecran(page).getByRole('button', { name: 'Retour à la liste' }).click()
  await page.getByRole('tab', { name: /Calendrier/ }).click()
  // Le BLOC de l'événement, pas son texte : la bascule d'onglet part dans une transition, et
  // l'instant d'après la Messagerie est encore l'écran montré — son texte y est aussi, dans la
  // liste, et Playwright s'accrochait à cette ligne qu'on masquait (vu au banc le 15.09.2026).
  await ecran(page).locator('button', { hasText: SUJET }).first().click()
  await page.getByRole('button', { name: "Ouvrir l'e-mail d'origine" }).click()
  await expect(ecran(page).getByRole('heading', { name: SUJET })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('tab')).toHaveCount(2)
  await expect(page.getByRole('tab').nth(1)).toHaveAttribute('aria-selected', 'true')
  // La Messagerie d'origine est restée sur sa liste.
  await page.getByRole('tab').nth(0).click()
  await expect(ecran(page).getByRole('heading', { name: SUJET })).toHaveCount(0)
})

// ⛔ La requête du fil lié se relit au retour du focus ou du réseau (au-delà d'une minute), et
// l'objet qu'elle rend change d'identité : l'effet qui l'ouvrait rouvrait alors le fil — archivé
// depuis —, fermait le composeur ouvert sur un autre, et la réponse en cours partait avec. Le
// banc ne relit pas au focus : c'est le retour du réseau qui rejoue la relecture.
test('⛔ le fil ouvert par son lien ne se rouvre pas seul : une réponse en cours ailleurs survit à la relecture', async ({ page }) => {
  await page.clock.install()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie?fil=fx-t2')}`)
  await expect(ecran(page).getByRole('heading', { name: 'Attestation de financement' })).toBeVisible({ timeout: 30_000 })
  const commande = page.locator('button[title$="/dashboard/messagerie?fil=fx-t2"]').first()
  if (await commande.isVisible()) await page.locator('button', { hasText: 'Aperçu' }).first().click()
  // Archivé (l'écran revient à la liste) : sa ligne change, la relecture rendra un AUTRE objet.
  await ecran(page).getByRole('button', { name: 'Archiver' }).click()
  await ecran(page).locator('[role="row"]', { hasText: SUJET }).first().click()
  await ecran(page).getByRole('button', { name: 'Répondre' }).click()
  await ecran(page).getByRole('textbox', { name: 'Votre réponse' }).fill('Bonjour Zoé')
  await page.clock.fastForward('02:00')
  await page.evaluate(() => { window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online')) })
  await page.clock.runFor(1_000)
  await expect(ecran(page).getByRole('heading', { name: SUJET })).toBeVisible()
  await expect(ecran(page).getByRole('textbox', { name: 'Votre réponse' })).toHaveValue('Bonjour Zoé')
})

test('créé, l’événement garde son titre, son type et son contact — et sa bulle ramène à l’e-mail', async ({ page }) => {
  await planifier(page)
  await page.evaluate(() => {
    const w = window as unknown as { __creations: string[] }
    w.__creations = []
    const suivant = window.fetch
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if ((init?.method ?? 'GET').toUpperCase() === 'POST' && url.includes('/rest/v1/calendar_events')) w.__creations.push(String(init?.body ?? ''))
      return suivant(input, init)
    }
  })
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(ecran(page).getByText(SUJET).first()).toBeVisible()
  // ⛔ Le brouillon d'un e-mail ne porte que l'IDENTIFIANT du contact : la fiche le vidait à
  // l'enregistrement, et l'événement perdait le contact du fil (revue du 15.09.2026).
  // L'événement paraît avant l'écriture (surcharge optimiste) : on attend la requête elle-même.
  const creations = () => page.evaluate(() => (window as unknown as { __creations: string[] }).__creations)
  await expect.poll(async () => (await creations()).length).toBe(1)
  expect(JSON.parse((await creations())[0])).toMatchObject({ contact_id: 'fx-c1', type: 'autre', title: SUJET })
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
