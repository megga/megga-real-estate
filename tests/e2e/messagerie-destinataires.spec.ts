/**
 * Les destinataires du composeur, « comme Google » (Julien, 14.09.2026) : une adresse
 * validée devient une capsule, on en pose plusieurs, les contacts se proposent, Cc et Cci
 * s'ouvrent depuis « À », et la boîte d'envoi se choisit dans un déroulé. Éprouvé sur le
 * banc `/dev/crm`, jusqu'à la charge utile que reçoit `mail-send`.
 *
 * ⚠ La charge utile se lit sur `window.fetch`, pas par `page.route` : le banc répond aux
 * edges DANS la page (`bancSupabase.ts`), aucune requête n'atteint le réseau.
 */
import { test, expect, type Page } from '@playwright/test'

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
const dialogue = (page: Page) => page.getByRole('dialog', { name: 'Nouveau message' })
const champA = (page: Page) => dialogue(page).getByRole('combobox', { name: 'Destinataire', exact: true })
const capsules = (page: Page) => dialogue(page).locator('[data-capsule]')

/** Enregistre chaque appel à `mail-send` dans `window.__envois`. */
async function ecouterEnvois(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __envois: unknown[] }
    w.__envois = []
    const avant = window.fetch
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/functions/v1/mail-send')) w.__envois.push(JSON.parse(String(init?.body)))
      return avant(input, init)
    }
  })
}
const envois = (page: Page) => page.evaluate(() => (window as unknown as { __envois: Record<string, unknown>[] }).__envois)

/** Colle un texte dans le champ, comme le ferait ⌘V. */
const coller = (page: Page, texte: string) => champA(page).evaluate((el, t) => {
  const dt = new DataTransfer()
  dt.setData('text/plain', t)
  el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
}, texte)

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/messagerie')}`)
  await ecran(page).locator('[role="row"]').first().waitFor({ timeout: 30_000 })
  // Replier les commandes du banc : ouvertes, elles couvrent le coin bas droit — là où
  // tombent « Envoyer » et « Transférer ».
  const commande = page.locator('button[title$="/dashboard/messagerie"]').first()
  if (await commande.isVisible()) await page.locator('button', { hasText: 'Aperçu' }).first().click()
  await expect(commande).toBeHidden()
})

test.describe('« Nouveau message »', () => {
  test.beforeEach(async ({ page }) => {
    await ecran(page).getByRole('button', { name: 'Nouveau message' }).first().click()
    await expect(dialogue(page)).toBeVisible()
  })

  test('le curseur est dans « À », et chaque adresse validée devient une capsule', async ({ page }) => {
    const a = champA(page)
    // ⛔ Le piège de focus envoyait le curseur sur la croix « Fermer ».
    await expect(a).toBeFocused()
    await a.fill('credit@banque-exemple.ch')
    await a.press('Enter')
    await a.pressSequentially('zoe@exemple.ch,')
    await a.pressSequentially('theo.b@example.ch ')
    await coller(page, 'salome@exemple.ch\nregie@regie-exemple.ch')
    // Une adresse déjà là ne se double pas, casse ignorée.
    await a.fill('ZOE@exemple.ch')
    await a.press('Enter')
    await expect(capsules(page)).toHaveCount(5)
    await expect(a).toHaveValue('')
    await expect(capsules(page).first()).toHaveAttribute('title', 'credit@banque-exemple.ch')
    // La capsule d'une société porte son logo ; celle d'un particulier, ses initiales.
    await expect(capsules(page).first().locator('[data-logo-expediteur]')).toHaveCount(1)
    await expect(capsules(page).nth(1).locator('[data-logo-expediteur]')).toHaveCount(0)
  })

  test('retour arrière : le premier sélectionne la dernière capsule, le second la retire', async ({ page }) => {
    const a = champA(page)
    await a.pressSequentially('zoe@exemple.ch,camille@exemple.ch,')
    await expect(capsules(page)).toHaveCount(2)
    await a.press('Backspace')
    await expect(capsules(page)).toHaveCount(2)
    await expect(capsules(page).last()).toHaveAttribute('data-armee', '')
    await a.press('Backspace')
    await expect(capsules(page)).toHaveCount(1)
    await expect(capsules(page).first()).toHaveAttribute('title', 'zoe@exemple.ch')
  })

  test('une saisie qui n’est pas une adresse : capsule en alerte, « Envoyer » éteint, double-clic pour corriger', async ({ page }) => {
    const a = champA(page)
    const envoyer = dialogue(page).getByRole('button', { name: 'Envoyer' })
    const avis = dialogue(page).getByText('Une adresse est à corriger')
    await dialogue(page).getByRole('textbox', { name: 'Objet' }).fill('Dossier de financement')
    // Un nom en cours de frappe est une recherche, pas une adresse fausse : pas d'avis.
    await a.pressSequentially('pas-une-adresse')
    await expect(avis).toHaveCount(0)
    await expect(envoyer).toBeDisabled()
    await a.press('Enter')
    await expect(capsules(page).first()).toHaveAttribute('data-invalide', '')
    await expect(avis).toBeVisible()
    await expect(envoyer).toBeDisabled()
    await capsules(page).first().dblclick()
    await expect(capsules(page)).toHaveCount(0)
    await expect(a).toHaveValue('pas-une-adresse')
    await a.fill('credit@banque-exemple.ch')
    // Tapée, pas encore validée : l'adresse suffit déjà à allumer « Envoyer ».
    await expect(envoyer).toBeEnabled()
    await expect(avis).toHaveCount(0)
  })

  test('les contacts se proposent pendant la frappe, et Entrée prend le premier', async ({ page }) => {
    const a = champA(page)
    await a.pressSequentially('roch')
    const liste = dialogue(page).getByRole('listbox', { name: 'Contacts suggérés' })
    await expect(liste.getByRole('option', { name: /Camille Rochat/ })).toBeVisible()
    await expect(a).toHaveAttribute('aria-expanded', 'true')
    await a.press('Enter')
    await expect(capsules(page)).toHaveCount(1)
    await expect(capsules(page).first()).toHaveAttribute('title', 'Camille Rochat <camille.rochat@example.ch>')
    await expect(capsules(page).first()).toContainText('Camille Rochat')
  })

  /**
   * Tab prend la suggestion ET quitte le champ : la sortie ne doit pas reposer le texte
   * tapé (« roch ») en capsule à côté du contact choisi.
   */
  test('Tab prend la suggestion, sans capsule en trop à la sortie du champ', async ({ page }) => {
    const a = champA(page)
    await a.pressSequentially('roch')
    await expect(dialogue(page).getByRole('option', { name: /Camille Rochat/ })).toBeVisible()
    await a.press('Tab')
    await expect(a).not.toBeFocused()
    await expect(capsules(page)).toHaveCount(1)
    await expect(capsules(page).first()).toContainText('Camille Rochat')
  })

  /** ⛔ Mesuré au banc : « théo », puis « pas-une-adresse » + Entrée posait Théo Baumgartner. */
  test('Entrée ne prend jamais la suggestion d’une frappe précédente', async ({ page }) => {
    const a = champA(page)
    await a.pressSequentially('théo')
    await expect(dialogue(page).getByRole('option', { name: /Théo Baumgartner/ })).toBeVisible()
    await a.fill('pas-une-adresse')
    await a.press('Enter')
    await expect(capsules(page)).toHaveCount(1)
    await expect(capsules(page).first()).toHaveAttribute('data-invalide', '')
    await expect(capsules(page).first()).toContainText('pas-une-adresse')
  })

  test('Cc, Cci et la boîte d’envoi — jusqu’à la charge utile de mail-send', async ({ page }) => {
    await ecouterEnvois(page)
    await champA(page).fill('zoe@exemple.ch')
    await champA(page).press('Enter')

    await dialogue(page).getByRole('button', { name: 'Cc', exact: true }).click()
    const cc = dialogue(page).getByRole('combobox', { name: 'Destinataires en copie', exact: true })
    await expect(cc).toBeFocused()
    await cc.fill('etude@notaire-exemple.ch')
    await cc.press('Enter')
    await dialogue(page).getByRole('button', { name: 'Cci', exact: true }).click()
    const cci = dialogue(page).getByRole('combobox', { name: 'Destinataires en copie cachée' })
    await expect(cci).toBeFocused()
    // Laissée tapée, sans Entrée : elle doit partir quand même.
    await cci.fill('archive@agence-exemple.ch')

    // « De » : les trois boîtes du banc ; la troisième ne peut pas envoyer et dit pourquoi.
    const de = dialogue(page).getByRole('combobox', { name: 'De', exact: true })
    await expect(de).toContainText('contact@agence-exemple.ch')
    await de.click()
    const boites = dialogue(page).getByRole('listbox', { name: 'De', exact: true }).getByRole('option')
    await expect(boites).toHaveCount(3)
    await expect(boites.nth(2)).toHaveAttribute('aria-disabled', 'true')
    await expect(boites.nth(2)).toContainText('Autorisation à renouveler')
    await boites.filter({ hasText: 'facturation@agence-exemple.ch' }).click()
    await expect(de).toContainText('facturation@agence-exemple.ch')

    await dialogue(page).getByRole('textbox', { name: 'Objet' }).fill('Dossier')
    await dialogue(page).getByRole('button', { name: 'Envoyer' }).click()
    await expect(dialogue(page)).toHaveCount(0)

    const [envoi] = await envois(page)
    expect(envoi).toMatchObject({
      kind: 'new', account_id: 'fx-a2', subject: 'Dossier',
      to: [{ name: null, email: 'zoe@exemple.ch' }],
      cc: [{ name: null, email: 'etude@notaire-exemple.ch' }],
      bcc: [{ name: null, email: 'archive@agence-exemple.ch' }],
    })
    // Le message rejoint les « Envoyés » de la boîte qui l'a envoyé.
    await expect(ecran(page).locator('button[aria-expanded]').filter({ hasText: 'facturation@agence-exemple.ch' }).first()).toBeVisible()
  })
})

test('le transfert prend aussi des capsules', async ({ page }) => {
  await ecouterEnvois(page)
  await ecran(page).locator('[role="row"]', { hasText: 'Banque Exemple SA' }).first().click()
  await ecran(page).getByRole('button', { name: 'Transférer' }).first().click()
  const a = ecran(page).getByRole('combobox', { name: 'Destinataire', exact: true })
  await expect(a).toBeFocused()
  await a.pressSequentially('etude@notaire-exemple.ch,')
  await expect(ecran(page).locator('[data-capsule]')).toHaveCount(1)
  const composeur = ecran(page).locator('div', { has: page.getByRole('textbox', { name: 'Note facultative' }) }).last()
  await composeur.getByRole('button', { name: 'Transférer' }).click()
  await expect.poll(async () => (await envois(page)).length).toBe(1)
  const [envoi] = await envois(page)
  expect(envoi).toMatchObject({ kind: 'forward', to: [{ name: null, email: 'etude@notaire-exemple.ch' }] })
})
