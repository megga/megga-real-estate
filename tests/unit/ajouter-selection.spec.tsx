/**
 * « Ajouter à la sélection de … » (`useAjouterSelection`) : le bilan dit ce qui est RÉELLEMENT entré
 * dans la file de l'acheteur, et ce qui y était déjà.
 *
 * ⛔ La RPC `insert_market_matches` est idempotente (`ON CONFLICT DO NOTHING`) et ne rend que les
 * lignes CRÉÉES. Le hook rendait jusqu'ici le nombre de biens SOUMIS : trois biens déjà présents
 * s'annonçaient « 3 biens ajoutés », et l'agent les cherchait en vain dans la file. Un bien déjà
 * présent mais écarté, refusé ou reporté reste hors de la file : il est compté à part, jamais
 * réactivé (le faux client n'a d'ailleurs aucun `update` : l'appeler ferait lever).
 *
 * Idiome createRoot (le dépôt n'a pas @testing-library/react), React 19 du dépôt.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  /** Lignes que rend la lecture des matchs déjà présents. */
  presents: [] as unknown[],
  lectureErreur: null as { message: string } | null,
  lectures: [] as { table: string; filtres: string[] }[],
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => h.rpc(...args),
    from: (table: string) => {
      const filtres: string[] = []
      const q = {
        select: () => q,
        eq: (c: string, v: unknown) => { filtres.push(`${c}=${String(v)}`); return q },
        in: (c: string, vs: unknown[]) => { filtres.push(`${c} in ${vs.join(',')}`); return q },
        then: <T,>(ok: (r: { data: unknown; error: unknown }) => T, ko?: (x: unknown) => T) => {
          h.lectures.push({ table, filtres })
          return Promise.resolve({ data: h.lectureErreur ? null : h.presents, error: h.lectureErreur }).then(ok, ko)
        },
      }
      return q
    },
  },
}))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({}) }))
vi.mock('@/lib/intercom-milestones', () => ({ markIntercomMilestone: () => undefined }))
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_MATCH_SENT: 'first_match_sent' } }))

import { useAjouterSelection, type AjoutSelectionInput, type BilanAjout } from '@/hooks/useAjouterSelection'

const attendre = (ms = 20) => new Promise((r) => setTimeout(r, ms))

async function monter() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  const invalider = vi.spyOn(client, 'invalidateQueries')
  const capture: { mutation: ReturnType<typeof useAjouterSelection> | null } = { mutation: null }
  function Sonde() {
    const mutation = useAjouterSelection()
    useEffect(() => { capture.mutation = mutation })
    return null
  }
  const root = createRoot(document.createElement('div'))
  root.render(<QueryClientProvider client={client}><Sonde /></QueryClientProvider>)
  await attendre()
  return {
    ajouter: (input: AjoutSelectionInput): Promise<BilanAjout> => capture.mutation!.mutateAsync(input),
    invalider,
    demonter: () => root.unmount(),
  }
}

const TROIS: AjoutSelectionInput = {
  contactId: 'c-1', agencyId: 'ag-1', clientSearchId: 's-1',
  items: [
    { marketListingId: 'ml-1', score: 91.6, reasons: ['budget'] },
    { marketListingId: 'ml-2', score: 140 },
    { marketListingId: 'ml-3', score: -4 },
  ],
}
const cree = (id: string) => ({ id: `m-${id}`, market_listing_id: id, status: 'suggested' })
const dansUnJour = () => new Date(Date.now() + 864e5).toISOString()

beforeEach(() => {
  h.rpc.mockReset()
  h.presents = []; h.lectureErreur = null; h.lectures.length = 0
})

describe('useAjouterSelection — le bilan', () => {
  it('soumet des matchs `suggested` au score borné, par la RPC idempotente', async () => {
    h.rpc.mockResolvedValue({ data: [cree('ml-1'), cree('ml-2'), cree('ml-3')], error: null })
    const { ajouter, demonter } = await monter()
    await ajouter(TROIS)
    expect(h.rpc).toHaveBeenCalledWith('insert_market_matches', { p_rows: [
      expect.objectContaining({ contact_id: 'c-1', agency_id: 'ag-1', market_listing_id: 'ml-1', client_search_id: 's-1', score: 92, status: 'suggested', reasons: { keys: ['budget'] } }),
      expect.objectContaining({ market_listing_id: 'ml-2', score: 100, reasons: {} }),
      expect.objectContaining({ market_listing_id: 'ml-3', score: 0 }),
    ] })
    demonter()
  })

  it('tous nouveaux : trois ajoutés, aucun déjà présent, et aucune lecture de plus', async () => {
    h.rpc.mockResolvedValue({ data: [cree('ml-1'), cree('ml-2'), cree('ml-3')], error: null })
    const { ajouter, demonter } = await monter()
    await expect(ajouter(TROIS)).resolves.toEqual({ ajoutes: 3, dejaPresents: 0, horsFile: 0 })
    expect(h.lectures).toEqual([])
    demonter()
  })

  it('rend le nombre RÉELLEMENT ajouté, et les déjà présents à part', async () => {
    // ml-3 était déjà dans les matchs de l'acheteur : la RPC ne rend que les deux créés.
    h.rpc.mockResolvedValue({ data: [cree('ml-1'), cree('ml-2')], error: null })
    h.presents = [{ status: 'suggested', snoozed_until: null }]
    const { ajouter, demonter } = await monter()
    await expect(ajouter(TROIS)).resolves.toEqual({ ajoutes: 2, dejaPresents: 1, horsFile: 0 })
    expect(h.lectures).toEqual([{ table: 'matches', filtres: ['contact_id=c-1', 'market_listing_id in ml-3'] }])
    demonter()
  })

  it('compte à part les déjà présents écartés, refusés ou reportés, sans les réactiver', async () => {
    h.rpc.mockResolvedValue({ data: [], error: null })
    h.presents = [
      { status: 'ignored', snoozed_until: null },
      { status: 'rejected', snoozed_until: null },
      { status: 'suggested', snoozed_until: dansUnJour() },
      // Un report ÉCHU est de retour dans la file ; un bien proposé y est aussi.
      { status: 'suggested', snoozed_until: '2020-01-01T00:00:00.000Z' },
      { status: 'sent', snoozed_until: null },
    ]
    const { ajouter, demonter } = await monter()
    const cinq = { ...TROIS, items: ['a', 'b', 'c', 'd', 'e'].map((id) => ({ marketListingId: id, score: 80 })) }
    await expect(ajouter(cinq)).resolves.toEqual({ ajoutes: 0, dejaPresents: 5, horsFile: 3 })
    demonter()
  })

  it('une lecture des présents en échec ne défait pas l’ajout : le détail seul est tu', async () => {
    h.rpc.mockResolvedValue({ data: [cree('ml-1')], error: null })
    h.lectureErreur = { message: 'timeout' }
    const { ajouter, demonter } = await monter()
    await expect(ajouter(TROIS)).resolves.toEqual({ ajoutes: 1, dejaPresents: 2, horsFile: 0 })
    demonter()
  })

  it('une RPC refusée fait lever, sans rien lire ni invalider', async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: 'refus', code: '42501' } })
    const { ajouter, invalider, demonter } = await monter()
    await expect(ajouter(TROIS)).rejects.toMatchObject({ code: '42501' })
    expect(h.lectures).toEqual([])
    expect(invalider).not.toHaveBeenCalled()
    demonter()
  })

  it('les biens ajoutés apparaissent là où l’agent les proposera : atelier, fil, mobile', async () => {
    h.rpc.mockResolvedValue({ data: [cree('ml-1')], error: null })
    const { ajouter, invalider, demonter } = await monter()
    await ajouter({ ...TROIS, items: [TROIS.items[0]] })
    const cles = invalider.mock.calls.map(([f]) => (f as { queryKey: unknown[] }).queryKey[0])
    expect(cles).toEqual(expect.arrayContaining(['atelier-matches', 'matches']))
    expect(cles.length).toBe(3)
    demonter()
  })
})
