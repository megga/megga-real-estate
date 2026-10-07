/**
 * Le panneau d'un match en CARTE FOCUS (`FilPanneau`, conception du fil épuré §3), monté pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · un texte que la conception retire : « Votre bien », « Voir le bien », l'adresse et la ville, le KYC écrit en toutes
 *     lettres ;
 *   · le prix, le score ou la flèche d'une baisse — celle d'un acheteur comme celle d'une annonce — ailleurs que sur la
 *     photo ; une photo ignorée, demandée avec son référent (Flatfox la refuse), ou la maison en sourdine perdue quand le
 *     bien n'en a pas ;
 *   · la pastille « Nouveau » d'un bien nouveau ou d'un mandat neuf perdue, sans son libellé en infobulle, ou posée sur
 *     une baisse ;
 *   · la phrase longue d'un signal hors du dépli ;
 *   · une ligne des critères qui ment : une coche malgré un écart, un compte faux, une icône sans verdict, un écart que
 *     seul l'œil voit ;
 *   · des critères dépliés d'office, un dépli qui ne se referme pas ou qui survivrait au match suivant, « Déjà proposé »
 *     au-dessus du tableau ou amputé de ses intéressés ; un dépli que son bouton ne vise pas, ou qui n'a pas de nom ;
 *   · un KYC qui ne dit plus s'il est vérifié, ou sans son libellé en infobulle ;
 *   · un nom qui ne mène plus au contact ;
 *   · un bouton-icône sans nom ou sans son icône, une touche perdue ou fausse, un geste qui en déclenche un autre, ou le
 *     prénom de l'acheteur écrit sur le bouton principal.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'fr' },
  }),
}))

import FilPanneau from '@/components/matching-fil/FilPanneau'
import { lignesCriteres, type FilBien, type FilMatch, type RaisonsMoteur } from '@/components/matching-fil/filModele'
import { teinteEcart, teinteTenu } from '@/components/matching-fil/filAffichage'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { crmPalette, type CrmPalette } from '@/components/crm/tokens'
import type { SearchCriteria } from '@/types/contact'

const sp = crmPalette(false)
const MAINTENANT = Date.parse('2020-01-15T12:00:00Z')
const CRITERES: SearchCriteria = {
  transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Florissant', 'GE'], budget_min: 2_000_000, budget_max: 2_600_000,
  rooms_min: 5, features: ['terrasse', 'vue lac'],
}
const FLORISSANT: FilBien = {
  id: 'p3', titre: 'Attique 5,5 pièces · Florissant', prix: 2_350_000, location: false, type: 'apartment', pieces: 5.5,
  surface: 168, ville: 'Genève', canton: 'GE', adresse: 'Route de Florissant 58', equipements: ['terrasse', 'vue lac'], photo: null,
}
/** Les raisons du moteur pour m22 au banc (`crmFixtures.ts`) : ce sont elles qui donnent un verdict à chaque critère. */
const RAISONS: RaisonsMoteur = {
  budget: { match: true, score: 27, detail: 'Dans le budget' },
  zone: { match: true, score: 20, detail: 'Genève correspond' },
  type: { match: true, score: 10, detail: 'apartment' },
  rooms: { match: true, score: 10, detail: '5,5 pièces' },
  features: { match: true, score: 8, detail: '2/2 critères' },
}
const ANASTASIA: FilMatch['acheteur'] = { id: 'c11', prenom: 'Anastasia', nom: 'Volkova', telephone: null, email: null, kyc: 'none' }
const match = (id: string, champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score: 100, raisons: RAISONS, criteres: CRITERES, creeLe: null, reporteJusquau: null, bien: FLORISSANT,
  acheteur: ANASTASIA, ...champs,
})
/** Refusé pour le prix à CHF 2'600'000, revenu à CHF 2'350'000 : une baisse de CHF 250'000 depuis son refus. */
const revenu = match('m30', {
  suivi: { statut: 'suggested', proposeLe: null, reponduLe: '2020-01-10T10:00:00Z', motif: 'prix', note: null, prixPropose: 2_600_000, apprisLe: null },
})
/** Une annonce du marché baissée de CHF 250'000 il y a cinq jours (lot C) : la baisse vient du BIEN, pas de l'acheteur. */
const baisseMarche = match('m31', {
  bien: { ...FLORISSANT, id: 'a1', marche: { ref: 'FF-1', sourceUrl: null }, prixInitial: 2_600_000, baisseLe: '2020-01-10T10:00:00Z' },
})
const nouveauMarche = match('m32', { bien: { ...FLORISSANT, id: 'a2', marche: { ref: 'FF-2', sourceUrl: null }, vuLe: '2020-01-14T10:00:00Z' } })
const mandatNeuf = match('m33', { bien: { ...FLORISSANT, id: 'p4', mandatLe: '2020-01-12T10:00:00Z' } })

const gestes = () => ({ onProposer: vi.fn(), onPlusTard: vi.fn(), onEcarter: vi.fn(), onVoirBien: vi.fn(), onVoirContact: vi.fn() })
type Gestes = ReturnType<typeof gestes>
let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(m: FilMatch, g: Gestes = gestes(), palette: CrmPalette = sp): Promise<Gestes> {
  if (!hote) {
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
  }
  await act(async () => {
    racine!.render(<FilPanneau sp={palette} m={m} historique={{ proposes: 2, interesses: 1 }} maintenant={MAINTENANT} {...g} />)
  })
  return g
}
const texte = (): string => hote!.textContent ?? ''
const depli = (): HTMLButtonElement => hote!.querySelector('button[aria-expanded]') as HTMLButtonElement
function bouton(nom: string): HTMLButtonElement {
  const b = [...hote!.querySelectorAll('button')].find((e) => e.getAttribute('aria-label') === nom || e.textContent === nom)
  expect(b, `le bouton « ${nom} »`).toBeDefined()
  return b!
}
/** Le cadre de la photo : le parent de l'image, ou de la maison en sourdine quand le bien n'en a pas. */
function photo(): HTMLElement {
  const img = hote!.querySelector('img')
  if (img) return img.parentElement!
  const maison = [...hote!.querySelectorAll('span')].find((s) => s.textContent === 'fil.sansPhoto' && s.querySelector('svg'))
  expect(maison, 'sans photo, la maison en sourdine').toBeDefined()
  return maison!.parentElement!
}
/** La pastille « Nouveau » : le mot visible, porté par l'élément qui a l'infobulle. */
const pastilleNouveau = (): HTMLElement | undefined =>
  [...photo().querySelectorAll<HTMLElement>('[title]')].find((s) => s.querySelector('[aria-hidden]')?.textContent === 'fil.signal.pastille')
/** Le coin d'une pastille posée sur la photo : les bords qu'elle fixe, sans figer la valeur de l'écart. */
const coins = (e: HTMLElement) => ({ haut: e.style.top !== '', bas: e.style.bottom !== '', gauche: e.style.left !== '', droite: e.style.right !== '' })
/** Le tracé d'une icône tel que MEIcon le dessine. */
function trace(nom: MEIconName): string {
  const boite = document.createElement('div')
  boite.innerHTML = renderToStaticMarkup(<MEIcon name={nom} />)
  return boite.querySelector('svg')!.innerHTML
}
/** Les icônes de la ligne des critères, dans l'ordre : le verdict s'il y en a un, puis le chevron. */
const iconesDeLaLigne = (): { trace: string; encre: string | null }[] =>
  [...depli().querySelectorAll('svg')].map((s) => ({ trace: s.innerHTML, encre: s.getAttribute('stroke') }))

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilPanneau — la carte focus', () => {
  it('le prix et le score sur la photo, le titre en lien vers le bien ; ni « Votre bien », ni « Voir le bien », ni l’adresse ni la ville', async () => {
    const g = await rendre(match('m22'))
    expect(photo().textContent).toContain("CHF 2'350'000")
    expect(photo().querySelector('[title^="fil.scoreAria"]')).not.toBeNull()
    const titre = hote!.querySelector('h2 button') as HTMLButtonElement
    expect(titre.textContent).toBe(FLORISSANT.titre)
    await act(async () => { titre.click() })
    expect(g.onVoirBien).toHaveBeenCalledTimes(1)
    expect(g.onVoirContact).not.toHaveBeenCalled()
    for (const retire of ['fil.votreBien', 'fil.voirBien', 'Route de Florissant 58', 'Genève']) expect(texte()).not.toContain(retire)
  })

  it('une photo : l’image, et les pastilles du prix et du score posées dessus', async () => {
    await rendre(match('m22', { bien: { ...FLORISSANT, photo: 'https://img.example/p3.jpg' } }))
    expect(hote!.querySelector('img')?.getAttribute('src')).toBe('https://img.example/p3.jpg')
    // Flatfox refuse une image demandée avec un référent (règle de `FilVignette`).
    expect(hote!.querySelector('img')?.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(photo().textContent).toContain("CHF 2'350'000")
    expect(photo().querySelector('[title^="fil.scoreAria"]')).not.toBeNull()
  })

  it('la photo en 280 px, le prix en bas à gauche, le score en bas à droite, au fond de la carte et à l’encre courante, en clair comme en sombre', async () => {
    for (const palette of [crmPalette(false), crmPalette(true)]) {
      await rendre(match('m22'), gestes(), palette)
      expect(photo().style.height).toBe('280px')
      const prix = [...photo().children].find((e) => e.textContent?.startsWith("CHF 2'350'000")) as HTMLElement
      const score = photo().querySelector('[title^="fil.scoreAria"]')!.parentElement as HTMLElement
      expect(coins(prix)).toEqual({ haut: false, bas: true, gauche: true, droite: false })
      expect(coins(score)).toEqual({ haut: false, bas: true, gauche: false, droite: true })
      const attendu = document.createElement('span')
      attendu.style.background = palette.cardBg
      attendu.style.color = palette.ink
      for (const p of [prix, score]) expect([p.style.background, p.style.color]).toEqual([attendu.style.background, attendu.style.color])
    }
  })

  it('le KYC de l’acheteur en bouclier : nommé et dans l’infobulle, pas écrit ; tenu s’il est vérifié, en sourdine sinon', async () => {
    await rendre(match('m22'))
    const sourdine = hote!.querySelector('[role="img"][aria-label="fil.kyc.none"]') as HTMLElement
    expect(sourdine).not.toBeNull()
    expect(sourdine.title).toBe('fil.kyc.none')
    // Un KYC à compléter n'est pas coché : le bouclier nu, pas celui de la coche.
    expect(sourdine.querySelector('svg')!.innerHTML).toBe(trace('shield-plain'))
    expect(sourdine.querySelector('svg')!.getAttribute('stroke')).toBe(sp.sub)
    expect(texte()).not.toContain('fil.kyc')
    await rendre(match('m22', { acheteur: { ...ANASTASIA, kyc: 'verified' } }))
    const tenu = hote!.querySelector('[role="img"][aria-label="fil.kyc.verified"]') as HTMLElement
    expect(tenu.title).toBe('fil.kyc.verified')
    expect(tenu.querySelector('svg')!.innerHTML).toBe(trace('shield'))
    expect(tenu.querySelector('svg')!.getAttribute('stroke')).toBe(teinteTenu(sp))
    expect(trace('shield')).not.toBe(trace('shield-plain'))
    expect(teinteTenu(sp)).not.toBe(sp.sub)
  })

  it('le nom de l’acheteur mène à sa fiche', async () => {
    const g = await rendre(match('m22'))
    const nom = [...hote!.querySelectorAll('button')].find((b) => b.textContent === 'Anastasia Volkova')
    expect(nom).toBeDefined()
    await act(async () => { nom!.click() })
    expect(g.onVoirContact).toHaveBeenCalledTimes(1)
    expect(g.onVoirBien).not.toHaveBeenCalled()
  })

  it('les critères tiennent en une ligne, repliée, cochée quand tous tiennent ; le dépli dit la comparaison, puis ce qui lui a déjà été proposé ; il se referme d’un clic', async () => {
    const m = match('m22')
    const lignes = lignesCriteres(m)
    expect(lignes.length).toBeGreaterThan(3)
    expect(lignes.every((l) => l.ok === true)).toBe(true)
    await rendre(m)
    expect(depli().getAttribute('aria-expanded')).toBe('false')
    expect(texte()).toContain(`fil.criteresSur {"count":${lignes.length},"total":${lignes.length}}`)
    expect(iconesDeLaLigne()).toEqual([{ trace: trace('check'), encre: teinteTenu(sp) }, { trace: trace('chevron-down'), encre: sp.sub }])
    expect(depli().querySelector('.sr-only')).toBeNull()
    expect(hote!.querySelector('table')).toBeNull()
    expect(texte()).not.toContain('fil.historique')
    await act(async () => { depli().click() })
    expect(depli().getAttribute('aria-expanded')).toBe('true')
    const table = hote!.querySelector('table')
    expect(table).not.toBeNull()
    const historique = [...hote!.querySelectorAll('p')].find((p) => p.textContent?.startsWith('fil.historique'))!
    expect(historique.textContent).toBe('fil.historique.proposes {"prenom":"Anastasia","count":2}fil.historique.interesses {"count":1}')
    expect(table!.compareDocumentPosition(historique) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await act(async () => { depli().click() })
    expect(depli().getAttribute('aria-expanded')).toBe('false')
    expect(hote!.querySelector('table')).toBeNull()
  })

  it('un critère en écart : l’alerte ambre et « 4 critères sur 5 », l’écart dit au lecteur d’écran, et marqué dans le tableau', async () => {
    const m = match('m24', { criteres: { ...CRITERES, rooms_min: 6 } })
    const lignes = lignesCriteres(m)
    expect(lignes.filter((l) => l.ok === false).map((l) => l.cle)).toEqual(['pieces'])
    await rendre(m)
    expect(texte()).toContain(`fil.criteresSur {"count":${lignes.length - 1},"total":${lignes.length}}`)
    expect(iconesDeLaLigne()).toEqual([{ trace: trace('alert'), encre: teinteEcart(sp) }, { trace: trace('chevron-down'), encre: sp.sub }])
    // L'alerte est `aria-hidden` : sans ce mot, « 4 critères sur 5 » se lirait comme un critère non évalué.
    expect(depli().querySelector('.sr-only')?.textContent).toBe(' · fil.ecart')
    await act(async () => { depli().click() })
    expect(hote!.querySelectorAll('[role="img"][aria-label="fil.ecart"]')).toHaveLength(1)
    expect(hote!.querySelectorAll('[role="img"][aria-label="fil.correspond"]')).toHaveLength(lignes.length - 1)
  })

  it('un critère que le moteur n’a pas évalué, sans écart : « 4 critères sur 5 », ni coche ni alerte', async () => {
    const m = match('m25', { raisons: { ...RAISONS, type: undefined } })
    const lignes = lignesCriteres(m)
    expect(lignes.map((l) => l.ok)).toContain(null)
    expect(lignes.some((l) => l.ok === false)).toBe(false)
    await rendre(m)
    expect(texte()).toContain(`fil.criteresSur {"count":${lignes.length - 1},"total":${lignes.length}}`)
    expect(iconesDeLaLigne()).toEqual([{ trace: trace('chevron-down'), encre: sp.sub }])
    expect(depli().querySelector('.sr-only')).toBeNull()
  })

  it('le dépli, pour un lecteur d’écran : `aria-controls` vise la région nommée quand elle est rendue, rien sinon', async () => {
    await rendre(match('m22'))
    expect(depli().hasAttribute('aria-controls')).toBe(false)
    await act(async () => { depli().click() })
    const region = document.getElementById(depli().getAttribute('aria-controls') ?? '')
    expect(region?.getAttribute('role')).toBe('region')
    expect(region?.getAttribute('aria-label')).toBe('fil.pourquoi')
    expect(region?.querySelector('table')).not.toBeNull()
  })

  it('le dépli se referme au match suivant', async () => {
    await rendre(match('m22'))
    await act(async () => { depli().click() })
    expect(hote!.querySelector('table')).not.toBeNull()
    await rendre(match('m23'))
    expect(depli().getAttribute('aria-expanded')).toBe('false')
    expect(hote!.querySelector('table')).toBeNull()
  })

  it('une baisse — depuis le refus, ou d’une annonce (lot C) : la flèche sur la photo, la phrase seulement au dépli, pas de « Nouveau »', async () => {
    for (const [m, phrase] of [[revenu, 'fil.signal.baisseRefus'], [baisseMarche, 'fil.signal.baisseMarche']] as const) {
      await rendre(m)
      expect([...photo().querySelectorAll('[title]')].map((e) => e.getAttribute('title'))).toContain('fil.signal.court {"montant":"CHF 250\'000"}')
      expect(texte()).not.toContain(phrase)
      expect(texte()).not.toContain('fil.signal.pastille')
      await act(async () => { depli().click() })
      expect(texte()).toContain(phrase)
    }
  })

  it('un bien nouveau sur le marché, un mandat neuf : la pastille « Nouveau » sur la photo, son libellé en infobulle ; la phrase au dépli', async () => {
    for (const [m, court, long] of [[nouveauMarche, 'fil.signal.nouveauCourt', 'fil.signal.nouveau {'], [mandatNeuf, 'fil.signal.mandatCourt', 'fil.signal.mandat {']] as const) {
      await rendre(m)
      expect(pastilleNouveau()?.title).toBe(court)
      expect(pastilleNouveau()!.querySelector('.sr-only')?.textContent).toBe(court)
      expect(coins(pastilleNouveau()!)).toEqual({ haut: true, bas: false, gauche: true, droite: false })
      expect(texte()).not.toContain(long)
      await act(async () => { depli().click() })
      expect(texte()).toContain(long)
    }
  })

  it('trois gestes : Écarter et Plus tard réduits à leur icône et nommés, « Proposé » avec le prénom dans l’infobulle ; chaque touche dans l’infobulle et `aria-keyshortcuts`, chaque clic à son geste', async () => {
    const g = await rendre(match('m22'))
    const ecarter = bouton('fil.actions.ecarter')
    const plusTard = bouton('fil.actions.plusTard')
    expect(ecarter.textContent).toBe('')
    expect(plusTard.textContent).toBe('')
    expect(ecarter.querySelector('svg')!.innerHTML).toBe(trace('close'))
    expect(plusTard.querySelector('svg')!.innerHTML).toBe(trace('clock'))
    const proposer = bouton('fil.actions.propose')
    expect(proposer.textContent).toBe('fil.actions.propose')
    expect(proposer.title).toContain('fil.actions.proposer')
    expect(proposer.title).toContain('Anastasia')
    for (const [b, touche] of [[ecarter, 'X'], [plusTard, 'P'], [proposer, 'E']] as const) {
      expect(b.getAttribute('aria-keyshortcuts')).toBe(touche)
      expect(b.title).toContain(`"touche":"${touche}"`)
    }
    await act(async () => { ecarter.click() })
    await act(async () => { plusTard.click() })
    await act(async () => { proposer.click() })
    expect([g.onEcarter, g.onPlusTard, g.onProposer].map((f) => f.mock.calls.length)).toEqual([1, 1, 1])
  })
})
