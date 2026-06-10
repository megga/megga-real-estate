// Statuts de livraison WhatsApp (sprint « outbound fiable ») — live contre le Supabase local.
//
//  Test 1 — la contrainte status accepte sent/delivered/read (migration 20260610130000).
//  Test 2 — progression monotone via .in(allowedPriorStatuses) : un event en retard
//           (delivered après read) ne matche aucune ligne → pas de rétrogradation.
//  Test 3 — failed pose delivery_error + status_updated_at, et failed après read = no-op.
//  Test 4 — un statut hors contrat est rejeté par le CHECK.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips cleanly locally when keys are absent.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { allowedPriorStatuses } from '../../supabase/functions/_shared/whatsapp-gateway'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const PMID_HAPPY = `wamid.TEST-DELIVERY-HAPPY-${Date.now()}`
const PMID_FAIL = `wamid.TEST-DELIVERY-FAIL-${Date.now()}`

describe.skipIf(!HAS_KEYS)('whatsapp delivery status — progression monotone', () => {
  const svc = () => serviceRoleClient()

  // Même sémantique d'UPDATE que applyStatusUpdates (whatsapp-webhook/index.ts).
  const apply = async (
    pmid: string,
    next: 'sent' | 'delivered' | 'read' | 'failed',
    patch: Record<string, unknown> = {},
  ) => {
    const { data, error } = await svc()
      .from('whatsapp_messages')
      .update({ status: next, status_updated_at: new Date().toISOString(), ...patch })
      .eq('provider', 'meta')
      .eq('provider_message_id', pmid)
      .eq('direction', 'outbound')
      .in('status', allowedPriorStatuses(next))
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length
  }

  beforeAll(async () => {
    const { error } = await svc().from('whatsapp_messages').insert([
      { provider: 'meta', provider_message_id: PMID_HAPPY, direction: 'outbound', wa_from: 'megga-test', wa_to: '41790000001', body: 'test delivery happy', status: 'received' },
      { provider: 'meta', provider_message_id: PMID_FAIL, direction: 'outbound', wa_from: 'megga-test', wa_to: '41790000002', body: 'test delivery fail', status: 'received' },
    ])
    if (error) throw new Error(`seed: ${error.message}`)
  })

  afterAll(async () => {
    await svc().from('whatsapp_messages').delete().in('provider_message_id', [PMID_HAPPY, PMID_FAIL])
  })

  it('fait progresser un sortant received → sent → delivered → read', async () => {
    expect(await apply(PMID_HAPPY, 'sent')).toBe(1)
    expect(await apply(PMID_HAPPY, 'delivered')).toBe(1)
    expect(await apply(PMID_HAPPY, 'read')).toBe(1)
    const { data } = await svc().from('whatsapp_messages')
      .select('status, status_updated_at').eq('provider_message_id', PMID_HAPPY).single()
    expect(data?.status).toBe('read')
    expect(data?.status_updated_at).not.toBeNull()
  })

  it('un event en retard ne rétrograde jamais (delivered/sent après read → 0 ligne)', async () => {
    expect(await apply(PMID_HAPPY, 'delivered')).toBe(0)
    expect(await apply(PMID_HAPPY, 'sent')).toBe(0)
    const { data } = await svc().from('whatsapp_messages')
      .select('status').eq('provider_message_id', PMID_HAPPY).single()
    expect(data?.status).toBe('read')
  })

  it('failed après read = no-op (un message lu a forcément été livré)', async () => {
    expect(await apply(PMID_HAPPY, 'failed', { delivery_error: 'ne doit pas apparaître' })).toBe(0)
    const { data } = await svc().from('whatsapp_messages')
      .select('status, delivery_error').eq('provider_message_id', PMID_HAPPY).single()
    expect(data?.status).toBe('read')
    expect(data?.delivery_error).toBeNull()
  })

  it('failed depuis sent pose delivery_error, puis reste terminal', async () => {
    expect(await apply(PMID_FAIL, 'sent')).toBe(1)
    expect(await apply(PMID_FAIL, 'failed', { delivery_error: '131047 — fenêtre 24h fermée (le client doit écrire en premier)' })).toBe(1)
    const { data } = await svc().from('whatsapp_messages')
      .select('status, delivery_error').eq('provider_message_id', PMID_FAIL).single()
    expect(data?.status).toBe('failed')
    expect(data?.delivery_error).toContain('131047')
    // terminal : aucun statut ne repasse par-dessus failed
    expect(await apply(PMID_FAIL, 'delivered')).toBe(0)
    expect(await apply(PMID_FAIL, 'read')).toBe(0)
  })

  it('le CHECK rejette un statut hors contrat', async () => {
    const { error } = await svc().from('whatsapp_messages')
      .update({ status: 'teleported' }).eq('provider_message_id', PMID_FAIL)
    expect(error).not.toBeNull()
  })
})
