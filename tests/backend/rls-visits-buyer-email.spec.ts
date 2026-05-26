// RLS — visits readable by buyer_email match.
//
// Scenario: a marketplace buyer (authenticated via Supabase Auth, no profile,
// no agency) must be able to SELECT visits where buyer_email matches their
// JWT email. They must NOT see visits booked by other emails.
//
// This was a real silent bug: VisitsRow.tsx queried a non-existent table
// `property_visits` and degraded to []. The fix points it at `visits` and
// relies on the policy `visits_select_by_buyer_email` added in
// 20260526140000_visits_select_by_buyer_email.sql.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient } from './helpers/supabase'

const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PASSWORD = 'Test-Buyer-Password-123!'
const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS — visits readable by buyer_email', () => {
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const buyerEmail = `buyer-${stamp}@megga-test.local`
  const otherEmail = `other-buyer-${stamp}@megga-test.local`

  let agencyId: string
  let propertyId: string
  let agentUserId: string
  let buyerUserId: string
  let visitMineId: string
  let visitOtherId: string
  let buyerClient: SupabaseClient

  beforeAll(async () => {
    const service = serviceRoleClient()

    // 1) Agency + agent profile (needed because visits.agency_id is NOT NULL)
    const { data: agency, error: agencyErr } = await service
      .from('agencies')
      .insert({ name: `Visit RLS Agency ${stamp}`, slug: `visit-rls-${stamp}` })
      .select('id')
      .single()
    if (agencyErr) throw new Error(`agency: ${agencyErr.message}`)
    agencyId = agency.id

    const agentEmail = `agent-${stamp}@megga-test.local`
    const { data: agentUser, error: agentErr } = await service.auth.admin.createUser({
      email: agentEmail,
      password: PASSWORD,
      email_confirm: true,
    })
    if (agentErr) throw new Error(`agentUser: ${agentErr.message}`)
    agentUserId = agentUser.user!.id

    await service.from('profiles').upsert(
      { id: agentUserId, email: agentEmail, full_name: 'Visit Agent', role: 'agent', agency_id: agencyId },
      { onConflict: 'id' }
    )

    // 2) Property
    const { data: prop, error: propErr } = await service
      .from('properties')
      .insert({ agency_id: agencyId, title: `Visit Test Property ${stamp}` })
      .select('id')
      .single()
    if (propErr) throw new Error(`property: ${propErr.message}`)
    propertyId = prop.id

    // 3) Contact needed because visits.contact_id is NOT NULL
    const { data: contact, error: contactErr } = await service
      .from('contacts')
      .insert({
        agency_id: agencyId,
        first_name: 'Visit',
        last_name: `Buyer ${stamp}`,
        email: buyerEmail,
        entity_type: 'pp', // pp = personne physique, pm = personne morale
        type: 'buyer',
        source: 'manual',
      })
      .select('id')
      .single()
    if (contactErr) throw new Error(`contact: ${contactErr.message}`)

    // 4) Two visits — one for our buyer, one for someone else
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: visits, error: visitErr } = await service
      .from('visits')
      .insert([
        {
          agency_id: agencyId,
          property_id: propertyId,
          contact_id: contact.id,
          scheduled_at: futureDate,
          status: 'planned',
          buyer_email: buyerEmail,
          buyer_message: 'Test message from buyer',
          agent_id: agentUserId,
        },
        {
          agency_id: agencyId,
          property_id: propertyId,
          contact_id: contact.id,
          scheduled_at: futureDate,
          status: 'planned',
          buyer_email: otherEmail,
          agent_id: agentUserId,
        },
      ])
      .select('id, buyer_email')
    if (visitErr) throw new Error(`visits: ${visitErr.message}`)
    visitMineId = visits.find(v => v.buyer_email === buyerEmail)!.id
    visitOtherId = visits.find(v => v.buyer_email === otherEmail)!.id

    // 5) Authenticated buyer (no profile, no agency)
    const { data: buyerUser, error: buyerErr } = await service.auth.admin.createUser({
      email: buyerEmail,
      password: PASSWORD,
      email_confirm: true,
    })
    if (buyerErr) throw new Error(`buyerUser: ${buyerErr.message}`)
    buyerUserId = buyerUser.user!.id

    buyerClient = createClient(URL, ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signinErr } = await buyerClient.auth.signInWithPassword({
      email: buyerEmail,
      password: PASSWORD,
    })
    if (signinErr) throw new Error(`buyer signin: ${signinErr.message}`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (visitMineId)   await svc.from('visits').delete().eq('id', visitMineId).then(() => {}, () => {})
    if (visitOtherId)  await svc.from('visits').delete().eq('id', visitOtherId).then(() => {}, () => {})
    if (propertyId)    await svc.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    if (buyerUserId)   await svc.auth.admin.deleteUser(buyerUserId).catch(() => {})
    if (agentUserId)   await svc.auth.admin.deleteUser(agentUserId).catch(() => {})
    if (agencyId)      await svc.from('agencies').delete().eq('id', agencyId).then(() => {}, () => {})
  })

  it('buyer sees their own visit', async () => {
    const { data, error } = await buyerClient
      .from('visits')
      .select('id, buyer_email')
      .eq('id', visitMineId)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0]?.buyer_email).toBe(buyerEmail)
  })

  it('buyer CANNOT see a visit booked under a different email', async () => {
    const { data, error } = await buyerClient
      .from('visits')
      .select('id')
      .eq('id', visitOtherId)
    expect(error).toBeNull()
    expect(data, `buyer leaked other email's visit`).toEqual([])
  })

  it('buyer list query returns ONLY their own visits', async () => {
    const { data, error } = await buyerClient
      .from('visits')
      .select('id, buyer_email')
      .limit(50)
    expect(error).toBeNull()
    const others = (data ?? []).filter(v => v.buyer_email !== buyerEmail)
    expect(others, `buyer leaked ${others.length} cross-email visits`).toEqual([])
  })

  it('buyer can join properties + profiles via FKs', async () => {
    // The component query uses joins — verify they work for the buyer role
    // (the joined tables have their own RLS).
    const { data, error } = await buyerClient
      .from('visits')
      .select(`
        id,
        scheduled_at,
        status,
        buyer_message,
        properties:property_id ( title, address ),
        agent:profiles!agent_id ( full_name )
      `)
      .eq('id', visitMineId)
      .single()
    expect(error).toBeNull()
    expect(data?.buyer_message).toBe('Test message from buyer')
    // properties and profiles RLS may or may not expose the joined data —
    // both `null` and a populated object are valid here; the visit row
    // itself just needs to be visible (which is what we're really testing).
  })
})
