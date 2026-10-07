/**
 * « En attente » ALLÉGÉ (`FilRetours`, conception du fil épuré §6), monté pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · sous le nom, la phrase « 2 biens proposés attendent sa réponse · relance … », ou toute autre ligne : l'en-tête est
 *     le nom seul (il ouvre le contact), et la pastille d'une relance DUE ;
 *   · une relance due qui ne se dirait pas — sa pastille : l'alerte ambre et « Relance », la date au survol et pour un
 *     lecteur d'écran —, ou une relance à venir dite deux fois (la liste la date) ;
 *   · une carte sans sa vignette, son titre, « CHF … · 27.09 » (le prix d'AUJOURD'HUI, que suit la flèche, et la date
 *     courte de la proposition), sa flèche ou son score ; la ville, « proposé le », la phrase longue d'une baisse ; un
 *     mandat hors vente qui tairait son état ;
 *   · une réponse qui perdrait son mot, sa touche (dans l'infobulle et `aria-keyshortcuts`, jamais sur la face) ou son
 *     geste : les gestes, le motif de refus et les prises du clavier du fil (`data-retour`, `data-bien`) ne changent
 *     pas (conception §9) ;
 *   · « Relance » qui ne serait plus un mot, ou une clé retirée revenue, dans l'une des QUATRE langues.
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

import FilRetours from '@/components/matching-fil/FilRetours'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { FilBien, FilMatch } from '@/components/matching-fil/filModele'
import { MOTIFS_REFUS, type FilAttente } from '@/components/matching-fil/filBoucle'
import { encreAccent, teinteEcart } from '@/components/matching-fil/filAffichage'
import { crmPalette } from '@/components/crm/tokens'
import fr from '@/i18n/locales/fr/matching.json'
import en from '@/i18n/locales/en/matching.json'
import de from '@/i18n/locales/de/matching.json'
import italien from '@/i18n/locales/it/matching.json'

const sp = crmPalette(false)
const EMMA: FilMatch['acheteur'] = { id: 'c7', prenom: 'Emma', nom: 'Schneider', telephone: null, email: null, kyc: 'none' }
const OERLIKON: FilBien = {
  id: 'ml-o', titre: 'Attique 4,5 pièces · Oerlikon', prix: 2_650_000, location: false, type: 'apartment', pieces: 4.5,
  surface: 140, ville: 'Zürich', canton: 'ZH', adresse: null, equipements: [], photo: null,
}
/** Proposé le 27.09 à CHF 2'700'000 : le prix a baissé de CHF 50'000 depuis. */
const PROPOSE: FilMatch = {
  id: 'm60', score: 100, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, bien: OERLIKON, acheteur: EMMA,
  suivi: { statut: 'sent', proposeLe: '2020-09-27T10:00:00Z', reponduLe: null, motif: null, note: null, prixPropose: 2_700_000, apprisLe: null },
}
const attente = (champs: Partial<FilAttente>): FilAttente => ({ acheteur: EMMA, matchs: [PROPOSE], echeance: '2020-09-30T09:00:00Z', due: true, ...champs })
const gestes = () => ({
  onInteresse: vi.fn(), onPasInteresse: vi.fn(), onMotif: vi.fn(), onFermerMotifs: vi.fn(), onPasEncore: vi.fn(), onVoirContact: vi.fn(),
})

let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(a: FilAttente, motifsPour: string | null = null): Promise<ReturnType<typeof gestes>> {
  const g = gestes()
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(<FilRetours sp={sp} attente={a} motifsPour={motifsPour} {...g} />)
  })
  return g
}
const texte = (): string => hote!.textContent ?? ''
const bouton = (libelle: string): HTMLButtonElement => [...hote!.querySelectorAll('button')].find((b) => b.textContent === libelle)!
/** Ce qu'on VOIT d'un élément : son texte, moins ce qui n'est dit qu'à un lecteur d'écran (idiome de `fil-correction`). */
const visible = (el: Element): string => {
  const copie = el.cloneNode(true) as HTMLElement
  copie.querySelectorAll('.sr-only').forEach((e) => e.remove())
  return copie.textContent ?? ''
}
/** Ce que l'en-tête ÉCRIT à l'écran, élément par élément — l'avatar (`aria-hidden`) mis à part. */
const entete = (): string[] =>
  [...hote!.querySelector('section')!.firstElementChild!.children].filter((e) => !e.hasAttribute('aria-hidden')).map(visible)
/** La carte du bien : la prise du clavier du fil (`data-retour`). */
const carte = (): HTMLElement => hote!.querySelector('[data-retour="m60"]') as HTMLElement
/** La ligne de détails d'une carte, jusqu'à la flèche : son premier nœud de texte qui dit un montant. */
const details = (c: Element): string | null | undefined =>
  [...c.querySelectorAll('span')].map((s) => s.firstChild).find((n) => n?.nodeType === Node.TEXT_NODE && n.textContent!.includes('CHF'))?.textContent
/** Le tracé d'une icône tel que MEIcon le dessine (idiome de `fil-bouton`, `fil-panneau` et `fil-liste`). */
function trace(nom: MEIconName): string {
  const boite = document.createElement('div')
  boite.innerHTML = renderToStaticMarkup(<MEIcon name={nom} />)
  return boite.querySelector('svg')!.innerHTML
}
const icones = (el: Element): string[] => [...el.querySelectorAll('svg')].map((s) => s.innerHTML)
/** Une couleur telle que le DOM la relit (jsdom écrit `rgb(…)` ce qu'on lui donne en hexadécimal). */
function couleur(c: string): string {
  const e = document.createElement('i')
  e.style.color = c
  return e.style.color
}
const REPONSES = [['fil.retours.interesse', 'I'], ['fil.retours.pasInteresse', 'N'], ['fil.retours.pasEncore', 'P']] as const

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('FilRetours — « En attente » allégé', () => {
  it('le nom seul ; une relance due en pastille — l’alerte ambre, sa date au survol et pour un lecteur d’écran', async () => {
    const g = await rendre(attente({}))
    expect(texte()).not.toContain('fil.retours.sousTitre')
    expect(entete()).toEqual(['Emma Schneider', 'fil.retours.relance'])
    const pastille = hote!.querySelector('[title^="fil.attente.relanceDue"]')!
    expect(pastille.getAttribute('title')).toBe('fil.attente.relanceDue {"date":"30.09"}')
    // Un lecteur d'écran n'a pas le survol : la date lui est dite, et l'icône et le mot, tus, ne le sont pas deux fois.
    expect(pastille.querySelector('.sr-only')?.textContent).toBe('fil.attente.relanceDue {"date":"30.09"}')
    const vu = [...pastille.children].filter((e) => e.getAttribute('aria-hidden') != null)
    expect(vu.map((e) => e.textContent)).toEqual(['', 'fil.retours.relance'])
    // La couleur est portée par l'icône ; le mot reste à l'encre.
    expect(icones(pastille)).toEqual([trace('alert')])
    expect(pastille.querySelector('svg')!.getAttribute('stroke')).toBe(teinteEcart(sp))
    await act(async () => { bouton('Emma Schneider').click() })
    expect(g.onVoirContact).toHaveBeenCalledTimes(1)
  })

  it('une relance à venir ne se dit pas ici : la ligne de la liste la date déjà', async () => {
    await rendre(attente({ due: false }))
    expect(entete()).toEqual(['Emma Schneider'])
    expect(texte()).not.toContain('fil.retours.relance')
    expect(texte()).not.toContain('fil.attente.relance')
  })

  it('un bien proposé : vignette, titre, son prix d’aujourd’hui et la date de la proposition, sa baisse en flèche, le score ; ni la ville, ni « proposé le »', async () => {
    await rendre(attente({}))
    const c = carte()
    expect(c.textContent).toContain('Attique 4,5 pièces · Oerlikon')
    // Le prix d'aujourd'hui (2'650'000), pas celui de la proposition (2'700'000) : la flèche dit l'écart entre les deux.
    expect(details(c)).toBe("CHF 2'650'000 · 27.09")
    expect(c.querySelector('[title^="fil.signal.court"]')?.getAttribute('title')).toBe('fil.signal.court {"montant":"CHF 50\'000"}')
    // La vignette (sans photo, la maison) puis la flèche : aucune autre icône dans la carte.
    expect(icones(c)).toEqual([trace('home'), trace('arrow-down')])
    expect(c.querySelector('[title^="fil.scoreAria"]')?.getAttribute('title')).toBe('fil.scoreAria {"score":100,"palier":"fil.palier.fort"}')
    for (const retire of ['Zürich', 'fil.retours.proposeLe', 'fil.signal.baissePropose']) expect(texte()).not.toContain(retire)
  })

  it('un mandat qui n’est plus en vente garde sa place : son état en tête du bien (lot E1)', async () => {
    await rendre(attente({ matchs: [{ ...PROPOSE, bien: { ...OERLIKON, enVente: false, statut: 'sold' } }] }))
    expect(details(carte())).toBe("listings:status.sold · CHF 2'650'000 · 27.09")
  })

  it('trois réponses à leur mot ; la touche dans l’infobulle et `aria-keyshortcuts`, jamais sur la face', async () => {
    await rendre(attente({}))
    expect([...carte().querySelectorAll('[role="group"] button')].map((b) => b.textContent)).toEqual(REPONSES.map(([mot]) => mot))
    for (const [mot, touche] of REPONSES) {
      expect(bouton(mot).getAttribute('aria-keyshortcuts')).toBe(touche)
      expect(bouton(mot).getAttribute('title')).toContain(`"touche":"${touche}"`)
    }
    expect(hote!.querySelector('kbd')).toBeNull()
    // « Intéressé » est le geste principal (l'accent), et le focus y revient après un geste annulé (`data-bien`).
    const interesse = bouton('fil.retours.interesse')
    expect(interesse.getAttribute('data-bien')).toBe('m60')
    expect(interesse.style.backgroundColor).toBe(couleur(sp.accent))
    for (const autre of ['fil.retours.pasInteresse', 'fil.retours.pasEncore']) expect(bouton(autre).style.backgroundColor).toBe('transparent')
  })

  it('chaque réponse appelle son geste, sur son bien', async () => {
    const g = await rendre(attente({}))
    await act(async () => { bouton('fil.retours.interesse').click() })
    await act(async () => { bouton('fil.retours.pasInteresse').click() })
    await act(async () => { bouton('fil.retours.pasEncore').click() })
    for (const geste of [g.onInteresse, g.onPasInteresse, g.onPasEncore]) {
      expect(geste).toHaveBeenCalledTimes(1)
      expect(geste).toHaveBeenCalledWith(PROPOSE)
    }
    expect(g.onMotif).not.toHaveBeenCalled()
  })

  it('le motif de refus : fermé par défaut ; ouvert, il se dit (`aria-expanded`, l’accent) et se consigne sur son bien', async () => {
    await rendre(attente({}))
    expect(bouton('fil.retours.pasInteresse').getAttribute('aria-expanded')).toBe('false')
    expect(hote!.querySelector('[aria-label="fil.motifsAide"]')).toBeNull()
    expect(carte().style.borderColor).toBe(couleur(sp.cardBorder))
    act(() => racine!.unmount())
    hote!.remove()

    const g = await rendre(attente({}), 'm60')
    expect(bouton('fil.retours.pasInteresse').getAttribute('aria-expanded')).toBe('true')
    // L'élément ACTIF porte l'accent (CLAUDE.md §3) : le bien dont on choisit le motif.
    expect(carte().style.borderColor).toBe(couleur(encreAccent(sp)))
    const motifs = carte().querySelector('[role="group"][aria-label="fil.motifsAide"]')
    expect(motifs).not.toBeNull()
    await act(async () => { (motifs!.querySelector('[aria-keyshortcuts="1"]') as HTMLButtonElement).click() })
    expect(g.onMotif).toHaveBeenCalledWith(PROPOSE, MOTIFS_REFUS[0], null)
  })

  // Aucune porte ne garde le RETRAIT d'une clé : la parité compare les langues entre elles, `lint:i18n-keys` ne lit que
  // les clés écrites. Une clé laissée dans les quatre langues passerait partout.
  it.each([
    ['fr', fr, 'Relance'], ['en', en, 'Follow-up'], ['de', de, 'Nachfassen'], ['it', italien, 'Sollecito'],
  ] as const)('%s : « Relance » en un mot ; ni la phrase sous le nom, ni « proposé le »', (langue, l, relance) => {
    expect(l.fil.retours.relance, langue).toBe(relance)
    expect(Object.keys(l.fil.retours).filter((k) => /^(sousTitre|proposeLe)/.test(k)), langue).toEqual([])
  })
})
