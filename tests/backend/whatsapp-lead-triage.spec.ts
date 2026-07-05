// Triage des numéros WhatsApp inconnus → leads. Helpers purs (toujours) + RPC atomique
// ensure_wa_inbound_lead exercée LIVE contre un projet de TEST (setupTwoAgencies). skipIf
// saute proprement sans les clés SUPABASE_TEST_*.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { isTriageEligible, triageLeadName, pickTriageAgency } from '../../supabase/functions/_shared/whatsapp-lead-triage.ts'

describe('whatsapp-lead-triage — helpers purs', () => {
  it('isTriageEligible : numéro réel + body texte non vide', () => {
    expect(isTriageEligible('41791234567', 'bonjour')).toBe(true)
    expect(isTriageEligible('41791234567', '   ')).toBe(false)          // body vide (trim)
    expect(isTriageEligible('41791234567', null)).toBe(false)           // média seul / vide
    expect(isTriageEligible('12345', 'hi')).toBe(false)                 // < 6 chiffres
    expect(isTriageEligible('1234567890123456', 'hi')).toBe(false)      // > 15 = JID de groupe
  })
  it('triageLeadName : Prospect + 4 derniers chiffres', () => {
    expect(triageLeadName('41791234567')).toEqual({ firstName: 'Prospect', lastName: '4567' })
    expect(triageLeadName('')).toEqual({ firstName: 'Prospect', lastName: 'WhatsApp' })
  })
  it('pickTriageAgency : garde cross-tenant (≥2 agences → jamais deviner, fallback IGNORÉ)', () => {
    const A = 'agency-a', B = 'agency-b', F = 'agency-fallback'
    expect(pickTriageAgency([A], F)).toBe(A)          // 1 agence → elle
    expect(pickTriageAgency([A], null)).toBe(A)       // 1 agence, sans fallback → elle
    expect(pickTriageAgency([A, B], F)).toBeNull()    // ≥2 → null MÊME avec fallback (clé)
    expect(pickTriageAgency([A, B], null)).toBeNull() // ≥2 → null
    expect(pickTriageAgency([], F)).toBe(F)           // 0 agence → béquille bootstrap
    expect(pickTriageAgency([], null)).toBeNull()     // 0 agence, sans fallback → null
    expect(pickTriageAgency([], '  ')).toBeNull()     // fallback blanc → null
  })
})

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('whatsapp-lead-triage — RPC ensure_wa_inbound_lead (live)', () => {
  let setup: TwoAgenciesSetup
  let service: ReturnType<typeof serviceRoleClient>
  const createdContactIds: string[] = []

  const call = async (agencyId: string | null, phone: string) => {
    const { data } = await service
      .rpc('ensure_wa_inbound_lead', {
        p_agency_id: agencyId, p_phone: phone, p_first_name: 'Prospect', p_last_name: phone.slice(-4),
      })
      .maybeSingle()
    const row = data as { contact_id: string | null; created: boolean } | null
    if (row?.contact_id) createdContactIds.push(row.contact_id)
    return row
  }

  beforeAll(async () => { setup = await setupTwoAgencies(); service = serviceRoleClient() })
  afterAll(async () => {
    for (const id of createdContactIds) await service.from('contacts').delete().eq('id', id)
    await setup.cleanup()
  })

  it('crée un lead minimal source=whatsapp, tags à_compléter/lead_whatsapp_auto, type lead', async () => {
    const r = await call(setup.agencyAId, '41791110001')
    expect(r?.created).toBe(true)
    const { data: c } = await service.from('contacts')
      .select('source, tags, type, score').eq('id', r!.contact_id!).single()
    const row = c as { source: string; tags: string[]; type: string; score: string }
    expect(row.source).toBe('whatsapp')
    expect(row.tags).toContain('à_compléter')
    expect(row.tags).toContain('lead_whatsapp_auto')
    expect(row.type).toBe('lead')
    expect(row.score).toBe('cold')
  })

  it('idempotence + normalisation : formats variés du même numéro → un seul contact', async () => {
    const r1 = await call(setup.agencyAId, '41791110002')
    const r2 = await call(setup.agencyAId, '0791110002')          // format national
    const r3 = await call(setup.agencyAId, '0041 79 111 00 02')   // avec préfixe + espaces
    expect(r1?.created).toBe(true)
    expect(r2?.created).toBe(false)
    expect(r3?.created).toBe(false)
    expect(r2?.contact_id).toBe(r1?.contact_id)
    expect(r3?.contact_id).toBe(r1?.contact_id)
  })

  it('idempotence sous concurrence : 2 appels parallèles → un seul contact, un seul created', async () => {
    const [a, b] = await Promise.all([call(setup.agencyAId, '41791110003'), call(setup.agencyAId, '41791110003')])
    expect(a?.contact_id).toBe(b?.contact_id)
    expect([a?.created, b?.created].filter(Boolean).length).toBe(1)
    const { count } = await service.from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', setup.agencyAId).eq('phone', '41791110003')
    expect(count).toBe(1)
  })

  it('ambiguïté : ≥2 contacts même numéro dans l\'agence → pas de nouveau lead (contact_id null)', async () => {
    const mk = async () => {
      const { data } = await service.from('contacts')
        .insert({ agency_id: setup.agencyAId, first_name: 'Dup', last_name: 'X', phone: '41791110004', source: 'manual' })
        .select('id').single()
      createdContactIds.push((data as { id: string }).id)
    }
    await mk(); await mk()
    const r = await call(setup.agencyAId, '41791110004')
    expect(r?.contact_id).toBeNull()
    expect(r?.created).toBe(false)
  })

  it('agency_id null → pas de lead', async () => {
    const r = await call(null, '41791110005')
    expect(r?.contact_id).toBeNull()
  })

  it('aval branché : un message inbound porteur de contact_id entre dans whatsapp_stale_insight_contacts', async () => {
    const lead = await call(setup.agencyAId, '41791110006')
    const pmid = `pmid-triage-${Date.now()}`
    const { data: m } = await service.from('whatsapp_messages').insert({
      provider: 'openwa', provider_message_id: pmid, wa_from: '41791110006', direction: 'inbound',
      contact_id: lead!.contact_id, agency_id: setup.agencyAId, body: 'bonjour je cherche un 3 pièces', status: 'received',
    }).select('id').single()
    const { data: stale } = await service.rpc('whatsapp_stale_insight_contacts', { p_limit: 200 })
    const ids = ((stale ?? []) as Array<{ contact_id: string }>).map((s) => s.contact_id)
    expect(ids).toContain(lead!.contact_id)
    await service.from('whatsapp_messages').delete().eq('id', (m as { id: string }).id)
  })
})
