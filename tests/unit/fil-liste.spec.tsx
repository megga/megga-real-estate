/**
 * La liste « À proposer » ALLÉGÉE (`FilListe`, conception du fil épuré §4), montée pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · « N acheteurs » sous un bien (ils sont listés dessous), un bien neuf écrit en toutes lettres au lieu de sa
 *     pastille « Nouveau » ;
 *   · une ligne « Marché » écrite en phrase (« 4 biens pas encore proposés · 1 en baisse ») au lieu de son compte et
 *     de ses compteurs — dont le libellé reste au survol et pour un lecteur d'écran ;
 *   · la date de retour sur la ligne des reportés (elle vit dans la liste dépliée) ;
 *   · des sous-titres longs : « À ajuster » et « Marché », lus dans le vrai fichier français.
 *
 * Et aussi, depuis la relecture de conformité de la tâche (07.10.2026) :
 *   · à l'écran, sous un bien, autre chose que son prix — un nombre d'acheteurs, quelle que soit la clé qui l'écrit,
 *     le signal en toutes lettres À CÔTÉ de sa pastille — et une pastille sur un bien sans signal ;
 *   · un compteur qui écrit sa phrase, un autre nombre que le sien, une autre icône que la sienne (la flèche d'une
 *     baisse, l'éclair d'un nouveau : la sparkle reste à l'IA), un compteur à zéro écrit, un ordre inversé ;
 *   · des reportés sans leur horloge, ou sans le chevron de leur dépli ;
 *   · un sous-titre rendu par une autre clé que la sienne ;
 *   · une valeur longue, ou une date de retour gardée, dans l'une des QUATRE langues : la parité compare des clés,
 *     jamais des valeurs, et un `{{date}}` que l'appel ne passe plus s'écrit tel quel à l'écran.
 *
 * Et depuis la relecture de qualité : un signal (pastille, flèche) que le NOM de l'en-tête ne dit pas — l'option porte un
 * `aria-label`, qui couvre son contenu : le `sr-only` d'un atome n'y est lu par personne ; et, sur l'en-tête CHOISI, la
 * pastille à côté de l'invite — à elles deux, elles laissaient 23 px au titre et au prix d'une colonne de 300.
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
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))

import FilListe from '@/components/matching-fil/FilListe'
import type { FilBien, FilMatch, FilSelectionResume, FilVue } from '@/components/matching-fil/filModele'
import type { Correction } from '@/components/matching-fil/filApprendre'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { crmPalette } from '@/components/crm/tokens'
import fr from '@/i18n/locales/fr/matching.json'
import en from '@/i18n/locales/en/matching.json'
import de from '@/i18n/locales/de/matching.json'
import italien from '@/i18n/locales/it/matching.json'

const sp = crmPalette(false)
const MAINTENANT = Date.parse('2020-01-15T12:00:00Z')
const acheteur = (id: string, prenom: string, nom: string): FilMatch['acheteur'] => ({ id, prenom, nom, telephone: null, email: null, kyc: 'none' })
const bien = (id: string, titre: string, prix: number, champs: Partial<FilBien> = {}): FilBien => ({
  id, titre, prix, location: false, type: 'apartment', pieces: 5, surface: 150, ville: 'Genève', canton: 'GE', adresse: null,
  equipements: [], photo: null, ...champs,
})
const match = (id: string, b: FilBien, a: FilMatch['acheteur'], champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score: 97, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, bien: b, acheteur: a, ...champs,
})
const JULIE = acheteur('c9', 'Julie', 'Morand')
const ANASTASIA = acheteur('c11', 'Anastasia', 'Volkova')
const EMMA = acheteur('c7', 'Emma', 'Schneider')
const ANTOINE = acheteur('c4', 'Antoine', 'Lefèvre')
/** Un mandat mis en service la veille : le signal « nouveau mandat ». */
const FLORISSANT = bien('p3', 'Attique 5,5 pièces · Florissant', 2_350_000, { mandatLe: '2020-01-14T09:00:00Z' })
const COLOGNY = bien('p6', 'Villa individuelle · Cologny', 3_200_000)
/** Refusé pour le prix à CHF 3'450'000, revenu à CHF 3'200'000. */
const antoine = match('m40', COLOGNY, ANTOINE, {
  suivi: { statut: 'suggested', proposeLe: null, reponduLe: '2020-01-10T10:00:00Z', motif: 'prix', note: null, prixPropose: 3_450_000, apprisLe: null },
})
const VUE: FilVue = {
  groupes: [
    { bien: FLORISSANT, matchs: [match('m22', FLORISSANT, ANASTASIA), match('m23', FLORISSANT, EMMA)] },
    { bien: COLOGNY, matchs: [antoine] },
  ],
  reportes: [match('m50', COLOGNY, JULIE, { reporteJusquau: '2020-01-20T09:00:00Z' })],
  compte: 3,
  ordre: ['bien:p3', 'm22', 'm23', 'bien:p6', 'm40'],
}
const SELECTIONS: FilSelectionResume[] = [
  { acheteur: EMMA, nombre: 4, meilleurScore: 100, vignettes: [], baisses: 1 },
  { acheteur: ANASTASIA, nombre: 2, meilleurScore: 95, vignettes: [], baisses: 1, nouveaux: 1 },
]
const CORRECTION: Correction = {
  cle: 'correction:cs9:prix', rechercheId: 'cs9', acheteur: JULIE, motif: 'prix', refus: [], criteres: {},
  changement: { cle: 'budget_max', avant: 1_600_000, apres: 1_550_000, location: false },
}

let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(
  vue: FilVue = VUE, selections: FilSelectionResume[] = SELECTIONS, corrections: Correction[] = [CORRECTION], courant: string | null = null,
): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(<FilListe sp={sp} vue={vue} selections={selections} corrections={corrections} courant={courant}
      onChoisir={() => {}} onReactiver={() => {}} maintenant={MAINTENANT} />)
  })
}
const texte = (): string => hote!.textContent ?? ''
const ligne = (cle: string): HTMLElement => hote!.querySelector(`[data-match="${cle}"]`) as HTMLElement
/** Le tracé d'une icône tel que MEIcon le dessine (idiome de `fil-bouton` et `fil-panneau`). */
function trace(nom: MEIconName): string {
  const boite = document.createElement('div')
  boite.innerHTML = renderToStaticMarkup(<MEIcon name={nom} />)
  return boite.querySelector('svg')!.innerHTML
}
/** Les tracés des icônes d'un élément, dans l'ordre. */
const icones = (el: Element): string[] => [...el.querySelectorAll('svg')].map((s) => s.innerHTML)
/** Ce qu'on VOIT d'un élément : son texte, moins ce qui n'est dit qu'à un lecteur d'écran. */
function visible(el: Element): string {
  const copie = el.cloneNode(true) as Element
  copie.querySelectorAll('.sr-only').forEach((n) => n.remove())
  return copie.textContent ?? ''
}
/** La sous-ligne d'une ligne « Marché » : le compte et les compteurs, parents du premier compteur. */
const sousLigne = (cle: string): HTMLElement => ligne(cle).querySelector('[title^="fil.selection."]')!.parentElement!

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilListe — la liste allégée', () => {
  it('l’en-tête d’un bien : le prix seul, et « Nouveau » en pastille, son libellé au survol', async () => {
    await rendre()
    const entete = ligne('bien:p3')
    expect(entete.textContent).toContain("CHF 2'350'000")
    expect(texte()).not.toContain('fil.acheteurs')
    const pastille = entete.querySelector('[title="fil.signal.mandatCourt"]')
    expect(pastille?.querySelector('[aria-hidden]')?.textContent).toBe('fil.signal.pastille')
    // Le nom de l'option couvre son contenu : c'est LUI qui dit « Nouveau mandat » à un lecteur d'écran.
    expect(entete.getAttribute('aria-label')).toBe('fil.quiPour.ligneAria {"titre":"Attique 5,5 pièces · Florissant","count":2} · fil.signal.mandatCourt')
    expect(ligne('bien:p6').getAttribute('aria-label')).toBe('fil.quiPour.ligneAria {"titre":"Villa individuelle · Cologny","count":1}')
    // À l'écran : le titre, le prix, le mot de la pastille — rien d'autre, quelle que soit la clé qui l'écrirait.
    expect(visible(entete)).toBe("Attique 5,5 pièces · FlorissantCHF 2'350'000fil.signal.pastille")
    // Un bien sans signal : ni pastille, ni rien après son prix.
    expect(visible(ligne('bien:p6'))).toBe("Villa individuelle · ColognyCHF 3'200'000")
  })

  it('l’en-tête CHOISI : l’invite prend la place de la pastille, et son nom garde le signal', async () => {
    await rendre(VUE, SELECTIONS, [CORRECTION], 'bien:p3')
    const entete = ligne('bien:p3')
    expect(entete.querySelector('[title="fil.signal.mandatCourt"]')).toBeNull()
    expect(visible(entete)).toBe("Attique 5,5 pièces · FlorissantCHF 2'350'000fil.quiPour.titre")
    expect(entete.getAttribute('aria-label')).toContain(' · fil.signal.mandatCourt')
  })

  it('un bien revenu par une baisse : la flèche, pas la phrase', async () => {
    await rendre()
    expect(ligne('m40').querySelector('[title^="fil.signal.court"]')).not.toBeNull()
    expect(ligne('m40').textContent).not.toContain('fil.ecartSur')
  })

  it('une ligne « Marché » : le nombre de biens, puis ses compteurs — le libellé au survol et pour un lecteur d’écran', async () => {
    await rendre()
    const selection = ligne('marche:c11')
    expect(selection.textContent).toContain('fil.selection.biens {"count":2}')
    expect(selection.textContent).not.toContain('fil.selection.ligne')
    for (const [libelle, icone] of [['fil.selection.baisses {"count":1}', 'arrow-down'], ['fil.selection.nouveaux {"count":1}', 'bolt']] as const) {
      const compteur = selection.querySelector(`[title='${libelle}']`)
      expect(compteur?.querySelector('.sr-only')?.textContent).toBe(libelle)
      // À l'écran, l'icône et le nombre, tus pour un lecteur d'écran qui lit déjà le libellé.
      const vu = [...(compteur?.children ?? [])].filter((e) => e.getAttribute('aria-hidden') != null)
      expect(vu.map((e) => e.textContent), libelle).toEqual(['', '1'])
      expect(icones(vu[0]!), libelle).toEqual([trace(icone)])
    }
  })

  it('une ligne « Marché » à l’écran : « 2 biens · ↓ 1 · ⚡ 1 », dans cet ordre, et rien pour un compteur à zéro', async () => {
    await rendre()
    expect(visible(sousLigne('marche:c11'))).toBe('fil.selection.biens {"count":2} · 1 · 1')
    expect(icones(sousLigne('marche:c11'))).toEqual([trace('arrow-down'), trace('bolt')])
    // Emma n'a que des baisses : ni éclair, ni « 0 ».
    expect(visible(sousLigne('marche:c7'))).toBe('fil.selection.biens {"count":4} · 1')
    expect(icones(sousLigne('marche:c7'))).toEqual([trace('arrow-down')])
  })

  it('les reportés : leur nombre, sans la date de retour, qui vit dans la liste dépliée', async () => {
    await rendre()
    const bouton = [...hote!.querySelectorAll('button[aria-expanded]')].at(-1) as HTMLButtonElement
    expect(bouton.textContent).toBe('fil.reportes {"count":1}')
    // L'horloge d'abord ; le chevron du dépli reste : retirer la date ne retire pas l'affordance.
    expect(icones(bouton)).toEqual([trace('clock'), trace('chevron-down')])
    expect(texte()).not.toContain('fil.deRetour')
    await act(async () => { bouton.click() })
    expect(bouton.getAttribute('aria-expanded')).toBe('true')
    expect(icones(bouton)).toEqual([trace('clock'), trace('chevron-up')])
    expect(texte()).toContain('fil.deRetour {"date":"20.01"}')
  })

  it('les sous-titres rendus : « À ajuster », « Vos biens », « Marché », chacun par sa clé', async () => {
    await rendre()
    expect([...hote!.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['fil.corrections.section', 'fil.vosBiens', 'fil.marche'])
  })

  it.each([
    ['fr', fr, 'À ajuster', 'Vos biens', 'Marché', ['{{count}} reporté', '{{count}} reportés'], ['{{count}} bien', '{{count}} biens']],
    ['en', en, 'To adjust', 'Your properties', 'Market', ['{{count}} postponed', '{{count}} postponed'], ['{{count}} property', '{{count}} properties']],
    ['de', de, 'Anzupassen', 'Ihre Objekte', 'Markt', ['{{count}} zurückgestellt', '{{count}} zurückgestellt'], ['{{count}} Objekt', '{{count}} Objekte']],
    ['it', italien, 'Da adattare', 'I Suoi immobili', 'Mercato', ['{{count}} rinviato', '{{count}} rinviati'], ['{{count}} immobile', '{{count}} immobili']],
  ] as const)('%s : les valeurs courtes, au singulier comme au pluriel, et plus de « N acheteurs »', (langue, l, section, vosBiens, marche, reportes, biens) => {
    expect(l.fil.corrections.section, langue).toBe(section)
    expect(l.fil.vosBiens, langue).toBe(vosBiens)
    expect(l.fil.marche, langue).toBe(marche)
    expect([l.fil.reportes_one, l.fil.reportes_other], langue).toEqual(reportes)
    expect([l.fil.selection.biens_one, l.fil.selection.biens_other], langue).toEqual(biens)
    expect(Object.keys(l.fil).filter((k) => k.startsWith('acheteurs')), langue).toEqual([])
  })
})

describe('FilListe — l’en-tête d’une annonce en baisse', () => {
  // « À proposer » ne lit aujourd'hui que des mandats (`useMatchingFil`, `not(property_id, is, null)`) : une annonce n'y
  // a pas d'en-tête. `EnTeteBien` garde pourtant sa baisse (01.10.2026) : en flèche, et sans pastille « Nouveau ».
  it('la flèche après le prix, ni phrase ni pastille', async () => {
    const annonce = bien('ml1', 'Appartement 4 pièces · Champel', 1_900_000, {
      marche: { ref: 'ml1', sourceUrl: null }, prixInitial: 2_000_000, baisseLe: '2020-01-12T09:00:00Z',
    })
    await rendre({ groupes: [{ bien: annonce, matchs: [match('m60', annonce, EMMA)] }], reportes: [], compte: 1, ordre: ['bien:ml1', 'm60'] }, [], [])
    const entete = ligne('bien:ml1')
    expect(entete.querySelector('[title^="fil.signal.court"]')).not.toBeNull()
    expect(visible(entete)).toBe("Appartement 4 pièces · ChampelCHF 1'900'000 · CHF 100'000")
    expect(entete.getAttribute('aria-label'))
      .toBe('fil.quiPour.ligneAria {"titre":"Appartement 4 pièces · Champel","count":1} · fil.signal.court {"montant":"CHF 100\'000"}')
  })
})
