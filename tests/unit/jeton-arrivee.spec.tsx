/**
 * Le jeton d'arrivée (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §4.2 et §8) : une arrivée — une
 * place du fil de matchs, la page du fil dans le pager de Matching, « Qui pour ce bien ? » d'une fiche (`?qui=1`), la
 * création d'un contact (`?nouveau=1`, §5.1) — s'applique UNE fois par navigation.
 *
 * Ce que cette spec refuse :
 *   · une arrivée rejouée au remontage de l'écran, au retour sur son onglet, à un retour arrière ou au rechargement ;
 *   · une arrivée ignorée sur un NOUVEAU clic, même vers un onglet déjà ouvert sur cette adresse ;
 *   · une arrivée appliquée avant le chargement de la pile d'onglets (l'hydratation l'effacerait) ou par un écran caché ;
 *   · une adresse réécrite par le fil, le pager, une fiche ou la page Contacts ;
 *   · un lien d'arrivée sans jeton : son second clic serait ignoré.
 *
 * Le crochet (`useArrivee`) est monté pour de vrai — `createRoot` + `act`, le routeur mémoire et la VRAIE pile d'onglets
 * (`CrmTabsProvider`) sur un client Supabase simulé, comme `crm-tabs-compte.spec.tsx`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, useEffect, useState, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BrowserRouter, MemoryRouter, Route, Routes, useLocation, useNavigate, useSearchParams,
  type InitialEntry, type NavigateFunction,
} from 'react-router-dom'
import { poserStockagesMemoire } from './helpers/stockage-memoire'
import { emptyRoots, readFileSafely, rel, scanRoots } from './helpers/fs-scan'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const h = vi.hoisted(() => ({
  /** La lecture de la pile serveur (`crm_open_tabs`) : absente, aucune ligne ; posée, celle que le test tient. */
  lecture: null as null | Promise<{ data: unknown; error: null }>,
  naviguer: null as null | NavigateFunction,
  /** Les arrivées appliquées par l'écran monté, dans l'ordre. */
  applications: [] as string[],
  /** L'arrivée que lit l'écran monté sous le routeur du navigateur. */
  lue: null as null | { jeton: string | null; adresse: string },
  /** La création d'un contact : ouverte ou non, le nombre de ses ouvertures, et de quoi la refermer. */
  ouverte: false,
  ouvertures: 0,
  fermer: null as null | (() => void),
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' }, profile: { agency_id: 'ag-1' } }) }))

vi.mock('@/lib/supabase', () => {
  const chaine = {
    select: () => chaine,
    eq: () => chaine,
    maybeSingle: () => h.lecture ?? Promise.resolve({ data: null, error: null }),
  }
  return { supabase: { from: () => chaine, rpc: async () => ({ data: { revision: 1, stale: false }, error: null }) } }
})

import { CrmTabsProvider } from '@/components/crm/CrmTabsProvider'
import { estArriveeFil } from '@/components/matching-fil/filLiens'
import { useArrivee } from '@/hooks/useArrivee'
import { EcranActifProvider } from '@/hooks/useEcranActif'
import { arriveeDe, arriveeNeuve, avecArrivee } from '@/lib/jetonArrivee'
import { ROUTER_FUTURE } from '@/lib/routerFuture'

const FIL = '/dashboard/matching'
const A = `${FIL}?attente=c7`
const loc = (search: string, state: unknown = null) => ({ pathname: FIL, search, state })

describe('le jeton d’arrivée — la règle', () => {
  it('chaque navigation vers une arrivée porte un jeton neuf, dans son état', () => {
    const un = avecArrivee()
    const deux = avecArrivee()
    expect(un.state.arrivee).toMatch(/\S/)
    expect(un.state.arrivee).not.toBe(deux.state.arrivee)
  })

  it('l’arrivée d’une localisation : le jeton de son état, et son adresse — chemin et requête', () => {
    expect(arriveeDe(loc('?attente=c7', { arrivee: 'j1' }))).toEqual({ jeton: 'j1', adresse: A })
    // Un autre état de navigation (l'accueil KYC pose `openWizard`), un jeton malformé, pas d'état du tout : pas de jeton.
    for (const state of [null, undefined, { openWizard: true }, { arrivee: 7 }, 'j1']) {
      expect(arriveeDe(loc('?attente=c7', state)).jeton, JSON.stringify(state)).toBeNull()
    }
  })

  it('un jeton neuf s’applique ; le même, jamais deux fois ; un nouveau sur la même adresse, si', () => {
    expect(arriveeNeuve({ jeton: 'j1', adresse: A }, null)).toBe(true)
    expect(arriveeNeuve({ jeton: 'j1', adresse: A }, { jeton: 'j1', adresse: A })).toBe(false)
    expect(arriveeNeuve({ jeton: 'j2', adresse: A }, { jeton: 'j1', adresse: A })).toBe(true)
  })

  it('une adresse sans jeton s’applique une fois, sur sa clé : l’adresse elle-même', () => {
    expect(arriveeNeuve({ jeton: null, adresse: A }, null)).toBe(true)
    expect(arriveeNeuve({ jeton: null, adresse: A }, { jeton: null, adresse: A })).toBe(false)
    expect(arriveeNeuve({ jeton: null, adresse: `${FIL}?attente=c9` }, { jeton: null, adresse: A })).toBe(true)
    // L'onglet que la barre réactive navigue vers SON adresse, sans jeton : l'arrivée appliquée sur elle ne se rejoue pas.
    expect(arriveeNeuve({ jeton: null, adresse: A }, { jeton: 'j1', adresse: A })).toBe(false)
    // Un nouveau clic sur le lien, après une adresse tapée : son jeton est neuf.
    expect(arriveeNeuve({ jeton: 'j3', adresse: A }, { jeton: null, adresse: A })).toBe(true)
  })

  it('un rechargement rend le même état, donc le même jeton : l’arrivée ne se rejoue pas', () => {
    const navigation = avecArrivee()
    const appliquee = arriveeDe(loc('?attente=c7', navigation.state))
    // Le navigateur garde avec l'entrée d'historique une COPIE structurée de l'état, et la rend au rechargement.
    expect(arriveeNeuve(arriveeDe(loc('?attente=c7', structuredClone(navigation.state))), appliquee)).toBe(false)
    // Une adresse sans jeton se recharge sans état : sa clé, l'adresse, n'a pas bougé.
    expect(arriveeNeuve(arriveeDe(loc('?attente=c7')), arriveeDe(loc('?attente=c7')))).toBe(false)
  })

  it('ce que l’onglet restitue d’un schéma antérieur ne compte pour rien : l’arrivée est neuve', () => {
    for (const derniere of ['j1', 3, true, {}, { jeton: 'j1' }, { jeton: 5, adresse: A }, { jeton: 'j1', adresse: 7 }]) {
      expect(arriveeNeuve({ jeton: 'j1', adresse: A }, derniere), JSON.stringify(derniere)).toBe(true)
    }
  })
})

let hote: HTMLDivElement | null = null
let racine: Root | null = null

async function rendre(arbre: ReactNode): Promise<void> {
  if (!racine) {
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
  }
  await act(async () => { racine!.render(arbre) })
}

function demonter(): void {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
}

async function naviguer(vers: string | number, options?: { state: unknown }): Promise<void> {
  await act(async () => {
    if (typeof vers === 'number') h.naviguer!(vers)
    else h.naviguer!(vers, options)
  })
}

function Pilote() {
  const navigate = useNavigate()
  useEffect(() => { h.naviguer = navigate })
  return null
}

/** Un écran qui lit son arrivée comme le fil : il l'applique — ici, il la consigne —, puis la marque. */
function EcranFil() {
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const { aAppliquer, marquerAppliquee } = useArrivee('fil.arrivee', estArriveeFil(params))
  useEffect(() => {
    if (!aAppliquer) return
    h.applications.push(`${pathname}${search}`)
    marquerAppliquee()
  }, [aAppliquer, marquerAppliquee, pathname, search])
  return null
}

/** Un écran qui lit l'arrivée de sa localisation, sous le routeur du navigateur. */
function LecteurNavigateur() {
  const location = useLocation()
  useEffect(() => { h.lue = arriveeDe(location) })
  return null
}

function Arbre({ entree, montage = 0, actif = true }: { entree: InitialEntry; montage?: number; actif?: boolean }) {
  return (
    <MemoryRouter initialEntries={[entree]} future={ROUTER_FUTURE}>
      <CrmTabsProvider>
        <Pilote />
        <EcranActifProvider value={actif}>
          <Routes>
            {/* Monté sur sa route, comme l'écran : en partir le démonte, y revenir le remonte. */}
            <Route path={FIL} element={<EcranFil key={montage} />} />
            <Route path="*" element={null} />
          </Routes>
        </EcranActifProvider>
      </CrmTabsProvider>
    </MemoryRouter>
  )
}

const avec = (jeton: string, search = '?attente=c7'): InitialEntry => ({ pathname: FIL, search, state: { arrivee: jeton } })

const CONTACTS = '/dashboard/contacts'
const NOUVEAU = `${CONTACTS}?nouveau=1`

/**
 * Un écran qui ouvre sa création comme la page Contacts (`ContactsPage`) : PENDANT LE RENDU, quand l'arrivée est à
 * appliquer et la création fermée ; marquée par l'effet.
 */
function EcranContacts() {
  const [params] = useSearchParams()
  const [ouverte, setOuverte] = useState(false)
  const { aAppliquer, marquerAppliquee } = useArrivee('contacts.nouveau', params.has('nouveau'))
  if (aAppliquer && !ouverte) setOuverte(true)
  useEffect(() => { if (aAppliquer) marquerAppliquee() }, [aAppliquer, marquerAppliquee])
  useEffect(() => { if (ouverte) h.ouvertures += 1 }, [ouverte])
  useEffect(() => {
    h.ouverte = ouverte
    h.fermer = () => setOuverte(false)
  })
  return null
}

function ArbreContacts({ entree, montage = 0 }: { entree: InitialEntry; montage?: number }) {
  return (
    <MemoryRouter initialEntries={[entree]} future={ROUTER_FUTURE}>
      <CrmTabsProvider>
        <Pilote />
        <EcranActifProvider value>
          <Routes>
            <Route path={CONTACTS} element={<EcranContacts key={montage} />} />
            <Route path="*" element={null} />
          </Routes>
        </EcranActifProvider>
      </CrmTabsProvider>
    </MemoryRouter>
  )
}

const nouveau = (jeton: string, search = '?nouveau=1'): InitialEntry => ({ pathname: CONTACTS, search, state: { arrivee: jeton } })

beforeEach(() => {
  poserStockagesMemoire()
  h.lecture = null
  h.naviguer = null
  h.applications = []
  h.lue = null
  h.ouverte = false
  h.ouvertures = 0
  h.fermer = null
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  })
})

afterEach(() => demonter())

describe('le jeton d’arrivée — dans l’onglet du CRM', () => {
  it('appliquée une fois : remonter l’écran ne la rejoue pas', async () => {
    await rendre(<Arbre entree={avec('j1')} />)
    expect(h.applications).toEqual([A])
    await rendre(<Arbre entree={avec('j1')} montage={1} />)
    expect(h.applications).toEqual([A])
  })

  it('un retour arrière après « Voir le contact » ne la rejoue pas', async () => {
    await rendre(<Arbre entree={avec('j1')} />)
    await naviguer('/dashboard/contacts/c7')
    await naviguer(-1)
    expect(h.applications).toEqual([A])
  })

  it('l’onglet que la barre réactive — son adresse, sans jeton — ne la rejoue pas', async () => {
    await rendre(<Arbre entree={avec('j1')} />)
    await naviguer('/dashboard/contacts/c7')
    await naviguer(A)
    expect(h.applications).toEqual([A])
  })

  it('un NOUVEAU clic sur le même lien la rejoue, l’écran déjà monté sur cette adresse', async () => {
    await rendre(<Arbre entree={avec('j1')} />)
    await naviguer(A, avecArrivee())
    expect(h.applications).toEqual([A, A])
  })

  it('une adresse sans jeton s’applique une fois ; une autre adresse, une fois aussi', async () => {
    await rendre(<Arbre entree={A} />)
    await rendre(<Arbre entree={A} montage={1} />)
    await naviguer(A)
    expect(h.applications).toEqual([A])
    await naviguer(`${FIL}?attente=c9`)
    expect(h.applications).toEqual([A, `${FIL}?attente=c9`])
  })

  it('un rechargement ne la rejoue pas : même entrée d’historique, même tranche (le miroir de session)', async () => {
    await rendre(<Arbre entree={avec('j1')} />)
    demonter()
    // Un arbre NEUF — routeur, pile d'onglets, écran —, sur la même entrée et le même stockage de session.
    await rendre(<Arbre entree={avec('j1')} />)
    expect(h.applications).toEqual([A])
  })

  it('elle attend la pile d’onglets : appliquée après l’hydratation, et une seule fois', async () => {
    let servir: (r: { data: unknown; error: null }) => void = () => {}
    h.lecture = new Promise((r) => { servir = r })
    await rendre(<Arbre entree={avec('j1')} />)
    expect(h.applications).toEqual([])
    // La pile serveur arrive : l'hydratation REMPLACE la pile locale — une arrivée appliquée avant y serait perdue, et
    // rejouée.
    await act(async () => { servir({ data: { tabs: [], active_index: 0, revision: 1 }, error: null }) })
    expect(h.applications).toEqual([A])
  })

  it('un écran caché ne l’applique pas : il attend d’être montré', async () => {
    await rendre(<Arbre entree={avec('j1')} actif={false} />)
    expect(h.applications).toEqual([])
    await rendre(<Arbre entree={avec('j1')} />)
    expect(h.applications).toEqual([A])
  })

  it('sans paramètre du fil, rien à appliquer — même sous un jeton', async () => {
    await rendre(<Arbre entree={avec('j1', '')} />)
    expect(h.applications).toEqual([])
  })

  it('un rechargement relit le même jeton : le routeur le reprend dans `history.state`', async () => {
    window.history.replaceState(null, '', FIL)
    await rendre(<BrowserRouter future={ROUTER_FUTURE}><Pilote /><LecteurNavigateur /></BrowserRouter>)
    await naviguer(A, avecArrivee())
    const lue = h.lue
    expect(lue).toEqual({ jeton: expect.any(String), adresse: A })
    demonter()
    h.lue = null
    // Un routeur NEUF sur la même entrée d'historique : ce que fait un rechargement.
    await rendre(<BrowserRouter future={ROUTER_FUTURE}><LecteurNavigateur /></BrowserRouter>)
    expect(h.lue).toEqual(lue)
  })
})

describe('le jeton d’arrivée — la création d’un contact (`?nouveau=1`)', () => {
  it('s’ouvre une fois : remonter l’écran ne la rouvre pas', async () => {
    await rendre(<ArbreContacts entree={nouveau('j1')} />)
    expect([h.ouverte, h.ouvertures]).toEqual([true, 1])
    await rendre(<ArbreContacts entree={nouveau('j1')} montage={1} />)
    expect([h.ouverte, h.ouvertures]).toEqual([false, 1])
  })

  it('refermée, l’onglet réactivé — son adresse, sans jeton — ne la rouvre pas ; un nouveau clic sur le lien, si', async () => {
    await rendre(<ArbreContacts entree={nouveau('j1')} />)
    await act(async () => { h.fermer!() })
    await naviguer(NOUVEAU)
    expect([h.ouverte, h.ouvertures]).toEqual([false, 1])
    await naviguer(NOUVEAU, avecArrivee())
    expect([h.ouverte, h.ouvertures]).toEqual([true, 2])
  })

  it('sans `?nouveau`, rien ne s’ouvre — même sous un jeton', async () => {
    await rendre(<ArbreContacts entree={nouveau('j1', '')} />)
    expect([h.ouverte, h.ouvertures]).toEqual([false, 0])
  })
})

const lire = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')

describe('le jeton d’arrivée — les écrans et leurs liens', () => {
  /** Les écrans qui appliquent une arrivée, chacun sous SA clé : le pager et le fil appliquent la même navigation. */
  const ECRANS: [string, string][] = [
    ['src/components/matching-fil/MatchingFil.tsx', "useArrivee('fil.arrivee', estArriveeFil(params))"],
    ['src/pages/agent/MatchingPage.tsx', "useArrivee('pager.arrivee', estArriveeFil(searchParams))"],
    ['src/pages/agent/ListingDetailPage.tsx', "useArrivee('quiPour.arrivee', params.has(PARAM_QUI_POUR))"],
    ['src/pages/agent/ExternalListingDetailPage.tsx', "useArrivee('quiPour.arrivee', params.has(PARAM_QUI_POUR))"],
    ['src/pages/agent/ContactsPage.tsx', "useArrivee('contacts.nouveau', searchParams.has('nouveau'))"],
  ]

  it.each(ECRANS)('%s applique son arrivée une fois, et ne réécrit jamais son adresse', (fichier, appel) => {
    const code = lire(fichier)
    expect(code).toContain(appel)
    expect(code).toMatch(/\bmarquerAppliquee\(\)/)
    // ⛔ La réconciliation des onglets lirait une adresse réécrite comme celle d'un autre onglet.
    expect(code).not.toMatch(/setSearchParams|replace:\s*true/)
  })

  it('la page Contacts ouvre sa création comme l’écran de la spec : pendant le rendu, marquée par l’effet', () => {
    const code = lire('src/pages/agent/ContactsPage.tsx')
    expect(code).toContain('if (aAppliquer && !modalOpen) openModal()')
    expect(code).toContain('useEffect(() => { if (aAppliquer) marquerAppliquee() }, [aAppliquer, marquerAppliquee])')
  })

  /** Une cible d'arrivée : une place du fil, une fiche défilée jusqu'à « Qui pour ce bien ? », la création d'un contact. */
  const CIBLE = /\/dashboard\/matching(?:\?|\$\{)|\/dashboard\/(?:listings|market)\/\$\{[^}]+\}\?\$\{PARAM_QUI_POUR\}=1|\/dashboard\/contacts\?nouveau=1/
  /** Les liens d'arrivée, par fichier. Un lien neuf s'inscrit ici — avec son jeton. */
  const SITES: Record<string, number> = {
    // « Ajouter un acheteur », la couverture de premier lancement du fil.
    'src/components/matching-fil/MatchingFil.tsx': 1,
    'src/components/matching-recherche/MatchingRechercheHybride.tsx': 1,
    'src/pages/agent/ContactDetailPage.tsx': 2,
    'src/pages/agent/ContactsPage.tsx': 1,
    'src/pages/agent/DealDetailPage.tsx': 1,
    'src/pages/agent/ExternalListingDetailPage.tsx': 1,
    'src/pages/agent/ListingDetailPage.tsx': 1,
    'src/pages/agent/ListingsPage.tsx': 1,
    'src/pages/agent/NouveauBienPage.tsx': 1,
    'src/pages/agent/TodayPage.tsx': 3,
  }

  it('chaque lien d’arrivée porte un jeton neuf : sans lui, un second clic sur le même lien serait ignoré', () => {
    const scan = scanRoots([{ root: 'src', keep: (n) => /\.(ts|tsx)$/.test(n) && !n.endsWith('.d.ts') }])
    expect(emptyRoots(scan)).toEqual([])
    expect(scan.unreadable).toEqual([])
    const trouves: Record<string, number> = {}
    const sansJeton: string[] = []
    for (const abs of scan.files) {
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      lu.value.split('\n').forEach((ligne, i) => {
        // Un commentaire cite ces adresses sans y mener.
        if (/^\s*(?:\/\/|\*|\/\*|\{\/\*)/.test(ligne) || !CIBLE.test(ligne)) return
        const f = rel(abs)
        trouves[f] = (trouves[f] ?? 0) + 1
        if (!/\b(?:navigate|go)\(/.test(ligne) || !ligne.includes('avecArrivee()')) sansJeton.push(`${f}:${i + 1}`)
      })
    }
    expect(sansJeton).toEqual([])
    expect(trouves).toEqual(SITES)
  })
})
