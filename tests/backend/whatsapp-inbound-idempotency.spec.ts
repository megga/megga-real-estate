// Idempotence des webhooks entrants WhatsApp — live contre le Supabase local.
//
// Meta REJOUE un webhook non acquitté à temps (ou le batche en double). La branche client de
// whatsapp-webhook s'appuie sur l'upsert ON CONFLICT DO NOTHING + .select('id') pour détecter
// le rejeu : 1re livraison → 1 ligne renvoyée (traiter), rejeu → 0 ligne (court-circuit avant
// l'audit `whatsapp_message_received` et markRead). Ce spec verrouille cette sémantique DB.
//
//  Test 1 — 1er insert d'un entrant renvoie 1 ligne (signal « nouveau »).
//  Test 2 — même (provider, provider_message_id) rejoué renvoie 0 ligne (signal « doublon »).
//  Test 3 — aucun doublon de ligne créé (un seul enregistrement pour ce providerMessageId).
//  Test 4 — un providerMessageId distinct renvoie bien 1 ligne (pas de faux positif).
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips cleanly locally when keys are absent.

import { describe, it, expect, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const PMID = `wamid.TEST-INBOUND-IDEMPOTENCY-${Date.now()}`
const PMID_OTHER = `wamid.TEST-INBOUND-IDEMPOTENCY-OTHER-${Date.now()}`

describe.skipIf(!HAS_KEYS)('whatsapp inbound — idempotence webhook rejeu', () => {
  const svc = () => serviceRoleClient()

  // Même upsert que la branche client de whatsapp-webhook (index.ts §4) : ON CONFLICT DO
  // NOTHING sur (provider, provider_message_id) + RETURNING id. Renvoie le nombre de lignes
  // RÉELLEMENT insérées (1 = nouveau, 0 = rejeu/doublon).
  const ingest = async (pmid: string): Promise<number> => {
    const { data, error } = await svc()
      .from('whatsapp_messages')
      .upsert({
        provider: 'meta',
        provider_message_id: pmid,
        direction: 'inbound',
        wa_from: '41790000009',
        wa_to: 'megga-test',
        body: 'message entrant test idempotence',
        status: 'received',
      }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })
      .select('id')
    if (error) throw new Error(error.message)
    return (data ?? []).length
  }

  afterAll(async () => {
    await svc().from('whatsapp_messages').delete().in('provider_message_id', [PMID, PMID_OTHER])
  })

  it('1re livraison → 1 ligne insérée (signal « nouveau »)', async () => {
    expect(await ingest(PMID)).toBe(1)
  })

  it('rejeu du même providerMessageId → 0 ligne (signal « doublon » = court-circuit)', async () => {
    // Deux rejeux de suite : toujours 0 (jamais de ré-insertion).
    expect(await ingest(PMID)).toBe(0)
    expect(await ingest(PMID)).toBe(0)
  })

  it('aucun doublon de ligne pour ce providerMessageId', async () => {
    const { data, error } = await svc()
      .from('whatsapp_messages')
      .select('id')
      .eq('provider', 'meta')
      .eq('provider_message_id', PMID)
    if (error) throw new Error(error.message)
    expect((data ?? []).length).toBe(1)
  })

  it('un providerMessageId distinct → 1 ligne (pas de faux positif du gate)', async () => {
    expect(await ingest(PMID_OTHER)).toBe(1)
  })
})
