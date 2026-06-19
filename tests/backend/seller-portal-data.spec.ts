// Backend integration spec for the `seller-portal-action` Edge Function — action `get_data`.
//
// B3 (Phase B) : la couche de LECTURE du portail vendeur passe désormais par cette
// edge function token-validée (service_role côté serveur), au lieu de requêtes anon
// directes non couvertes par la RLS. Ce spec prouve, contre le stack LOCAL (supabase
// start, l'edge-runtime sert le code du repo) :
//   1. token valide → ok:true + le bien + la transaction + les VRAIES offres (crm_offers,
//      liées par deal_id) du bien du token.
//   2. token inconnu → ok:false reason 'invalid'.
//   3. token expiré → ok:false reason 'expired'.
//   4. token révoqué → ok:false reason 'revoked'.
//
// Le gateway local exige la clé anon pour les fonctions non listées verify_jwt=false
// (cf. kyc-report-data.spec) : on l'attache à la main, puis la logique de token de la
// fonction s'applique. Tout est seedé/nettoyé via service_role sur le stack local.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const BASE_URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ENDPOINT = `${BASE_URL}/functions/v1/seller-portal-action`
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const authHeaders = { apikey: ANON, Authorization: `Bearer ${ANON}` }

const future = () => new Date(Date.now() + 90 * 86400000).toISOString()
const past = () => new Date(Date.now() - 86400000).toISOString()

async function getData(token: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({ token, action: 'get_data' }),
  })
  return { status: res.status, body: await res.json() }
}

const TEST_AMOUNT = 1_850_000

describe.skipIf(!HAS_KEYS)('seller-portal-action — get_data (lecture portail vendeur)', () => {
  let setup: TwoAgenciesSetup
  let contactId = ''
  let propertyId = ''
  let txId = ''
  let offerId = ''
  const tokenActive = `b3-active-${crypto.randomUUID()}`
  const tokenExpired = `b3-expired-${crypto.randomUUID()}`
  const tokenRevoked = `b3-revoked-${crypto.randomUUID()}`

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()
    const agency = setup.agencyAId
    const agent = setup.agentAId

    const { data: contact } = await svc
      .from('contacts')
      .insert({ agency_id: agency, first_name: 'Vendeur', last_name: 'Test B3' })
      .select('id').single()
    contactId = contact!.id

    const { data: property } = await svc
      .from('properties')
      .insert({ agency_id: agency, title: 'Bien test portail B3', type: 'apartment', status: 'active', price: 1_900_000, city: 'Genève', canton: 'GE' })
      .select('id').single()
    propertyId = property!.id

    const { data: tx } = await svc
      .from('transactions')
      .insert({ agency_id: agency, property_id: propertyId, contact_seller_id: contactId, stage: 'offer', status: 'active' })
      .select('id').single()
    txId = tx!.id

    const { data: offer } = await svc
      .from('crm_offers')
      .insert({ agency_id: agency, deal_id: txId, kind: 'offer', from_party: 'buyer', by_label: 'Acheteur test', amount: TEST_AMOUNT, status: 'pending', expires_at: future() })
      .select('id').single()
    offerId = offer!.id

    await svc.from('seller_portals').insert([
      { token: tokenActive, agency_id: agency, contact_id: contactId, property_id: propertyId, agent_id: agent, status: 'active', expires_at: future() },
      { token: tokenExpired, agency_id: agency, contact_id: contactId, property_id: propertyId, agent_id: agent, status: 'active', expires_at: past() },
      { token: tokenRevoked, agency_id: agency, contact_id: contactId, property_id: propertyId, agent_id: agent, status: 'revoked', expires_at: future() },
    ])
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    await svc.from('seller_portals').delete().in('token', [tokenActive, tokenExpired, tokenRevoked]).then(() => {}, () => {})
    if (offerId) await svc.from('crm_offers').delete().eq('id', offerId).then(() => {}, () => {})
    if (txId) await svc.from('transactions').delete().eq('id', txId).then(() => {}, () => {})
    if (propertyId) await svc.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    if (contactId) await svc.from('contacts').delete().eq('id', contactId).then(() => {}, () => {})
    await setup?.cleanup()
  })

  it('token valide → ok + bien + transaction + VRAIES offres (crm_offers par deal_id)', async () => {
    const { status, body } = await getData(tokenActive)
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect((body.property as { id?: string } | null)?.id).toBe(propertyId)
    expect((body.transaction as { id?: string } | null)?.id).toBe(txId)
    const offers = (body.offers ?? []) as Array<{ id: string; amount: number }>
    expect(offers.length).toBe(1)
    expect(offers[0].id).toBe(offerId)
    expect(offers[0].amount).toBe(TEST_AMOUNT)
  })

  it('token inconnu → ok:false reason invalid', async () => {
    const { status, body } = await getData(`nope-${crypto.randomUUID()}`)
    expect(status).toBe(200)
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('invalid')
  })

  it('token expiré → ok:false reason expired', async () => {
    const { body } = await getData(tokenExpired)
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('expired')
  })

  it('token révoqué → ok:false reason revoked', async () => {
    const { body } = await getData(tokenRevoked)
    expect(body.ok).toBe(false)
    expect(body.reason).toBe('revoked')
  })
})
