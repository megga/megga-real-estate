/**
 * Le lecteur du point du jour, éprouvé sans base.
 *
 * POURQUOI CE BANC. Deux appelants le partagent depuis le 15.09.2026 — le push de 07h30 et
 * l'outil `get_daily_brief` — et tous deux lisent en SERVICE ROLE : la RLS est contournée, le
 * filtre d'agence posé sur chaque requête est la seule garde de tenant. Un filtre oublié ici
 * ferait lire à un agent la journée d'une autre agence, sans qu'aucune erreur ne le signale.
 */
import { describe, it, expect } from 'vitest'
import { loadAgencyData } from './morning-brief-data'

const AGENCY = 'a0000000-0000-4000-8000-000000000001'
const NOW = new Date('2026-07-05T05:30:00Z')

type Appel = { table: string; op: string; args: unknown[] }

/**
 * Faux client : chaque maillon de la chaîne est ENREGISTRÉ, et la chaîne se résout comme
 * celle de supabase-js — `{ data, error }`, jamais une exception.
 */
function fauxClient(rows: Record<string, unknown[]>, erreurSur?: string) {
  const appels: Appel[] = []
  const from = (table: string) => {
    const self: Record<string, unknown> = {}
    for (const op of ['select', 'eq', 'in', 'gte', 'gt', 'lt', 'lte', 'not', 'or', 'order', 'limit']) {
      self[op] = (...args: unknown[]) => { appels.push({ table, op, args }); return self }
    }
    self.then = (resolve: (r: unknown) => void) => resolve(table === erreurSur
      ? { data: null, error: { message: 'canceling statement due to statement timeout' } }
      : { data: rows[table] ?? [], error: null })
    return self
  }
  return { client: { from } as never, appels }
}

describe('loadAgencyData — les cinq sources du point du jour', () => {
  it('⛔ chaque lecture porte le filtre d’agence (service role : c’est la seule garde de tenant)', async () => {
    const { client, appels } = fauxClient({})
    await loadAgencyData(client, AGENCY, '2026-07-04T22:00:00.000Z', '2026-07-05T22:00:00.000Z', NOW)
    for (const table of ['visits', 'calendar_events', 'reminders', 'crm_offers']) {
      expect(appels, table).toContainEqual({ table, op: 'eq', args: ['agency_id', AGENCY] })
    }
    // Leads vendeurs : pool partagé, mais JAMAIS celui d'une autre agence.
    const or = appels.find((a) => a.table === 'seller_leads' && a.op === 'or')
    expect(or?.args[0]).toBe(`assigned_agency_id.eq.${AGENCY},assigned_agency_id.is.null`)
  })

  it('met les lignes à plat : nom du contact, repli sur le nom du formulaire, bien, agent', async () => {
    const { client } = fauxClient({
      visits: [
        {
          scheduled_at: '2026-07-05T08:00:00Z', buyer_name: 'Formulaire', agent_id: 'p-1',
          contact: { first_name: 'Anne', last_name: 'Dubois' }, property: { title: 'Les Vergers', city: 'Meyrin' },
        },
        { scheduled_at: '2026-07-05T12:00:00Z', buyer_name: 'Paul Visiteur', agent_id: null, contact: null, property: null },
      ],
      calendar_events: [
        { type: 'notary', starts_at: '2026-07-05T12:00:00Z', all_day: false, status: null, recurrence: null, contact: { first_name: 'Anne', last_name: 'Dubois' } },
      ],
      reminders: [{ type: 'post_visit_feedback', trigger_at: '2026-07-05T07:00:00Z', contact: { first_name: 'Jean', last_name: null } }],
      crm_offers: [{ amount: 1450000, by_label: 'M. Keller', expires_at: '2026-07-06T10:00:00Z' }],
      seller_leads: [{ contact_name: 'Marie Curie', property_data: { city: 'Carouge' }, estimation_median: 1250000 }],
    })
    const d = await loadAgencyData(client, AGENCY, '2026-07-04T22:00:00.000Z', '2026-07-05T22:00:00.000Z', NOW)
    expect(d).toEqual({
      visits: [
        { scheduledAt: '2026-07-05T08:00:00Z', who: 'Anne Dubois', propertyTitle: 'Les Vergers', city: 'Meyrin', agentId: 'p-1' },
        { scheduledAt: '2026-07-05T12:00:00Z', who: 'Paul Visiteur', propertyTitle: null, city: null, agentId: null },
      ],
      events: [{ startsAt: '2026-07-05T12:00:00.000Z', allDay: false, type: 'notary', who: 'Anne Dubois' }],
      eventsAtLimit: false,
      reminders: [{ type: 'post_visit_feedback', who: 'Jean' }],
      offers: [{ amount: 1450000, byLabel: 'M. Keller', expiresAt: '2026-07-06T10:00:00Z' }],
      sellerLeads: [{ contactName: 'Marie Curie', city: 'Carouge', estimationMedian: 1250000 }],
    })
  })

  it('⛔ une seule lecture en échec rend null : une section vide en silence ferait croire la journée libre', async () => {
    for (const table of ['visits', 'calendar_events', 'reminders', 'crm_offers', 'seller_leads']) {
      const { client } = fauxClient({ visits: [{ scheduled_at: 'x', buyer_name: null, agent_id: null, contact: null, property: null }] }, table)
      expect(await loadAgencyData(client, AGENCY, 'a', 'b', NOW), table).toBeNull()
    }
  })
})
