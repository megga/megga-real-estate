// Admin ops — RPC de santé (migration 20260705172000)
//
//  get_admin_syndication_health / get_admin_whatsapp_health / get_admin_ai_costs :
//  gardées is_super_admin() OR is_service_role().
//
//  Test 1 — Gate : un agent simple est rejeté sur les 3 RPC.
//  Test 2 — Shape : un super_admin (domaine de test CI) reçoit les clés jsonb
//    attendues (syndication : by_status/recent_errors/agencies/last_push_at ;
//    whatsapp : compteurs + top_errors + cron_locks) et un tableau pour ai_costs.
//  Test 3 — Comptage : une ligne property_syndications en erreur seedée via
//    service_role apparaît dans by_status/recent_errors.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RPC santé ops admin — gardées super_admin/service', () => {
  let setup: TwoAgenciesSetup
  let propertyId: string | null = null

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { error: promoteErr } = await service
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentAId)
    if (promoteErr) throw new Error(`promote: ${promoteErr.message}`)

    // Seed : un bien + une syndication en erreur (agence A).
    // Un seed qui échoue est un BUG, pas une variation de schéma : on throw. Avec un
    // simple console.warn, le test de comptage était sauté et passait à vide
    // (transaction_type 'sell' violait la CHECK depuis toujours).
    // transaction_type : la CHECK properties_transaction_type_check n'admet que
    // 'buy' | 'rent' — 'sell' n'existe pas côté properties.
    const { data: prop, error: propErr } = await service
      .from('properties')
      .insert({
        agency_id: setup.agencyAId,
        title: `Test syndication ${setup.stamp}`,
        status: 'active',
        transaction_type: 'buy',
      })
      .select('id')
      .single()
    if (propErr) throw new Error(`seed property: ${propErr.message}`)
    propertyId = prop.id

    const { error: synErr } = await service.from('property_syndications').insert({
      property_id: prop.id,
      agency_id: setup.agencyAId,
      portal: 'immobilier_ch',
      status: 'error',
      error: `test-error-${setup.stamp}`,
    })
    if (synErr) throw new Error(`seed syndication: ${synErr.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (propertyId) {
      await service.from('property_syndications').delete().eq('property_id', propertyId).then(() => {}, () => {})
      await service.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    }
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('un agent simple est rejeté sur les 3 RPC', async () => {
    const [syn, wa, costs] = await Promise.all([
      setup.clientB.rpc('get_admin_syndication_health'),
      setup.clientB.rpc('get_admin_whatsapp_health'),
      setup.clientB.rpc('get_admin_ai_costs', { p_months: 3 }),
    ])
    expect(syn.error, 'syndication: refus attendu').not.toBeNull()
    expect(wa.error, 'whatsapp: refus attendu').not.toBeNull()
    expect(costs.error, 'ai costs: refus attendu').not.toBeNull()
  })

  it('un super_admin reçoit les shapes attendues', async () => {
    const { data: syn, error: synErr } = await setup.clientA.rpc('get_admin_syndication_health')
    if (synErr) throw new Error(`syndication: ${synErr.message}`)
    const synObj = syn as Record<string, unknown>
    expect(Array.isArray(synObj.by_status)).toBe(true)
    expect(Array.isArray(synObj.recent_errors)).toBe(true)
    expect(Array.isArray(synObj.agencies)).toBe(true)
    expect('last_push_at' in synObj).toBe(true)

    const { data: wa, error: waErr } = await setup.clientA.rpc('get_admin_whatsapp_health')
    if (waErr) throw new Error(`whatsapp: ${waErr.message}`)
    const waObj = wa as Record<string, unknown>
    for (const key of ['sent_24h', 'failed_24h', 'sent_7d', 'failed_7d', 'unmapped_inbound_7d']) {
      expect(typeof waObj[key], `clé ${key}`).toBe('number')
    }
    expect(Array.isArray(waObj.top_errors)).toBe(true)
    expect(Array.isArray(waObj.cron_locks)).toBe(true)

    const { data: costs, error: costsErr } = await setup.clientA.rpc('get_admin_ai_costs', { p_months: 3 })
    if (costsErr) throw new Error(`ai costs: ${costsErr.message}`)
    expect(Array.isArray(costs)).toBe(true)
  })

  it('une syndication en erreur seedée est visible dans la santé', async () => {
    const { data, error } = await setup.clientA.rpc('get_admin_syndication_health')
    if (error) throw new Error(error.message)
    const obj = data as {
      by_status: Array<{ portal: string; status: string; count: number }>
      recent_errors: Array<{ error: string | null }>
    }
    const errorBucket = obj.by_status.find((r) => r.status === 'error' && r.portal === 'immobilier_ch')
    expect(errorBucket?.count ?? 0).toBeGreaterThanOrEqual(1)
    expect(obj.recent_errors.some((e) => e.error === `test-error-${setup.stamp}`)).toBe(true)
  })
})
