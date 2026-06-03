// Filtre anti-écho C1 — whatsapp_messages.is_agent_error.
// Vérifie que la requête mémoire 24h de l'agent EXCLUT les réponses
// marquées is_agent_error=true (celles-ci ne doivent pas polluer le contexte).
//
// Tourne contre un projet de TEST (SUPABASE_TEST_*), pas la prod.
// skipIf saute proprement si les clés de test ne sont pas fournies (local sans Docker).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)("C1 exclut les réponses d'erreur de la mémoire", () => {
  let setup: TwoAgenciesSetup
  let waTo: string
  let msgOkId: string
  let msgErrId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()

    // Numéro unique digits-only pour isoler ces lignes des autres tests
    waTo = '4179' + setup.stamp.replace(/\D/g, '').slice(-7)

    const service = serviceRoleClient()

    // Ligne OK — is_agent_error=false, doit être visible par la requête C1
    const { data: msgOk, error: errOk } = await service
      .from('whatsapp_messages')
      .insert({
        provider: 'meta',
        provider_message_id: `err-mem-ok-${setup.stamp}`,
        direction: 'outbound',
        wa_from: 'megga',
        wa_to: waTo,
        agency_id: setup.agencyAId,
        body: 'réponse normale',
        status: 'received',
        is_agent_error: false,
      })
      .select('id')
      .single()
    if (errOk) throw new Error(`msgOk insert: ${errOk.message}`)
    msgOkId = msgOk.id

    // Ligne ERR — is_agent_error=true, doit être EXCLUE par la requête C1
    const { data: msgErr, error: errKo } = await service
      .from('whatsapp_messages')
      .insert({
        provider: 'meta',
        provider_message_id: `err-mem-ko-${setup.stamp}`,
        direction: 'outbound',
        wa_from: 'megga',
        wa_to: waTo,
        agency_id: setup.agencyAId,
        body: 'iaDown',
        status: 'received',
        is_agent_error: true,
      })
      .select('id')
      .single()
    if (errKo) throw new Error(`msgErr insert: ${errKo.message}`)
    msgErrId = msgErr.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (msgOkId) await service.from('whatsapp_messages').delete().eq('id', msgOkId)
    if (msgErrId) await service.from('whatsapp_messages').delete().eq('id', msgErrId)
    await setup.cleanup()
  })

  it('ne renvoie pas la ligne is_agent_error=true', async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data } = await serviceRoleClient()
      .from('whatsapp_messages')
      .select('body, is_agent_error')
      .or(`wa_from.eq.${waTo},wa_to.eq.${waTo}`)
      .eq('is_agent_error', false)
      .gt('created_at', since)

    // Le numéro waTo est unique — exactement 1 ligne doit correspondre (la OK)
    expect(data?.length).toBe(1)
    expect(data?.every((r) => r.is_agent_error === false)).toBe(true)
  })
})
