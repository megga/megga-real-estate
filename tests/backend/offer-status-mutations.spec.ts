// Regression — crm_offers.status mutations (Accept / Reject / Withdraw).
// Wired in DdOfferCard (PR #447) — was a financial blind spot before:
// offers could be created but never acted on through the UI.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — crm_offers status transitions', () => {
  let setup: TwoAgenciesSetup
  let dealAId: string
  let offerAId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    // Seed a deal in agency A (needs RLS to allow agent A to see + act).
    const { data: deal, error: dealErr } = await svc
      .from('transactions')
      .insert({ agency_id: setup.agencyAId, stage: 'offer' })
      .select('id')
      .single()
    if (dealErr) throw new Error(`deal: ${dealErr.message}`)
    dealAId = deal.id

    // Seed a pending offer linked to that deal.
    const { data: offer, error: offerErr } = await svc
      .from('crm_offers')
      .insert({
        agency_id: setup.agencyAId,
        deal_id: dealAId,
        kind: 'offer',
        from_party: 'buyer',
        by_label: 'Test buyer',
        amount: 1_200_000,
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        status: 'pending',
      })
      .select('id')
      .single()
    if (offerErr) throw new Error(`offer: ${offerErr.message}`)
    offerAId = offer.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (offerAId) await svc.from('crm_offers').delete().eq('id', offerAId).then(() => {}, () => {})
    if (dealAId) await svc.from('transactions').delete().eq('id', dealAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('agent A accepts an offer (status=accepted, responded_at set)', async () => {
    const { error } = await setup.clientA
      .from('crm_offers')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('id', offerAId)
    expect(error).toBeNull()

    const svc = serviceRoleClient()
    const { data: row } = await svc
      .from('crm_offers')
      .select('status, responded_at')
      .eq('id', offerAId)
      .single()
    expect(row?.status).toBe('accepted')
    expect(row?.responded_at).toBeTruthy()
  })

  it('agent B CANNOT update agency A offer (RLS isolation)', async () => {
    // Reset to pending via service_role.
    const svc = serviceRoleClient()
    await svc.from('crm_offers').update({ status: 'pending', responded_at: null }).eq('id', offerAId)

    const { data: returned } = await setup.clientB
      .from('crm_offers')
      .update({ status: 'rejected' })
      .eq('id', offerAId)
      .select('id')
    expect(returned, `agent B leaked update to agency A offer`).toEqual([])

    const { data: row } = await svc
      .from('crm_offers')
      .select('status')
      .eq('id', offerAId)
      .single()
    expect(row?.status).toBe('pending')
  })
})
