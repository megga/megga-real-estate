// Sécurité — RPC admin_log_impersonation (migration 20260705160000)
//
//  L'audit d'impersonation est écrit CÔTÉ SERVEUR (SECURITY DEFINER, gardée
//  is_super_admin) : useImpersonate n'active la vue impersonée que si cette
//  RPC réussit (audit-first). Remplace l'ancien insert client fire-and-forget
//  (contournable, non bloquant).
//
//  Test 1 — Gate : un agent simple appelant la RPC → erreur (42501 wrappé).
//  Test 2 — Succès : un super_admin (domaine de test CI) reçoit un uuid et la
//    ligne activity_events existe (action, acteur, cible, severity warn,
//    category auth, metadata enrichie serveur : target_email/target_role).
//  Test 3 — Action invalide → erreur.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('admin_log_impersonation RPC — audit-first, gardée super_admin', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()

    // agentA = super_admin (email @megga-test.local → allowlist via domaine de test).
    const { error: promoteErr } = await serviceRoleClient()
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentAId)
    if (promoteErr) throw new Error(`promote super_admin: ${promoteErr.message}`)
  })

  afterAll(async () => {
    await serviceRoleClient()
      .from('profiles')
      .update({ role: 'agent' })
      .eq('id', setup.agentAId)
      .then(() => {}, () => {})
    await setup.cleanup()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 1 — Gate : agent simple rejeté
  // ──────────────────────────────────────────────────────────────────────────

  it('un agent simple ne peut pas journaliser une impersonation', async () => {
    const { error } = await setup.clientB.rpc('admin_log_impersonation', {
      p_action: 'impersonate_start',
      p_target_id: setup.agentAId,
      p_metadata: {},
    })
    expect(error, 'la RPC doit être refusée à un non-super-admin').not.toBeNull()
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 2 — Succès : uuid retourné + ligne d'audit complète
  // ──────────────────────────────────────────────────────────────────────────

  it('un super_admin journalise impersonate_start et la ligne d\'audit existe', async () => {
    const { data: eventId, error } = await setup.clientA.rpc('admin_log_impersonation', {
      p_action: 'impersonate_start',
      p_target_id: setup.agentBId,
      p_metadata: { target_name: 'Agent B' },
    })
    if (error) throw new Error(`rpc (super_admin): ${error.message}`)
    expect(typeof eventId).toBe('string')
    expect((eventId as string).length).toBeGreaterThan(0)

    const { data: rows, error: readErr } = await serviceRoleClient()
      .from('activity_events')
      .select('id, action, actor_id, actor_kind, entity_type, entity_id, category, severity, metadata')
      .eq('id', eventId as string)
      .limit(1)
    if (readErr) throw new Error(`activity_events read: ${readErr.message}`)
    expect(rows?.length).toBe(1)

    const event = rows![0]
    expect(event.action).toBe('impersonate_start')
    expect(event.actor_id).toBe(setup.agentAId)
    expect(event.actor_kind).toBe('user')
    expect(event.entity_type).toBe('profile')
    expect(event.entity_id).toBe(setup.agentBId)
    expect(event.category).toBe('auth')
    expect(event.severity).toBe('warn')
    // Metadata enrichie côté serveur (email/rôle réels de la cible) + client (nom).
    const meta = event.metadata as { target_email?: string; target_role?: string; target_name?: string }
    expect(meta.target_name).toBe('Agent B')
    expect(meta.target_email).toContain('@megga-test.local')
    expect(meta.target_role).toBe('agent')
  })

  // ──────────────────────────────────────────────────────────────────────────
  // Test 3 — Action invalide refusée
  // ──────────────────────────────────────────────────────────────────────────

  it('une action hors impersonate_start/stop est refusée', async () => {
    const { error } = await setup.clientA.rpc('admin_log_impersonation', {
      p_action: 'impersonate_forever',
      p_target_id: setup.agentBId,
      p_metadata: {},
    })
    expect(error, 'action invalide → erreur').not.toBeNull()
  })
})
