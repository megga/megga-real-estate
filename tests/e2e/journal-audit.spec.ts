/**
 * Le journal d'audit refait (14.09.2026, Julien : « inclus tout cela dans le pager ; que
 * l'historique soit organisé et épuré », puis « les exports, on n'en a pas besoin »),
 * éprouvé sur le banc `/dev/crm`, dont les fixtures portent des événements sur un mois,
 * une rafale de trois correspondances, une alerte et un critique.
 */
import { test, expect, type Page } from '@playwright/test'

// Chaque écran d'onglet vivant garde son DOM ; on vise celui qui est MONTRÉ.
const ecran = (page: Page) => page.locator('[data-onglet]:not([aria-hidden="true"])')
const lignes = (page: Page) => ecran(page).locator('section button[aria-expanded]')

/**
 * ⚠ Les photos du banc viennent d'Unsplash : servies ici par une image locale, AVANT la
 * navigation — une photo qui échoue retombe sur le glyphe, et le test la croirait absente.
 */
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route('**/images.unsplash.com/**', (r) => r.fulfill({ body: PNG, contentType: 'image/png' }))
  await page.goto(`/dev/crm?entree=${encodeURIComponent('/dashboard/audit')}`)
  await ecran(page).getByRole('heading', { name: /Journal d.audit/ }).waitFor({ timeout: 30_000 })
  await expect(lignes(page).first()).toBeVisible()
})

test('le journal vit dans le cadre des pages sœurs : la page ne défile plus, l’historique si', async ({ page }) => {
  const mesure = await ecran(page).locator('main').evaluate((main) => {
    const cadre = main.firstElementChild as HTMLElement
    const defilants = [...cadre.querySelectorAll<HTMLElement>('div')].filter((d) => getComputedStyle(d).overflowY === 'auto')
    return {
      rayon: getComputedStyle(cadre).borderTopRightRadius,
      page: document.scrollingElement!.scrollHeight <= window.innerHeight + 1,
      historiqueDefile: defilants.some((d) => d.scrollHeight > d.clientHeight),
    }
  })
  expect(mesure.rayon, 'le rayon du cadre de travail').toBe('26px')
  expect(mesure.page, 'la page entière défilait sous la bande').toBe(true)
  expect(mesure.historiqueDefile, 'l’historique doit défiler DANS le cadre').toBe(true)
})

test('plus aucun export ni en-tête — l’historique seul, titré pour les lecteurs d’écran', async ({ page }) => {
  await expect(ecran(page).getByText(/Export/)).toHaveCount(0)
  await expect(ecran(page).getByRole('button', { name: /CSV|PDF/ })).toHaveCount(0)
  // « Supprime » (Julien, 14.09.2026) : titre, sous-titre et compte ne se voient plus…
  await expect(ecran(page).getByText('Toutes les actions de l’agence')).toHaveCount(0)
  // … mais la page garde son nom dans l'arbre d'accessibilité.
  const titre = ecran(page).getByRole('heading', { level: 1, name: /Journal d.audit/ })
  await expect(titre).toHaveCount(1)
  expect(await titre.evaluate((h) => h.getBoundingClientRect().height)).toBeLessThanOrEqual(1)
})

test('une ligne s’ouvre sur son détail ; une rafale « ×3 » se déplie en trois lignes', async ({ page }) => {
  const cree = lignes(page).filter({ hasText: 'Contact créé' }).first()
  await cree.click()
  await expect(cree).toHaveAttribute('aria-expanded', 'true')
  const detail = ecran(page).getByRole('region', { name: 'Détails' })
  await expect(detail).toContainText('Horodatage')
  await expect(detail).toContainText('contact_created')

  const rafale = lignes(page).filter({ hasText: '×3' })
  await expect(rafale).toHaveCount(1)
  await rafale.click()
  await expect(ecran(page).locator('[role="group"] button[aria-expanded]')).toHaveCount(3)
})

test('le filtre « Acteur » ne garde que l’IA, prend l’accent, et s’efface', async ({ page }) => {
  const avant = await lignes(page).count()
  const acteur = ecran(page).getByLabel('Acteur')
  await acteur.selectOption('ai')
  await expect.poll(() => lignes(page).count()).toBeLessThan(avant)
  // Chaque pastille d'acteur restante est celle de MEGGA AI.
  const noms = await ecran(page).locator('section button[aria-expanded] [title]').evaluateAll(
    (els) => els.map((e) => e.getAttribute('title')).filter((t) => t && !/regroup/.test(t)),
  )
  expect(new Set(noms)).toEqual(new Set(['MEGGA AI']))
  // Un filtre posé porte l'accent (#424bfb).
  expect(await acteur.evaluate((s) => getComputedStyle(s).backgroundColor)).toBe('rgb(66, 75, 251)')

  await ecran(page).getByRole('button', { name: 'Effacer les filtres' }).click()
  await expect.poll(() => lignes(page).count()).toBe(avant)
})

test('la recherche lit le texte affiché — « contact cree » trouve « Contact créé »', async ({ page }) => {
  await ecran(page).getByLabel('Rechercher une action, un objet…').fill('contact cree')
  await expect(lignes(page).filter({ hasText: 'Contact créé' }).first()).toBeVisible()
  await expect(lignes(page).filter({ hasText: 'Visite planifiée' })).toHaveCount(0)
})

/**
 * « Tout » dépasse une page : une requête ne rend jamais plus de 1000 lignes (max_rows
 * de PostgREST). Le banc porte une longue traîne de 1 100 gestes anciens (`TRAINE_JOURNAL`)
 * pour que la pagination s'y éprouve : 1 124 évènements en tout.
 */
test('« Tout » se lit par pages : 1000 d’abord, puis les plus anciens à la demande', async ({ page }) => {
  await ecran(page).getByRole('button', { name: 'Tout', exact: true }).click()
  const plusAnciens = ecran(page).getByRole('button', { name: 'Charger les évènements plus anciens' })
  await expect(plusAnciens).toHaveCount(1)
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 976' })).toHaveCount(1)
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 977' }), 'la 1001ᵉ ligne est sur la page 2').toHaveCount(0)

  // La recherche ne voit que le CHARGÉ — et le dit, là où l'œil cherche le résultat.
  const recherche = ecran(page).getByLabel('Rechercher une action, un objet…')
  await recherche.fill('archivé n° 1100')
  await expect(ecran(page).getByText(/ne porte que sur les 1'000 évènements chargés/)).toBeVisible()
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 1100' })).toHaveCount(0)

  // L'avis offre d'aller plus loin : la page suivante apporte la ligne cherchée.
  await plusAnciens.first().click()
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 1100' })).toHaveCount(1)
  await expect(ecran(page).getByText(/ne porte que sur/)).toHaveCount(0)

  // Tout est chargé : la liste va jusqu'au plus ancien, et le bouton s'efface.
  await recherche.fill('')
  await expect(lignes(page).filter({ hasText: 'Dossier archivé n° 977' })).toHaveCount(1)
  await expect(plusAnciens).toHaveCount(0)
})

/**
 * « Comme dans la pop-up — les photos de l'annonce ou du match » (Julien, 14.09.2026) : la
 * même tuile que la cloche, la même photo pour la même rafale, et le logo WhatsApp fourni.
 */
test('un match et une diffusion montrent la photo du bien ; WhatsApp porte son logo', async ({ page }) => {
  const match = lignes(page).filter({ hasText: 'Correspondance suggérée' }).first()
  await expect(match.locator('img')).toHaveAttribute('referrerpolicy', 'no-referrer')
  // Sans libellé serveur, le sujet d'un match est le bien qu'il désigne — celui de la
  // cloche, la tête de rafale étant la même des deux côtés (ordre date puis id).
  await expect(match).toContainText('Villa individuelle · Cologny')

  const diffusion = lignes(page).filter({ hasText: 'Bien diffusé sur un portail' }).first()
  await diffusion.scrollIntoViewIfNeeded()
  await expect(diffusion.locator('img')).toHaveCount(1)
  await expect(lignes(page).filter({ hasText: 'Visite planifiée' }).first().locator('img')).toHaveCount(0)

  const whatsapp = lignes(page).filter({ hasText: 'Message WhatsApp reçu' }).first()
  await expect(whatsapp.locator('[data-canal="whatsapp"] svg linearGradient')).toHaveCount(1)
})
