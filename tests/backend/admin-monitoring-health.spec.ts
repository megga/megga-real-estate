// Admin monitoring health — get_admin_monitoring_health v2 (migration 20260712123000)
//
//  La v1 (baseline / 20260518_004) accordait EXECUTE à authenticated SANS
//  guard interne : n'importe quel agent connecté lisait les métriques
//  plateforme. La v2 adopte le pattern P3 : is_super_admin() OR
//  is_service_role(), et expose db_limit_mb / storage_limit_mb depuis
//  app_config.admin_platform_limits (plus de plafond codé en dur côté client).
//
//  Test 1 — Gate : un agent simple est rejeté (régression de sécurité fermée).
//  Test 2 — Shape + limites : un super_admin reçoit les 8 colonnes, dont
//    db_limit_mb / storage_limit_mb > 0.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('get_admin_monitoring_health — gardée super_admin/service, limites servies', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()
    const { error: promoteErr } = await service
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentAId)
    if (promoteErr) throw new Error(`promote: ${promoteErr.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('un agent simple est rejeté (guard v2)', async () => {
    const { error } = await setup.clientB.rpc('get_admin_monitoring_health')
    expect(error, 'refus attendu pour un agent non super-admin').not.toBeNull()
  })

  it('un super_admin reçoit le shape + les limites DB/storage > 0', async () => {
    const { data, error } = await setup.clientA.rpc('get_admin_monitoring_health')
    if (error) throw new Error(`monitoring health: ${error.message}`)
    const row = (data as Array<Record<string, unknown>> | null)?.[0]
    expect(row, 'une ligne attendue').toBeTruthy()
    for (const key of [
      'errors_last_24h', 'emails_sent_today', 'api_requests_today',
      'db_size_mb', 'storage_used_mb', 'db_limit_mb', 'storage_limit_mb',
    ]) {
      expect(row!, `colonne ${key} présente`).toHaveProperty(key)
    }
    // Les limites viennent d'app_config.admin_platform_limits (défauts 8000/100000).
    expect(Number(row!.db_limit_mb), 'db_limit_mb > 0').toBeGreaterThan(0)
    expect(Number(row!.storage_limit_mb), 'storage_limit_mb > 0').toBeGreaterThan(0)
  })
})
