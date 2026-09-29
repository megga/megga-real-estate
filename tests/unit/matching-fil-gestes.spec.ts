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
 * match qui n'est plus `suggested` se simule : la base n'en réécrit aucune ligne. Une insertion
 * suivie de `single()` rend la ligne créée : `visite-neuve` dans `visits`, `deal-neuf` ailleurs.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  execAjusterRecherche, execDismiss, execIgnorerCorrection, execPasEncore, execPlanifierVisite, execProposer,
  execProposerSelection, execReact, execRelance, execRepondre, execSnooze, execWake,
} from '@/lib/matchingGestes'
import { auditActionLabel } from '@/lib/auditActionLabel'

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
        neq: (col: string, val: unknown) => { e.filtres.push(`${col}<>${String(val)}`); return q },
        is: (col: string, val: unknown) => { e.filtres.push(`${col} is ${String(val)}`); return q },
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
            : unique ? { id: table === 'visits' ? 'visite-neuve' : 'deal-neuf' }
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

const CTX = { agencyId: 'ag-1', userId: 'u-1' }
const ACHETEUR = { id: 'c-1', matchId: 'm-1', first: 'Julie', last: 'Morand', email: null, score: 90 }
const annonce = (id: string, ref: string) => ({
  kind: 'market' as const, id, key: `m:${id}`, ref, title: `Annonce ${id}`, price: 1_500_000, addr: 'Genève',
  rooms: 5, area: 124, type: 'apartment', gallery: [], sourceUrl: null, agency: { name: null, phone: null },
})
const MANDAT = {
  kind: 'property' as const, id: 'p1', key: 'p:p1', ref: 'MG-IN-P1', title: 'Champel', price: 1_450_000, addr: 'Genève',
  rooms: 4.5, area: 118, type: 'apartment', gallery: [], sourceUrl: null, agency: { name: null, phone: null },
}
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

  it('Réactiver rend le match à proposer, annule son rappel ET écrit `match_reactive`', async () => {
    await execWake(CTX, ACHETEUR)
    expect(seq()).toEqual(['update:matches', 'update:reminders', 'insert:activity_events'])
    expect(ecritures()[0]!.valeurs).toEqual({ snoozed_until: null })
    expect(ecritures()[0]!.filtres).toEqual(['id=m-1'])
    expect(ecritures()[1]!.valeurs).toEqual({ status: 'cancelled' })
    expect(ecritures()[1]!.filtres).toEqual(['match_id=m-1', 'type=custom', 'status in pending,triggered'])
    // La ligne de « Plus tard » et d'« Écarter » : même acteur, même famille, le match et son score.
    expect(ecritures()[2]!.valeurs).toMatchObject({
      agency_id: 'ag-1', actor_id: 'u-1', actor_kind: 'user', action: 'match_reactive', entity_type: 'contact',
      entity_id: 'c-1', category: 'deal', object_label: 'Julie Morand', metadata: { match_id: 'm-1', score: 90 },
    })
  })

  it('une réactivation refusée fait lever, sans ligne au journal', async () => {
    h.erreurs['update:matches'] = { message: 'refus', code: '42501' }
    await expect(execWake(CTX, ACHETEUR)).rejects.toMatchObject({ code: '42501' })
    expect(seq()).toEqual(['update:matches'])
  })

  it('les trois lignes ont leur libellé au journal, dans les quatre langues', () => {
    for (const langue of ['fr', 'de', 'en', 'it']) {
      const brut = readFileSync(join(process.cwd(), `src/i18n/locales/${langue}/common.json`), 'utf8')
      const table = (JSON.parse(brut) as { audit: { action: Record<string, string> } }).audit.action
      for (const action of ['match_reporte', 'match_ecarte', 'match_reactive']) {
        expect(table[action] ?? '', `${langue} : ${action}`).toMatch(/\S/)
      }
    }
    // Ce que le journal, la cloche et la fiche mobile affichent : sans libellé, l'identifiant déridé (« Match reactive »).
    expect(auditActionLabel('match_reactive')).toBe('Match réactivé')
  })
})

describe('rien ne sort vers l’acheteur', () => {
  it('Je l’ai proposé : sent_via agent, une relance à +3 j, aucun appel de fonction', async () => {
    await execProposer(CTX, { ...ACHETEUR, email: 'julie@example.ch' }, annonce('ml-1', 'MG-MK-1'))
    expect(ecrit('update:matches').valeurs).toMatchObject({ status: 'sent', sent_via: 'agent' })
    const relance = ecrit('insert:reminders').valeurs as { trigger_at: string }
    expect(relance).toMatchObject({ type: 'follow_up_sent_property', channel: 'task', trigger_days: 3, match_id: 'm-1' })
    // Un seul bien : pas de `match_ids`, colonne que l'écran écrirait avant que la migration la crée.
    expect(relance).not.toHaveProperty('match_ids')
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

  it('rattache le deal ouvert existant, sans le modifier pour une annonce du marché', async () => {
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

  it('une relance refusée fait lever : le geste le dit, au lieu de passer pour réussi sans relance', async () => {
    // `PGRST204` : ce que PostgREST rendait à l'écran parti avant la migration qui crée `match_ids`.
    h.erreurs['insert:reminders'] = { message: 'colonne inconnue', code: 'PGRST204' }
    await expect(execProposerSelection(CTX, JULIE, DEUX)).rejects.toMatchObject({ code: 'PGRST204' })
    // Le reste est écrit : la relecture qui suit l'échec montre le bien proposé.
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:activity_events', 'insert:reminders'])
  })
})

describe('execProposer — le rattachement du deal, gardé à travers l’extraction', () => {
  it('rattache un bien en mandat au deal ouvert qui n’en porte pas', async () => {
    h.lectures.transactions = [{ id: 'deal-actif', property_id: null }]
    await execProposer(CTX, ACHETEUR, MANDAT)
    expect(seq()).toEqual(['update:matches', 'update:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(ecritures()[1]!.valeurs).toEqual({ property_id: 'p1' })
    // Seulement s'il n'en porte toujours aucun : un mandat posé entre la lecture et l'écriture (un collègue, le
    // copilote) n'est pas écrasé.
    expect(ecritures()[1]!.filtres).toEqual(['id=deal-actif', 'property_id is null'])
    expect(ecritures()[2]!.valeurs).toMatchObject({ action: 'match_propose', metadata: { deal_id: 'deal-actif' } })
    expect(ecritures()[3]!.valeurs).toMatchObject({ property_id: 'p1', transaction_id: 'deal-actif' })
  })

  it('un rattachement refusé fait lever, sans journal ni relance', async () => {
    h.lectures.transactions = [{ id: 'deal-actif', property_id: null }]
    h.erreurs['update:transactions'] = { message: 'refus', code: '42501' }
    await expect(execProposer(CTX, ACHETEUR, MANDAT)).rejects.toMatchObject({ code: '42501' })
    expect(seq()).toEqual(['update:matches', 'update:transactions'])
  })

  it('crée un new_lead sur l’annonce du marché quand aucun deal n’est ouvert', async () => {
    await expect(execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))).resolves.toEqual({ dealId: 'deal-neuf', deja: false })
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:activity_events', 'insert:reminders'])
    expect(ecritures()[1]!.valeurs).toMatchObject({ stage: 'new_lead', market_listing_id: 'ml-1' })
  })
})

describe('le deal d’un geste : l’OUVERT de l’acheteur, jamais un deal perdu (lot E1)', () => {
  // « Marquer perdu » (Pipeline) n'écrit que l'étape `lost`, le statut reste `active` : lu sur le statut seul, un geste
  // neuf se rattacherait au deal perdu. Ouvert (`dealOuvert`) : un statut `active` ou `on_hold`, et une autre étape.
  const LECTURE_DU_DEAL = ['agency_id=ag-1', 'contact_buyer_id=c-1', 'status in active,on_hold', 'stage<>lost', 'order created_at desc', 'limit 1']
  const VISITE = { debut: '2026-09-24T12:00:00.000Z', dureeMinutes: 45, lieu: null }
  /** Les trois gestes qui touchent un deal, tous par `rattacherDeal`. */
  const GESTES: [string, () => Promise<unknown>][] = [
    ['« Je l’ai proposé »', () => execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))],
    ['« J’ai proposé N biens »', () => execProposerSelection(CTX, { id: 'c-1', first: 'Julie', last: 'Morand' }, [
      { matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') },
    ])],
    ['« Planifier une visite »', () => execPlanifierVisite(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'), VISITE)],
  ]

  it.each(GESTES)('%s cherche le deal ouvert de cet acheteur, dans cette agence, le plus récent', async (_geste, geste) => {
    await geste()
    expect(lectures().filter((l) => l.table === 'transactions').map((l) => l.filtres)).toEqual([LECTURE_DU_DEAL])
  })

  it.each(GESTES)('%s : une lecture du deal refusée ou expirée fait lever, sans ouvrir un second deal', async (_geste, geste) => {
    // `57014` : la lecture annulée au bout du statement_timeout. Avalée, elle se lirait « aucun deal ouvert ».
    h.erreurs['select:transactions'] = { message: 'canceling statement due to statement timeout', code: '57014' }
    await expect(geste()).rejects.toMatchObject({ code: '57014' })
    expect(seq()).not.toContain('insert:transactions')
    // Ni rien de ce qui suit le deal (journal, relance, visite) : seul le match a bougé, et la visite le rend à
    // « intéressé ».
    expect(seq().filter((s) => s !== 'update:matches')).toEqual([])
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
      expect(trace).toHaveBeenCalledWith('[matching] reminder close failed', expect.objectContaining({ code: '42501' }))
    } finally {
      trace.mockRestore()
    }
  })

  it('une réponse refusée fait lever, et la relance reste en place', async () => {
    h.erreurs['update:matches'] = { message: 'refus', code: '42501' }
    await expect(execReact({ matchId: 'm-1' }, 'interested')).rejects.toMatchObject({ code: '42501' })
    expect(h.appels.map((a) => `${a.genre}:${a.table}`)).toEqual(['update:matches'])
  })

  it('J’ai relancé : une lecture ou un report refusés font lever, sans relance en double', async () => {
    h.erreurs['select:reminders'] = { message: 'refus', code: '42501' }
    await expect(execRelance(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))).rejects.toMatchObject({ code: '42501' })
    expect(ecritures().some((e) => e.table === 'reminders')).toBe(false)
    h.erreurs = { 'update:reminders': { message: 'refus', code: '42501' } }
    h.lectures.reminders = [{ id: 'r-1' }]
    await expect(execRelance(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))).rejects.toMatchObject({ code: '42501' })
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

describe('la relance couvre TOUS les biens d’une proposition (lot B)', () => {
  it('une sélection : `match_ids` porte chaque bien marqué, `match_id` le meilleur', async () => {
    await execProposerSelection(CTX, { id: 'c-1', first: 'Julie', last: 'Morand' }, [
      { matchId: 'm-b', score: 91, bien: annonce('ml-2', 'MG-MK-2') },
      { matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') },
    ])
    expect(ecrit('insert:reminders').valeurs).toMatchObject({ match_id: 'm-a', match_ids: ['m-b', 'm-a'] })
  })

  it('un bien : `match_id` seul, sans `match_ids` — le fil et l’écran mobile', async () => {
    await execProposer(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))
    expect(ecrit('insert:reminders').valeurs).toMatchObject({ match_id: 'm-1' })
    expect(ecrit('insert:reminders').valeurs).not.toHaveProperty('match_ids')
    h.appels.length = 0
    await execProposerSelection(CTX, { id: 'c-1', first: 'Julie', last: 'Morand' }, [{ matchId: 'm-a', score: 97, bien: annonce('ml-1', 'MG-MK-1') }])
    expect(ecrit('insert:reminders').valeurs).not.toHaveProperty('match_ids')
  })
})

describe('execRepondre — la réponse consignée par l’agent (lot B)', () => {
  it('Intéressé : depuis `sent` seulement, efface un motif d’avant, ne touche aucune relance', async () => {
    await expect(execRepondre(ACHETEUR, { genre: 'interested' })).resolves.toEqual({ deja: false })
    expect(seq()).toEqual(['update:matches'])
    const e = ecrit('update:matches')
    expect(e.valeurs).toEqual({ status: 'interested', reaction_motif: null, reaction_note: null, apprentissage_at: null })
    expect(e.filtres).toEqual(['id=m-1', 'contact_id=c-1', 'status in sent'])
    expect(h.invoke).not.toHaveBeenCalled()
  })

  it('Pas intéressé : le motif et la note sans espaces, depuis `sent` ou `interested`', async () => {
    await execRepondre(ACHETEUR, { genre: 'rejected', motif: 'prix', note: '  Trop cher  ' })
    const e = ecrit('update:matches')
    expect(e.valeurs).toEqual({ status: 'rejected', reaction_motif: 'prix', reaction_note: 'Trop cher', apprentissage_at: null })
    expect(e.filtres).toEqual(['id=m-1', 'contact_id=c-1', 'status in sent,interested'])
  })

  it('une note vide ne s’écrit pas ; rien de réécrit : `deja`', async () => {
    h.retours['update:matches'] = []
    await expect(execRepondre(ACHETEUR, { genre: 'rejected', motif: 'autre', note: '   ' })).resolves.toEqual({ deja: true })
    expect(ecrit('update:matches').valeurs).toMatchObject({ reaction_note: null })
  })

  it('un refus de la base fait lever', async () => {
    h.erreurs['update:matches'] = { message: 'refus', code: '42501' }
    await expect(execRepondre(ACHETEUR, { genre: 'interested' })).rejects.toMatchObject({ code: '42501' })
  })
})

describe('execPasEncore — la relance de la proposition repoussée de 3 jours', () => {
  // Le bien attend encore sa réponse : `sent`, de cet acheteur.
  beforeEach(() => { h.lectures.matches = [{ id: 'm-1' }] })

  it('reprend la relance qui COUVRE ce bien, même portée par un autre ; rien sur le match', async () => {
    h.lectures.reminders = [
      { id: 'r-autre', match_id: 'm-9', match_ids: ['m-9'] },
      { id: 'r-sel', match_id: 'm-best', match_ids: ['m-best', 'm-1'] },
    ]
    await expect(execPasEncore(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))).resolves.toEqual({ deja: false })
    expect(lectures().find((l) => l.table === 'matches')!.filtres).toEqual(['id=m-1', 'contact_id=c-1', 'status=sent'])
    // Une relance repoussée depuis « Aujourd'hui » (`snoozed`) est encore la sienne.
    expect(lectures().find((l) => l.table === 'reminders')!.filtres).toEqual([
      'contact_id=c-1', 'type=follow_up_sent_property', 'status in pending,triggered,snoozed', 'order created_at desc',
    ])
    const report = ecrit('update:reminders')
    expect(report.filtres).toEqual(['id=r-sel'])
    expect(report.valeurs).toMatchObject({ status: 'pending' })
    expect(dansJours((report.valeurs as { trigger_at: string }).trigger_at)).toBe(3)
    expect(ecrit('insert:activity_events').valeurs).toMatchObject({ action: 'match_pas_encore', metadata: { match_id: 'm-1', relance_id: 'r-sel' } })
    expect(ecritures().some((e) => e.table === 'matches')).toBe(false)
  })

  it('une relance d’avant le lot B (sans `match_ids`) se reconnaît à son `match_id`', async () => {
    h.lectures.reminders = [{ id: 'r-vieille', match_id: 'm-1', match_ids: null }]
    await execPasEncore(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))
    expect(ecrit('update:reminders').filtres).toEqual(['id=r-vieille'])
  })

  it('aucune relance en cours : en pose une à +3 j pour ce bien, au nom élidé nulle part', async () => {
    await execPasEncore(CTX, { ...ACHETEUR, first: 'Emma', last: 'Schneider' }, annonce('ml-1', 'MG-MK-1'))
    const relance = ecrit('insert:reminders').valeurs
    expect(relance).toMatchObject({
      match_id: 'm-1', channel: 'task', trigger_days: 3, message_template: 'Retour : Emma Schneider sur MG-MK-1',
    })
    expect(relance).not.toHaveProperty('match_ids')
  })

  it('un bien déjà répondu (un collègue, un autre onglet) : rien d’écrit, `deja`', async () => {
    h.lectures.matches = []
    h.lectures.reminders = [{ id: 'r-sel', match_id: 'm-1', match_ids: null }]
    await expect(execPasEncore(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))).resolves.toEqual({ deja: true })
    expect(ecritures()).toEqual([])
    expect(lectures().map((l) => l.table)).toEqual(['matches'])
  })

  it('une relance qui ne se pose pas fait lever : « Pas encore » ne se dit pas fait', async () => {
    h.erreurs['insert:reminders'] = { message: 'refus', code: '42501' }
    await expect(execPasEncore(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'))).rejects.toMatchObject({ code: '42501' })
    expect(ecritures().some((e) => e.table === 'activity_events')).toBe(false)
  })
})

describe('execPlanifierVisite — la visite créée en interne, aucune invitation (lot B)', () => {
  const VISITE = { debut: '2026-09-24T12:00:00.000Z', dureeMinutes: 45, lieu: 'Avenue de Champel 12, Genève' }

  it('un bien en mandat : match → visit_planned, visite `planned` rattachée au deal, deal avancé, journal', async () => {
    // La visite écrite est rendue : la fiche d'un mandat l'ouvre (« Ouvrir la visite »).
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, VISITE)).resolves.toEqual({ deja: false, visiteId: 'visite-neuve' })
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:visits', 'insert:activity_events', 'update:transactions'])
    expect(ecritures()[0]!.valeurs).toEqual({ status: 'visit_planned' })
    expect(ecritures()[0]!.filtres).toEqual(['id=m-1', 'contact_id=c-1', 'status=interested'])
    expect(ecrit('insert:visits').valeurs).toMatchObject({
      agency_id: 'ag-1', agent_id: 'u-1', property_id: 'p1', contact_id: 'c-1', transaction_id: 'deal-neuf',
      scheduled_at: VISITE.debut, duration_minutes: 45, status: 'planned', visit_type: 'sur_place', buyer_name: 'Julie Morand',
      reminder_sent: true,
    })
    expect(ecrit('update:transactions').valeurs).toEqual({ stage: 'visit_planned' })
    expect(ecrit('update:transactions').filtres).toEqual(['id=deal-neuf', 'stage in new_lead,to_qualify,active_search,to_recontact'])
    expect(ecrit('insert:activity_events').valeurs).toMatchObject({
      action: 'visit_scheduled', category: 'contact', metadata: { match_id: 'm-1', deal_id: 'deal-neuf', scheduled_at: VISITE.debut },
    })
    expect(h.invoke).not.toHaveBeenCalled()
  })

  it('une annonce du marché : un événement « visite » de l’agenda, jamais une ligne `visits`', async () => {
    await expect(execPlanifierVisite(CTX, ACHETEUR, annonce('ml-1', 'MG-MK-1'), VISITE)).resolves.toEqual({ deja: false, visiteId: null })
    expect(seq()).toEqual(['update:matches', 'insert:transactions', 'insert:calendar_events', 'update:transactions'])
    expect(ecrit('insert:calendar_events').valeurs).toMatchObject({
      agency_id: 'ag-1', type: 'visite', title: 'Visite · Annonce ml-1', starts_at: VISITE.debut,
      ends_at: '2026-09-24T12:45:00.000Z', contact_id: 'c-1', location: VISITE.lieu,
    })
  })

  it('un match qui n’est plus « intéressé » : rien d’autre, `deja`', async () => {
    h.retours['update:matches'] = []
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, VISITE)).resolves.toEqual({ deja: true, visiteId: null })
    expect(h.appels.map((a) => `${a.genre}:${a.table}`)).toEqual(['update:matches'])
  })

  it('lot E1 : ce que la fiche d’un mandat y ajoute entre dans la visite (visio, bon, rendez-vous), jamais le rappel la veille', async () => {
    const details = {
      visit_type: 'video', video_link: 'https://meet.example/visite', bon: { docId: 'doc-1', signedAt: null },
      qualification: { rendezVous: 'Code 4521' },
    }
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, { ...VISITE, details })).resolves.toEqual({ deja: false, visiteId: 'visite-neuve' })
    expect(ecrit('insert:visits').valeurs).toMatchObject({ ...details, transaction_id: 'deal-neuf', reminder_sent: true })
    expect(h.invoke).not.toHaveBeenCalled()
  })

  it('lot E1 : le deal que la fiche connaît sur ce bien porte la visite ; le deal le plus récent de l’acheteur n’est pas cherché', async () => {
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, { ...VISITE, deal: 'd-bien' }))
      .resolves.toEqual({ deja: false, visiteId: 'visite-neuve' })
    expect(seq()).toEqual(['update:matches', 'insert:visits', 'insert:activity_events', 'update:transactions'])
    expect(lectures().some((l) => l.table === 'transactions')).toBe(false)
    expect(ecrit('insert:visits').valeurs).toMatchObject({ transaction_id: 'd-bien', reminder_sent: true })
    expect(ecrit('update:transactions').filtres).toEqual(['id=d-bien', 'stage in new_lead,to_qualify,active_search,to_recontact'])
    expect(ecrit('insert:activity_events').valeurs).toMatchObject({ metadata: { deal_id: 'd-bien' } })
  })

  it('une visite refusée : le match redevient « intéressé », et le geste lève', async () => {
    h.erreurs['insert:visits'] = { message: 'refus', code: '42501' }
    await expect(execPlanifierVisite(CTX, ACHETEUR, MANDAT, VISITE)).rejects.toMatchObject({ code: '42501' })
    const retour = ecritures().filter((e) => e.table === 'matches')[1]!
    expect(retour.valeurs).toEqual({ status: 'interested' })
    expect(retour.filtres).toEqual(['id=m-1', 'status=visit_planned'])
  })
})

describe('Apprendre — les deux gestes d’une correction (lot B)', () => {
  const C = { contactId: 'c-1', nom: 'Julie Morand', rechercheId: 'cs-1', motif: 'prix', refusIds: ['r-1', 'r-2'] }
  const BUDGET = { cle: 'budget_max' as const, apres: 1_550_000 }

  it('Ignorer : les refus sont pris en compte, et le journal le dit — lisible, famille `contact`', async () => {
    await execIgnorerCorrection(CTX, C)
    const e = ecrit('update:matches')
    expect(typeof (e.valeurs as { apprentissage_at: unknown }).apprentissage_at).toBe('string')
    expect(e.filtres).toEqual(['id in r-1,r-2', 'client_search_id=cs-1', 'status=rejected'])
    expect(ecrit('insert:activity_events').valeurs).toMatchObject({
      action: 'correction_ignoree', entity_id: 'c-1', category: 'contact', object_label: 'Julie Morand',
      metadata: { client_search_id: 'cs-1', motif: 'prix', match_ids: ['r-1', 'r-2'] },
    })
  })

  it('Ajuster : UN appel au moteur (mode rescore-search), la SEULE clé corrigée, aucune écriture du client', async () => {
    h.invoke = vi.fn(() => Promise.resolve({ data: { reevalues: 5, ecartes: 1 }, error: null }))
    await expect(execAjusterRecherche(C, BUDGET)).resolves.toEqual({ reevalues: 5, ecartes: 1 })
    expect(h.invoke).toHaveBeenCalledWith('matching-engine', {
      body: {
        mode: 'rescore-search', client_search_id: 'cs-1', correction: { cle: 'budget_max', valeur: 1_550_000 },
        motif: 'prix', refus_ids: ['r-1', 'r-2'],
      },
    })
    expect(h.appels).toEqual([])
  })

  it('Ajuster en échec fait lever : la correction reste à l’écran', async () => {
    h.invoke = vi.fn(() => Promise.resolve({ data: null, error: { message: 'internal_error' } }))
    await expect(execAjusterRecherche(C, BUDGET)).rejects.toMatchObject({ message: 'internal_error' })
  })
})
