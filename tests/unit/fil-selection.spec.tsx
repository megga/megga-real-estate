/**
 * La sélection du marché ALLÉGÉE (`FilSelection`, conception du fil épuré §7), montée pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · sous le nom, « Marché · 2 biens pas encore proposés » ou toute autre ligne : l'en-tête est le nom seul (il ouvre
 *     le contact) ; la recherche écrite d'office — elle se déplie d'un clic sur un chevron nommé (`aria-expanded`, son
 *     libellé au survol, `aria-controls` seulement quand elle est rendue), se replie d'un autre, et d'un acheteur à
 *     l'autre ;
 *   · une ligne sans sa case, sa vignette, son titre, son prix, son score ou sa croix ; pièces, surface ou ville sur la
 *     ligne ; une baisse écrite en phrase au lieu de sa flèche — celle du refus de CET acheteur (lot B) d'abord, puis
 *     celle de l'annonce (lot C) —, ou sa phrase PERDUE : sans dépli, la sélection la porte au survol de la flèche et
 *     pour un lecteur d'écran (qui l'a refusé et à quel prix, la date d'une baisse du marché) ; un bien neuf sans sa
 *     pastille « Nouveau » (son libellé au survol), ou avec la flèche ET la pastille ;
 *   · « À vérifier : … » écrit à l'écran : l'alerte ambre le dit, sa liste ENTIÈRE au survol et pour un lecteur
 *     d'écran ; une alerte sur un bien sans écart ; un bien sans verdict ou sans critère dessiné comme un écart (par
 *     l'alerte, même grise) ;
 *   · « Écarter » écrit sur chaque ligne (une croix nommée, son libellé au survol), une croix sous 24 × 24 (WCAG
 *     2.5.8), ou qui n'écarterait pas SON bien ; « J'ai proposé 2 biens à Anastasia » sur le bouton principal :
 *     « Proposé · N », N les cases cochées, « Proposé » sans case, la phrase entière et la touche au survol ;
 *   · ce qui ne change pas (conception §9) : les cases telles qu'on les reçoit et leur geste, le bouton désactivé sans
 *     case (sa raison dite), « Voir 20 de plus » et le focus qui suit sa lecture, l'erreur et « Réessayer » qui garde
 *     le focus, le vide, le chargement ;
 *   · dans les quatre langues, d'autres mots que « Proposé · {{count}} » et « Sa recherche », ou le retour des clés
 *     retirées (aucune porte ne garde le RETRAIT d'une clé). ⚠ En allemand, pas « Ihre Suche » : le fichier y écrit
 *     « Ihre » pour le vouvoiement (« Ihre Objekte »), et l'agent y lirait « votre recherche ».
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, type ComponentProps } from 'react'
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

import FilSelection from '@/components/matching-fil/FilSelection'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { FilBien, FilMatch, FilSelectionResume, RaisonsMoteur } from '@/components/matching-fil/filModele'
import { dateCourte, teinteEcart } from '@/components/matching-fil/filAffichage'
import { crmPalette } from '@/components/crm/tokens'
import type { SearchCriteria } from '@/types/contact'
import fr from '@/i18n/locales/fr/matching.json'
import en from '@/i18n/locales/en/matching.json'
import de from '@/i18n/locales/de/matching.json'
import italien from '@/i18n/locales/it/matching.json'

const sp = crmPalette(false)
const MAINTENANT = Date.parse('2020-01-15T12:00:00Z')
const HIER = '2020-01-14T10:00:00Z'
const ANASTASIA: FilMatch['acheteur'] = { id: 'c11', prenom: 'Anastasia', nom: 'Volkova', telephone: null, email: null, kyc: 'none' }
const CRITERES: SearchCriteria = { transaction_type: 'buy', type: 'apartment', zones: ['Genève'], budget_min: 2_000_000, budget_max: 2_400_000 }
const annonce = (id: string, titre: string, prix: number, champs: Partial<FilBien> = {}): FilBien => ({
  id, titre, prix, location: false, type: 'apartment', pieces: 5, surface: 150, ville: 'Genève', canton: 'GE', adresse: null,
  equipements: [], photo: null, marche: { ref: `MG-MK-${id}`, sourceUrl: null }, ...champs,
})
const match = (id: string, b: FilBien, budgetTenu: boolean, champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score: 95, criteres: CRITERES, creeLe: null, reporteJusquau: null, bien: b, acheteur: ANASTASIA,
  raisons: {
    budget: { match: budgetTenu, score: budgetTenu ? 30 : 0, detail: budgetTenu ? 'Dans le budget' : 'Hors budget' },
    zone: { match: true, score: 20, detail: 'Genève correspond' },
  },
  ...champs,
})
/** Chaque critère posé tenu, en fait : le prix dans les bornes, le quartier, le type. */
const TENUES: RaisonsMoteur = {
  budget: { match: true, score: 30, detail: 'Dans le budget' },
  zone: { match: true, score: 20, detail: 'Genève correspond' },
  type: { match: true, score: 20, detail: 'Appartement' },
}
/** En baisse sur le marché depuis la veille : CHF 2'500'000 → CHF 2'450'000. */
const EAUX_VIVES = annonce('ml-s2', 'Attique 5 pièces · Eaux-Vives', 2_450_000, { prixInitial: 2_500_000, baisseLe: '2020-01-14T09:00:00Z' })
const MALAGNOU = annonce('ml-s1', 'Appartement 6 pièces · Malagnou', 2_480_000)
const MATCHS = [match('m25', EAUX_VIVES, true), match('m24', MALAGNOU, false)]
const RESUME: FilSelectionResume = { acheteur: ANASTASIA, nombre: 2, meilleurScore: 95, vignettes: [], baisses: 1 }
const TENU = match('m26', annonce('ml-s3', 'Duplex 5 pièces · Champel', 2_300_000), true, { raisons: TENUES })
/** Refusé par Anastasia pour le PRIX à CHF 2'600'000, revenu à CHF 2'350'000 (lot B) — et vu sur le marché hier. */
const REVENU = match('m27', annonce('ml-s4', 'Appartement 5 pièces · Florissant', 2_350_000, { vuLe: HIER }), true, {
  raisons: TENUES,
  suivi: { statut: 'suggested', proposeLe: null, reponduLe: '2020-01-10T10:00:00Z', motif: 'prix', note: null, prixPropose: 2_600_000, apprisLe: null },
})
/** Vue pour la première fois sur le marché hier (lot C). */
const NEUF = match('m28', annonce('ml-s5', 'Attique 4 pièces · Plainpalais', 2_200_000, { vuLe: HIER }), true, { raisons: TENUES })
/** Aucune raison du moteur : aucun verdict. Et une recherche sans critère détaillé. */
const SANS_VERDICT = match('m29', annonce('ml-s6', 'Maison 6 pièces · Cologny', 2_390_000), true, { raisons: null })
const SANS_CRITERES = match('m30', annonce('ml-s7', 'Loft · Carouge', 2_100_000), true, { criteres: null })

/** La phrase d'une baisse, que la sélection porte au survol de sa flèche : le dépli de la carte focus l'écrit, ici rien. */
const BAISSE_50 = `fil.signal.baisseMarche ${JSON.stringify({ montant: "CHF 50'000", date: dateCourte(EAUX_VIVES.baisseLe!) })}`
const REFUS_250 = 'fil.signal.baisseRefus {"prenom":"Anastasia","prix":"CHF 2\'600\'000","montant":"CHF 250\'000"}'
const ECARTS = 'fil.selection.ecarts {"liste":"fil.criteres.budget, fil.criteres.type"}'
/** L'infobulle du bouton principal : la phrase entière du geste, et sa touche. */
const infobulle = (libelle: string): string => `fil.actions.infobulle ${JSON.stringify({ libelle, touche: 'E' })}`
const phrase = (n: number): string => `fil.selection.proposer ${JSON.stringify({ count: n, prenom: 'Anastasia' })}`

const gestes = () => ({
  onCocher: vi.fn(), onEcarter: vi.fn(), onVoirPlus: vi.fn(), onReessayer: vi.fn(), onProposer: vi.fn(), onVoirContact: vi.fn(),
})
type Champs = Partial<Omit<ComponentProps<typeof FilSelection>, 'sp' | 'maintenant'>>

let hote: HTMLDivElement | null = null
let racine: Root | null = null
let g = gestes()
/** Monte le panneau — ou le re-rend, sur la même racine : un état local y survit, comme dans le fil. */
async function rendre(champs: Champs = {}): Promise<ReturnType<typeof gestes>> {
  if (!hote) {
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
    g = gestes()
  }
  await act(async () => {
    racine!.render(<FilSelection sp={sp} resume={RESUME} matchs={MATCHS} coches={['m25', 'm24']} aPlus={false} isLoading={false}
      isError={false} aDesDonnees isFetching={false} {...g} maintenant={MAINTENANT} {...champs} />)
  })
  return g
}
const texte = (): string => hote!.textContent ?? ''
/** Ce qu'on VOIT : sans le texte réservé aux lecteurs d'écran. */
const visible = (el: Element = hote!): string => {
  const copie = el.cloneNode(true) as HTMLElement
  copie.querySelectorAll('.sr-only').forEach((e) => e.remove())
  return copie.textContent ?? ''
}
const bouton = (libelle: string): HTMLButtonElement => [...hote!.querySelectorAll('button')].find((b) => b.textContent === libelle)!
const replier = (): HTMLButtonElement => hote!.querySelector('button[aria-label="fil.selection.rechercheAria"]') as HTMLButtonElement
const proposer = (): HTMLButtonElement => hote!.querySelector('button[aria-keyshortcuts="E"]') as HTMLButtonElement
/** Ce que le panneau ÉCRIT hors de la liste et du bouton principal — l'en-tête, la recherche dépliée ; l'avatar à part. */
const horsListe = (): string => {
  const copie = hote!.querySelector('section')!.cloneNode(true) as HTMLElement
  copie.lastElementChild!.remove()
  copie.querySelectorAll('ul, [aria-hidden="true"]').forEach((e) => e.remove())
  return copie.textContent ?? ''
}
/** La ligne d'un bien, par sa case (`data-bien` : le fil y rend le focus après un « Écarter »). */
const ligne = (id: string): HTMLLIElement => hote!.querySelector(`input[type="checkbox"][data-bien="${id}"]`)!.closest('li')!
const caseDe = (id: string): HTMLInputElement => hote!.querySelector(`input[type="checkbox"][data-bien="${id}"]`) as HTMLInputElement
/** La ligne du prix d'un bien : ce qu'elle écrit, puis ce qui le suit (la flèche, la pastille, l'alerte), par leur infobulle. */
function prixDe(li: Element): { texte: (string | null)[]; suite: (string | null)[] } {
  const l = [...li.querySelectorAll('span')].find((s) => [...s.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.includes('CHF')))!
  return {
    texte: [...l.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent),
    suite: [...l.children].map((e) => e.getAttribute('title')),
  }
}
/** Le tracé d'une icône tel que MEIcon le dessine (idiome de `fil-bouton`, `fil-panneau` et `fil-retours`). */
function trace(nom: MEIconName): string {
  const boite = document.createElement('div')
  boite.innerHTML = renderToStaticMarkup(<MEIcon name={nom} />)
  return boite.querySelector('svg')!.innerHTML
}
const icones = (el: Element): string[] => [...el.querySelectorAll('svg')].map((s) => s.innerHTML)

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilSelection — la sélection du marché allégée', () => {
  it('le nom seul, qui ouvre le contact ; sa recherche se déplie d’un clic sur le chevron, et se replie d’un autre', async () => {
    const appels = await rendre()
    for (const retire of ['fil.selection.marche', 'fil.selection.ligne', 'fil.selection.recherche']) expect(texte()).not.toContain(retire)
    expect(horsListe()).toBe('Anastasia Volkova')
    await act(async () => { bouton('Anastasia Volkova').click() })
    expect(appels.onVoirContact).toHaveBeenCalledTimes(1)
    // Un bouton réduit à son icône : nommé, son libellé au survol (conception §2), son état dit au lecteur d'écran.
    expect(replier().title).toBe('fil.selection.rechercheAria')
    expect(replier().getAttribute('aria-expanded')).toBe('false')
    // Repliée, la recherche n'est pas rendue : le chevron ne vise rien (même règle que le dépli de la carte focus).
    expect(replier().hasAttribute('aria-controls')).toBe(false)
    expect(icones(replier())).toEqual([trace('chevron-down')])
    await act(async () => { replier().click() })
    expect(replier().getAttribute('aria-expanded')).toBe('true')
    expect(icones(replier())).toEqual([trace('chevron-up')])
    const recherche = document.getElementById(replier().getAttribute('aria-controls') ?? '')
    expect(recherche?.textContent).toMatch(/^fil\.selection\.recherche \{"resume":".+"\}$/)
    expect(horsListe()).toBe(`Anastasia Volkova${recherche!.textContent}`)
    await act(async () => { replier().click() })
    expect(replier().getAttribute('aria-expanded')).toBe('false')
    expect(replier().hasAttribute('aria-controls')).toBe(false)
    expect(texte()).not.toContain('fil.selection.recherche')
  })

  it('la recherche se replie d’un acheteur à l’autre', async () => {
    await rendre()
    await act(async () => { replier().click() })
    await rendre({ resume: { ...RESUME, acheteur: { ...ANASTASIA, id: 'c99' } } })
    expect(replier().getAttribute('aria-expanded')).toBe('false')
    expect(texte()).not.toContain('fil.selection.recherche')
  })

  it('un bien : case, vignette, titre, son prix seul, le score et la croix ; ni pièces, ni surface, ni ville', async () => {
    await rendre()
    const eaux = ligne('m25')
    expect(eaux.textContent).toContain('Attique 5 pièces · Eaux-Vives')
    // La baisse du marché : sa flèche, et sa phrase datée au survol et pour un lecteur d'écran — jamais à l'écran.
    expect(prixDe(eaux)).toEqual({ texte: ["CHF 2'450'000"], suite: [BAISSE_50, ECARTS] })
    expect(eaux.querySelector('[title^="fil.signal.baisseMarche"] .sr-only')?.textContent).toBe(BAISSE_50)
    expect(visible()).not.toContain('fil.signal.baisseMarche')
    // Sans photo, la maison ; puis la flèche de la baisse, l'alerte de l'écart, la croix : aucune autre icône.
    expect(icones(eaux)).toEqual([trace('home'), trace('arrow-down'), trace('alert'), trace('close')])
    expect(eaux.querySelector('[title^="fil.scoreAria"]')?.getAttribute('title')).toBe('fil.scoreAria {"score":95,"palier":"fil.palier.fort"}')
    const malagnou = ligne('m24')
    expect(prixDe(malagnou)).toEqual({ texte: ["CHF 2'480'000"], suite: [ECARTS] })
    expect(icones(malagnou)).toEqual([trace('home'), trace('alert'), trace('close')])
    for (const retire of ['Genève', 'fil.selection.pieces', 'fil.valeurs.m2']) expect(texte()).not.toContain(retire)
  })

  it('une baisse en flèche — celle du refus de CET acheteur d’abord (lot B), sa phrase au survol — ; un bien neuf, la pastille « Nouveau », son libellé au survol', async () => {
    await rendre({ matchs: [REVENU, NEUF], coches: [] })
    // Revenu ET vu hier : la flèche de SA baisse, pas la pastille — l'une ou l'autre. Sans dépli ici, le refus et son prix
    // vivent dans l'infobulle de la flèche et pour un lecteur d'écran ; nulle part ailleurs.
    const revenu = ligne('m27')
    expect(prixDe(revenu)).toEqual({ texte: ["CHF 2'350'000"], suite: [REFUS_250] })
    expect(revenu.querySelector('[title^="fil.signal.baisseRefus"] .sr-only')?.textContent).toBe(REFUS_250)
    expect(visible()).not.toContain('fil.signal.baisseRefus')
    const neuf = ligne('m28')
    expect(prixDe(neuf)).toEqual({ texte: ["CHF 2'200'000"], suite: ['fil.signal.nouveauCourt'] })
    const pastille = neuf.querySelector('[title="fil.signal.nouveauCourt"]')!
    expect(visible(pastille)).toBe('fil.signal.pastille')
    expect(pastille.querySelector('.sr-only')?.textContent).toBe('fil.signal.nouveauCourt')
    for (const retire of ['fil.signal.baissePropose', 'fil.signal.nouveau {']) expect(texte()).not.toContain(retire)
  })

  it('un écart se dit par l’alerte ambre : sa liste ENTIÈRE au survol et pour un lecteur d’écran, pas à l’écran ; sans écart, rien', async () => {
    await rendre({ matchs: [...MATCHS, TENU] })
    const ecarts = [...hote!.querySelectorAll('[title^="fil.selection.ecarts"]')]
    expect(ecarts).toHaveLength(2)
    for (const e of ecarts) {
      expect(e.getAttribute('title')).toBe(ECARTS)
      expect(e.querySelector('.sr-only')?.textContent).toBe(ECARTS)
      expect(icones(e)).toEqual([trace('alert')])
      expect(e.querySelector('svg')!.getAttribute('stroke')).toBe(teinteEcart(sp))
    }
    expect(visible()).not.toContain('fil.selection.ecarts')
    expect(prixDe(ligne('m26')).suite).toEqual([])
    expect(icones(ligne('m26'))).toEqual([trace('home'), trace('close')])
  })

  it('un bien sans verdict, ou sans critère : ni écrit, ni dessiné comme un écart — un « ? » en sourdine, son état au survol et pour un lecteur d’écran', async () => {
    await rendre({ matchs: [SANS_VERDICT, SANS_CRITERES], coches: [] })
    for (const [id, etat] of [['m29', 'fil.nonEvalues'], ['m30', 'fil.sansCriteres']] as const) {
      const l = ligne(id)
      expect(l.querySelector(`[title="${etat}"] .sr-only`)?.textContent).toBe(etat)
      expect(visible(l)).not.toContain(etat)
      // Pas l'alerte, même grise : en clair, l'ambre et la sourdine ne diffèrent presque que par la teinte.
      expect(icones(l)).toEqual([trace('home'), trace('help'), trace('close')])
      expect([...l.querySelectorAll('svg')].map((s) => s.getAttribute('stroke'))).not.toContain(teinteEcart(sp))
    }
  })

  it('« Écarter » : une croix nommée, son libellé au survol, une cible de 24 × 24 ; elle écarte SON bien, une fois', async () => {
    const appels = await rendre()
    const croix = ligne('m24').querySelector('button[aria-label^="fil.selection.ecarterAria"]') as HTMLButtonElement
    expect(croix.getAttribute('aria-label')).toBe('fil.selection.ecarterAria {"titre":"Appartement 6 pièces · Malagnou"}')
    expect(croix.textContent).toBe('')
    expect(croix.title).toBe('fil.actions.ecarter')
    expect(icones(croix)).toEqual([trace('close')])
    // WCAG 2.5.8 : 24 × 24 au moins, et une boîte qui ne se laisse pas écraser dans une ligne serrée.
    expect([croix.style.width, croix.style.height, croix.style.flex]).toEqual(['24px', '24px', '0 0 auto'])
    await act(async () => { croix.click() })
    expect(appels.onEcarter).toHaveBeenCalledTimes(1)
    expect(appels.onEcarter).toHaveBeenCalledWith(MATCHS[1])
    expect(appels.onCocher).not.toHaveBeenCalled()
    // ⛔ Un double clic n'écarte pas deux biens : son second clic tomberait sur la ligne suivante (`unSeulClic`).
    await act(async () => { croix.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 })) })
    expect(appels.onEcarter).toHaveBeenCalledTimes(1)
  })

  it('les cases : cochées telles qu’on les reçoit ; un clic coche ou décoche SON bien', async () => {
    const appels = await rendre({ coches: ['m25'] })
    expect(caseDe('m25').checked).toBe(true)
    expect(caseDe('m24').checked).toBe(false)
    expect(caseDe('m24').getAttribute('aria-label')).toBe('fil.selection.inclure {"titre":"Appartement 6 pièces · Malagnou"}')
    await act(async () => { caseDe('m24').click() })
    expect(appels.onCocher).toHaveBeenLastCalledWith('m24', true)
    await act(async () => { caseDe('m25').click() })
    expect(appels.onCocher).toHaveBeenLastCalledWith('m25', false)
    expect(appels.onCocher).toHaveBeenCalledTimes(2)
  })

  it('« Proposé · N », N les cases cochées ; la phrase entière et la touche au survol ; il propose', async () => {
    await rendre()
    expect(proposer().textContent).toBe('fil.selection.propose {"count":2}')
    expect(proposer().title).toBe(infobulle(phrase(2)))
    const appels = await rendre({ coches: ['m25'] })
    expect(proposer().textContent).toBe('fil.selection.propose {"count":1}')
    expect(proposer().title).toBe(infobulle(phrase(1)))
    expect(proposer().disabled).toBe(false)
    expect(proposer().hasAttribute('aria-describedby')).toBe(false)
    await act(async () => { proposer().click() })
    expect(appels.onProposer).toHaveBeenCalledTimes(1)
  })

  it('sans case cochée : « Proposé », désactivé, sa raison dite à côté et au lecteur d’écran', async () => {
    const appels = await rendre({ coches: [] })
    expect(proposer().textContent).toBe('fil.actions.propose')
    expect(proposer().title).toBe(infobulle('fil.selection.proposerAucun {"prenom":"Anastasia"}'))
    expect(proposer().disabled).toBe(true)
    expect(document.getElementById(proposer().getAttribute('aria-describedby') ?? '')?.textContent).toBe('fil.selection.aucunCoche')
    await act(async () => { proposer().click() })
    expect(appels.onProposer).not.toHaveBeenCalled()
  })

  it('« Voir 20 de plus » reste : il lit la suite, et le focus passe au premier bien chargé', async () => {
    const appels = await rendre({ aPlus: true })
    const voir = bouton('fil.selection.voirPlus')
    voir.focus()
    await act(async () => { voir.click() })
    expect(appels.onVoirPlus).toHaveBeenCalledTimes(1)
    await rendre({ aPlus: true, isFetching: true })
    await rendre({ matchs: [...MATCHS, TENU] })
    expect(document.activeElement).toBe(caseDe('m26'))
  })

  it('l’erreur sans liste la remplace ; « Réessayer » relit, et garde le focus quand la lecture échoue encore', async () => {
    const appels = await rendre({ isError: true, aDesDonnees: false })
    expect(hote!.querySelector('[role="alert"]')?.textContent).toBe('fil.selection.erreur')
    expect(hote!.querySelector('ul')).toBeNull()
    const reessayer = bouton('fil.reessayer')
    reessayer.focus()
    await act(async () => { reessayer.click() })
    expect(appels.onReessayer).toHaveBeenCalledTimes(1)
    await rendre({ aDesDonnees: false, isLoading: true, isFetching: true })
    expect(bouton('fil.reessayer')).toBeUndefined()
    await rendre({ isError: true, aDesDonnees: false })
    expect(document.activeElement).toBe(bouton('fil.reessayer'))
  })

  it('l’erreur après une liste la garde, et se dit dessous, à la place de « Voir 20 de plus »', async () => {
    await rendre({ isError: true, aPlus: true })
    expect(hote!.querySelectorAll('li')).toHaveLength(2)
    expect(hote!.querySelector('[role="alert"]')?.textContent).toBe('fil.selection.erreur')
    expect(bouton('fil.selection.voirPlus')).toBeUndefined()
  })

  it('le chargement et le vide se disent ; ni l’un ni l’autre ne demande de cocher', async () => {
    await rendre({ isLoading: true, coches: [] })
    expect(hote!.querySelector('[role="status"]')?.textContent).toBe('fil.chargement')
    expect(hote!.querySelector('ul')).toBeNull()
    expect(texte()).not.toContain('fil.selection.aucunCoche')
    await rendre({ matchs: [], coches: [] })
    expect(texte()).toContain('fil.selection.vide')
    expect(texte()).not.toContain('fil.selection.aucunCoche')
  })

  // Aucune porte ne garde le RETRAIT d'une clé : la parité compare les langues entre elles, `lint:i18n-keys` ne lit que
  // les clés écrites. `ligne_one` / `ligne_other` remis dans les quatre langues passent les quatre portes (mesuré).
  it.each([
    ['fr', fr, 'Proposé · {{count}}', 'Sa recherche'],
    ['en', en, 'Proposed · {{count}}', 'Their search'],
    ['de', de, 'Vorgeschlagen · {{count}}', 'Suchkriterien'],
    ['it', italien, 'Proposto · {{count}}', 'La sua ricerca'],
  ] as const)('%s : « Proposé · {{count}} » et « Sa recherche » ; « … pas encore proposés » est parti', (langue, l, propose, recherche) => {
    const s = l.fil.selection as unknown as Record<string, unknown>
    expect([s.propose_one, s.propose_other, s.rechercheAria], langue).toEqual([propose, propose, recherche])
    expect(Object.keys(s).filter((k) => k.startsWith('ligne')), langue).toEqual([])
  })
})
