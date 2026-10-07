/**
 * La recherche à ajuster ALLÉGÉE (`FilCorrection`, conception du fil épuré §5), montée pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · une phrase que la conception retire : « Refusé 2 fois pour … », « Recherche : … », les titres « Les biens
 *     refusés » et « La correction proposée » (ils restent des noms ACCESSIBLES), « refusé le », pièces, surface et ville
 *     d'un bien refusé ;
 *   · une correction qui ne se lirait pas avant → après : l'ancienne valeur barrée, la nouvelle dans son champ ;
 *   · « aujourd'hui : … » perdu pour un lecteur d'écran, ou écrit à l'écran quand la saisie est valide ;
 *   · une saisie refusée qui ne dirait pas pourquoi.
 *
 * Et aussi, depuis la relecture de conformité de la tâche (07.10.2026) :
 *   · « Recherche : … » revenu sous sa garde d'origine : les refus portent leurs critères, comme ceux que
 *     `construireCorrections` retient — sans eux, la ligne ne pouvait pas s'écrire et son absence ne prouvait rien ;
 *   · un titre de section revenu à l'écran sous une autre balise qu'un `h3`, une pastille du motif qu'on ne verrait pas ;
 *   · un bien refusé sans son titre ou sans sa vignette, ou à son prix d'AUJOURD'HUI au lieu de celui où on l'a
 *     proposé (les deux étaient égaux dans les données : l'un passait pour l'autre) ;
 *   · une valeur d'aujourd'hui non barrée, posée après le champ, lue deux fois (elle est `aria-hidden`), sans flèche
 *     vers le champ, ou une phrase « aujourd'hui : … » que le champ ne désigne plus (`aria-describedby`) ;
 *   · la surface, les pièces, une borne absente (« Sans maximum »), le type et les équipements, qu'aucun test ne
 *     montait ; des quartiers ou un type lus après → avant ;
 *   · les gestes, que la réécriture ne devait pas toucher (conception §9) : « Ajuster » qui n'envoie pas la seule clé
 *     corrigée, à la valeur saisie, ou qui part sur une saisie refusée ou pendant l'envoi ; « Ignorer » qui ajuste ;
 *     le nom qui n'ouvre plus le contact ;
 *   · une valeur longue, ou une clé retirée revenue, dans l'une des QUATRE langues : la parité compare des clés,
 *     jamais des valeurs.
 *
 * Et depuis la relecture de qualité : des quartiers ou un type dont l'ancien ne serait dit que par son barré — que tous les
 * lecteurs d'écran n'annoncent pas : « Quartiers, Champel, Genève, GE » ne dit plus ce qui part — au lieu de
 * « aujourd'hui : … », comme un nombre ; des pièces pré-remplies « 5.5 » à côté d'un « 4,5 » barré ; une valeur pré-remplie
 * qui ne repartirait pas telle quelle ; un loyer dit comme un prix de vente, sans « / mois ».
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

import FilCorrection from '@/components/matching-fil/FilCorrection'
import type { FilBien, FilMatch } from '@/components/matching-fil/filModele'
import type { Correction } from '@/components/matching-fil/filApprendre'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { crmPalette } from '@/components/crm/tokens'
import fr from '@/i18n/locales/fr/matching.json'
import en from '@/i18n/locales/en/matching.json'
import de from '@/i18n/locales/de/matching.json'
import italien from '@/i18n/locales/it/matching.json'

const sp = crmPalette(false)
const JULIE: FilMatch['acheteur'] = { id: 'c9', prenom: 'Julie', nom: 'Morand', telephone: null, email: null, kyc: 'none' }
const CRITERES: Correction['criteres'] = { transaction_type: 'buy', budget_min: 1_300_000, budget_max: 1_600_000 }
const PHOTO = 'https://images.test/ml2.jpg'
const bien = (id: string, titre: string, prix: number, pieces: number, surface: number, photo: string | null = null): FilBien => ({
  id, titre, prix, location: false, type: 'apartment', pieces, surface, ville: 'Genève', canton: 'GE', adresse: null,
  equipements: [], photo,
})
/** Un refus, au prix où le bien a été PROPOSÉ — celui d'aujourd'hui sauf mention contraire. */
const refus = (id: string, b: FilBien, le: string, note: string | null, prixPropose: number | null = b.prix): FilMatch => ({
  id, score: 97, raisons: null, criteres: CRITERES, creeLe: null, reporteJusquau: null, rechercheId: 'cs9', bien: b, acheteur: JULIE,
  suivi: { statut: 'rejected', proposeLe: null, reponduLe: le, motif: 'prix', note, prixPropose, apprisLe: null },
})
const correction = (changement: Correction['changement'], criteres: Correction['criteres'] = CRITERES): Correction => ({
  cle: 'correction:cs9:prix', rechercheId: 'cs9', acheteur: JULIE, motif: 'prix',
  refus: [
    // Proposé à CHF 1'560'000, baissé depuis à CHF 1'490'000 : l'acheteur a dit non au premier.
    refus('m14', bien('ml2', 'Appartement 5 pièces · Servette', 1_490_000, 5, 118, PHOTO), '2020-09-30T10:00:00Z', null, 1_560_000),
    refus('m16', bien('ml5', 'Attique 4,5 pièces · Malagnou', 1_580_000, 4.5, 112), '2020-09-23T10:00:00Z', 'Au-dessus de ce que sa banque suit.'),
  ],
  criteres,
  changement,
})
const BUDGET = correction({ cle: 'budget_max', avant: 1_600_000, apres: 1_550_000, location: false })

const gestes = () => ({ onAjuster: vi.fn(), onIgnorer: vi.fn(), onVoirContact: vi.fn() })
type Gestes = ReturnType<typeof gestes>
let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(c: Correction, occupe = false): Promise<Gestes> {
  const g = gestes()
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(<FilCorrection sp={sp} correction={c} occupe={occupe} {...g} />)
  })
  return g
}
const texte = (): string => hote!.textContent ?? ''
/** Ce qu'on VOIT d'un élément : son texte, moins ce qui n'est dit qu'à un lecteur d'écran. */
const visible = (el: Element = hote!): string => {
  const copie = el.cloneNode(true) as HTMLElement
  copie.querySelectorAll('.sr-only').forEach((e) => e.remove())
  return copie.textContent ?? ''
}
/** Ce qu'un lecteur d'écran lit d'un élément : son texte, moins ce qui est tu (`aria-hidden`). */
const lu = (el: Element = hote!): string => {
  const copie = el.cloneNode(true) as HTMLElement
  copie.querySelectorAll('[aria-hidden="true"]').forEach((e) => e.remove())
  return copie.textContent ?? ''
}
const groupe = (): HTMLElement => hote!.querySelector('[role="group"]') as HTMLElement
const champ = (): HTMLInputElement => hote!.querySelector('input') as HTMLInputElement
function bouton(nom: string): HTMLButtonElement {
  const b = [...hote!.querySelectorAll('button')].find((e) => e.textContent === nom)
  expect(b, `le bouton « ${nom} »`).toBeDefined()
  return b!
}
/** L'élément du groupe qui porte ce texte, lui et pas son parent. */
function porteur(valeur: string): HTMLElement {
  const e = [...groupe().querySelectorAll<HTMLElement>('*')]
    .find((x) => x.textContent === valeur && [...x.children].every((f) => f.textContent !== valeur))
  expect(e, `« ${valeur} » dans la correction`).toBeDefined()
  return e!
}
/** Barré : par sa balise ou par son style. */
const barre = (e: HTMLElement): boolean => e.closest('s, del') != null || e.style.textDecoration.includes('line-through')
const avantDans = (a: Node, b: Node): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
/** Le tracé d'une icône tel que MEIcon le dessine (idiome de `fil-bouton`, `fil-panneau` et `fil-liste`). */
function trace(nom: MEIconName): string {
  const boite = document.createElement('div')
  boite.innerHTML = renderToStaticMarkup(<MEIcon name={nom} />)
  return boite.querySelector('svg')!.innerHTML
}
const icones = (el: Element): string[] => [...el.querySelectorAll('svg')].map((s) => s.innerHTML)
async function saisir(valeur: string): Promise<void> {
  const c = champ()
  const fixer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    fixer.call(c, valeur)
    c.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
/** Ce que le mock écrit pour une clé et ses valeurs. */
const cle = (k: string, o?: Record<string, unknown>): string => (o ? `${k} ${JSON.stringify(o)}` : k)

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilCorrection — la recherche à ajuster allégée', () => {
  it('le motif en pastille ; ni « Refusé 2 fois pour … », ni « Recherche : … », ni titres', async () => {
    await rendre(BUDGET)
    const motif = 'fil.corrections.ligne {"motif":"fil.motifs.prix","count":2}'
    expect(visible()).toContain(motif)
    // Le mot dit tout : un lecteur d'écran le lit tel quel (`FilPastille` ne tait son texte que si un `libelle` le dit).
    expect(lu()).toContain(motif)
    for (const retire of ['fil.corrections.sousTitre', 'fil.selection.recherche']) expect(texte()).not.toContain(retire)
    expect(hote!.querySelector('h3')).toBeNull()
    // Ni sous une autre balise : ils ne restent que des noms accessibles.
    for (const titre of ['fil.corrections.pourquoi', 'fil.corrections.proposition']) expect(texte()).not.toContain(titre)
    expect(hote!.querySelector('ul[aria-label="fil.corrections.pourquoi"]')).not.toBeNull()
    expect(hote!.querySelector('[role="group"][aria-label="fil.corrections.proposition"]')).not.toBeNull()
  })

  it('un bien refusé : sa vignette, son titre, le prix où on l’a PROPOSÉ et la date du refus, la note de l’acheteur ; ni pièces, ni surface, ni ville, ni « refusé le »', async () => {
    await rendre(BUDGET)
    expect(texte()).toContain("CHF 1'560'000 · 30.09")
    expect(texte()).toContain('Au-dessus de ce que sa banque suit.')
    for (const retire of ['fil.selection.pieces', 'fil.valeurs.m2', 'Genève', 'fil.corrections.refuseLe']) expect(texte()).not.toContain(retire)
    const cartes = [...hote!.querySelectorAll('ul[aria-label="fil.corrections.pourquoi"] > li')]
    expect(cartes.map((li) => visible(li))).toEqual([
      "Appartement 5 pièces · ServetteCHF 1'560'000 · 30.09",
      "Attique 4,5 pièces · MalagnouCHF 1'580'000 · 23.09Au-dessus de ce que sa banque suit.",
    ])
    expect(cartes[0]!.querySelector('img')?.getAttribute('src')).toBe(PHOTO)
    expect(icones(cartes[1]!)).toEqual([trace('home')])
  })

  it('le budget se lit avant → après : l’ancien barré devant son champ, le nouveau dedans ; « aujourd’hui » pour un lecteur d’écran', async () => {
    await rendre(BUDGET)
    expect(visible()).toContain("CHF 1'600'000")
    expect(champ().value).toBe("1'550'000")
    const aide = hote!.querySelector('[id]:not(input).sr-only')
    expect(aide?.textContent).toBe('fil.corrections.avant {"valeur":"CHF 1\'600\'000"}')
    expect(visible()).not.toContain('fil.corrections.avant')
    expect(champ().getAttribute('aria-describedby')).toBe(aide?.id)
    expect(hote!.querySelector(`label[for="${champ().id}"]`)?.textContent).toBe('fil.corrections.budget')
    const ancien = porteur("CHF 1'600'000")
    expect(barre(ancien)).toBe(true)
    expect(ancien.getAttribute('aria-hidden'), 'dite par « aujourd’hui : … », elle n’est pas lue deux fois').toBe('true')
    expect(avantDans(ancien, champ())).toBe(true)
    expect(icones(groupe())).toEqual([trace('arrow-right')])
  })

  it.each([
    ['une surface', { cle: 'surface_min', avant: 110, apres: 120 }, 'fil.corrections.surface', cle('fil.valeurs.m2', { valeur: '110' }), '120',
      cle('fil.corrections.avant', { valeur: cle('fil.valeurs.m2', { valeur: '110' }) })],
    ['des pièces', { cle: 'rooms_min', avant: 4.5, apres: 5.5 }, 'fil.corrections.pieces', '4,5', '5,5', cle('fil.corrections.avant', { valeur: '4,5' })],
    ['un budget sans maximum', { cle: 'budget_max', avant: null, apres: 1_550_000, location: false }, 'fil.corrections.budget',
      'fil.corrections.sansMaxCourt', "1'550'000", 'fil.corrections.sansMax'],
    ['une surface sans minimum', { cle: 'surface_min', avant: null, apres: 120 }, 'fil.corrections.surface', 'fil.corrections.sansMinCourt', '120',
      'fil.corrections.sansMin'],
  ] satisfies [string, Correction['changement'], string, string, string, string][])(
    '%s : son libellé, l’ancienne valeur barrée devant le champ, la phrase entière pour un lecteur d’écran',
    async (_cas, changement, libelle, ancienne, saisie, phrase) => {
      const g = await rendre(correction(changement))
      expect(visible(groupe())).toBe(libelle + ancienne)
      expect(champ().value).toBe(saisie)
      expect(barre(porteur(ancienne))).toBe(true)
      expect(avantDans(porteur(ancienne), champ())).toBe(true)
      expect(document.getElementById(champ().getAttribute('aria-describedby') ?? '')?.textContent).toBe(phrase)
      // Ce qu'on lit pré-rempli est ce qui part : « 5,5 » repart 5.5.
      await act(async () => { bouton('fil.corrections.valider').click() })
      expect(g.onAjuster).toHaveBeenLastCalledWith(changement)
    },
  )

  it('un loyer : « / mois » sur la valeur barrée, dans la phrase, et dans la borne d’une saisie refusée', async () => {
    await rendre(correction({ cle: 'budget_max', avant: 3_000, apres: 2_950, location: true },
      { transaction_type: 'rent', budget_min: 2_000, budget_max: 3_000 }))
    const ancienne = cle('fil.valeurs.parMois', { valeur: "CHF 3'000" })
    expect(barre(porteur(ancienne))).toBe(true)
    expect(champ().value).toBe("2'950")
    expect(document.getElementById(champ().getAttribute('aria-describedby') ?? '')?.textContent).toBe(cle('fil.corrections.avant', { valeur: ancienne }))
    await saisir("1'500")
    expect(visible()).toContain(cle('fil.corrections.sousMinimum', { valeur: cle('fil.valeurs.parMois', { valeur: "CHF 2'000" }) }))
  })

  it('une saisie refusée dit pourquoi, à l’écran, et « Ajuster » ne part pas', async () => {
    const g = await rendre(BUDGET)
    await saisir('abc')
    expect(visible()).toContain('fil.corrections.valeurInvalide')
    await saisir("1'200'000")
    expect(visible()).toContain(cle('fil.corrections.sousMinimum', { valeur: "CHF 1'300'000" }))
    const ajuster = bouton('fil.corrections.valider')
    expect(ajuster.disabled).toBe(true)
    await act(async () => { ajuster.click() })
    expect(g.onAjuster).not.toHaveBeenCalled()
  })

  it('« Ajuster » envoie la seule clé corrigée, à la valeur saisie ; « Ignorer » ignore ; le nom ouvre le contact', async () => {
    const g = await rendre(BUDGET)
    await act(async () => { bouton('fil.corrections.valider').click() })
    expect(g.onAjuster).toHaveBeenLastCalledWith({ cle: 'budget_max', avant: 1_600_000, apres: 1_550_000, location: false })
    await saisir("1'500'000")
    await act(async () => { bouton('fil.corrections.valider').click() })
    expect(g.onAjuster).toHaveBeenLastCalledWith({ cle: 'budget_max', avant: 1_600_000, apres: 1_500_000, location: false })
    await act(async () => { bouton('fil.corrections.ignorer').click() })
    expect(g.onIgnorer).toHaveBeenCalledTimes(1)
    expect(g.onAjuster).toHaveBeenCalledTimes(2)
    await act(async () => { bouton('Julie Morand').click() })
    expect(g.onVoirContact).toHaveBeenCalledTimes(1)
  })

  it('pendant l’envoi, les deux gestes se grisent', async () => {
    const g = await rendre(BUDGET, true)
    for (const nom of ['fil.corrections.valider', 'fil.corrections.ignorer']) {
      const b = bouton(nom)
      expect(b.disabled, nom).toBe(true)
      await act(async () => { b.click() })
    }
    expect(g.onAjuster).not.toHaveBeenCalled()
    expect(g.onIgnorer).not.toHaveBeenCalled()
  })

  it('des zones retirées : celles qui partent, barrées, puis celles qui restent ; « aujourd’hui » pour un lecteur d’écran', async () => {
    await rendre(correction({ cle: 'zones', retirees: ['Champel'], apres: ['Genève', 'GE'] }, { ...CRITERES, zones: ['Champel', 'Genève', 'GE'] }))
    expect(hote!.querySelector('s')?.textContent).toBe('Champel')
    expect(texte()).toContain('Genève, GE')
    expect(visible(groupe())).toBe('fil.corrections.zonesChampelGenève, GE')
    expect(icones(groupe())).toEqual([trace('arrow-right')])
    // Le barré ne s'annonce pas partout : muet, il est dit — les quartiers d'aujourd'hui, en entier.
    expect(hote!.querySelector('s')?.getAttribute('aria-hidden')).toBe('true')
    expect(groupe().querySelector('.sr-only')?.textContent).toBe(cle('fil.corrections.avant', { valeur: 'Champel, Genève, GE' }))
  })

  it.each([
    ['un type', 'apartment', cle('fil.types.apartment', { defaultValue: 'apartment' })],
    ['tous les types', null, 'fil.corrections.tousTypes'],
  ] as const)('le type, depuis %s : l’ancien barré, une flèche, le nouveau ; « aujourd’hui » pour un lecteur d’écran', async (_cas, avant, ancien) => {
    await rendre(correction({ cle: 'type', avant, apres: 'house' }))
    expect(hote!.querySelector('s')?.textContent).toBe(ancien)
    expect(visible(groupe())).toBe(`fil.corrections.type${ancien}${cle('fil.types.house', { defaultValue: 'house' })}`)
    expect(icones(groupe())).toEqual([trace('arrow-right')])
    expect(hote!.querySelector('s')?.getAttribute('aria-hidden')).toBe('true')
    expect(groupe().querySelector('.sr-only')?.textContent).toBe(cle('fil.corrections.avant', { valeur: ancien }))
  })

  it('des équipements ajoutés : « + » et leurs noms, sous leur libellé', async () => {
    await rendre(correction({ cle: 'features', ajoutes: ['vue lac'], apres: ['balcon', 'vue lac'] }))
    expect(visible(groupe())).toBe(`fil.corrections.equipements+ ${cle('fil.equipementsNoms.vue-lac', { defaultValue: 'vue lac' })}`)
  })

  it.each([
    ['fr', fr, ['Budget max', 'Surface min', 'Pièces min', 'Quartiers', 'Type', 'Tous les types', 'Équipements', 'Ajuster', 'Sans maximum', 'Sans minimum']],
    ['en', en, ['Max budget', 'Min surface', 'Min rooms', 'Areas', 'Type', 'All types', 'Features', 'Adjust', 'No maximum', 'No minimum']],
    ['de', de, ['Max. Budget', 'Min. Fläche', 'Min. Zimmer', 'Gegenden', 'Typ', 'Alle Objektarten', 'Ausstattung', 'Anpassen', 'Ohne Maximum', 'Ohne Minimum']],
    ['it', italien, ['Budget max', 'Superficie min', 'Locali min', 'Zone', 'Tipo', 'Tutti i tipi', 'Dotazioni', 'Adatta', 'Senza massimo', 'Senza minimo']],
  ] as const)('%s : des libellés courts, « Ajuster », et aucune des quatre clés retirées', (langue, l, valeurs) => {
    const c = l.fil.corrections
    expect([c.budget, c.surface, c.pieces, c.zones, c.type, c.tousTypes, c.equipements, c.valider, c.sansMaxCourt, c.sansMinCourt], langue)
      .toEqual([...valeurs])
    expect(Object.keys(c).filter((k) => /^(sousTitre|refuseLe|zonesApres|typeAvant)/.test(k)), langue).toEqual([])
  })
})
