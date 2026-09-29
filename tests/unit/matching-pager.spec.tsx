/**
 * Le pager de Matching au bureau (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §4.1 et §4.3) : sa
 * page 0 est le FIL DE MATCHS, et « Matching » s'ouvre sur lui ; la Recherche reste en page 1.
 *
 * Ce que cette spec refuse :
 *   · une autre page 0 que le fil, en production (sans `banc`) ;
 *   · « Matching » ouvert sur la Recherche, sans arrivée ni page retenue par l'onglet ;
 *   · un fil dont « Voir le marché » ne mènerait pas à la Recherche (`onOpenRecherche`) ;
 *   · un onglet qui perdrait sa dernière page vue : la Recherche retenue l'emporte sur l'ouverture ;
 *   · un lien d'arrivée du fil (`?contact=`) qui laisserait l'onglet sur la Recherche ;
 *   · un banc qui perdrait ses emplacements : ses deux pages remplacent celles de la production ;
 *   · un fil qui ne saurait pas si sa page est montrée (`montre`) : son focus d'ouverture le lit ;
 *   · une commande du pager qui prendrait le focus au clic de souris : le fil de la page 0 ne prend qu'un focus perdu.
 *
 * Le pager est monté pour de vrai — `createRoot` + `act`, le routeur mémoire et la VRAIE pile d'onglets
 * (`CrmTabsProvider`) sur un client Supabase simulé, comme `jeton-arrivee.spec.tsx`. La coquille du CRM et les deux
 * pages sont des témoins : ce qui est éprouvé, c'est ce que le pager monte, et la page qu'il montre — celle dont il ne
 * rend pas l'enveloppe inerte.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, createElement, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useNavigate, type NavigateFunction } from 'react-router-dom'
import { poserStockagesMemoire } from './helpers/stockage-memoire'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const h = vi.hoisted(() => ({ naviguer: null as null | NavigateFunction }))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' }, profile: { agency_id: 'ag-1' } }) }))

vi.mock('@/lib/supabase', () => {
  const chaine = {
    select: () => chaine,
    eq: () => chaine,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }
  return { supabase: { from: () => chaine, rpc: async () => ({ data: { revision: 1, stale: false }, error: null }) } }
})

// La coquille du CRM — barre latérale, bande d'onglets : ici, elle ne rend que son contenu.
vi.mock('@/components/crm/CrmWorkspace', () => ({ default: ({ children }: { children: ReactNode }) => children }))

// Les deux pages de la production, en témoins. Le fil porte son « Voir le marché » : un bouton qui appelle
// `onOpenRecherche` ; et il dit s'il se sait montré.
vi.mock('@/components/matching-fil/MatchingFil', () => ({
  default: ({ onOpenRecherche, montre }: { dark: boolean; onOpenRecherche?: () => void; montre?: boolean }) =>
    createElement('button', { type: 'button', 'data-temoin': 'fil', 'data-montre': String(montre), onClick: onOpenRecherche }),
}))
vi.mock('@/components/matching-recherche/MatchingRechercheHybride', () => ({
  default: () => createElement('div', { 'data-temoin': 'recherche' }),
}))

import { CrmTabsProvider } from '@/components/crm/CrmTabsProvider'
import { avecArrivee } from '@/lib/jetonArrivee'
import { ROUTER_FUTURE } from '@/lib/routerFuture'
import MatchingPage, { type MatchingPagerBanc } from '@/pages/agent/MatchingPage'

const FIL = '/dashboard/matching'

/** Les emplacements d'un banc, en témoins. Des composants de MODULE, comme l'exige `MatchingPagerBanc`. */
const BANC: MatchingPagerBanc = {
  Page0: () => <div data-temoin="banc-fil" />,
  Page1: () => <div data-temoin="banc-recherche" />,
}

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

function Pilote() {
  const navigate = useNavigate()
  useEffect(() => { h.naviguer = navigate })
  return null
}

/** Le pager sous sa pile d'onglets. `montage` le remonte dans le même onglet : un retour sur l'écran. */
function Arbre({ banc, montage = 0 }: { banc?: MatchingPagerBanc; montage?: number }) {
  return (
    <MemoryRouter initialEntries={[FIL]} future={ROUTER_FUTURE}>
      <CrmTabsProvider>
        <Pilote />
        <MatchingPage key={montage} banc={banc} />
      </CrmTabsProvider>
    </MemoryRouter>
  )
}

/** Les témoins des deux pages, dans l'ordre du pager. */
const temoins = (): (string | undefined)[] =>
  [...document.querySelectorAll<HTMLElement>('[data-temoin]')].map((t) => t.dataset.temoin)

/** La page montrée : la seule dont le pager ne rend pas l'enveloppe inerte. */
function pageMontree(): string | undefined {
  const vues = [...document.querySelectorAll<HTMLElement>('[data-temoin]')].filter((t) => !t.closest('[inert]'))
  return vues.length === 1 ? vues[0]!.dataset.temoin : undefined
}

/** « Voir le marché » du fil. */
async function voirLeMarche(): Promise<void> {
  await act(async () => { document.querySelector<HTMLElement>('[data-temoin="fil"]')!.click() })
}

beforeEach(() => {
  poserStockagesMemoire()
  h.naviguer = null
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
  })
})

afterEach(() => demonter())

describe('le pager de Matching — le fil en page 0', () => {
  it('en production, la page 0 est le fil, et « Matching » s’ouvre sur lui', async () => {
    await rendre(<Arbre />)
    expect(temoins()).toEqual(['fil', 'recherche'])
    expect(pageMontree()).toBe('fil')
  })

  it('« Voir le marché » du fil mène à la Recherche, la page 1', async () => {
    await rendre(<Arbre />)
    await voirLeMarche()
    expect(pageMontree()).toBe('recherche')
  })

  it('l’onglet garde sa dernière page vue : revenu sur l’écran, il rouvre la Recherche', async () => {
    await rendre(<Arbre />)
    await voirLeMarche()
    await rendre(<Arbre montage={1} />)
    expect(pageMontree()).toBe('recherche')
  })

  it('un lien d’arrivée du fil (`?contact=`) ramène au fil l’onglet resté sur la Recherche', async () => {
    await rendre(<Arbre />)
    await voirLeMarche()
    await act(async () => { h.naviguer!(`${FIL}?contact=c7`, avecArrivee()) })
    expect(pageMontree()).toBe('fil')
  })

  it('le fil sait si sa page est montrée : oui sur la page 0, non une fois sur la Recherche', async () => {
    await rendre(<Arbre />)
    const fil = () => document.querySelector<HTMLElement>('[data-temoin="fil"]')!.dataset.montre
    expect(fil()).toBe('true')
    await voirLeMarche()
    expect(fil()).toBe('false')
  })

  it('un clic de souris sur les points de page ou l’indice de molette ne leur donne pas le focus', async () => {
    await rendre(<Arbre />)
    const commandes = [...document.querySelectorAll<HTMLButtonElement>('button:not([data-temoin])')]
    // Les deux points de page et l'indice de molette.
    expect(commandes).toHaveLength(3)
    for (const c of commandes) {
      const appui = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
      act(() => { c.dispatchEvent(appui) })
      expect(appui.defaultPrevented, c.outerHTML.slice(0, 80)).toBe(true)
    }
  })

  it('le banc garde ses emplacements : ses deux pages remplacent celles de la production, et il s’ouvre sur la page 0', async () => {
    await rendre(<Arbre banc={BANC} />)
    expect(temoins()).toEqual(['banc-fil', 'banc-recherche'])
    expect(pageMontree()).toBe('banc-fil')
  })
})
