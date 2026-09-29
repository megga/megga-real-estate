/**
 * Le jeton d'arrivée DANS LES ONGLETS du CRM : une arrivée ne s'applique que dans l'onglet qui porte son adresse, une
 * fois, et se range dans la tranche de CET onglet — ni dans celle de l'onglet actif, ni dans celle d'un voisin.
 *
 * Ce que cette spec refuse :
 *   · une arrivée écrite chez l'onglet qui prend la main quand on ferme l'onglet actif : la pile pose le suivant comme
 *     actif tout de suite et navigue dans une transition — le temps d'un rendu, son écran montre l'adresse de l'onglet
 *     fermé, AVEC son état de navigation ;
 *   · un lien suivi dans l'onglet dont l'arrivée se perdrait à attendre que la pile range son adresse — ou, sur
 *     mobile, où la pile ne suit pas l'adresse, à attendre un onglet qui ne la rejoindra jamais ;
 *   · un nouveau clic vers une adresse ouverte dans un onglet caché qui s'appliquerait ailleurs, ou deux fois ;
 *   · une arrivée rejouée par les bascules de la barre, ou appliquée par un écran caché ;
 *   · un rechargement qui rejoue une arrivée dont la ligne serveur de la pile porte la marque ;
 *   · un pager de Matching qui applique son arrivée avant la pile d'onglets, ou caché, ou qui glisse de la Recherche
 *     vers la page 0 au lieu de naître dessus.
 *
 * Les écrans sont montés comme `EcransVivants` (`AgentLayout`) les monte : chacun sous SON onglet (`OngletEcranCtx`) ;
 * le montré — celui que désigne `crmEcranVisible` — sur la localisation du routeur, AVEC son état, les autres sur
 * celle de leur onglet, sans état. Tous les onglets de la pile sont montés : sous le plafond de six écrans vivants,
 * c'est ce que la coquille garde dès que chacun a été actif. La VRAIE pile (`CrmTabsProvider`) tourne sur un client
 * Supabase simulé, sous le routeur mémoire et les drapeaux de l'app (`ROUTER_FUTURE`) : sans `v7_startTransition`, la
 * fermeture n'aurait pas de rendu intermédiaire.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, useContext, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  MemoryRouter, Route, Routes, useLocation, useNavigate, useSearchParams,
  type MemoryRouterProps, type NavigateFunction,
} from 'react-router-dom'
import { poserStockagesMemoire, type StockageMemoire } from './helpers/stockage-memoire'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const h = vi.hoisted(() => ({
  /** La lecture de la pile serveur (`crm_open_tabs`) : celle que le test tient. */
  lecture: null as null | Promise<{ data: unknown; error: null }>,
  naviguer: null as null | NavigateFunction,
  /** La pile telle que le dernier rendu la voit : ses gestes sont ceux de la barre. */
  onglets: null as null | CrmTabsApi,
  /** L'adresse du routeur. */
  adresse: '',
  /** Les arrivées appliquées : l'onglet de l'écran, l'adresse — et celle de l'onglet, si ce n'est pas la même. */
  applications: [] as string[],
  /** La page que montre un pager, relevée après chaque rendu (`Temoin`). */
  pages: [] as (number | null)[],
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

// Le pager de Matching sans ce qui l'entoure : son chrome, et ses deux pages — le banc fournit les siennes.
vi.mock('@/components/crm/CrmWorkspace', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('@/components/matching-fil/MatchingFil', () => ({ default: () => null }))
vi.mock('@/components/matching-recherche/MatchingRechercheHybride', () => ({ default: () => null }))

import MatchingPage, { type MatchingPagerBanc } from '@/pages/agent/MatchingPage'
import { CrmTabsProvider } from '@/components/crm/CrmTabsProvider'
import { crmSidebarActiveFor } from '@/components/crm/crmSidebarNav'
import { estArriveeFil } from '@/components/matching-fil/filLiens'
import { useArrivee } from '@/hooks/useArrivee'
import { OngletEcranCtx, useCrmTabs, type CrmTabsApi } from '@/hooks/useCrmTabs'
import { EcranActifProvider } from '@/hooks/useEcranActif'
import { crmEcranVisible, type CrmTab } from '@/lib/crmTabs'
import { avecArrivee } from '@/lib/jetonArrivee'
import { ROUTER_FUTURE } from '@/lib/routerFuture'
import { cleDuCompte } from '@/lib/stockageParCompte'

const FIL = '/dashboard/matching'
const A = `${FIL}?attente=c7`
const ACCUEIL = '/dashboard'
/** Une clé de lecteur telle que `useTabScopedState` la range : préfixée par la section de l'écran. */
const tranche = (cle: string) => `${crmSidebarActiveFor(FIL)}:${cle}`
const MARQUE_FIL = tranche('fil.arrivee')
const PAGE = tranche('pager')
const MARQUE_PAGER = tranche('pager.arrivee')

/** Un onglet de la pile, sur une adresse, avec sa tranche. */
function onglet(id: string, adresse: string, ui?: Record<string, unknown>): CrmTab {
  const [path, requete] = adresse.split('?')
  return { id, path, search: requete ? `?${requete}` : '', section: crmSidebarActiveFor(path), ...(ui && { ui }) }
}

/** La ligne serveur de la pile. */
const ligne = (tabs: CrmTab[]) => ({ data: { tabs, active_index: 0, revision: 1 }, error: null })

/** Une entrée d'historique du routeur mémoire. */
type Entree = NonNullable<MemoryRouterProps['initialEntries']>[number]

/** L'entrée d'historique d'un lien d'arrivée : son adresse, et son jeton dans l'état. */
const lien = (jeton: string): Entree => ({ pathname: FIL, search: '?attente=c7', state: { arrivee: jeton } })

/** Tient le routeur et la pile : les gestes du test passent par eux, comme ceux d'un lien et de la barre. */
function Pilote() {
  const navigate = useNavigate()
  const onglets = useCrmTabs()
  const { pathname, search } = useLocation()
  useEffect(() => {
    h.naviguer = navigate
    h.onglets = onglets
    h.adresse = `${pathname}${search}`
  })
  return null
}

/**
 * Un écran qui lit son arrivée comme le fil : il l'applique — ici, il la consigne —, puis la marque. Quand son onglet
 * porte une autre adresse que la sienne, il la consigne aussi : c'est chez un onglet qui ne l'a pas demandée qu'il
 * écrirait.
 */
function EcranFil() {
  const [params] = useSearchParams()
  const { pathname, search } = useLocation()
  const ongletId = useContext(OngletEcranCtx)
  const sien = useCrmTabs().tabs.find((t) => t.id === ongletId)
  const { aAppliquer, marquerAppliquee } = useArrivee('fil.arrivee', estArriveeFil(params))
  useEffect(() => {
    if (!aAppliquer) return
    const ici = `${pathname}${search}`
    const porte = sien ? `${sien.path}${sien.search}` : ici
    h.applications.push(porte === ici ? `${ongletId} ${ici}` : `${ongletId} ${ici} ≠ ${porte}`)
    marquerAppliquee()
  }, [aAppliquer, marquerAppliquee, ongletId, pathname, search, sien])
  return null
}

/**
 * Les écrans d'onglet, comme `EcransVivants` les monte : chacun sous son onglet ; le montré sur la localisation du
 * routeur, avec son état, les autres sur celle de leur onglet, sans état. Pile vide : un seul écran, hors onglet.
 */
function Ecrans({ ecran }: { ecran: ReactNode }) {
  const { tabs, active } = useCrmTabs()
  const location = useLocation()
  const routes = [<Route key="fil" path={FIL} element={ecran} />, <Route key="autres" path="*" element={null} />]
  if (!tabs.length) return <Routes>{routes}</Routes>
  const montre = crmEcranVisible(tabs, tabs[active]?.id, location.pathname, location.search)
  return (
    <>
      {tabs.map((tb) => {
        const actif = tb.id === montre
        const loc = actif
          ? { pathname: location.pathname, search: location.search, hash: location.hash, state: location.state, key: tb.id }
          : { pathname: tb.path, search: tb.search, hash: '', state: null, key: tb.id }
        return (
          <div key={tb.id} data-onglet={tb.id}>
            <OngletEcranCtx.Provider value={tb.id}>
              <EcranActifProvider value={actif}>
                <Routes location={loc}>{routes}</Routes>
              </EcranActifProvider>
            </OngletEcranCtx.Provider>
          </div>
        )
      })}
    </>
  )
}

/** Les deux pages du pager, réduites à un repère. */
const BANC: MatchingPagerBanc = { Page0: () => <i data-page="0" />, Page1: () => <i data-page="1" /> }

/** La page que montre le pager d'un onglet : celle qui n'est pas inerte (`MatchingPage`). */
function pageMontree(ongletId: string): number | null {
  const page = [...document.querySelectorAll<HTMLElement>(`[data-onglet="${ongletId}"] [data-page]`)]
    .find((p) => !p.parentElement?.hasAttribute('inert'))
  return page ? Number(page.dataset.page) : null
}

/**
 * Relève, après chaque rendu de la pile ou du routeur, la page que montre le pager d'un onglet : un effet de mise en
 * page lit le DOM du rendu qui vient d'être validé, avant toute peinture.
 */
function Temoin({ onglet: id }: { onglet: string }) {
  useCrmTabs()
  useLocation()
  useLayoutEffect(() => { h.pages.push(pageMontree(id)) })
  return null
}

function Arbre({ entree, ecran = <EcranFil />, temoin }: { entree: Entree; ecran?: ReactNode; temoin?: string }) {
  return (
    <MemoryRouter initialEntries={[entree]} future={ROUTER_FUTURE}>
      <CrmTabsProvider>
        <Pilote />
        <Ecrans ecran={ecran} />
        {temoin && <Temoin onglet={temoin} />}
      </CrmTabsProvider>
    </MemoryRouter>
  )
}

let session: StockageMemoire
let hote: HTMLDivElement | null = null
let racine: Root | null = null

async function rendre(arbre: ReactNode): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => { racine!.render(arbre) })
}

/** Un geste — un lien suivi, un clic sur la barre —, et tout ce qu'il déclenche. */
async function geste(f: () => void): Promise<void> {
  await act(async () => { f() })
}

/** Ce que la tranche d'un onglet porte sous une clé. */
const tranchee = (cle: string, ongletId: string) => h.onglets!.lireUi(cle, ongletId)

/** Le point de la page Recherche, dans le pager d'un onglet. */
function allerALaRecherche(ongletId: string): void {
  document.querySelector<HTMLButtonElement>(`[data-onglet="${ongletId}"] button[title="pager.recherche"]`)!.click()
}

beforeEach(() => {
  ;({ session } = poserStockagesMemoire())
  h.lecture = null
  h.naviguer = null
  h.onglets = null
  h.adresse = ''
  h.applications = []
  h.pages = []
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  })
})

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
})

describe('une arrivée ne s’applique que dans l’onglet qui porte son adresse', () => {
  it('fermer l’onglet actif : l’onglet qui prend la main ne reçoit pas son arrivée', async () => {
    h.lecture = Promise.resolve(ligne([onglet('ta', A), onglet('tb', FIL)]))
    await rendre(<Arbre entree={lien('j1')} />)
    expect(h.applications).toEqual([`ta ${A}`])
    await geste(() => h.onglets!.fermer(0))
    expect(h.onglets!.tabs.map((t) => t.id)).toEqual(['tb'])
    expect(h.adresse).toBe(FIL)
    expect(h.applications).toEqual([`ta ${A}`])
    expect(tranchee(MARQUE_FIL, 'tb')).toBeUndefined()
  })

  it('… ni son pager : la page 0 de l’arrivée fermée ne s’écrit pas chez lui', async () => {
    // L'onglet qui prend la main avait laissé son pager sur la Recherche : c'est cette page qu'effacerait la page 0
    // d'une arrivée écrite chez lui.
    h.lecture = Promise.resolve(ligne([onglet('ta', A), onglet('tb', FIL, { [PAGE]: 1 })]))
    await rendre(<Arbre entree={lien('j1')} ecran={<MatchingPage banc={BANC} />} />)
    expect(pageMontree('ta')).toBe(0)
    expect(pageMontree('tb')).toBe(1)
    await geste(() => h.onglets!.fermer(0))
    expect(pageMontree('tb')).toBe(1)
    expect(tranchee(PAGE, 'tb')).toBe(1)
    expect(tranchee(MARQUE_PAGER, 'tb')).toBeUndefined()
  })

  it('« Précédent » ramène ensuite l’adresse fermée DANS cet onglet : sa navigation, appliquée une fois', async () => {
    h.lecture = Promise.resolve(ligne([onglet('ta', A), onglet('tb', FIL)]))
    await rendre(<Arbre entree={lien('j1')} />)
    await geste(() => h.onglets!.fermer(0))
    await geste(() => h.naviguer!(-1))
    expect(h.adresse).toBe(A)
    expect(h.applications).toEqual([`ta ${A}`, `tb ${A}`])
    await geste(() => h.naviguer!(1))
    await geste(() => h.naviguer!(-1))
    expect(h.applications).toEqual([`ta ${A}`, `tb ${A}`])
  })

  it('un lien suivi dans l’onglet : l’arrivée attend que la pile y range son adresse, puis s’applique là', async () => {
    h.lecture = Promise.resolve(ligne([onglet('ta', ACCUEIL)]))
    await rendre(<Arbre entree={ACCUEIL} />)
    await geste(() => h.naviguer!(A, avecArrivee()))
    expect(h.applications).toEqual([`ta ${A}`])
    expect(h.onglets!.tabs.map((t) => `${t.id} ${t.path}${t.search}`)).toEqual([`ta ${A}`])
  })

  it('un nouveau clic vers une adresse ouverte dans un onglet caché s’applique dans CET onglet, une fois', async () => {
    // L'accueil est actif ; l'onglet caché porte A, appliquée par un clic précédent.
    h.lecture = Promise.resolve(ligne([onglet('ta', ACCUEIL), onglet('tb', A, { [MARQUE_FIL]: { jeton: 'j0', adresse: A } })]))
    await rendre(<Arbre entree={ACCUEIL} />)
    expect(h.applications).toEqual([])
    // Le clic, depuis l'accueil : l'onglet qui porte A est montré aussitôt, l'accueil étant encore l'actif de la pile —
    // et c'est dans la tranche de l'onglet de l'écran que l'arrivée se range.
    const clic = avecArrivee()
    await geste(() => h.naviguer!(A, clic))
    expect(h.applications).toEqual([`tb ${A}`])
    expect(h.onglets!.tabs[h.onglets!.active].id).toBe('tb')
    expect(tranchee(MARQUE_FIL, 'tb')).toEqual({ jeton: clic.state.arrivee, adresse: A })
    expect(tranchee(MARQUE_FIL, 'ta')).toBeUndefined()
    // La barre, d'un onglet à l'autre : rien ne se rejoue.
    await geste(() => h.onglets!.selectionner(0))
    await geste(() => h.onglets!.selectionner(1))
    await geste(() => h.onglets!.selectionner(0))
    expect(h.applications).toEqual([`tb ${A}`])
  })

  it('un écran caché, puis réactivé par la barre, ne rejoue rien ; un nouveau clic, si — une fois', async () => {
    h.lecture = Promise.resolve(ligne([onglet('ta', A), onglet('tb', ACCUEIL)]))
    await rendre(<Arbre entree={lien('j1')} />)
    expect(h.applications).toEqual([`ta ${A}`])
    // Caché : son adresse, sans état. Réactivé : la barre navigue vers son adresse, sans jeton.
    await geste(() => h.onglets!.selectionner(1))
    await geste(() => h.onglets!.selectionner(0))
    expect(h.applications).toEqual([`ta ${A}`])
    await geste(() => h.naviguer!(A, avecArrivee()))
    expect(h.applications).toEqual([`ta ${A}`, `ta ${A}`])
    await geste(() => h.onglets!.selectionner(1))
    await geste(() => h.onglets!.selectionner(0))
    expect(h.applications).toEqual([`ta ${A}`, `ta ${A}`])
  })
})

describe('sur mobile, la pile ne suit pas l’adresse : l’arrivée n’a pas d’onglet à attendre', () => {
  it('un lien suivi s’applique, une fois — l’onglet, lui, reste où il était', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (q: string) => ({
        matches: q === '(max-width: 768px)', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
      }),
    })
    h.lecture = Promise.resolve(ligne([onglet('ta', ACCUEIL)]))
    await rendre(<Arbre entree={ACCUEIL} />)
    await geste(() => h.naviguer!(A, avecArrivee()))
    expect(h.onglets!.tabs.map((t) => `${t.path}${t.search}`)).toEqual([ACCUEIL])
    expect(h.applications).toEqual([`ta ${A} ≠ ${ACCUEIL}`])
    await geste(() => h.naviguer!(ACCUEIL))
    await geste(() => h.naviguer!(-1))
    expect(h.applications).toHaveLength(1)
  })
})

describe('le rechargement : la marque revient avec la pile serveur', () => {
  /**
   * Un rechargement : la même entrée d'historique, donc le même jeton, et un miroir de session SANS la marque — la
   * première image vient de lui, puis l'hydratation le remplace par la ligne serveur.
   */
  async function recharger(serveur: CrmTab): Promise<void> {
    const miroir = { tabs: [onglet('ta', A)], active: 0, revision: null }
    session.setItem(cleDuCompte('megga.crm.tabs', 'u-1', 'ag-1'), JSON.stringify(miroir))
    let servir: (r: { data: unknown; error: null }) => void = () => {}
    h.lecture = new Promise((r) => { servir = r })
    await rendre(<Arbre entree={lien('j1')} />)
    expect(h.onglets!.tabs.map((t) => t.id)).toEqual(['ta'])
    expect(h.applications).toEqual([])
    await act(async () => { servir(ligne([serveur])) })
    expect(h.onglets!.chargement).toBe(false)
  }

  it('la ligne serveur porte la marque : rien n’est rejoué, même si le miroir ne la porte pas', async () => {
    await recharger(onglet('ta', A, { [MARQUE_FIL]: { jeton: 'j1', adresse: A } }))
    expect(h.applications).toEqual([])
  })

  it('CONTRÔLE : la même ligne sans la marque — l’arrivée s’applique, une fois', async () => {
    await recharger(onglet('ta', A))
    expect(h.applications).toEqual([`ta ${A}`])
  })
})

describe('le pager de Matching : son arrivée attend la pile d’onglets, et d’être montré', () => {
  it('pendant le chargement de la pile, il montre la page 0 sans rien écrire ; la pile arrivée, il l’applique', async () => {
    // La première image vient du miroir de session, puis l'hydratation le remplace par la ligne serveur : dans l'un
    // comme dans l'autre, l'onglet est resté sur la Recherche — l'arrivée doit l'emporter sur cette page retrouvée.
    const resteSurLaRecherche = onglet('ta', A, { [PAGE]: 1 })
    session.setItem(cleDuCompte('megga.crm.tabs', 'u-1', 'ag-1'),
      JSON.stringify({ tabs: [resteSurLaRecherche], active: 0, revision: null }))
    let servir: (r: { data: unknown; error: null }) => void = () => {}
    h.lecture = new Promise((r) => { servir = r })
    await rendre(<Arbre entree={lien('j1')} ecran={<MatchingPage banc={BANC} />} />)
    expect(h.onglets!.chargement).toBe(true)
    const [provisoire] = h.onglets!.tabs
    expect(pageMontree(provisoire.id)).toBe(0)
    // Écrite ici, la page serait effacée par l'hydratation — et l'arrivée, rejouée : la tranche ne porte que la page
    // retrouvée.
    expect(h.onglets!.tabs.flatMap((t) => Object.entries(t.ui ?? {}))).toEqual([[PAGE, 1]])
    await act(async () => { servir(ligne([resteSurLaRecherche])) })
    expect(pageMontree('ta')).toBe(0)
    expect(tranchee(PAGE, 'ta')).toBe(0)
    expect(tranchee(MARQUE_PAGER, 'ta')).toEqual({ jeton: 'j1', adresse: A })
  })

  it('caché, il n’applique rien ; montré par la barre, une fois — la page choisie ensuite survit aux bascules', async () => {
    // L'onglet caché porte une adresse du fil jamais appliquée : sans jeton, sa clé est l'adresse. Son pager était
    // resté sur la Recherche : montré, l'arrivée l'amène à la page 0, une fois.
    h.lecture = Promise.resolve(ligne([onglet('ta', ACCUEIL), onglet('tb', A, { [PAGE]: 1 })]))
    await rendre(<Arbre entree={ACCUEIL} ecran={<MatchingPage banc={BANC} />} />)
    expect(tranchee(PAGE, 'tb')).toBe(1)
    expect(tranchee(MARQUE_PAGER, 'tb')).toBeUndefined()
    await geste(() => h.onglets!.selectionner(1))
    expect(pageMontree('tb')).toBe(0)
    expect(tranchee(MARQUE_PAGER, 'tb')).toEqual({ jeton: null, adresse: A })
    await geste(() => allerALaRecherche('tb'))
    expect(pageMontree('tb')).toBe(1)
    await geste(() => h.onglets!.selectionner(0))
    await geste(() => h.onglets!.selectionner(1))
    expect(pageMontree('tb')).toBe(1)
  })

  it('un lien suivi dans l’onglet : le pager naît sur la page 0, sans passer par la Recherche', async () => {
    // L'onglet avait laissé son pager sur la Recherche. L'arrivée se MONTRE dès le premier rendu, avant que la pile
    // range l'adresse dans l'onglet : attendre pour la montrer ferait naître le pager sur cette Recherche retrouvée,
    // puis le ferait glisser vers la page 0.
    h.lecture = Promise.resolve(ligne([onglet('ta', ACCUEIL, { [PAGE]: 1 })]))
    await rendre(<Arbre entree={ACCUEIL} ecran={<MatchingPage banc={BANC} />} temoin="ta" />)
    h.pages = []
    const clic = avecArrivee()
    await geste(() => h.naviguer!(A, clic))
    const montrees = h.pages.filter((p) => p !== null)
    expect(montrees.length).toBeGreaterThan(0)
    expect(montrees.filter((p) => p !== 0)).toEqual([])
    expect(tranchee(MARQUE_PAGER, 'ta')).toEqual({ jeton: clic.state.arrivee, adresse: A })
  })
})
