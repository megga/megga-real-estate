// Backend test (live CI) — Producteur de statut de RÉACTION de match
// (migration 20260617120000_match_reaction_response_at.sql).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : exécuté contre un Supabase local seedé
// (jamais la prod) et DOIT réellement passer. Signaux déterministes.
//
// Couvre :
//   R1  'interested' → matches.response_at stampé + status posé.
//   R2  'rejected'   → response_at stampé.
//   R3  'visit_planned' → response_at stampé.
//   R4  'ignored' (écart agent, PAS une réaction) → response_at reste NULL.
//   R5  immuabilité : 1re réaction gagne (interested puis visit_planned →
//       response_at inchangé).
//   R6  audit : event 'match_reaction' (category=deal, entity=contact,
//       metadata old/new/match_id/contact_id), scoped agence ; via service-role
//       (sans uid/GUC) → actor_kind='system', actor_id NULL ; idempotent (un
//       2e UPDATE vers le MÊME statut n'émet pas de nouvel event).
//   R7  attribution 'user' : un agent authentifié qui marque → actor_kind='user',
//       actor_id = l'agent.
//   R8  boucle no_response (automation-engine) : un match 'sent'+response_at NULL
//       est éligible ; après réaction il sort de la requête (.eq('status','sent')
//       .is('response_at', null)).
//   R9  multi-tenant : un agent d'une AUTRE agence ne peut pas marquer le match
//       (RLS) → response_at reste NULL.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('match reaction producer — response_at + audit (live + isolation)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient

  const contactIds: string[] = []
  const matchIds: string[] = []
  let propA = '' // bien interne (agence A) partagé par les matches
  let propB = '' // bien interne (agence B) pour le test multi-tenant

  const mkContact = async (agencyId: string, tag: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'REACT', last_name: `${tag}-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contact ${tag}: ${error.message}`)
    contactIds.push(data.id)
    return data.id
  }

  const mkProperty = async (agencyId: string, tag: string): Promise<string> => {
    // 'draft' : évite on_property_active (net.http_post) ; un match n'exige pas
    // que le bien soit publié, seulement une FK property_id valide.
    const { data, error } = await svc.from('properties').insert({
      agency_id: agencyId, title: `REACT ${tag} ${setup.stamp}`,
      type: 'apartment', status: 'draft', transaction_type: 'buy',
    }).select('id').single()
    if (error) throw new Error(`property ${tag}: ${error.message}`)
    return data.id
  }

  // Unicité uq_matches_contact_property(contact_id, property_id) → on varie le
  // contact (un par match) et on réutilise le bien partagé.
  const mkSentMatch = async (
    agencyId: string, contactId: string, propertyId: string, sentDaysAgo = 1,
  ): Promise<string> => {
    const sentAt = new Date(Date.now() - sentDaysAgo * 86400_000).toISOString()
    const { data, error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, property_id: propertyId,
      score: 80, status: 'sent', source: 'internal', sent_via: 'email', sent_at: sentAt,
    }).select('id').single()
    if (error) throw new Error(`match: ${error.message}`)
    matchIds.push(data.id)
    return data.id
  }

  const getMatch = async (id: string): Promise<{ status: string; response_at: string | null }> => {
    const { data } = await svc.from('matches').select('status, response_at').eq('id', id).single()
    return data as { status: string; response_at: string | null }
  }

  const reactionEvents = async (matchId: string): Promise<Record<string, unknown>[]> => {
    const { data } = await svc.from('activity_events')
      .select('action, actor_kind, actor_id, entity_type, entity_id, category, severity, metadata, agency_id, created_at')
      .eq('action', 'match_reaction')
      .order('created_at', { ascending: false })
    return ((data ?? []) as Record<string, unknown>[])
      .filter(e => (e.metadata as Record<string, unknown> | null)?.match_id === matchId)
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()
    propA = await mkProperty(setup.agencyAId, 'PropA')
    propB = await mkProperty(setup.agencyBId, 'PropB')
  })

  afterAll(async () => {
    if (!svc) return
    // activity_events est append-only (trigger d'immuabilité) → jamais supprimé.
    if (matchIds.length) await svc.from('matches').delete().in('id', matchIds)
    const allProps = [propA, propB].filter(Boolean)
    if (allProps.length) await svc.from('properties').delete().in('id', allProps)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    await setup.cleanup()
  })

  it('R1 — interested → response_at stampé + status posé', async () => {
    const c = await mkContact(setup.agencyAId, 'Interested')
    const m = await mkSentMatch(setup.agencyAId, c, propA)
    expect((await getMatch(m)).response_at).toBeNull()
    await svc.from('matches').update({ status: 'interested' }).eq('id', m)
    const after = await getMatch(m)
    expect(after.status).toBe('interested')
    expect(after.response_at, 'response_at posé à la réaction').not.toBeNull()
  })

  it('R2 — rejected → response_at stampé', async () => {
    const c = await mkContact(setup.agencyAId, 'Rejected')
    const m = await mkSentMatch(setup.agencyAId, c, propA)
    await svc.from('matches').update({ status: 'rejected' }).eq('id', m)
    const after = await getMatch(m)
    expect(after.status).toBe('rejected')
    expect(after.response_at).not.toBeNull()
  })

  it('R3 — visit_planned → response_at stampé', async () => {
    const c = await mkContact(setup.agencyAId, 'Visit')
    const m = await mkSentMatch(setup.agencyAId, c, propA)
    await svc.from('matches').update({ status: 'visit_planned' }).eq('id', m)
    const after = await getMatch(m)
    expect(after.status).toBe('visit_planned')
    expect(after.response_at).not.toBeNull()
  })

  it('R4 — ignored (écart agent) → response_at reste NULL', async () => {
    const c = await mkContact(setup.agencyAId, 'Ignored')
    const m = await mkSentMatch(setup.agencyAId, c, propA)
    await svc.from('matches').update({ status: 'ignored' }).eq('id', m)
    const after = await getMatch(m)
    expect(after.status).toBe('ignored')
    expect(after.response_at, 'ignored ne pose PAS response_at').toBeNull()
  })

  it('R5 — immuabilité : la première réaction gagne', async () => {
    const c = await mkContact(setup.agencyAId, 'Immutable')
    const m = await mkSentMatch(setup.agencyAId, c, propA)
    await svc.from('matches').update({ status: 'interested' }).eq('id', m)
    const first = (await getMatch(m)).response_at
    expect(first).not.toBeNull()
    await svc.from('matches').update({ status: 'visit_planned' }).eq('id', m)
    const second = await getMatch(m)
    expect(second.status).toBe('visit_planned')
    expect(second.response_at, 'response_at figé sur la 1re réaction').toBe(first)
  })

  it('R6 — audit match_reaction (system via service-role) + idempotence', async () => {
    const c = await mkContact(setup.agencyAId, 'Audit')
    const m = await mkSentMatch(setup.agencyAId, c, propA)
    await svc.from('matches').update({ status: 'interested' }).eq('id', m)
    const evs = await reactionEvents(m)
    expect(evs.length).toBe(1)
    const ev = evs[0]
    expect(ev.category).toBe('deal')
    expect(ev.entity_type).toBe('contact')
    expect(ev.entity_id).toBe(c)
    expect(ev.agency_id).toBe(setup.agencyAId)
    expect(ev.actor_kind).toBe('system') // service-role : pas d'uid, pas de GUC
    expect(ev.actor_id).toBeNull()
    const meta = ev.metadata as Record<string, unknown>
    expect(meta.match_id).toBe(m)
    expect(meta.old_status).toBe('sent')
    expect(meta.new_status).toBe('interested')
    expect(meta.contact_id).toBe(c)
    // Idempotence : ré-écrire le MÊME statut n'émet pas de nouvel event (IS DISTINCT).
    await svc.from('matches').update({ status: 'interested' }).eq('id', m)
    expect((await reactionEvents(m)).length).toBe(1)
  })

  it('R7 — attribution user : un agent authentifié qui marque → actor=agent', async () => {
    const c = await mkContact(setup.agencyAId, 'UserAttr')
    const m = await mkSentMatch(setup.agencyAId, c, propA)
    const { error } = await setup.clientA.from('matches').update({ status: 'interested' }).eq('id', m)
    expect(error, 'agent A devrait pouvoir marquer un match de son agence').toBeNull()
    expect((await getMatch(m)).response_at).not.toBeNull()
    const evs = await reactionEvents(m)
    expect(evs.length).toBe(1)
    expect(evs[0].actor_kind).toBe('user')
    expect(evs[0].actor_id).toBe(setup.agentAId)
  })

  it('R8 — boucle no_response : sent+null éligible, sort après réaction', async () => {
    const c = await mkContact(setup.agencyAId, 'NoResponse')
    const m = await mkSentMatch(setup.agencyAId, c, propA, 4) // envoyé il y a 4 j
    const threeDaysAgo = new Date(Date.now() - 3 * 86400_000).toISOString()
    const eligible = async (): Promise<boolean> => {
      const { data } = await svc.from('matches')
        .select('id').eq('id', m)
        .eq('status', 'sent').is('response_at', null).lt('sent_at', threeDaysAgo)
      return (data ?? []).length === 1
    }
    expect(await eligible(), 'match envoyé sans réponse = éligible relance J+3').toBe(true)
    await svc.from('matches').update({ status: 'interested' }).eq('id', m)
    expect(await eligible(), 'après réaction le match sort de la file no_response').toBe(false)
  })

  it('R9 — multi-tenant : un agent d\'une autre agence ne peut pas marquer', async () => {
    const c = await mkContact(setup.agencyBId, 'MtBuyer')
    const m = await mkSentMatch(setup.agencyBId, c, propB)
    // clientA (agence A) tente de marquer un match de l'agence B → RLS bloque (0 ligne).
    await setup.clientA.from('matches').update({ status: 'rejected' }).eq('id', m)
    const after = await getMatch(m)
    expect(after.status, 'le match de B ne doit pas changer').toBe('sent')
    expect(after.response_at).toBeNull()
  })
})
