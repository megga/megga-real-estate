/**
 * Garde-fou : les gestes du matching laissent une TRACE au journal (CLAUDE.md §5), une proposition
 * n'écrit qu'UN suivi — un deal, une relance, une ligne de journal —, et RIEN ne part vers l'acheteur
 * (décision de Julien, 21.09.2026 : le matching reste chez l'agent).
 *
 * ⛔ LE FAUX CLIENT SUIT supabase-js, sinon il laisse passer de faux verts. Une requête n'est ENVOYÉE
 * qu'à l'`await` (`then`) : un `insert` dont on oublie l'`await` ne part pas, et ne doit donc pas être
 * compté comme écrit. Les lectures sont consignées elles aussi (table, filtres), et une erreur
 * s'injecte par genre et par table (`h.erreurs['update:matches']`). `functions.invoke` passe par
 * `h.invoke` : c'est lui qui prouve qu'aucune fonction serveur (e-mail, lien) n'est appelée.
 *
 * Une écriture suivie de `select(…)` rend ses lignes, comme PostgREST : par défaut celles que ses
 * filtres `id` désignent (toutes réécrites), sinon `h.retours['update:matches']` — c'est ainsi qu'un
 * match qui n'est plus `suggested` se simule : la base n'en réécrit aucune ligne.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  execDismiss, execProposer, execProposerSelection, execReact, execRelance, execSnooze,
} from '@/hooks/useAtelierMatching'

type Genre = 'select' | 'insert' | 'update'
interface Appel { table: string; genre: Genre; valeurs: unknown; filtres: string[] }
interface ErreurPostgrest { message: string; code?: string }

const h = vi.hoisted(() => ({
  /** Requêtes ENVOYÉES, lectures comprises, dans l'ordre d'envoi. */
  appels: [] as Appel[],
  lectures: {} as Record<string, unknown[]>,
  /** `'<genre>:<table>'` → l'erreur que rend cette requête. */
  erreurs: {} as Record<string, ErreurPostgrest>,
  /** `'<genre>:<table>'` → les lignes qu'une écriture suivie de `select` rend (défaut : ses filtres `id`). */
  retours: {} as Record<string, unknown[]>,
  invoke: vi.fn(),
}))

vi.mock('@/lib/supabase', () => {
  /** Les lignes qu'un filtre `id=…` ou `id in …` désigne : ce qu'une écriture rend quand elle a tout réécrit. */
  const lignesDesFiltres = (filtres: string[]): { id: string }[] => {
    for (const f of filtres) {
      if (f.startsWith('id=')) return [{ id: f.slice(3) }]
      if (f.startsWith('id in ')) return f.slice(6).split(',').map((id) => ({ id }))
    }
    return []
  }
  return { supabase: {
    from: (table: string) => {
      const e: Appel = { table, genre: 'select', valeurs: null, filtres: [] }
      let unique = false
      let rendu = false
      const q = {
        // Après une écriture, `select('id')` ne fait que choisir ce qui revient : le genre reste l'écriture.
        select: () => { if (e.genre !== 'select') rendu = true; return q },
        insert: (valeurs: unknown) => { e.genre = 'insert'; e.valeurs = valeurs; return q },
        update: (valeurs: unknown) => { e.genre = 'update'; e.valeurs = valeurs; return q },
        eq: (col: string, val: unknown) => { e.filtres.push(`${col}=${String(val)}`); return q },
        in: (col: string, vals: unknown[]) => { e.filtres.push(`${col} in ${vals.join(',')}`); return q },
        order: (col: string, o?: { ascending?: boolean }) => {
          e.filtres.push(`order ${col} ${o?.ascending === false ? 'desc' : 'asc'}`)
          return q
        },
        limit: (n: number) => { e.filtres.push(`limit ${n}`); return q },
        single: () => { unique = true; return q },
        // L'ENVOI : supabase-js ne part qu'ici, à l'`await`.
        then: <T>(resoudre: (r: { data: unknown; error: ErreurPostgrest | null }) => T, rejeter?: (x: unknown) => T) => {
          h.appels.push(e)
          const erreur = h.erreurs[`${e.genre}:${table}`] ?? null
          const data = erreur ? null
            : unique ? { id: 'deal-neuf' }
              : e.genre === 'select' ? (h.lectures[table] ?? [])
                : rendu ? (h.retours[`${e.genre}:${table}`] ?? lignesDesFiltres(e.filtres)) : null
          return Promise.resolve({ data, error: erreur }).then(resoudre, rejeter)
        },
      }
      return q
    },
    functions: { invoke: (...args: unknown[]) => h.invoke(...args) },
  } }
})
vi.mock('@/lib/intercom-milestones', () => ({ markIntercomMilestone: () => undefined }))
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_MATCH_SENT: 'first_match_sent' } }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({}) }))

const CTX = { agencyId: 'ag-1', userId: 'u-1' }
const ACHETEUR = { id: 'c-1', matchId: 'm-1', first: 'Julie', last: 'Morand', email: null, score: 90 }
const annonce = (id: string, ref: string) => ({
  kind: 'market' as const, id, key: `m:${id}`, ref, title: `Annonce ${id}`, price: 1_500_000, addr: 'Genève',
  rooms: 5, area: 124, type: 'apartment', gallery: [], sourceUrl: null, agency: { name: null, phone: null },
})
const ecritures = () => h.appels.filter((a) => a.genre !== 'select')
const lectures = () => h.appels.filter((a) => a.genre === 'select')
const seq = () => ecritures().map((e) => `${e.genre}:${e.table}`)
const ecrit = (cle: string) => ecritures().find((e) => `${e.genre}:${e.table}` === cle)!
/** Jours entre maintenant et une échéance ISO, arrondis : une relance « à +3 j » rend 3. */
const dansJours = (iso: unknown) => Math.round((Date.parse(String(iso)) - Date.now()) / 864e5)

beforeEach(() => {
  h.appels.length = 0; h.lectures = {}; h.erreurs = {}; h.retours = {}
  h.invoke = vi.fn(() => Promise.resolve({ error: null }))
})

describe('gestes du matching — le journal', () => {
  it('Plus tard reporte le match, pose le rappel ET écrit `match_reporte`', async () => {
    await execSnooze(CTX, ACHETEUR)
    expect(seq()).toEqual(['update:matches', 'insert:reminders', 'insert:activity_events'])
    expect(ecritures()[2]!.valeurs).toMatchObject({
      agency_id: 'ag-1', actor_id: 'u-1', actor_kind: 'user', action: 'match_reporte',
      entity_type: 'contact', entity_id: 'c-1', category: 'deal', metadata: { match_id: 'm-1', score: 90 },
    })
  })

  it('Écarter ignore le match ET écrit `match_ecarte`', async () => {
    await execDismiss(CTX, ACHETEUR)
    expect(seq()).toEqual(['update:matches', 'insert:activity_events'])
    expect(ecritures()[0]!.valeurs).toEqual({ status: 'ignored' })
    expect(ecritures()[1]!.valeurs).toMatchObject({ action: 'match_ecarte', entity_id: 'c-1', metadata: { match_id: 'm-1', score: 90 } })
  })
})

describe('rien ne sort vers l’acheteur', () => {
  it('Je l’ai proposé : sent_via agent, une relance à +3 j, aucun appel de fonction', async () => {
    await execProposer(CTX, { ...ACHETEUR, email: 'julie@example.ch' }, annonce('ml-1', 'MG-MK-1'))
    expect(ecrit('update:matches').valeurs).toMatchObject({ status: 'sent', sent_via: 'agent' })
    const relance = ecrit('insert:reminders').valeurs as { trigger_at: string }
    expect(relance).toMatchObject({ type: 'follow_up_sent_property', channel: 'task', trigger_days: 3, match_id: 'm-1' })
    expect(dansJours(relance.trigger_at)).toBe(3)
    expect(ecrit('insert:activity_events').valeurs).toMatchObject({
      action: 'match_propose',
      metadata: { match_ids: ['m-1'], deal_id: 'deal-neuf', bien_refs: ['MG-MK-1'], nombre: 1, score: 90 },
    })
    expect(h.invoke).not.toHaveBeenCalled()
  })

  it('J’ai proposé N biens : sent_via agent, une relance à +3 j, aucun appel de fonction', async () => {
    await execProposerSelection(CTX, { id: 'c-1', first: 'Julie', last: 'Morand' }, [
      { matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') },
    ])
    expect(ecrit('update:matches').valeurs).toMatchObject({ status: 'sent', sent_via: 'agent' })
    const relance = ecrit('insert:reminders').valeurs as { trigger_at: string }
    expect(relance).toMatchObject({ channel: 'task', trigger_days: 3 })
    expect(dansJours(relance.trigger_at)).toBe(3)
    expect(h.invoke).not.toHaveBeenCalled()
  })

  it('J’ai relancé : repousse la relance de 3 jours, n’appelle aucune fonction', async () => {
    h.lectures.reminders = [{ id: 'r-1' }]
    await execRelance(CTX, { ...ACHETEUR, email: 'julie@example.ch' }, annonce('ml-1', 'MG-MK-1'))
    const report = ecrit('update:reminders')
    expect(report.valeurs).toMatchObject({ status: 'pending' })
    expect(report.filtres).toEqual(['id=r-1'])
    expect(dansJours((report.valeurs as { trigger_at: string }).trigger_at)).toBe(3)
    expect(ecrit('insert:activity_events').valeurs).toMatchObject({ action: 'relance', metadata: { match_id: 'm-1', canal: 'agent' } })
    expect(h.invoke).not.toHaveBeenCalled()
  })

  it('J’ai relancé sans relance en cours : en pose une à +3 j', async () => {
    await execRelance(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))
    expect(seq()).toEqual(['update:matches', 'insert:activity_events', 'insert:reminders'])
    expect(ecrit('insert:reminders').valeurs).toMatchObject({ channel: 'task', trigger_days: 3, match_id: 'm-1' })
    expect(h.invoke).not.toHaveBeenCalled()
  })
})

describe('execProposerSelection — un geste, un suivi', () => {
  const JULIE = { id: 'c-1', first: 'Julie', last: 'Morand' }
  const DEUX = [
    { matchId: 'm-b', score: 91, bien: annonce('ml-2', 'MG-MK-2') },
    { matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') },
  ]

  it('marque les matchs proposés, crée le deal sur le meilleur bien, et n’écrit qu’UNE ligne de journal et UNE relance', async () => {
    await execProposerSelection(CTX, JULIE, DEUX)
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(ecritures()[1]!.valeurs).toMatchObject({ contact_buyer_id: 'c-1', stage: 'new_lead', market_listing_id: 'ml-1' })
    expect(ecritures()[2]!.valeurs).toMatchObject({
      action: 'match_propose', entity_id: 'c-1',
      metadata: { match_ids: ['m-b', 'm-a'], deal_id: 'deal-neuf', bien_refs: ['MG-MK-2', 'MG-MK-1'], nombre: 2 },
    })
    expect(ecritures()[3]!.valeurs).toMatchObject({ type: 'follow_up_sent_property', match_id: 'm-a', transaction_id: 'deal-neuf' })
  })

  it('ne réécrit que les matchs encore `suggested` DE CET ACHETEUR', async () => {
    await execProposerSelection(CTX, JULIE, DEUX)
    const marquage = ecritures()[0]!
    expect(marquage.valeurs).toMatchObject({ status: 'sent', sent_via: 'agent' })
    expect(marquage.filtres).toEqual(['id in m-b,m-a', 'contact_id=c-1', 'status=suggested'])
  })

  it('la relance ne porte aucun bien en mandat', async () => {
    await execProposerSelection(CTX, JULIE, DEUX)
    expect(ecritures()[3]!.valeurs).toMatchObject({ property_id: null })
  })

  it('cherche le deal actif de cet acheteur, dans cette agence, le plus récent', async () => {
    await execProposerSelection(CTX, JULIE, DEUX)
    expect(lectures().map((l) => [l.table, l.filtres])).toEqual([[
      'transactions',
      ['agency_id=ag-1', 'contact_buyer_id=c-1', 'status=active', 'order created_at desc', 'limit 1'],
    ]])
  })

  it('rattache le deal actif existant, sans le modifier pour une annonce du marché', async () => {
    h.lectures.transactions = [{ id: 'deal-actif', property_id: null }]
    await execProposerSelection(CTX, JULIE, [{ matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') }])
    expect(seq()).toEqual(['update:matches', 'insert:activity_events', 'insert:reminders'])
    expect(ecritures()[1]!.valeurs).toMatchObject({ metadata: { deal_id: 'deal-actif' } })
  })

  it('rien à proposer, rien d’écrit', async () => {
    await execProposerSelection(CTX, JULIE, [])
    expect(h.appels).toEqual([])
  })

  it('un marquage refusé fait lever, et RIEN d’autre ne part', async () => {
    h.erreurs['update:matches'] = { message: 'refus', code: '42501' }
    await expect(execProposerSelection(CTX, JULIE, DEUX)).rejects.toMatchObject({ code: '42501' })
    expect(h.appels.map((a) => `${a.genre}:${a.table}`)).toEqual(['update:matches'])
  })

  it('un deal qui ne se crée pas fait lever, sans journal ni relance', async () => {
    h.erreurs['insert:transactions'] = { message: 'contrainte', code: '23514' }
    await expect(execProposerSelection(CTX, JULIE, DEUX)).rejects.toMatchObject({ code: '23514' })
    expect(seq()).toEqual(['update:matches', 'insert:transactions'])
  })

  it('une relance refusée est signalée, sans faire croire le geste échoué', async () => {
    h.erreurs['insert:reminders'] = { message: 'refus', code: '42501' }
    const trace = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await expect(execProposerSelection(CTX, JULIE, DEUX)).resolves.toEqual({ dealId: 'deal-neuf', deja: false })
      expect(trace).toHaveBeenCalledWith('[atelier] reminder insert failed', expect.objectContaining({ code: '42501' }))
    } finally {
      trace.mockRestore()
    }
  })
})

describe('execProposer — le rattachement du deal, gardé à travers l’extraction', () => {
  it('rattache un bien en mandat au deal actif qui n’en porte pas', async () => {
    h.lectures.transactions = [{ id: 'deal-actif', property_id: null }]
    await execProposer(CTX, ACHETEUR, {
      kind: 'property', id: 'p1', key: 'p:p1', ref: 'MG-IN-P1', title: 'Champel', price: 1_450_000, addr: 'Genève',
      rooms: 4.5, area: 118, type: 'apartment', gallery: [], sourceUrl: null, agency: { name: null, phone: null },
    })
    expect(seq()).toEqual(['update:matches', 'update:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(ecritures()[1]!.valeurs).toEqual({ property_id: 'p1' })
    expect(ecritures()[1]!.filtres).toEqual(['id=deal-actif'])
    expect(ecritures()[2]!.valeurs).toMatchObject({ action: 'match_propose', metadata: { deal_id: 'deal-actif' } })
    expect(ecritures()[3]!.valeurs).toMatchObject({ property_id: 'p1', transaction_id: 'deal-actif' })
  })

  it('crée un new_lead sur l’annonce du marché quand aucun deal n’est actif', async () => {
    await expect(execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))).resolves.toEqual({ dealId: 'deal-neuf', deja: false })
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(ecritures()[1]!.valeurs).toMatchObject({ stage: 'new_lead', market_listing_id: 'ml-1' })
  })
})

describe('execProposer — seulement un match encore à proposer, de cet acheteur', () => {
  it('ne marque que le match `suggested` DE CET ACHETEUR', async () => {
    await execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))
    expect(ecrit('update:matches').filtres).toEqual(['id=m-1', 'contact_id=c-1', 'status=suggested'])
  })

  it('un match qui n’est plus `suggested` : aucune écriture après le marquage, et `deja` le dit', async () => {
    h.retours['update:matches'] = []
    await expect(execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))).resolves.toEqual({ dealId: null, deja: true })
    // Ni lecture du deal, ni deal, ni journal, ni relance : le marquage seul est parti.
    expect(h.appels.map((a) => `${a.genre}:${a.table}`)).toEqual(['update:matches'])
    expect(h.invoke).not.toHaveBeenCalled()
  })
})

describe('execProposerSelection — le suivi ne porte que ce qui a été marqué', () => {
  const JULIE = { id: 'c-1', first: 'Julie', last: 'Morand' }
  const DEUX = [
    { matchId: 'm-b', score: 91, bien: annonce('ml-2', 'MG-MK-2') },
    { matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') },
  ]

  it('une partie seulement réécrite : journal, deal et relance ne portent que celle-là', async () => {
    // m-a (le meilleur) a été proposé entre-temps : la base ne réécrit que m-b.
    h.retours['update:matches'] = [{ id: 'm-b' }]
    await expect(execProposerSelection(CTX, JULIE, DEUX)).resolves.toEqual({ dealId: 'deal-neuf', deja: false })
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(ecrit('insert:transactions').valeurs).toMatchObject({ market_listing_id: 'ml-2' })
    expect(ecrit('insert:activity_events').valeurs).toMatchObject({
      object_label: 'Julie Morand · 1 bien',
      metadata: { match_ids: ['m-b'], bien_refs: ['MG-MK-2'], nombre: 1 },
    })
    expect(ecrit('insert:reminders').valeurs).toMatchObject({
      match_id: 'm-b', message_template: 'Retour de Julie Morand sur 1 bien proposé',
    })
  })

  it('aucune réécrite : rien d’autre n’est écrit, et `deja` le dit', async () => {
    h.retours['update:matches'] = []
    await expect(execProposerSelection(CTX, JULIE, DEUX)).resolves.toEqual({ dealId: null, deja: true })
    expect(h.appels.map((a) => `${a.genre}:${a.table}`)).toEqual(['update:matches'])
  })
})

describe('la relance suit la réponse', () => {
  it('Intéressé / Pas intéressé clôt la relance de proposition du match', async () => {
    await execReact({ matchId: 'm-1' }, 'rejected')
    expect(seq()).toEqual(['update:matches', 'update:reminders'])
    expect(ecrit('update:matches').valeurs).toEqual({ status: 'rejected' })
    const cloture = ecrit('update:reminders')
    expect(cloture.valeurs).toMatchObject({ status: 'done' })
    expect(typeof (cloture.valeurs as { completed_at: unknown }).completed_at).toBe('string')
    expect(cloture.filtres).toEqual(['match_id=m-1', 'type=follow_up_sent_property', 'status in pending,triggered'])
  })

  it('une clôture refusée est signalée, sans faire croire la réponse perdue', async () => {
    h.erreurs['update:reminders'] = { message: 'refus', code: '42501' }
    const trace = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      await expect(execReact({ matchId: 'm-1' }, 'interested')).resolves.toBeUndefined()
      expect(trace).toHaveBeenCalledWith('[atelier] reminder close failed', expect.objectContaining({ code: '42501' }))
    } finally {
      trace.mockRestore()
    }
  })

  it('une réponse refusée fait lever, et la relance reste en place', async () => {
    h.erreurs['update:matches'] = { message: 'refus', code: '42501' }
    await expect(execReact({ matchId: 'm-1' }, 'interested')).rejects.toMatchObject({ code: '42501' })
    expect(h.appels.map((a) => `${a.genre}:${a.table}`)).toEqual(['update:matches'])
  })

  it('J’ai relancé ne reprend que la relance de PROPOSITION du match, la plus récente', async () => {
    h.lectures.reminders = [{ id: 'r-2' }]
    await execRelance(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))
    const lecture = lectures().find((l) => l.table === 'reminders')!
    expect(lecture.filtres).toEqual([
      'match_id=m-1', 'type=follow_up_sent_property', 'status in pending,triggered', 'order created_at desc', 'limit 1',
    ])
    expect(ecrit('update:reminders').filtres).toEqual(['id=r-2'])
  })
})
