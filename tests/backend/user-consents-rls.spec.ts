// Conformité nLPD — user_consents (migration 20260705170000)
//
//  Preuve de consentement IMMUABLE : insert via la RPC record_consent
//  uniquement (user_id + ip_hash déterminés serveur), aucune policy
//  UPDATE/DELETE/INSERT directe.
//
//  Test 1 — record_consent insère pour l'appelant ; relire sa propre ligne OK.
//  Test 2 — idempotence : ré-accepter la même version = no-op (1 seule ligne).
//  Test 3 — isolation : un autre agent ne voit PAS les consentements d'autrui.
//  Test 4 — immuabilité : UPDATE et DELETE refusés même pour le propriétaire
//    (0 ligne affectée — pas de policy).
//  Test 5 — insert direct refusé (pas de policy INSERT) ; type invalide refusé.
//  Test 6 — super_admin (domaine de test CI) lit tout.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const VERSION = 'test-2026-07'

describe.skipIf(!HAS_KEYS)('user_consents — RLS + record_consent (preuve immuable)', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    // Purge des lignes de test (service_role bypasse la RLS).
    await serviceRoleClient()
      .from('user_consents')
      .delete()
      .in('user_id', [setup.agentAId, setup.agentBId])
      .then(() => {}, () => {})
    await setup.cleanup()
  })

  it('record_consent insère pour l\'appelant et la lecture propre fonctionne', async () => {
    const { error } = await setup.clientA.rpc('record_consent', {
      p_type: 'terms',
      p_version: VERSION,
    })
    if (error) throw new Error(`record_consent: ${error.message}`)

    const { data, error: readErr } = await setup.clientA
      .from('user_consents')
      .select('consent_type, version, user_id')
      .eq('version', VERSION)
    if (readErr) throw new Error(`read own: ${readErr.message}`)
    expect(data?.length).toBe(1)
    expect(data![0].user_id).toBe(setup.agentAId)
    expect(data![0].consent_type).toBe('terms')
  })

  it('ré-accepter la même version est idempotent (une seule ligne)', async () => {
    const { error } = await setup.clientA.rpc('record_consent', {
      p_type: 'terms',
      p_version: VERSION,
    })
    if (error) throw new Error(`record_consent (2e): ${error.message}`)

    const { data } = await setup.clientA
      .from('user_consents')
      .select('id')
      .eq('version', VERSION)
    expect(data?.length).toBe(1)
  })

  it('un autre agent ne voit pas les consentements d\'autrui', async () => {
    const { data, error } = await setup.clientB
      .from('user_consents')
      .select('id, user_id')
      .eq('user_id', setup.agentAId)
    if (error) throw new Error(`cross read: ${error.message}`)
    expect(data?.length ?? 0).toBe(0)
  })

  it('UPDATE et DELETE sont refusés même pour le propriétaire', async () => {
    const { data: updated } = await setup.clientA
      .from('user_consents')
      .update({ version: 'tampered' })
      .eq('user_id', setup.agentAId)
      .select('id')
    expect(updated?.length ?? 0).toBe(0)

    const { data: deleted } = await setup.clientA
      .from('user_consents')
      .delete()
      .eq('user_id', setup.agentAId)
      .select('id')
    expect(deleted?.length ?? 0).toBe(0)

    // La ligne originale est intacte.
    const { data: still } = await setup.clientA
      .from('user_consents')
      .select('version')
      .eq('version', VERSION)
    expect(still?.length).toBe(1)
  })

  it('insert direct et type invalide sont refusés', async () => {
    const { error: directErr } = await setup.clientA.from('user_consents').insert({
      user_id: setup.agentAId,
      consent_type: 'terms',
      version: 'direct-insert',
    })
    expect(directErr, 'insert direct sans policy doit échouer').not.toBeNull()

    const { error: typeErr } = await setup.clientA.rpc('record_consent', {
      p_type: 'tracking_everything',
      p_version: VERSION,
    })
    expect(typeErr, 'type de consentement invalide doit échouer').not.toBeNull()
  })

  it('un super_admin (domaine de test) lit les consentements de tous', async () => {
    const service = serviceRoleClient()
    const { error: promoteErr } = await service
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentBId)
    if (promoteErr) throw new Error(`promote: ${promoteErr.message}`)

    const { data, error } = await setup.clientB
      .from('user_consents')
      .select('id, user_id')
      .eq('user_id', setup.agentAId)
    if (error) throw new Error(`admin read: ${error.message}`)
    expect(data?.length).toBe(1)

    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentBId)
  })
})
