/**
 * La pile d'onglets appartient à UN compte et UNE agence (audit S11).
 *
 * Le fournisseur est monté pour de vrai (createRoot + act, routeur mémoire), avec
 * un client Supabase simulé : la ligne serveur est absente, et `crm_tabs_save` est
 * un espion. Le miroir de sessionStorage est semé avec un onglet « Jean Dupont »
 * sous la clé du compte A, agence AG1 — et sous l'ancienne clé non indexée.
 *
 * CONTRÔLE POSITIF d'abord : monté en A/AG1, la sauvegarde PORTE bien « Jean
 * Dupont ». Sans lui, les cas « B ne voit rien » passeraient pour un banc qui ne
 * lit jamais le miroir.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { poserStockagesMemoire, type StockageMemoire } from './helpers/stockage-memoire'

const h = vi.hoisted(() => ({
  user: null as null | { id: string },
  profile: null as null | { agency_id: string | null },
  rpc: null as unknown as ReturnType<typeof import('vitest')['vi']['fn']>,
}))

vi.mock('react-i18next', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k }),
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: h.user, profile: h.profile }) }))

vi.mock('@/lib/supabase', () => {
  const chaine = { select: () => chaine, eq: () => chaine, maybeSingle: async () => ({ data: null, error: null }) }
  return { supabase: { from: () => chaine, rpc: (...args: unknown[]) => h.rpc(...args) } }
})

import { CrmTabsProvider } from '@/components/crm/CrmTabsProvider'

const CONTACT = '3f2b6c1e-0000-4000-8000-000000000001'
// Deux onglets : la fiche de Jean Dupont (inactive) et la liste (active). L'onglet
// ACTIF prend l'emplacement courant (gel continu) : la fiche, elle, garde son libellé.
const PILE_A = JSON.stringify({
  tabs: [
    { id: 't1', path: `/dashboard/contacts/${CONTACT}`, search: '', section: 'contacts', label: 'Jean Dupont', pinned: false, ui: {} },
    { id: 't2', path: '/dashboard/contacts', search: '', section: 'contacts', label: 'Contacts', pinned: false, ui: {} },
  ],
  active: 1,
  revision: null,
})

let session: StockageMemoire
let hote: HTMLDivElement | null = null
let racine: Root | null = null

async function monter(user: string, agence: string) {
  h.user = { id: user }
  h.profile = { agency_id: agence }
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(createElement(MemoryRouter, { initialEntries: ['/dashboard/contacts'] }, createElement(CrmTabsProvider, null, null)))
  })
  // Débounce de la sauvegarde (800 ms) : on le franchit.
  await act(async () => { await vi.advanceTimersByTimeAsync(900) })
}

/** Les appels à crm_tabs_save : (nom, arguments). */
const sauvegardes = () => h.rpc.mock.calls.filter(([nom]) => nom === 'crm_tabs_save').map(([, args]) => args as Record<string, unknown>)

beforeEach(() => {
  vi.useFakeTimers()
  ;({ session } = poserStockagesMemoire())
  session.setItem('megga.crm.tabs:A:AG1', PILE_A)
  session.setItem('megga.crm.tabs', PILE_A) // ancienne clé non indexée : ne doit plus rien donner
  h.rpc = vi.fn(async () => ({ data: { revision: 1, stale: false }, error: null }))
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
  vi.useRealTimers()
})

describe('pile d’onglets — par compte et par agence', () => {
  it('CONTRÔLE POSITIF : A/AG1 retrouve sa pile, et la sauvegarde la porte avec son compte et son agence', async () => {
    await monter('A', 'AG1')
    const s = sauvegardes()
    expect(s.length).toBeGreaterThan(0)
    expect(JSON.stringify(s.at(-1)?.p_tabs)).toContain('Jean Dupont')
    expect(s.at(-1)?.p_owner).toBe('A')
    expect(s.at(-1)?.p_agency).toBe('AG1')
  })

  it('B sur le même onglet du navigateur : sa pile ne contient RIEN de A', async () => {
    await monter('B', 'AG2')
    const s = sauvegardes()
    expect(s.length).toBeGreaterThan(0) // B persiste bien SA pile
    for (const a of s) {
      expect(JSON.stringify(a.p_tabs)).not.toContain('Jean Dupont')
      expect(JSON.stringify(a.p_tabs)).not.toContain(CONTACT)
      expect(a.p_owner).toBe('B')
    }
  })

  it('A dans une AUTRE agence : la pile de l’ancienne agence ne revient pas', async () => {
    await monter('A', 'AG2')
    const s = sauvegardes()
    expect(s.length).toBeGreaterThan(0)
    for (const a of s) {
      expect(JSON.stringify(a.p_tabs)).not.toContain('Jean Dupont')
      expect(a.p_agency).toBe('AG2')
    }
  })

  it('le miroir s’écrit sous la clé du couple compte/agence, jamais sous l’ancienne', async () => {
    session.removeItem('megga.crm.tabs')
    await monter('B', 'AG2')
    expect(session.getItem('megga.crm.tabs:B:AG2')).not.toBeNull()
    expect(session.getItem('megga.crm.tabs')).toBeNull()
  })

  it('PGRST202 (migration pas encore appliquée) : repli sur l’appel historique, la persistance continue', async () => {
    h.rpc = vi.fn(async (_nom: string, args: Record<string, unknown>) => ('p_owner' in args
      ? { data: null, error: { code: 'PGRST202', message: 'not found' } }
      : { data: { revision: 1, stale: false }, error: null }))
    await monter('A', 'AG1')
    const s = sauvegardes()
    expect(s.some((a) => 'p_owner' in a)).toBe(true) // tentée avec la garde…
    expect(s.some((a) => !('p_owner' in a) && JSON.stringify(a.p_tabs).includes('Jean Dupont'))).toBe(true) // …puis sans
  })

  it('fin de session : plus aucune sauvegarde ni écriture du miroir, même au pagehide', async () => {
    // Module frais : le drapeau de fin de session vit pour la vie de la page, il
    // ne doit pas se répandre sur les autres cas de ce fichier.
    vi.resetModules()
    const { CrmTabsProvider: Frais } = await import('@/components/crm/CrmTabsProvider')
    const { marquerFinDeSession } = await import('@/lib/stockageParCompte')
    h.user = { id: 'A' }
    h.profile = { agency_id: 'AG1' }
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
    await act(async () => {
      racine!.render(createElement(MemoryRouter, { initialEntries: ['/dashboard/contacts'] }, createElement(Frais, null, null)))
    })
    marquerFinDeSession()
    session.removeItem('megga.crm.tabs:A:AG1') // ce que la purge vient de faire
    h.rpc.mockClear()
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))
      await vi.advanceTimersByTimeAsync(900)
    })
    expect(sauvegardes()).toEqual([])
    expect(session.getItem('megga.crm.tabs:A:AG1')).toBeNull()
  })
})
