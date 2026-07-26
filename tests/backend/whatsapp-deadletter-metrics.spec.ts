// WhatsApp — compteurs dead-letters (migration 20260710163000)
//
//  get_whatsapp_deadletter_metrics() : gardé is_super_admin() OR is_service_role().
//
//  Test 1 — Gate : un agent simple est rejeté.
//  Test 2 — Shape : un super_admin (domaine de test CI) reçoit les clés numériques
//    (5 signaux persistés + processing_deadletter_24h fenêtré pour l'alerting).
//  Test 3 — Comptage : deux lignes whatsapp_messages seedées via service_role
//    (une is_agent_error=true, une processing_status='failed' retry_count=3)
//    font croître processing_failed / processing_deadletter / agent_errors_24h.
//  Test 4 — Fusion : get_admin_whatsapp_health() expose aussi ces 5 clés.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const DL_KEYS = [
  'processing_failed',
  'processing_deadletter',
  'processing_deadletter_24h',
  'agent_errors_24h',
  'delivery_failed_24h',
  'async_jobs_failed_24h',
] as const

type Deadletters = Record<(typeof DL_KEYS)[number], number>

describe.skipIf(!HAS_KEYS)('WhatsApp dead-letter metrics — gardé super_admin/service', () => {
  let setup: TwoAgenciesSetup
  const seededIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { error: promoteErr } = await service
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', setup.agentAId)
    if (promoteErr) throw new Error(`promote: ${promoteErr.message}`)

    // Seed : une erreur copilote (24h) + un média non rejouable (dead-letter).
    //
    // ⚠ Insert EN LOT : PostgREST construit une seule requête avec l'UNION des clés
    // des objets, et une clé absente d'un objet part en NULL — le DEFAULT de la
    // colonne ne s'applique PAS (c'est ce que corrige `Prefer: missing=default`).
    // Les deux lignes doivent donc porter exactement les mêmes clés, sinon les
    // colonnes NOT NULL DEFAULT (processing_status, retry_count, is_agent_error)
    // reçoivent NULL et l'insert entier échoue.
    const { data: rows, error: seedErr } = await service
      .from('whatsapp_messages')
      .insert([
        {
          provider_message_id: `dl-agent-${setup.stamp}`,
          wa_from: '41790000001',
          agency_id: setup.agencyAId,
          is_agent_error: true,
          processing_status: 'done',
          retry_count: 0,
        },
        {
          provider_message_id: `dl-proc-${setup.stamp}`,
          wa_from: '41790000002',
          agency_id: setup.agencyAId,
          is_agent_error: false,
          processing_status: 'failed',
          retry_count: 3,
        },
      ])
      .select('id')
    // Un seed qui échoue est un BUG, pas une variation de schéma : on throw. Avec un
    // simple console.warn, le test de comptage était sauté et passait à vide.
    if (seedErr) throw new Error(`seed whatsapp_messages: ${seedErr.message}`)
    for (const r of rows ?? []) seededIds.push(r.id)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (seededIds.length > 0) {
      await service.from('whatsapp_messages').delete().in('id', seededIds).then(() => {}, () => {})
    }
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('un agent simple est rejeté', async () => {
    const { error } = await setup.clientB.rpc('get_whatsapp_deadletter_metrics')
    expect(error, 'refus attendu (42501)').not.toBeNull()
  })

  it('un super_admin reçoit tous les compteurs numériques', async () => {
    const { data, error } = await setup.clientA.rpc('get_whatsapp_deadletter_metrics')
    if (error) throw new Error(error.message)
    const obj = data as Record<string, unknown>
    for (const key of DL_KEYS) {
      expect(typeof obj[key], `clé ${key}`).toBe('number')
    }
  })

  it('les lignes seedées font croître les compteurs', async () => {
    const { data, error } = await setup.clientA.rpc('get_whatsapp_deadletter_metrics')
    if (error) throw new Error(error.message)
    const dl = data as Deadletters
    expect(dl.processing_failed).toBeGreaterThanOrEqual(1)
    expect(dl.processing_deadletter).toBeGreaterThanOrEqual(1)
    expect(dl.processing_deadletter_24h).toBeGreaterThanOrEqual(1) // seedé created_at = now
    expect(dl.agent_errors_24h).toBeGreaterThanOrEqual(1)
  })

  it('get_admin_whatsapp_health fusionne les 5 clés dead-letters', async () => {
    const { data, error } = await setup.clientA.rpc('get_admin_whatsapp_health')
    if (error) throw new Error(error.message)
    const obj = data as Record<string, unknown>
    for (const key of DL_KEYS) {
      expect(typeof obj[key], `health.${key}`).toBe('number')
    }
  })
})
