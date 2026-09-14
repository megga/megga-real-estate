/**
 * « Ajouter une boîte » (Julien, 14.09.2026 : « Bluewin, Infomaniak, on peut supprimer,
 * juste mettre IMAP »). Éprouvé au banc `/dev/crm`, dont les fixtures jouent
 * `imap_detect` et `connect_imap` : les domaines en `exemple.ch` sont reconnus chez un
 * « Hébergeur Exemple », le mot de passe « faux » est refusé par le serveur IMAP.
 *
 * ⚠ Ce que ce banc ne prouve PAS : un vrai serveur. La reconnaissance réelle (domaine, puis
 * MX) et le test de connexion réel sont éprouvés côté edge — `imap-presets.test.ts`,
 * `imap.test.ts` — et, pour de bon, par l'épreuve T3.8 du plan du lot 3, avec une vraie boîte.
 */
import { test, expect, type Page } from '@playwright/test'

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
const assistant = (page: Page) => page.getByRole('dialog', { name: 'Ajouter une boîte' })
const champ = (page: Page, nom: string) => assistant(page).getByRole('textbox', { name: nom, exact: true })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie')}`)
  await ecran(page).locator('[role="row"]').first().waitFor({ timeout: 30_000 })
  // Replier les commandes du banc : ouvertes, elles couvrent le coin bas droit.
  const commande = page.locator('button[title$="/dashboard/messagerie"]').first()
  if (await commande.isVisible()) await page.locator('button', { hasText: 'Aperçu' }).first().click()
  await expect(commande).toBeHidden()
  await ecran(page).locator('button[aria-expanded]', { hasText: '@agence-exemple.ch' }).first().click()
  await ecran(page).getByRole('menuitem', { name: 'Ajouter une boîte' }).click()
  await expect(assistant(page)).toBeVisible()
})

test('quatre choix : WhatsApp, Google, Microsoft, IMAP — plus de tuile Infomaniak ni Bluewin', async ({ page }) => {
  await expect(assistant(page).getByRole('button', { name: /WhatsApp Business/ })).toBeVisible()
  await expect(assistant(page).getByRole('button', { name: /Google Workspace/ })).toBeVisible()
  await expect(assistant(page).getByRole('button', { name: /Outlook \/ Microsoft 365/ })).toBeVisible()
  await expect(assistant(page).getByRole('button', { name: /Autre boîte \(IMAP \/ SMTP\)/ })).toBeVisible()
  await expect(assistant(page).getByRole('button', { name: /Infomaniak Mail|Bluewin \(Swisscom\)/ })).toHaveCount(0)
  await expect(assistant(page).getByRole('button')).toHaveCount(5) // les quatre lignes et la croix
  // ⛔ Le logo WhatsApp était un combiné BLANC sur fond transparent : invisible.
  const vert = await assistant(page).getByRole('button', { name: /WhatsApp Business/ }).locator('stop').first().getAttribute('stop-color')
  expect(vert?.toLowerCase()).toBe('#4ac14b')
})

test('l’adresse remplit les serveurs ; un mot de passe refusé se DIT ; le bon connecte la boîte', async ({ page }) => {
  await assistant(page).getByRole('button', { name: /Autre boîte/ }).click()
  await champ(page, 'Adresse e-mail').fill('nouvelle@agence-exemple.ch')
  await expect(assistant(page).getByText('Serveurs Hébergeur Exemple renseignés.')).toBeVisible()
  await expect(champ(page, 'Serveur IMAP')).toHaveValue('imap.hebergeur-exemple.ch')
  await expect(champ(page, 'Serveur SMTP')).toHaveValue('smtp.hebergeur-exemple.ch')
  await expect(assistant(page).getByRole('combobox', { name: 'Port IMAP' })).toHaveValue('993')
  await expect(assistant(page).getByRole('combobox', { name: 'Port SMTP' })).toHaveValue('465')

  const tester = assistant(page).getByRole('button', { name: 'Tester et connecter' })
  await expect(tester).toBeDisabled() // pas de mot de passe
  await assistant(page).getByLabel('Mot de passe', { exact: true }).fill('faux')
  await tester.click()
  await expect(assistant(page).getByRole('alert')).toHaveText(/Identifiant ou mot de passe refusé par le serveur IMAP/)

  await assistant(page).getByLabel('Mot de passe', { exact: true }).fill('le-bon')
  await tester.click()
  await expect(assistant(page).getByText('Boîte connectée')).toBeVisible()
  await expect(assistant(page).getByText('nouvelle@agence-exemple.ch')).toBeVisible()
  await assistant(page).getByRole('button', { name: 'Ouvrir la boîte' }).click()
  await expect(assistant(page)).toHaveCount(0)
  // La boîte ouverte est la nouvelle, et elle figure au sélecteur.
  await expect(ecran(page).locator('button[aria-expanded]', { hasText: 'nouvelle@agence-exemple.ch' }).first()).toBeVisible()
})

test('des serveurs TAPÉS ne sont jamais écrasés par la détection', async ({ page }) => {
  await assistant(page).getByRole('button', { name: /Autre boîte/ }).click()
  await champ(page, 'Serveur IMAP').fill('imap.mon-hebergeur.ch')
  await champ(page, 'Adresse e-mail').fill('g@agence-exemple.ch')
  await expect(assistant(page).getByText('Serveurs Hébergeur Exemple renseignés.')).toBeVisible()
  await expect(champ(page, 'Serveur IMAP')).toHaveValue('imap.mon-hebergeur.ch')
})

test('une adresse corrigée vers un fournisseur inconnu retire les serveurs devinés', async ({ page }) => {
  await assistant(page).getByRole('button', { name: /Autre boîte/ }).click()
  await champ(page, 'Adresse e-mail').fill('g@agence-exemple.ch')
  await expect(champ(page, 'Serveur IMAP')).toHaveValue('imap.hebergeur-exemple.ch')
  await champ(page, 'Adresse e-mail').fill('g@inconnu.ch')
  await expect(assistant(page).getByText('Serveurs non reconnus : saisissez ceux de votre hébergeur.')).toBeVisible()
  await expect(champ(page, 'Serveur IMAP')).toHaveValue('')
})

test('une adresse Google est renvoyée vers la connexion Google, l’adresse reportée', async ({ page }) => {
  await assistant(page).getByRole('button', { name: /Autre boîte/ }).click()
  await champ(page, 'Adresse e-mail').fill('zoe@gmail.com')
  await expect(assistant(page).getByText(/Adresse Google/)).toBeVisible()
  await assistant(page).getByRole('button', { name: 'Connecter avec Google' }).click()
  await expect(assistant(page).getByRole('button', { name: 'Autoriser' })).toBeVisible()
  await expect(assistant(page).getByRole('textbox', { name: 'Adresse e-mail' })).toHaveValue('zoe@gmail.com')
})

test('⛔ Microsoft ne propose PAS l’IMAP ; Google le propose (mot de passe d’application)', async ({ page }) => {
  await assistant(page).getByRole('button', { name: /Outlook \/ Microsoft 365/ }).click()
  await expect(assistant(page).getByRole('button', { name: 'Autoriser' })).toBeVisible()
  await expect(assistant(page).getByRole('button', { name: 'Configurer en IMAP' })).toHaveCount(0)
  await assistant(page).getByRole('button', { name: 'Retour' }).click()
  await assistant(page).getByRole('button', { name: /Google Workspace/ }).click()
  await assistant(page).getByRole('textbox', { name: 'Adresse e-mail' }).fill('zoe@gmail.com')
  await assistant(page).getByRole('button', { name: 'Configurer en IMAP' }).click()
  await expect(champ(page, 'Adresse e-mail')).toHaveValue('zoe@gmail.com')
  await expect(assistant(page).getByText("Ce fournisseur exige un mot de passe d'application.")).toBeVisible()
  // Venu de Google, on ne lui repropose pas Google.
  await expect(assistant(page).getByRole('button', { name: 'Connecter avec Google' })).toHaveCount(0)
})

test('l’échec d’un test s’efface quand l’adresse change — il parlait d’une autre boîte', async ({ page }) => {
  await assistant(page).getByRole('button', { name: /Autre boîte/ }).click()
  await champ(page, 'Adresse e-mail').fill('g@agence-exemple.ch')
  await expect(champ(page, 'Serveur IMAP')).toHaveValue('imap.hebergeur-exemple.ch')
  await assistant(page).getByLabel('Mot de passe', { exact: true }).fill('faux')
  await assistant(page).getByRole('button', { name: 'Tester et connecter' }).click()
  await expect(assistant(page).getByRole('alert')).toBeVisible()
  await champ(page, 'Adresse e-mail').fill('h@agence-exemple.ch')
  await expect(assistant(page).getByRole('alert')).toHaveCount(0)
  // Vide, l'identifiant est l'adresse : le champ le montre.
  await expect(champ(page, 'Utilisateur')).toHaveAttribute('placeholder', 'h@agence-exemple.ch')
})
