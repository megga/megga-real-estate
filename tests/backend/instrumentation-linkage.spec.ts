// Backend test (live CI) — Instrumentation comportementale PR2 : liaison + contextuel
// (migration 20260617091000_instrumentation_linkage.sql).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : exécuté contre un Supabase local seedé.
//
// Couvre :
//   L1 back-link : créer un contact dont le numéro matche un message orphelin → lié + recency bumpée.
//   L2 garde unicité : 2 contacts même numéro normalisé dans l'agence → message NON lié (ambigu).
//   L3 exclusion AGENT : message d'un numéro agent (whatsapp_agent_links) → NON lié à un contact homonyme.
//   L4 exclusion JID de GROUPE : wa_from > 15 chiffres → NON lié (pas un numéro E.164).
//   L5 resolve_contact_by_phone : renvoie le contact unique ; ambigu → rien ; GRANT service_role only.
//   L6 create_lead_with_optional_deal + p_property_id : le deal créé porte property_id (pas de surcharge ambiguë).
//   L7 multi-tenant : un contact agence B ne lie pas un message orphelin agence A.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('instrumentation linkage PR2 — back-link + property_id (live + isolation)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient

  const waIds: string[] = []
  const contactIds: string[] = []
  const linkIds: string[] = []
  const txIds: string[] = []
  const propIds: string[] = []

  let waEmpty = 0
  const mkOrphanMsg = async (agencyId: string, waFrom: string, tag: string): Promise<string> => {
    const { data, error } = await svc.from('whatsapp_messages').insert({
      provider: 'openwa', provider_message_id: `lnk-${setup.stamp}-${tag}-${waEmpty++}`,
      direction: 'inbound', wa_from: waFrom, status: 'received', processing_status: 'done',
      agency_id: agencyId, wa_timestamp: new Date().toISOString(), body: 'hi',
      // contact_id volontairement omis → orphelin
    }).select('id').single()
    if (error) throw new Error(`wa ${tag}: ${error.message}`)
    waIds.push(data.id)
    return data.id
  }

  const mkContact = async (agencyId: string, phone: string | null, tag: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'LNK', last_name: `${tag}-${setup.stamp}`, type: 'buyer', phone,
    }).select('id').single()
    if (error) throw new Error(`contact ${tag}: ${error.message}`)
    contactIds.push(data.id)
    return data.id
  }

  const contactOfMsg = async (msgId: string): Promise<string | null> => {
    const { data } = await svc.from('whatsapp_messages').select('contact_id').eq('id', msgId).single()
    return (data?.contact_id as string | null) ?? null
  }
  const lastInteraction = async (cid: string): Promise<string | null> => {
    const { data } = await svc.from('contacts').select('last_interaction_at').eq('id', cid).single()
    return (data?.last_interaction_at as string | null) ?? null
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()
  })

  afterAll(async () => {
    if (!svc) return
    if (txIds.length) await svc.from('transactions').delete().in('id', txIds)
    if (waIds.length) await svc.from('whatsapp_messages').delete().in('id', waIds)
    if (linkIds.length) await svc.from('whatsapp_agent_links').delete().in('id', linkIds)
    if (propIds.length) await svc.from('properties').delete().in('id', propIds)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    await setup.cleanup()
  })

  it('L1 — back-link : créer un contact matchant un message orphelin → lié + recency bumpée', async () => {
    const ts = new Date('2026-06-10T10:00:00Z').toISOString()
    const { data, error } = await svc.from('whatsapp_messages').insert({
      provider: 'openwa', provider_message_id: `lnk-${setup.stamp}-L1`, direction: 'inbound',
      wa_from: '41791000001', status: 'received', processing_status: 'done',
      agency_id: setup.agencyAId, wa_timestamp: ts, body: 'coucou',
    }).select('id').single()
    if (error) throw new Error(`L1 msg: ${error.message}`)
    waIds.push(data.id)
    const c = await mkContact(setup.agencyAId, '+41 79 100 00 01', 'L1')  // last9 = 791000001
    expect(await contactOfMsg(data.id)).toBe(c)
    // recency bumpée depuis le message rétro-lié (le back-link est un UPDATE → bump explicite)
    expect(new Date((await lastInteraction(c))!).getTime()).toBe(new Date(ts).getTime())
  })

  it('L2 — garde unicité : 2 contacts même numéro → message NON lié (ambigu)', async () => {
    // 2 contacts AVANT le message → à l'insert du msg, aucun back-link (trigger sur contacts, pas messages)
    await mkContact(setup.agencyAId, '+41 79 100 00 02', 'L2a')
    await mkContact(setup.agencyAId, '+41 79 100 00 02', 'L2b')
    const m = await mkOrphanMsg(setup.agencyAId, '41791000002', 'L2')
    // re-toucher un des contacts (UPDATE phone) → garde count=2 → ne lie pas
    await svc.from('contacts').update({ phone: '+41 79 100 00 02' }).eq('id', contactIds[contactIds.length - 2])
    expect(await contactOfMsg(m)).toBeNull()
  })

  it('L3 — exclusion AGENT : message d\'un numéro agent → non lié à un contact homonyme', async () => {
    const { data: link, error: le } = await svc.from('whatsapp_agent_links').insert({
      profile_id: setup.agentAId, agency_id: setup.agencyAId, wa_number: '41791000003', verified: true,
    }).select('id').single()
    if (le) throw new Error(`L3 link: ${le.message}`)
    linkIds.push(link.id)
    const m = await mkOrphanMsg(setup.agencyAId, '41791000003', 'L3')  // numéro = agent
    await mkContact(setup.agencyAId, '+41 79 100 00 03', 'L3')          // homonyme
    expect(await contactOfMsg(m)).toBeNull()  // exclu car wa_from = numéro agent
  })

  it('L4 — exclusion JID de GROUPE : wa_from > 15 chiffres → non lié', async () => {
    const m = await mkOrphanMsg(setup.agencyAId, '120363237700000004', 'L4')  // 18 chiffres
    await mkContact(setup.agencyAId, '41700000004', 'L4')                       // last9 = 700000004 (coïncide)
    expect(await contactOfMsg(m)).toBeNull()  // exclu : 18 chiffres = JID de groupe
  })

  it('L5 — resolve_contact_by_phone : contact unique renvoyé ; ambigu → rien ; service_role only', async () => {
    const c = await mkContact(setup.agencyAId, '+41 79 100 00 05', 'L5')
    const { data: ok } = await svc.rpc('resolve_contact_by_phone', { p_phone: '41791000005' }).maybeSingle()
    expect((ok as { id: string } | null)?.id).toBe(c)
    // ambigu (2 contacts même numéro) → aucune résolution
    await mkContact(setup.agencyAId, '+41 79 100 00 06', 'L6a')
    await mkContact(setup.agencyAId, '+41 79 100 00 06', 'L6b')
    const { data: amb } = await svc.rpc('resolve_contact_by_phone', { p_phone: '41791000006' }).maybeSingle()
    expect(amb).toBeNull()
    // GRANT : un agent authentifié ne peut pas appeler la RPC
    const { error: denied } = await setup.clientA.rpc('resolve_contact_by_phone', { p_phone: '41791000005' })
    expect(denied).not.toBeNull()
  })

  it('L6 — create_lead_with_optional_deal + p_property_id : le deal porte property_id', async () => {
    const { data: prop, error: pe } = await svc.from('properties').insert({
      agency_id: setup.agencyAId, title: `LNK prop ${setup.stamp}`, type: 'apartment', status: 'draft', transaction_type: 'buy',
    }).select('id').single()
    if (pe) throw new Error(`L6 prop: ${pe.message}`)
    propIds.push(prop.id)
    const { data, error } = await setup.clientA.rpc('create_lead_with_optional_deal', {
      p_first_name: 'Lead', p_last_name: `WithProp-${setup.stamp}`,
      p_create_deal: true, p_deal_role: 'buyer', p_property_id: prop.id,
    })
    expect(error, 'pas de surcharge ambiguë (PGRST203)').toBeNull()
    const res = data as { contact_id: string; deal_id: string }
    contactIds.push(res.contact_id); txIds.push(res.deal_id)
    const { data: tx } = await svc.from('transactions').select('property_id').eq('id', res.deal_id).single()
    expect(tx?.property_id).toBe(prop.id)
  })

  it('L7 — multi-tenant : un contact agence B ne lie pas un message orphelin agence A', async () => {
    const m = await mkOrphanMsg(setup.agencyAId, '41791000007', 'L7')
    await mkContact(setup.agencyBId, '+41 79 100 00 07', 'L7')  // même numéro, AUTRE agence
    expect(await contactOfMsg(m)).toBeNull()
  })
})
