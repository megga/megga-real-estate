// Admin end-users — get_admin_end_user_stats / get_admin_seller_portals /
// get_admin_kyc_magic_links (migration 20260713140000)
//
//  Test 1 — Gate : un agent simple est rejeté sur les 3 RPC (42501).
//  Test 2 — Stats : le super_admin reçoit la forme jsonb attendue.
//  Test 3 — SÉCURITÉ (non-régression) : un portail seedé apparaît SANS colonne
//    `token`. Règle d'or capability-URL (#844/#845).
//  Test 4 — SÉCURITÉ (non-régression nLPD) : un magic-link seedé apparaît SANS
//    `token`, `client_ip` ni `client_user_agent` (minimisation).
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RPC end-users admin — gardées super_admin, zéro secret', () => {
  let setup: TwoAgenciesSetup
  let contactId: string | null = null
  let propertyId: string | null = null

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { error: promoteErr } = await service.from('profiles').update({ role: 'super_admin' }).eq('id', setup.agentAId)
    if (promoteErr) throw new Error(`promote: ${promoteErr.message}`)

    // Contact + bien (agence A) — supports des portails/liens.
    // Ces seeds sont des PRÉCONDITIONS des tests anti-fuite : sans eux, les RPC
    // renvoient un tableau vide et les boucles d'assertion ne s'exécutent jamais
    // (le test passerait au vert même si le token fuyait). Toute erreur throw donc.
    // transaction_type : la CHECK properties_transaction_type_check n'admet que
    // 'buy' | 'rent' — 'sell' n'existe pas côté properties.
    const { data: c, error: cErr } = await service.from('contacts')
      .insert({ agency_id: setup.agencyAId, first_name: 'End', last_name: `User ${setup.stamp}`, email: `enduser-${setup.stamp}@megga-test.local` })
      .select('id').single()
    if (cErr) throw new Error(`seed contact: ${cErr.message}`)
    contactId = c.id
    const { data: p, error: pErr } = await service.from('properties')
      .insert({ agency_id: setup.agencyAId, title: `EU seed ${setup.stamp}`, status: 'active', transaction_type: 'buy' })
      .select('id').single()
    if (pErr) throw new Error(`seed property: ${pErr.message}`)
    propertyId = p.id

    // Portail vendeur (token requis — on vérifie qu'il NE ressort PAS).
    const { error: portErr } = await service.from('seller_portals').insert({
      token: `tok-portal-${setup.stamp}`, agency_id: setup.agencyAId,
      contact_id: contactId, property_id: propertyId, agent_id: setup.agentAId, status: 'active',
    })
    if (portErr) throw new Error(`seed seller_portal: ${portErr.message}`)

    // Magic link KYC (token + client_ip requis — on vérifie qu'ils NE ressortent PAS).
    const { data: kc, error: kcErr } = await service.from('kyc_cases')
      .insert({ agency_id: setup.agencyAId, contact_id: contactId, type: 'seller_pp' })
      .select('id').single()
    if (kcErr) throw new Error(`seed kyc_case: ${kcErr.message}`)
    const { error: mlErr } = await service.from('kyc_magic_links').insert({
      token: `tok-ml-${setup.stamp}`, agency_id: setup.agencyAId, kyc_case_id: kc.id,
      contact_id: contactId, expires_at: new Date(Date.now() + 7 * 864e5).toISOString(),
      client_ip: '203.0.113.7', client_user_agent: 'seed-agent',
    })
    if (mlErr) throw new Error(`seed kyc_magic_link: ${mlErr.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    await service.from('kyc_magic_links').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
    await service.from('kyc_cases').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
    await service.from('seller_portals').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
    if (propertyId) await service.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    if (contactId) await service.from('contacts').delete().eq('id', contactId).then(() => {}, () => {})
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('un agent simple est rejeté sur les 3 RPC', async () => {
    const [stats, portals, links] = await Promise.all([
      setup.clientB.rpc('get_admin_end_user_stats'),
      setup.clientB.rpc('get_admin_seller_portals', {}),
      setup.clientB.rpc('get_admin_kyc_magic_links', {}),
    ])
    expect(stats.error, 'stats: refus attendu').not.toBeNull()
    expect(portals.error, 'portals: refus attendu').not.toBeNull()
    expect(links.error, 'links: refus attendu').not.toBeNull()
  })

  it('les stats end-users ont la forme attendue', async () => {
    const { data, error } = await setup.clientA.rpc('get_admin_end_user_stats')
    if (error) throw new Error(error.message)
    const obj = data as Record<string, Record<string, unknown>>
    expect(obj.portals).toBeTruthy()
    expect(obj.magic_links).toBeTruthy()
    expect(obj.leads).toBeTruthy()
    expect(obj.contact_messages).toBeTruthy()
    expect(typeof obj.portals.active).toBe('number')
    expect(typeof obj.magic_links.conversion_pct).toBe('number')
  })

  it('get_admin_seller_portals ne renvoie JAMAIS le token', async () => {
    const { data, error } = await setup.clientA.rpc('get_admin_seller_portals', { p_limit: 100 })
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<Record<string, unknown>>
    // Non-vide obligatoire : sur un tableau vide la boucle anti-fuite ci-dessous
    // ne s'exécuterait pas et le test passerait sans rien prouver.
    expect(rows.length, 'jeu non vide — sinon l\'anti-fuite ne teste rien').toBeGreaterThanOrEqual(1)
    const mine = rows.find(r => r.property_title === `EU seed ${setup.stamp}`)
    expect(mine, 'portail seedé présent').toBeTruthy()
    for (const r of rows) {
      expect(Object.keys(r)).not.toContain('token')
    }
  })

  it('get_admin_kyc_magic_links ne renvoie ni token ni PII IP', async () => {
    const { data, error } = await setup.clientA.rpc('get_admin_kyc_magic_links', { p_limit: 100 })
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as Array<Record<string, unknown>>
    // Non-vide obligatoire (cf. get_admin_seller_portals) : sinon l'anti-fuite tourne à vide.
    expect(rows.length, 'jeu non vide — sinon l\'anti-fuite ne teste rien').toBeGreaterThanOrEqual(1)
    for (const r of rows) {
      const keys = Object.keys(r)
      expect(keys).not.toContain('token')
      expect(keys).not.toContain('client_ip')
      expect(keys).not.toContain('client_user_agent')
    }
  })
})
