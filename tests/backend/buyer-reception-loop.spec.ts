// Backend test (live CI) — Boucle de réception acheteur
// (migration 20260707120000_buyer_reception_links.sql).
//
// record_buyer_reaction = la réaction de l'acheteur (portail) met à jour le match
// EN DIRECT sous attribution 'reception', puis les triggers existants
// (set_match_response_at + log_match_reaction) stampent response_at + audit.
//
// Couvre :
//   L1  interested → match 'interested' + response_at + lien 'reacted'/reacted_at.
//   L2  rejected + motif → match 'rejected' + reaction_motif consigné + response_at.
//   L3  audit : event 'match_reaction' actor_kind='system', metadata.via='reception'.
//   L4  garde : un match HORS de la sélection du lien → 'match_not_in_selection'.
//   L5  garde : lien expiré → 'link_expired' (aucune mutation).
//   L6  interested ne consigne PAS de motif (motif réservé à l'écartement).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('buyer reception loop — record_buyer_reaction (live)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient
  const contactIds: string[] = []
  const matchIds: string[] = []
  const linkIds: string[] = []
  const propIds: string[] = []

  const mkContact = async (tag: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'RECEP', last_name: `${tag}-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contact ${tag}: ${error.message}`)
    contactIds.push(data.id); return data.id
  }
  const mkProperty = async (tag: string): Promise<string> => {
    const { data, error } = await svc.from('properties').insert({
      agency_id: setup.agencyAId, title: `RECEP ${tag} ${setup.stamp}`, type: 'apartment', status: 'draft', transaction_type: 'buy',
    }).select('id').single()
    if (error) throw new Error(`property ${tag}: ${error.message}`)
    propIds.push(data.id); return data.id
  }
  const mkSentMatch = async (contactId: string, propertyId: string): Promise<string> => {
    const { data, error } = await svc.from('matches').insert({
      agency_id: setup.agencyAId, contact_id: contactId, property_id: propertyId,
      score: 80, status: 'sent', source: 'internal', sent_via: 'reception', sent_at: new Date().toISOString(),
    }).select('id').single()
    if (error) throw new Error(`match: ${error.message}`)
    matchIds.push(data.id); return data.id
  }
  const mkLink = async (contactId: string, mIds: string[], daysToExpiry = 30): Promise<string> => {
    const { data, error } = await svc.from('buyer_reception_links').insert({
      token: `test-${setup.stamp}-${Math.round(performance.now())}-${mIds[0]}`,
      agency_id: setup.agencyAId, contact_id: contactId, agent_id: setup.agentAId,
      match_ids: mIds, status: 'viewed',
      expires_at: new Date(Date.now() + daysToExpiry * 86400_000).toISOString(),
    }).select('id').single()
    if (error) throw new Error(`link: ${error.message}`)
    linkIds.push(data.id); return data.id
  }
  const getMatch = async (id: string) => {
    const { data } = await svc.from('matches').select('status, response_at, reaction_motif').eq('id', id).single()
    return data as { status: string; response_at: string | null; reaction_motif: string | null }
  }
  const getLink = async (id: string) => {
    const { data } = await svc.from('buyer_reception_links').select('status, reacted_at').eq('id', id).single()
    return data as { status: string; reacted_at: string | null }
  }
  const reactionEvents = async (matchId: string): Promise<Record<string, unknown>[]> => {
    const { data } = await svc.from('activity_events')
      .select('actor_kind, actor_id, metadata').eq('action', 'match_reaction').order('created_at', { ascending: false })
    return ((data ?? []) as Record<string, unknown>[]).filter(e => (e.metadata as Record<string, unknown> | null)?.match_id === matchId)
  }

  beforeAll(async () => { setup = await setupTwoAgencies(); svc = serviceRoleClient() })
  afterAll(async () => {
    if (!svc) return
    if (linkIds.length) await svc.from('buyer_reception_links').delete().in('id', linkIds)
    if (matchIds.length) await svc.from('matches').delete().in('id', matchIds)
    if (propIds.length) await svc.from('properties').delete().in('id', propIds)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    await setup.cleanup()
  })

  it('L1 — interested → match + response_at + lien reacted', async () => {
    const c = await mkContact('Interested'); const p = await mkProperty('P1'); const m = await mkSentMatch(c, p)
    const link = await mkLink(c, [m])
    const { error } = await svc.rpc('record_buyer_reaction', { p_link_id: link, p_match_id: m, p_reaction: 'interested' })
    expect(error).toBeNull()
    const after = await getMatch(m)
    expect(after.status).toBe('interested')
    expect(after.response_at).not.toBeNull()
    const lk = await getLink(link)
    expect(lk.status).toBe('reacted')
    expect(lk.reacted_at).not.toBeNull()
  })

  it('L2 — rejected + motif → match rejeté + motif consigné', async () => {
    const c = await mkContact('Rejected'); const p = await mkProperty('P2'); const m = await mkSentMatch(c, p)
    const link = await mkLink(c, [m])
    const { error } = await svc.rpc('record_buyer_reaction', { p_link_id: link, p_match_id: m, p_reaction: 'rejected', p_motif: 'Trop cher' })
    expect(error).toBeNull()
    const after = await getMatch(m)
    expect(after.status).toBe('rejected')
    expect(after.reaction_motif).toBe('Trop cher')
    expect(after.response_at).not.toBeNull()
  })

  it('L3 — audit match_reaction : system + via=reception', async () => {
    const c = await mkContact('Audit'); const p = await mkProperty('P3'); const m = await mkSentMatch(c, p)
    const link = await mkLink(c, [m])
    await svc.rpc('record_buyer_reaction', { p_link_id: link, p_match_id: m, p_reaction: 'interested' })
    const evs = await reactionEvents(m)
    expect(evs.length).toBe(1)
    expect(evs[0].actor_kind).toBe('system')
    expect((evs[0].metadata as Record<string, unknown>).via).toBe('reception')
  })

  it('L4 — garde : match hors de la sélection du lien', async () => {
    const c = await mkContact('OutOfSel'); const p1 = await mkProperty('P4a'); const p2 = await mkProperty('P4b')
    const inSel = await mkSentMatch(c, p1); const outSel = await mkSentMatch(c, p2)
    const link = await mkLink(c, [inSel]) // outSel PAS dans la sélection
    const { error } = await svc.rpc('record_buyer_reaction', { p_link_id: link, p_match_id: outSel, p_reaction: 'interested' })
    expect(error).not.toBeNull()
    expect(String(error?.message)).toContain('match_not_in_selection')
    expect((await getMatch(outSel)).status).toBe('sent') // inchangé
  })

  it('L5 — garde : lien expiré → aucune mutation', async () => {
    const c = await mkContact('Expired'); const p = await mkProperty('P5'); const m = await mkSentMatch(c, p)
    const link = await mkLink(c, [m], -1) // expiré hier
    const { error } = await svc.rpc('record_buyer_reaction', { p_link_id: link, p_match_id: m, p_reaction: 'interested' })
    expect(error).not.toBeNull()
    expect(String(error?.message)).toContain('link_expired')
    expect((await getMatch(m)).status).toBe('sent')
  })

  it('L6 — interested ne consigne pas de motif', async () => {
    const c = await mkContact('NoMotif'); const p = await mkProperty('P6'); const m = await mkSentMatch(c, p)
    const link = await mkLink(c, [m])
    await svc.rpc('record_buyer_reaction', { p_link_id: link, p_match_id: m, p_reaction: 'interested', p_motif: 'ignored' })
    expect((await getMatch(m)).reaction_motif).toBeNull()
  })
})
