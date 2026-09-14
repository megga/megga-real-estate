/**
 * Glisser un événement du Calendrier d'un jour à l'autre (14.09.2026, Julien : « dans tous
 * les événements, tâches, on doit pouvoir switcher d'un jour à l'autre — de manière
 * fluide »), éprouvé sur le banc `/dev/crm` : un vrai glissé de souris dans Chromium.
 *
 * ⚠ LA PREUVE DE L'ENREGISTREMENT EST L'ÉCRITURE ELLE-MÊME, lue au passage de `fetch`.
 * L'écran ne la prouve pas : le Calendrier garde l'horaire déplacé dans son état local,
 * que la base l'ait pris ou non — c'est exactement ce qui cachait qu'une tâche déplacée
 * ne s'enregistrait JAMAIS (elle revenait à sa place au rechargement).
 */
import { test, expect, type Page } from '@playwright/test'

// Chaque écran d'onglet vivant garde son DOM ; on vise celui qui est MONTRÉ.
const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
const colonne = (page: Page, i: number) => ecran(page).locator(`[data-cal-col="${i}"]`)
const fantome = (page: Page) => page.locator('[data-cal-fantome]')

interface Ecriture { url: string; method: string; body: string }

/**
 * Relève les écritures PostgREST. Posé APRÈS le montage du banc, pour envelopper son
 * intercepteur : l'écriture est vue telle que le client l'émet, puis servie par le banc.
 */
async function espionnerEcritures(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __ecritures: Ecriture[] }
    w.__ecritures = []
    const suivant = window.fetch
    window.fetch = (input, init) => {
      const method = (init?.method ?? 'GET').toUpperCase()
      if (method !== 'GET' && method !== 'HEAD') {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
        w.__ecritures.push({ url, method, body: typeof init?.body === 'string' ? init.body : '' })
      }
      return suivant(input, init)
    }
  })
}
const ecritures = (page: Page, table: string) =>
  page.evaluate((t) => (window as unknown as { __ecritures: Ecriture[] }).__ecritures.filter((e) => e.url.includes(`/rest/v1/${t}?`)), table)

/** Presse au centre-haut de `depuis`, glisse par petits pas jusqu'à (x, y), sans relâcher. */
async function glisser(page: Page, depuis: { x: number; y: number; width: number; height: number }, x: number, y: number) {
  const x0 = depuis.x + depuis.width / 2
  const y0 = depuis.y + Math.min(10, depuis.height / 2)
  await page.mouse.move(x0, y0)
  await page.mouse.down()
  await page.mouse.move(x, y, { steps: 16 })
}

test.beforeEach(async ({ page }) => {
  // Un mardi matin : la visite (mar. 13:30, 45 min) et les deux tâches (mar. et mer.
  // 11:30) du banc tombent dans la semaine affichée.
  await page.clock.setFixedTime(new Date('2026-09-15T08:30:00'))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/calendar')}`)
  await ecran(page).locator('button', { hasText: 'Visite —' }).first().waitFor({ timeout: 30_000 })
  // Replier les commandes du banc : ouvertes, elles couvrent le coin bas droit.
  const commande = page.locator('button[title$="/dashboard/calendar"]').first()
  if (await commande.isVisible()) await page.locator('button', { hasText: 'Aperçu' }).first().click()
  await expect(commande).toBeHidden()
  await espionnerEcritures(page)
})

test('une visite glissée de mardi à jeudi change de jour, garde son heure, et s’enregistre', async ({ page }) => {
  const visite = ecran(page).locator('button', { hasText: 'Visite —' }).first()
  const b = (await visite.boundingBox())!
  const jeudi = (await colonne(page, 3).boundingBox())!
  const y = b.y + Math.min(10, b.height / 2)
  await glisser(page, b, jeudi.x + jeudi.width / 2, y)

  // Pendant le glissé : le fantôme annonce l'horaire, et se POSE dans la colonne de
  // jeudi. ⚠ Par sondage : il y GLISSE (transition de `left`), et une mesure prise
  // aussitôt le trouve encore entre deux colonnes — c'est la fluidité demandée.
  await expect(fantome(page)).toContainText('13:30 – 14:15')
  await expect.poll(async () => {
    const f = (await fantome(page).boundingBox())!
    return f.x >= jeudi.x && f.x + f.width <= jeudi.x + jeudi.width
  }).toBe(true)
  await page.mouse.up()

  await expect(fantome(page)).toHaveCount(0)
  await expect(colonne(page, 3).locator('button', { hasText: 'Visite —' })).toContainText('13:30')
  await expect(colonne(page, 1).locator('button', { hasText: 'Visite —' })).toHaveCount(0)
  await expect(page.getByRole('dialog'), 'le relâché ne doit pas ouvrir la bulle').toHaveCount(0)
  // La confirmation ne dit que le point d'arrivée — le jour, le mois et l'heure (Julien,
  // 14.09.2026) : ni le titre, ni « Déplacé ».
  const confirmation = page.getByText('· Jeudi 17 septembre, 13:30')
  await expect(confirmation).toBeVisible()
  await expect(confirmation).not.toContainText(/Déplacé|Visite/)

  await expect.poll(() => ecritures(page, 'visits')).toHaveLength(1)
  const [w] = await ecritures(page, 'visits')
  expect(w.method).toBe('PATCH')
  const corps = JSON.parse(w.body)
  expect(new Date(corps.scheduled_at).getTime()).toBe(new Date(2026, 8, 17, 13, 30).getTime())
  expect(corps.duration_minutes).toBe(45)
})

test('une tâche glissée au lendemain, une heure plus tard, s’enregistre — elle ne revenait jamais à sa place', async ({ page }) => {
  const tache = colonne(page, 1).locator('button', { hasText: 'Tâche' }).first()
  const b = (await tache.boundingBox())!
  const mercredi = (await colonne(page, 2).boundingBox())!
  const heure = mercredi.height / 24
  await glisser(page, b, mercredi.x + mercredi.width / 2, b.y + Math.min(10, b.height / 2) + heure)
  // Un bloc court : l'heure d'arrivée ET le titre — la plage entière le tronquait en « T… ».
  await expect(fantome(page)).toContainText('12:30')
  await expect(fantome(page)).toContainText('Tâche')
  await page.mouse.up()

  await expect(colonne(page, 1).locator('button', { hasText: 'Tâche' })).toHaveCount(0)
  await expect(colonne(page, 2).locator('button', { hasText: 'Tâche' })).toHaveCount(2)

  await expect.poll(() => ecritures(page, 'reminders')).toHaveLength(1)
  const corps = JSON.parse((await ecritures(page, 'reminders'))[0].body)
  expect(new Date(corps.trigger_at).getTime()).toBe(new Date(2026, 8, 16, 12, 30).getTime())
  // Rouverte : `automation-engine` ne déclenche que les `pending`.
  expect(corps.status).toBe('pending')
})

test('Échap annule le glissé : rien ne bouge, rien ne s’écrit, aucune bulle ne s’ouvre', async ({ page }) => {
  const visite = ecran(page).locator('button', { hasText: 'Visite —' }).first()
  const b = (await visite.boundingBox())!
  const vendredi = (await colonne(page, 4).boundingBox())!
  await glisser(page, b, vendredi.x + vendredi.width / 2, b.y + 10)
  await expect(fantome(page)).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(fantome(page)).toHaveCount(0)
  await page.mouse.up()

  await expect(colonne(page, 1).locator('button', { hasText: 'Visite —' })).toHaveCount(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await ecritures(page, 'visits')).toHaveLength(0)
})

test('un clic sans glissé ouvre toujours la bulle', async ({ page }) => {
  await ecran(page).locator('button', { hasText: 'Visite —' }).first().click()
  await expect(page.getByRole('dialog', { name: /Visite —/ })).toBeVisible()
  expect(await ecritures(page, 'visits')).toHaveLength(0)
})

test('en vue Mois, une pastille glissée sur une autre case change de jour — la case visée s’allume', async ({ page }) => {
  await ecran(page).getByRole('button', { name: 'Mois', exact: true }).click()
  const caseDu = (jour: number) => ecran(page).locator('[data-cal-cell]').filter({ has: page.locator('button', { hasText: new RegExp(`^${jour}$`) }) })
  const pastille = caseDu(15).locator('button', { hasText: 'Visite —' })
  const b = (await pastille.boundingBox())!
  const cible = (await caseDu(18).boundingBox())!
  await glisser(page, b, cible.x + cible.width / 2, cible.y + cible.height / 2)

  await expect(fantome(page)).toContainText('Visite —')
  await expect.poll(() => caseDu(18).evaluate((c) => getComputedStyle(c).boxShadow)).toContain('inset')
  await page.mouse.up()

  await expect(caseDu(18).locator('button', { hasText: 'Visite —' })).toContainText('13:30')
  await expect(caseDu(15).locator('button', { hasText: 'Visite —' })).toHaveCount(0)
  await expect.poll(() => ecritures(page, 'visits')).toHaveLength(1)
  const corps = JSON.parse((await ecritures(page, 'visits'))[0].body)
  expect(new Date(corps.scheduled_at).getTime()).toBe(new Date(2026, 8, 18, 13, 30).getTime())
})
