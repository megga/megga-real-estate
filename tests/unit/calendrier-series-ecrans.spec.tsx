/**
 * Une série du Calendrier sur les AUTRES écrans que le Calendrier — « Aujourd'hui » (bureau et
 * mobile) et l'agenda mobile, que `useCalendarScreen` nourrit (revue du 15.09.2026).
 *
 * ⛔ Le hook rendait les séries telles qu'enregistrées, et seul le Calendrier de bureau les
 * développait : une série hebdomadaire n'apparaissait sur ces écrans qu'à sa PREMIÈRE date. Et le
 * geste « fait » d'« Aujourd'hui » écrivait sur la ligne maîtresse — toute la série cochée.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCalendarScreen, type UseCalendarScreenReturn } from '@/hooks/useCalendarScreen'
import { markBlockDone, type TodayHBlock } from '@/components/crm/today/useTodayH'

interface Appel { table: string; op: 'select' | 'update'; payload?: unknown; filtres: [string, unknown][] }
type Rep = { data: unknown; error: null }

const h = vi.hoisted(() => ({ lignes: {} as Record<string, Record<string, unknown>[]>, appels: [] as Appel[] }))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: { agency_id: 'ag-1' } }) }))
vi.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    const rec: Appel = { table, op: 'select', filtres: [] }
    const repondre = (): Rep => {
      h.appels.push(rec)
      if (rec.op === 'update') return { data: null, error: null }
      const egal = rec.filtres.filter(([k]) => k.startsWith('eq:') && k !== 'eq:agency_id')
      return { data: (h.lignes[table] ?? []).filter((r) => egal.every(([k, v]) => r[k.slice(3)] === v)), error: null }
    }
    const b = {
      select: () => b, gte: () => b, lte: () => b, or: () => b, order: () => b, in: () => b, limit: () => b,
      eq: (c: string, v: unknown) => { rec.filtres.push([`eq:${c}`, v]); return b },
      update: (p: unknown) => { rec.op = 'update'; rec.payload = p; return b },
      maybeSingle: async (): Promise<Rep> => { const r = repondre(); return { data: Array.isArray(r.data) ? (r.data[0] ?? null) : null, error: null } },
      then: (res: (v: Rep) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve().then(repondre).then(res, rej),
    }
    return b
  }
  return { supabase: { from } }
})

/** Aujourd'hui à 10 h, et la même heure N semaines plus tôt. */
const aujourdhui = () => { const d = new Date(); d.setHours(10, 0, 0, 0); return d }
const semainesAvant = (n: number) => { const d = aujourdhui(); d.setDate(d.getDate() - 7 * n); return d }
const cle = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

/** Une série hebdomadaire née trois semaines avant aujourd'hui. */
const serie = (recurrence: Record<string, unknown>) => ({
  id: 's1', type: 'autre', title: 'Point hebdo', starts_at: semainesAvant(3).toISOString(),
  ends_at: new Date(semainesAvant(3).getTime() + 3_600_000).toISOString(), all_day: false, location: null, notes: null, color: null,
  recurrence: { freq: 'weekly', until: null, ...recurrence }, status: null, contact_id: null, property_id: null, mail_thread_id: null, contact: null, property: null,
})

// Idiome createRoot (le dépôt n'a pas @testing-library/react) : le hook, monté pour de vrai,
// rend chaque état à la sonde par un effet.
function Sonde({ rendu }: { rendu: (r: UseCalendarScreenReturn) => void }) {
  const r = useCalendarScreen()
  useEffect(() => { rendu(r) })
  return null
}
let racine: Root | null = null
const rendre = async (): Promise<UseCalendarScreenReturn> => {
  let dernier: UseCalendarScreenReturn | null = null
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  racine = createRoot(document.createElement('div'))
  racine.render(<QueryClientProvider client={qc}><Sonde rendu={(r) => { dernier = r }} /></QueryClientProvider>)
  const pret = () => (dernier as UseCalendarScreenReturn | null)?.series.length
  for (let i = 0; i < 50 && !pret(); i++) await new Promise((r) => setTimeout(r, 10))
  return dernier!
}

beforeEach(() => { h.lignes = {}; h.appels = [] })
afterEach(() => { racine?.unmount(); racine = null })

describe('useCalendarScreen — les écrans reçoivent les OCCURRENCES', () => {
  it('une série née il y a trois semaines est là AUJOURD HUI, sous l id de son occurrence', async () => {
    h.lignes.calendar_events = [serie({})]
    const r = await rendre()
    const duJour = r.events.filter((e) => e.start.toDateString() === aujourdhui().toDateString())
    expect(duJour.map((e) => [e.id, e.masterId, e.start.getHours()])).toEqual([[`s1@${cle(aujourdhui())}`, 's1', 10]])
    // La série elle-même reste servie au Calendrier, qui la développe après ses surcharges.
    expect(r.series.map((e) => e.id)).toEqual(['s1'])
    expect(r.events.filter((e) => e.masterId === 's1').length).toBeGreaterThan(8)
  })

  it('une occurrence RETIRÉE n y est pas ; une autre porte SON état, pas celui de la série', async () => {
    const hier7 = semainesAvant(1)
    h.lignes.calendar_events = [serie({ sauf: [cle(aujourdhui())], etats: { [cle(hier7)]: 'done' } })]
    const r = await rendre()
    expect(r.series).toHaveLength(1)
    expect(r.events.some((e) => e.id === `s1@${cle(aujourdhui())}`)).toBe(false)
    expect(r.events.find((e) => e.id === `s1@${cle(hier7)}`)?.status).toBe('done')
    expect(r.events.find((e) => e.id === `s1@${cle(semainesAvant(2))}`)?.status).toBeUndefined()
  })
})

describe('« Aujourd hui » — le geste « fait » sur une occurrence', () => {
  const bloc = (id: string): TodayHBlock => ({ id, origin: 'event' } as TodayHBlock)

  it('écrit l état DANS la série, sous la clé de l occurrence — jamais sur la ligne maîtresse', async () => {
    h.lignes.calendar_events = [{ id: 's1', recurrence: { freq: 'weekly', until: null, etats: { '2026-9-8': 'done' } } }]
    expect(await markBlockDone(bloc('s1@2026-9-15'), true)).toBe(true)
    const maj = h.appels.filter((a) => a.op === 'update')
    expect(maj).toHaveLength(1)
    expect(maj[0].filtres).toEqual([['eq:id', 's1']])
    expect(maj[0].payload).toEqual({ recurrence: { freq: 'weekly', until: null, etats: { '2026-9-8': 'done', '2026-9-15': 'done' } } })
    expect(h.appels.some((a) => a.filtres.some(([, v]) => v === 's1@2026-9-15')), 'maître@date n est l id d aucune ligne').toBe(false)
  })

  it('décoché, l occurrence redevient à faire — les autres gardent le leur', async () => {
    h.lignes.calendar_events = [{ id: 's1', recurrence: { freq: 'weekly', until: null, etats: { '2026-9-8': 'done', '2026-9-15': 'done' } } }]
    await markBlockDone(bloc('s1@2026-9-15'), false)
    expect(h.appels.find((a) => a.op === 'update')?.payload).toEqual({ recurrence: { freq: 'weekly', until: null, etats: { '2026-9-8': 'done' } } })
  })

  it('un événement simple garde son statut de ligne', async () => {
    expect(await markBlockDone(bloc('e1'), true)).toBe(true)
    expect(h.appels.map((a) => [a.op, a.payload, a.filtres])).toEqual([['update', { status: 'done' }, [['eq:id', 'e1']]]])
  })

  it('une série introuvable : le geste échoue, rien n est écrit', async () => {
    expect(await markBlockDone(bloc('disparue@2026-9-15'), true)).toBe(false)
    expect(h.appels.filter((a) => a.op === 'update')).toEqual([])
  })
})
