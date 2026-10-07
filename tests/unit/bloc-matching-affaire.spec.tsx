/**
 * Le bloc « Matching » de la fiche d'affaire (`BlocMatchingAffaire`, étape 5b-1, conception
 * `2026-09-30-fiche-affaire-matching-design.md` §4), monté pour de vrai.
 *
 * Ce que cette spec refuse :
 *   · un état écrit autrement que dans « Qui pour ce bien ? » ; un mandat hors vente qui tairait son état ;
 *   · un score écrit autrement qu'en `FilScore` (« 92 % » était l'écriture du bloc d'avant) ;
 *   · une ligne qui mènerait ailleurs qu'à la place du bien dans le fil, ou sans jeton d'arrivée ;
 *   · une ligne sans place (une visite planifiée) qui se donnerait pour un bouton — balise, rôle, focus ou curseur ;
 *   · une lecture en cours qui montrerait des lignes, ou une lecture en cours ou en échec lue comme une liste vide ; un
 *     échec qu'un lecteur d'écran ne dirait pas ; un « Réessayer » qui ne relirait rien ;
 *   · une location sans « / mois » ; un palier qui ne suivrait pas le score ;
 *   · une liste qui ne serait pas un repère de position : les textes `sr-only` de `FilScore` déborderaient sur le pager.
 *
 * Idiome `createRoot` + `act` du dépôt. Mock partiel de react-i18next : la clé EST le libellé, ses valeurs s'y accolent
 * en JSON.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, useEffect, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k} ${JSON.stringify(o)}` : k) }),
}))

import BlocMatchingAffaire from '@/components/matching-fil/BlocMatchingAffaire'
import type { BienAffaire } from '@/components/matching-fil/filAffaire'
import { crmPalette } from '@/components/crm/tokens'
import { ROUTER_FUTURE } from '@/lib/routerFuture'

/** Ce que le bloc lit de la lecture — son type, pas celui du crochet entier. */
type Lecture = ComponentProps<typeof BlocMatchingAffaire>['lecture']

const sp = crmPalette(false)
const bien = (id: string, champs: Partial<BienAffaire>): BienAffaire => ({
  id, rang: 2, score: 97, titre: `Bien ${id}`, prix: 1_450_000, location: false, etat: { cle: 'aProposer' },
  cleEtatMandat: null, lien: null, ...champs,
})
const lecture = (champs: Partial<Lecture>): Lecture => ({
  lignes: [], isLoading: false, isError: false, aDesDonnees: true, refetch: () => Promise.resolve(), ...champs,
})

/** Où la navigation a mené : l'adresse et l'état du routeur. */
const vu: { arrivee: { search: string; state: unknown } | null } = { arrivee: null }
function Fil() {
  const l = useLocation()
  useEffect(() => { vu.arrivee = { search: l.search, state: l.state } })
  return null
}

let hote: HTMLDivElement | null = null
let racine: Root | null = null
async function rendre(l: Lecture): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(
      <MemoryRouter initialEntries={['/fiche']} future={ROUTER_FUTURE}>
        <Routes>
          <Route path="/fiche" element={<BlocMatchingAffaire sp={sp} lecture={l} />} />
          <Route path="/dashboard/matching" element={<Fil />} />
        </Routes>
      </MemoryRouter>,
    )
  })
}
/** Le texte rendu, sans la feuille de survol que la liste pose. */
const texte = (): string => {
  const copie = hote!.cloneNode(true) as HTMLElement
  copie.querySelectorAll('style').forEach((s) => s.remove())
  return copie.textContent ?? ''
}

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
  vu.arrivee = null
})

describe('BlocMatchingAffaire', () => {
  it('une ligne : le titre, l’état écrit comme dans « Qui pour ce bien ? », le prix, le score en `FilScore`', async () => {
    await rendre(lecture({ lignes: [bien('m1', { etat: { cle: 'propose', date: '2026-09-24T08:00:00Z' } })] }))
    expect(texte()).toContain('Bien m1')
    expect(texte()).toContain('fil.quiPour.etat.propose {"date":"24.09"}')
    expect(texte()).toContain("CHF 1'450'000")
    expect(hote!.querySelector('[title^="fil.scoreAria"]')?.getAttribute('title')).toBe('fil.scoreAria {"score":97,"palier":"fil.palier.fort"}')
    expect(texte()).not.toContain('%')
  })

  it('un mandat qui n’est plus en vente ajoute son état : « Proposé le 24.09 · Vendu »', async () => {
    await rendre(lecture({ lignes: [bien('m1', { etat: { cle: 'propose', date: '2026-09-24T08:00:00Z' }, cleEtatMandat: 'listings:status.sold' })] }))
    expect(texte()).toContain('fil.quiPour.etat.propose {"date":"24.09"} · listings:status.sold')
  })

  it('une ligne mène au bien, à SA place dans le fil, avec un jeton d’arrivée neuf', async () => {
    await rendre(lecture({ lignes: [bien('m1', { lien: 'attente=c9' })] }))
    await act(async () => { hote!.querySelector('button')!.click() })
    expect(vu.arrivee?.search).toBe('?attente=c9')
    expect((vu.arrivee?.state as { arrivee?: unknown } | null)?.arrivee).toEqual(expect.any(String))
  })

  it('une ligne sans place — une visite planifiée — n’est pas un bouton', async () => {
    await rendre(lecture({ lignes: [bien('m1', { etat: { cle: 'visite' }, lien: null })] }))
    // La ligne est le parent de son `FilScore`, quelle que soit sa balise.
    const ligne = hote!.querySelector('[title^="fil.scoreAria"]')!.parentElement!
    expect(hote!.querySelector('button, [role="button"], [tabindex]')).toBeNull()
    expect(hote!.querySelector('.affaire-bien')).toBeNull()
    expect(ligne.style.cursor).toBe('')
    expect(texte()).toContain('fil.quiPour.etat.visite')
  })

  it('en lecture, rien d’autre : ni les lignes déjà là, ni « Aucun bien »', async () => {
    await rendre(lecture({ isLoading: true, lignes: [bien('m1', { lien: 'attente=c9' })] }))
    expect(hote!.querySelector('[role="status"]')?.textContent).toBe('fil.affaire.chargement')
    expect(texte()).toBe('fil.affaire.chargement')
  })

  it('en échec d’une première lecture : l’alerte dit le message, « Réessayer » relit', async () => {
    const refetch = vi.fn(() => Promise.resolve())
    await rendre(lecture({ isError: true, aDesDonnees: false, refetch }))
    expect(hote!.querySelector('[role="alert"]')?.textContent).toBe('fil.affaire.erreur')
    expect(texte()).not.toContain('fil.affaire.aucun')
    await act(async () => { hote!.querySelector('button')!.click() })
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('vide : ni lecture, ni erreur — « Aucun bien pour l’instant. »', async () => {
    await rendre(lecture({}))
    expect(texte()).toBe('fil.affaire.aucun')
  })

  it('une location s’écrit « / mois », au prix comme dans son état', async () => {
    await rendre(lecture({ lignes: [bien('m1', { location: true, prix: 2950, etat: { cle: 'revenu', prix: 3100 } })] }))
    expect(texte().match(/fil\.valeurs\.parMois/g)).toHaveLength(2)
  })

  it('le palier suit le score de chaque ligne', async () => {
    await rendre(lecture({ lignes: [bien('m1', { score: 97 }), bien('m2', { score: 72 })] }))
    expect([...hote!.querySelectorAll('[title^="fil.scoreAria"]')].map((e) => e.getAttribute('title'))).toEqual([
      'fil.scoreAria {"score":97,"palier":"fil.palier.fort"}', 'fil.scoreAria {"score":72,"palier":"fil.palier.bon"}',
    ])
  })

  it('la liste est un repère de position : les textes `sr-only` de `FilScore` ne débordent pas sur le pager', async () => {
    await rendre(lecture({ lignes: [bien('m1', {})] }))
    expect((hote!.firstElementChild as HTMLElement).style.position).toBe('relative')
  })

  it('un rafraîchissement en échec garde ses lignes : l’erreur ne remplace pas des biens déjà lus', async () => {
    await rendre(lecture({ isError: true, aDesDonnees: true, lignes: [bien('m1', {})] }))
    expect(texte()).toContain('Bien m1')
    expect(texte()).not.toContain('fil.affaire.erreur')
  })
})
