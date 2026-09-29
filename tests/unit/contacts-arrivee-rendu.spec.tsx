/**
 * La page Contacts, RENDUE, sur l'arrivée qu'envoie la couverture du Matching — « Ajouter un acheteur »,
 * `/dashboard/contacts?nouveau=1` avec son jeton (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md`
 * §5.1) : la création d'un contact s'ouvre, UNE fois par clic.
 *
 * Ce que cette spec refuse :
 *   · une création qui ne s'ouvrirait pas sur un carnet VIDE — le cas même de la couverture : l'agence qui n'a encore
 *     aucun acheteur voit la page Contacts en premier lancement ;
 *   · une création qui se rouvrirait d'elle-même une fois refermée, ou sur l'adresse rejouée sans jeton (un onglet
 *     réactivé) ; un nouveau clic ignoré ; une création ouverte sans `?nouveau`.
 *
 * La vraie `ContactsPage` et son vrai pager, sous la vraie pile d'onglets (`CrmTabsProvider`) sur un Supabase simulé ;
 * la coquille, la liste, la modale et l'écran de premier lancement sont des témoins. Le mécanisme de l'arrivée
 * (`useArrivee`) est éprouvé à part, dans `jeton-arrivee.spec.tsx`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useNavigate, type InitialEntry, type NavigateFunction } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { poserStockagesMemoire } from './helpers/stockage-memoire'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const h = vi.hoisted(() => ({
  naviguer: null as null | NavigateFunction,
  contacts: [] as unknown[],
  /** Les ouvertures de la création, montage après montage de la modale. */
  ouvertures: 0,
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (cle: string) => cle }),
}))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' }, profile: { id: 'u-1', agency_id: 'ag-1' } }) }))
vi.mock('@/lib/supabase', () => {
  const chaine = { select: () => chaine, eq: () => chaine, maybeSingle: () => Promise.resolve({ data: null, error: null }) }
  return { supabase: { from: () => chaine, rpc: async () => ({ data: { revision: 1, stale: false }, error: null }) } }
})
vi.mock('@/components/crm/CrmWorkspace', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/hooks/useContactsScreen', () => ({
  useContactsScreen: () => ({ contacts: h.contacts, isLoading: false, isError: false, refetch: vi.fn() }),
}))
vi.mock('@/hooks/useContacts', () => ({ useCreateContact: () => ({ mutateAsync: vi.fn(), isPending: false }) }))
vi.mock('@/hooks/useContactDuplicates', () => ({ useFindContactDuplicates: () => ({ data: [] }) }))
vi.mock('@/hooks/useExtractLead', () => ({ useExtractLead: () => ({ mutateAsync: vi.fn() }) }))
vi.mock('@/lib/crmDark', () => ({ useCrmDarkPref: () => [false, vi.fn()] }))
vi.mock('@/components/crm/contacts-pager/ContactsFirstRun', () => ({ default: () => <div data-temoin="premier-lancement" /> }))
vi.mock('@/components/crm/contacts-pager/NewContactModal', () => ({
  default: function ModaleTemoin({ onClose }: { onClose: () => void }) {
    useEffect(() => { h.ouvertures += 1 }, [])
    return <div data-temoin="creation"><button type="button" data-temoin="fermer" onClick={onClose} /></div>
  },
}))

import { CrmTabsProvider } from '@/components/crm/CrmTabsProvider'
import { EcranActifProvider } from '@/hooks/useEcranActif'
import { avecArrivee } from '@/lib/jetonArrivee'
import { ROUTER_FUTURE } from '@/lib/routerFuture'
import ContactsPage from '@/pages/agent/ContactsPage'

/** Le `navigate` du routeur, tenu par le test. */
function Pilote() {
  const naviguer = useNavigate()
  useEffect(() => { h.naviguer = naviguer })
  return null
}

let hote: HTMLDivElement | null = null
let racine: Root | null = null

async function monter(entree: InitialEntry): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={[entree]} future={ROUTER_FUTURE}>
          <CrmTabsProvider>
            <Pilote />
            <EcranActifProvider value>
              <ContactsPage />
            </EcranActifProvider>
          </CrmTabsProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    )
  })
}

const creation = (): Element | null => document.querySelector('[data-temoin="creation"]')
const arrivee = (jeton: string, search = '?nouveau=1'): InitialEntry => ({ pathname: '/dashboard/contacts', search, state: { arrivee: jeton } })

beforeEach(() => {
  poserStockagesMemoire()
  h.contacts = []
  h.ouvertures = 0
  h.naviguer = null
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

describe('la page Contacts sur l’arrivée de la couverture (`?nouveau=1`)', () => {
  it('carnet vide, page de premier lancement : la création s’ouvre, une fois ; un nouveau clic la rouvre', async () => {
    await monter(arrivee('j1'))
    expect(document.querySelector('[data-temoin="premier-lancement"]')).not.toBeNull()
    expect(creation()).not.toBeNull()
    expect(h.ouvertures).toBe(1)
    // Refermée, elle ne se rouvre pas d'elle-même…
    await act(async () => { (document.querySelector('[data-temoin="fermer"]') as HTMLButtonElement).click() })
    expect(creation()).toBeNull()
    // … ni sur l'adresse rejouée sans jeton, comme par un onglet réactivé…
    await act(async () => { h.naviguer!('/dashboard/contacts?nouveau=1') })
    expect(creation()).toBeNull()
    // … mais un NOUVEAU clic sur « Ajouter un acheteur », jeton neuf, la rouvre.
    await act(async () => { h.naviguer!('/dashboard/contacts?nouveau=1', avecArrivee()) })
    expect(creation()).not.toBeNull()
    expect(h.ouvertures).toBe(2)
  })

  it('un carnet déjà rempli : la création s’ouvre aussi', async () => {
    h.contacts = [{ id: 'c1', firstName: 'Julie', lastName: 'Sturm', roles: ['buyer'] }]
    await monter(arrivee('j1'))
    expect(creation()).not.toBeNull()
  })

  it('sans `?nouveau` : rien ne s’ouvre', async () => {
    await monter(arrivee('j1', ''))
    expect(creation()).toBeNull()
    expect(h.ouvertures).toBe(0)
  })
})
