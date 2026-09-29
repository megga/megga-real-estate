/**
 * Une visite créée dans le Calendrier part vers l'agenda connecté — avec SON identifiant
 * (28.09.2026), éprouvé sur le banc `/dev/crm`.
 *
 * ⛔ Elle n'y partait JAMAIS. `persistCreate` pousse une visite vers Google ou Outlook par
 * `propagateVisit(id)` ; or `createVisit` rendait `undefined` — cache-helpers ne rend à
 * l'appelant que les colonnes de SA requête, et l'insert de `useVisits` n'en avait pas.
 * La garde statique (`insert-rend-id.spec.ts`) tient la requête ; celle-ci tient la chaîne.
 *
 * ⚠ LE BANC N'A PAS D'AGENDA CONNECTÉ : on en simule un. Avant tout script de la page, un
 * relais se glisse sous l'intercepteur du banc — le banc LIT `window.fetch` (il reçoit le
 * natif, qu'il garde pour ce qu'il laisse passer), puis l'AFFECTE (il devient le suivant du
 * relais). Le relais répond « connecté » pour `google_calendar_tokens` et relève le reste.
 */
import { test, expect, type Page } from '@playwright/test'
import { attendreRideauLeve } from './helpers/rideau'

interface Appel { url: string; corps: string; reponse: string }

const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
/** Le menu d'un sélecteur « Bien lié » / « Contact lié », porté dans `<body>`. */
const menuDuSelecteur = (page: Page) => page.locator('div:has(> div > input[placeholder="Rechercher…"])')

test('une visite créée part vers l’agenda connecté, avec son identifiant', async ({ page }) => {
  await page.addInitScript(() => {
    const natif = window.fetch.bind(window)
    let banc: typeof window.fetch = natif
    let installe = false
    const w = window as unknown as { __appels: Appel[] }
    w.__appels = []
    const relais: typeof window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/rest/v1/google_calendar_tokens')) {
        return new Response(JSON.stringify({ id: 'gct-banc', user_id: 'banc', google_email: 'agent@banc.test', sync_enabled: true, last_sync_at: null }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        })
      }
      const res = await banc(input, init)
      if ((init?.method ?? 'GET').toUpperCase() === 'POST' && (url.includes('/rest/v1/visits') || url.includes('/functions/v1/google-calendar-sync'))) {
        w.__appels.push({ url, corps: typeof init?.body === 'string' ? init.body : '', reponse: await res.clone().text() })
      }
      return res
    }
    Object.defineProperty(window, 'fetch', { configurable: true, get: () => (installe ? relais : natif), set: (f) => { banc = f; installe = true } })
  })
  await page.clock.setFixedTime(new Date('2026-09-15T08:30:00'))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/calendar')}`)
  await ecran(page).locator('button', { hasText: 'Visite —' }).first().waitFor({ timeout: 30_000 })
  await attendreRideauLeve(page)

  await ecran(page).getByRole('button', { name: 'Nouvel événement' }).click()
  const fiche = page.getByRole('dialog', { name: 'Nouvel événement' })
  await fiche.getByRole('button', { name: 'Visite', exact: true }).click()
  await fiche.getByLabel('Titre').fill('Seconde visite')
  // Une visite exige un bien ET un contact : sans eux, elle ne se crée pas.
  await fiche.getByRole('button', { name: 'Bien lié', exact: true }).click()
  await menuDuSelecteur(page).getByRole('button').first().click()
  await fiche.getByRole('button', { name: 'Contact lié', exact: true }).click()
  await menuDuSelecteur(page).getByRole('button').first().click()
  await fiche.getByRole('button', { name: 'Créer', exact: true }).click()

  const appels = () => page.evaluate(() => (window as unknown as { __appels: Appel[] }).__appels)
  await expect.poll(async () => (await appels()).filter((a) => a.corps.includes('"create_event"')).length).toBe(1)
  const tous = await appels()
  const creee = (JSON.parse(tous.find((a) => a.url.includes('/rest/v1/visits'))!.reponse) as { id: string }[])[0]
  const envoi = JSON.parse(tous.find((a) => a.corps.includes('"create_event"'))!.corps) as { visit_id: string }
  expect(envoi.visit_id).toBe(creee.id)
})
