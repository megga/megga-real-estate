// Sécurité de la révocation de session — RPC revoke_user_session (live spec)
//
// revoke_user_session(p_user_id, p_session_id) supprime une ligne auth.sessions
// SCOPÉE (id + user_id) → un utilisateur ne peut révoquer que SES sessions.
// SECURITY DEFINER, exposée à service_role UNIQUEMENT (REVOKE anon/authenticated).
// L'edge revoke-device-session l'appelle avec l'id user VÉRIFIÉ (admin.getUser) +
// le session_id de l'appareil possédé par le caller.
//
// Test 1 — anon ne peut PAS appeler la RPC (EXECUTE révoqué).
// Test 2 — un agent authentifié ne peut PAS appeler la RPC (EXECUTE révoqué).
// Test 3 — service_role PEUT l'appeler ; sur un session_id inexistant = no-op SANS erreur.
//
// Tourne live en CI (SUPABASE_TEST_* présents) ; skip propre en local sans clés.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

// uuid valide mais sans session correspondante → la suppression no-op.
const ABSENT_SESSION_ID = '00000000-0000-4000-8000-000000000000'

describe.skipIf(!HAS_KEYS)('revoke_user_session RPC — service_role only', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    await setup.cleanup()
  })

  it('anon ne peut pas appeler revoke_user_session', async () => {
    const { error } = await anonClient().rpc('revoke_user_session', {
      p_user_id: setup.agentAId,
      p_session_id: ABSENT_SESSION_ID,
    })
    expect(error, 'anon doit être rejeté (EXECUTE révoqué)').not.toBeNull()
  })

  it('un agent authentifié ne peut pas appeler revoke_user_session', async () => {
    const { error } = await setup.clientB.rpc('revoke_user_session', {
      p_user_id: setup.agentBId,
      p_session_id: ABSENT_SESSION_ID,
    })
    expect(error, 'authenticated doit être rejeté (EXECUTE révoqué)').not.toBeNull()
  })

  it('service_role peut appeler ; session inexistante = no-op sans erreur', async () => {
    const { error } = await serviceRoleClient().rpc('revoke_user_session', {
      p_user_id: setup.agentAId,
      p_session_id: ABSENT_SESSION_ID,
    })
    expect(error, 'service_role doit pouvoir appeler la RPC sans erreur').toBeNull()
  })
})
