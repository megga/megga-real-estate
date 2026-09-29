/**
 * La page 0 du Matching, RENDUE (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §5.1) : le vrai fil
 * (`MatchingFil`), ses deux lectures tenues par le test — le fil (`useMatchingFil`) et les recherches actives
 * (`useRecherchesActives`).
 *
 * Ce que cette spec refuse :
 *   · la couverture montrée à une agence dont le fil a lu un match — à proposer, une ligne « Marché », sa boucle, même
 *     sans recherche active —, pendant une lecture ou sur un échec ;
 *   · la couverture montrée parce qu'un FILTRE vide l'écran (une arrivée `?contact=`) : c'est l'agence qu'on juge ;
 *   · « Tout est à jour » dit à une agence qui a des recherches et aucun match, ou « aucun match » à une agence qui en a ;
 *   · une couverture qui garderait l'en-tête du fil, dont les étapes ne seraient pas une liste ORDONNÉE, ou dont le
 *     bouton ne mènerait pas à la création d'un contact.
 *
 * `createRoot` + `act` sous le routeur mémoire, comme `jeton-arrivee.spec.tsx`. La règle elle-même (`ecranDuFil`) est
 * éprouvée dans `matching-fil-demarrage.spec.ts`, la lecture des recherches dans `matching-fil-recherches.spec.tsx`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const h = vi.hoisted(() => ({
  fil: null as unknown as LectureFil,
  recherches: 'aucune' as RecherchesAgence,
  lieu: null as null | { pathname: string; search: string; state: unknown },
  /** Stable d'un rendu à l'autre, comme celui de react-i18next. */
  traduction: { t: (cle: string) => cle, i18n: { language: 'fr' } },
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => h.traduction,
}))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' }, profile: { id: 'u-1', agency_id: 'ag-1' } }) }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/hooks/useMatchingFil', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useMatchingFil')>()),
  useMatchingFil: () => h.fil,
  useRecherchesActives: () => h.recherches,
}))
// La sélection d'une ligne « Marché » : aucun bien chargé, rien n'en dépend ici.
vi.mock('@/hooks/useSelectionMarche', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useSelectionMarche')>()),
  useSelectionMarche: () => ({
    matchs: [], aPlus: false, chargeLe: 0, isLoading: false, isError: false, aDesDonnees: false,
    isPlaceholderData: false, isFetching: false, refetch: () => Promise.resolve(),
  }),
}))

import MatchingFil from '@/components/matching-fil/MatchingFil'
import type { RecherchesAgence } from '@/components/matching-fil/filDemarrage'
import { cleSelection, type FilBien, type FilMatch, type FilSelectionResume } from '@/components/matching-fil/filModele'
import type { useMatchingFil } from '@/hooks/useMatchingFil'
import { ROUTER_FUTURE } from '@/lib/routerFuture'

type LectureFil = ReturnType<typeof useMatchingFil>

const JULIE: FilMatch['acheteur'] = { id: 'c1', prenom: 'Julie', nom: 'Sturm', telephone: null, email: null, kyc: 'none' }
const CHAMPEL: FilBien = {
  id: 'p1', titre: 'Appartement Champel', prix: 1_250_000, location: false, type: 'apartment', pieces: 4, surface: 110,
  ville: 'Genève', canton: 'GE', adresse: 'Avenue de Champel 12', equipements: [], photo: null, enVente: true, statut: 'active',
}
const A_PROPOSER: FilMatch = {
  id: 'm1', score: 88, raisons: null, criteres: null, creeLe: null, reporteJusquau: null, rechercheId: null, bien: CHAMPEL,
  acheteur: JULIE,
}
/** Un match de la boucle : proposé, sans réponse. */
const PROPOSE: FilMatch = {
  ...A_PROPOSER, id: 'm2',
  suivi: { statut: 'sent', proposeLe: '2026-09-25T09:00:00Z', reponduLe: null, motif: null, note: null, prixPropose: 1_250_000, apprisLe: null },
}
const MARCHE: FilSelectionResume = { acheteur: JULIE, nombre: 3, meilleurScore: 86, vignettes: [] }

function lecture(p: Partial<LectureFil> = {}): LectureFil {
  return {
    isLoading: false, isError: false, aDesDonnees: true, erreurLe: 0,
    matchs: [], selections: [], boucle: [], relances: [], historique: new Map(), chargeLe: Date.now(),
    rafraichir: () => Promise.resolve(), ...p,
  }
}

/** L'adresse où le fil a mené, et son état de navigation. */
function Position() {
  const l = useLocation()
  useEffect(() => { h.lieu = { pathname: l.pathname, search: l.search, state: l.state } })
  return null
}

let hote: HTMLDivElement | null = null
let racine: Root | null = null

async function monter({ entree = '/dashboard/matching', onOpenRecherche }: { entree?: string; onOpenRecherche?: () => void } = {}) {
  demonter()
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(
      <MemoryRouter initialEntries={[entree]} future={ROUTER_FUTURE}>
        <MatchingFil dark={false} onOpenRecherche={onOpenRecherche} />
        <Position />
      </MemoryRouter>,
    )
  })
}

function demonter(): void {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
}

/** Un élément sans enfant qui rend exactement ce texte — ici, une clé de traduction. */
const affiche = (cle: string): boolean =>
  [...(hote?.querySelectorAll('*') ?? [])].some((e) => e.childElementCount === 0 && e.textContent === cle)
const bouton = (cle: string): HTMLButtonElement | undefined =>
  [...(hote?.querySelectorAll('button') ?? [])].find((b) => b.textContent === cle)
/** La couverture de premier lancement : son bouton. */
const couverture = (): boolean => bouton('firstRun.start') !== undefined
/** L'en-tête du fil, filtres compris. */
const enTete = (): boolean => affiche('fil.titre')

beforeEach(() => {
  h.fil = lecture()
  h.recherches = 'aucune'
  h.lieu = null
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  })
})

afterEach(() => demonter())

describe('la page 0 du Matching, rendue', () => {
  it('sans recherche active ni match : la couverture, sans l’en-tête du fil ; son bouton ouvre la création d’un contact', async () => {
    await monter()
    expect(couverture()).toBe(true)
    expect(affiche('firstRun.title')).toBe(true)
    expect(enTete()).toBe(false)
    expect(hote!.querySelector('[role="tablist"]')).toBeNull()
    expect(affiche('fil.vide.titre')).toBe(false)
    expect(affiche('fil.vide.sansMatch')).toBe(false)
    // Les trois étapes, une liste ORDONNÉE, dans l'ordre de la boucle.
    const etapes = [...hote!.querySelectorAll('ol > li')].map((li) => li.textContent)
    expect(etapes).toEqual(['acheteur', 'biens', 'scores'].map((k) => `firstRun.${k}.titlefirstRun.${k}.sub`))
    await act(async () => { bouton('firstRun.start')!.click() })
    // Une ARRIVÉE, avec son jeton : la page Contacts ouvre sa création une fois par clic (`useArrivee`).
    expect(h.lieu?.pathname).toBe('/dashboard/contacts')
    expect(h.lieu?.search).toBe('?nouveau=1')
    expect((h.lieu?.state as { arrivee?: unknown } | null)?.arrivee).toMatch(/\S/)
  })

  it('des recherches actives, aucun match : « aucun bien ne correspond », qui mène au marché — jamais « Tout est à jour »', async () => {
    h.recherches = 'actives'
    const ouvrirRecherche = vi.fn()
    await monter({ onOpenRecherche: ouvrirRecherche })
    expect(affiche('fil.vide.sansMatch')).toBe(true)
    expect(affiche('fil.vide.titre')).toBe(false)
    expect(couverture()).toBe(false)
    expect(enTete()).toBe(true)
    await act(async () => { bouton('fil.vide.marche')!.click() })
    expect(ouvrirRecherche).toHaveBeenCalledTimes(1)
    // Hors du pager, pas de Recherche où mener : pas de bouton mort.
    await monter()
    expect(affiche('fil.vide.sansMatch')).toBe(true)
    expect(bouton('fil.vide.marche')).toBeUndefined()
  })

  it('des matchs à proposer, aucune recherche active : le fil, pas la couverture', async () => {
    h.fil = lecture({ matchs: [A_PROPOSER] })
    await monter()
    expect(hote!.querySelector('[data-match="m1"]')).not.toBeNull()
    expect(enTete()).toBe(true)
    expect(couverture()).toBe(false)
  })

  it('des lignes « Marché » seules : le fil, jamais « aucun match » ni la couverture', async () => {
    for (const recherches of ['actives', 'aucune'] as const) {
      h.recherches = recherches
      h.fil = lecture({ selections: [MARCHE] })
      await monter()
      expect(hote!.querySelector(`[data-match="${cleSelection('c1')}"]`), recherches).not.toBeNull()
      expect(affiche('fil.vide.sansMatch'), recherches).toBe(false)
      expect(couverture(), recherches).toBe(false)
    }
  })

  it('une boucle seule, recherche close ou non : le fil et ses onglets ; « À proposer » y dit « Tout est à jour »', async () => {
    for (const recherches of ['aucune', 'actives'] as const) {
      h.recherches = recherches
      h.fil = lecture({ boucle: [PROPOSE] })
      await monter()
      expect(hote!.querySelector('[role="tablist"]'), recherches).not.toBeNull()
      expect(affiche('fil.vide.titre'), recherches).toBe(true)
      expect(affiche('fil.vide.sansMatch'), recherches).toBe(false)
      expect(couverture(), recherches).toBe(false)
    }
  })

  it('une arrivée ?contact= que le filtre vide : « Rien ne correspond », jamais la couverture ni « aucun match »', async () => {
    for (const recherches of ['aucune', 'actives'] as const) {
      h.recherches = recherches
      // Des matchs pour Julie ; l'arrivée filtre sur un AUTRE acheteur.
      h.fil = lecture({ matchs: [A_PROPOSER] })
      await monter({ entree: '/dashboard/matching?contact=c2' })
      expect(affiche('fil.filtreVide'), recherches).toBe(true)
      expect(couverture(), recherches).toBe(false)
      expect(affiche('fil.vide.sansMatch'), recherches).toBe(false)
    }
  })

  it('pendant une lecture — celle du fil ou celle des recherches — : le squelette, ni couverture ni état vide', async () => {
    const cas: [LectureFil, RecherchesAgence][] = [
      [lecture({ isLoading: true, aDesDonnees: false }), 'aucune'],
      [lecture(), 'chargement'],
    ]
    for (const [fil, recherches] of cas) {
      h.fil = fil
      h.recherches = recherches
      await monter()
      expect(affiche('fil.chargement'), recherches).toBe(true)
      expect(couverture(), recherches).toBe(false)
      expect(affiche('fil.vide.titre'), recherches).toBe(false)
      expect(affiche('fil.vide.sansMatch'), recherches).toBe(false)
    }
  })

  it('sur un échec sans données — du fil ou des recherches — : l’état d’erreur, et « Réessayer » relit', async () => {
    const rafraichir = vi.fn(() => Promise.resolve())
    const cas: [LectureFil, RecherchesAgence][] = [
      [lecture({ isError: true, aDesDonnees: false, rafraichir }), 'aucune'],
      [lecture({ rafraichir }), 'erreur'],
    ]
    for (const [i, [fil, recherches]] of cas.entries()) {
      h.fil = fil
      h.recherches = recherches
      await monter()
      expect(affiche('fil.erreur'), recherches).toBe(true)
      expect(couverture(), recherches).toBe(false)
      await act(async () => { bouton('fil.reessayer')!.click() })
      expect(rafraichir).toHaveBeenCalledTimes(i + 1)
    }
  })
})
