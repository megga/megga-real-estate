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
// Complété en juillet 2026, après le retrait de la démo `/portal` (les deux specs
// e2e supprimées ne rendaient QUE des données fictives : elles n'auraient jamais
// attrapé une fuite). Ce qui manquait ici, c'est la preuve d'ISOLATION — un lien
// est public, sa seule protection est le token :
//   5. cloisonnement inter-agences : le token de A ne rend RIEN de l'agence B.
//   6. cloisonnement par deal : une offre d'un AUTRE bien de la MÊME agence ne
//      remonte pas (la jointure est par deal_id, pas par agency_id).
//   7. écritures refusées sur lien mort : `offer_decision` et `save_preferences`
//      répondent 410 sur un token expiré ou révoqué, 401 sur un token inconnu.
//      Un lien révoqué qui accepterait encore une offre serait le pire défaut
//      possible de cette surface.
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

async function call(payload: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(payload),
  })
  return { status: res.status, body: await res.json() }
}

const getData = (token: string) => call({ token, action: 'get_data' })

const TEST_AMOUNT = 1_850_000

describe.skipIf(!HAS_KEYS)('seller-portal-action — get_data (lecture portail vendeur)', () => {
  let setup: TwoAgenciesSetup
  let contactId = ''
  let propertyId = ''
  let txId = ''
  let offerId = ''
  // Bruit d'isolation : une autre agence, et un autre deal de la MÊME agence.
  let otherAgencyPropertyId = ''
  let otherAgencyTxId = ''
  let otherAgencyOfferId = ''
  let otherAgencyContactId = ''
  let sameAgencyPropertyId = ''
  let sameAgencyTxId = ''
  let sameAgencyOfferId = ''
  const tokenActive = `b3-active-${crypto.randomUUID()}`
  const tokenExpired = `b3-expired-${crypto.randomUUID()}`
  const tokenRevoked = `b3-revoked-${crypto.randomUUID()}`

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()
    const agency = setup.agencyAId
    const agent = setup.agentAId

    const { data: contact, error: contactErr } = await svc
      .from('contacts')
      .insert({ agency_id: agency, first_name: 'Vendeur', last_name: 'Test B3' })
      .select('id').single()
    if (contactErr || !contact) throw new Error(`seed contact vendeur : ${contactErr?.message ?? 'aucune ligne'}`)
    contactId = contact.id

    const { data: property, error: propertyErr } = await svc
      .from('properties')
      .insert({ agency_id: agency, title: 'Bien test portail B3', type: 'apartment', status: 'active', price: 1_900_000, city: 'Genève', canton: 'GE' })
      .select('id').single()
    if (propertyErr || !property) throw new Error(`seed bien du token : ${propertyErr?.message ?? 'aucune ligne'}`)
    propertyId = property.id

    const { data: tx, error: txErr } = await svc
      .from('transactions')
      .insert({ agency_id: agency, property_id: propertyId, contact_seller_id: contactId, stage: 'offer', status: 'active' })
      .select('id').single()
    if (txErr || !tx) throw new Error(`seed transaction du token : ${txErr?.message ?? 'aucune ligne'}`)
    txId = tx.id

    const { data: offer, error: offerErr } = await svc
      .from('crm_offers')
      .insert({ agency_id: agency, deal_id: txId, kind: 'offer', from_party: 'buyer', by_label: 'Acheteur test', amount: TEST_AMOUNT, status: 'pending', expires_at: future() })
      .select('id').single()
    if (offerErr || !offer) throw new Error(`seed offre du deal du token : ${offerErr?.message ?? 'aucune ligne'}`)
    offerId = offer.id

    // ── Bruit d'isolation ───────────────────────────────────────────────
    // (a) Agence B : rien de tout ceci ne doit apparaître dans le payload de A.
    const { data: otherContact, error: otherContactErr } = await svc
      .from('contacts')
      .insert({ agency_id: setup.agencyBId, first_name: 'Vendeur', last_name: 'Agence B' })
      .select('id').single()
    if (otherContactErr || !otherContact) throw new Error(`seed contact agence B : ${otherContactErr?.message ?? 'aucune ligne'}`)
    otherAgencyContactId = otherContact.id

    const { data: otherProperty, error: otherPropertyErr } = await svc
      .from('properties')
      .insert({ agency_id: setup.agencyBId, title: 'Bien AGENCE B — ne doit jamais fuiter', type: 'apartment', status: 'active', price: 4_200_000, city: 'Zurich', canton: 'ZH' })
      .select('id').single()
    if (otherPropertyErr || !otherProperty) throw new Error(`seed bien agence B : ${otherPropertyErr?.message ?? 'aucune ligne'}`)
    otherAgencyPropertyId = otherProperty.id

    const { data: otherTx, error: otherTxErr } = await svc
      .from('transactions')
      .insert({ agency_id: setup.agencyBId, property_id: otherAgencyPropertyId, contact_seller_id: otherAgencyContactId, stage: 'offer', status: 'active' })
      .select('id').single()
    if (otherTxErr || !otherTx) throw new Error(`seed transaction agence B : ${otherTxErr?.message ?? 'aucune ligne'}`)
    otherAgencyTxId = otherTx.id

    const { data: otherOffer, error: otherOfferErr } = await svc
      .from('crm_offers')
      .insert({ agency_id: setup.agencyBId, deal_id: otherAgencyTxId, kind: 'offer', from_party: 'buyer', by_label: 'Acheteur agence B', amount: 4_100_000, status: 'pending', expires_at: future() })
      .select('id').single()
    if (otherOfferErr || !otherOffer) throw new Error(`seed offre agence B : ${otherOfferErr?.message ?? 'aucune ligne'}`)
    otherAgencyOfferId = otherOffer.id

    // (b) Même agence, AUTRE bien : la jointure des offres est par deal_id, pas
    //     par agency_id. Un élargissement accidentel ferait remonter celle-ci.
    const { data: sameProperty, error: samePropertyErr } = await svc
      .from('properties')
      .insert({ agency_id: agency, title: 'Autre bien MÊME agence', type: 'house', status: 'active', price: 2_500_000, city: 'Genève', canton: 'GE' })
      .select('id').single()
    if (samePropertyErr || !sameProperty) throw new Error(`seed autre bien même agence : ${samePropertyErr?.message ?? 'aucune ligne'}`)
    sameAgencyPropertyId = sameProperty.id

    const { data: sameTx, error: sameTxErr } = await svc
      .from('transactions')
      .insert({ agency_id: agency, property_id: sameAgencyPropertyId, contact_seller_id: contactId, stage: 'offer', status: 'active' })
      .select('id').single()
    if (sameTxErr || !sameTx) throw new Error(`seed transaction autre bien : ${sameTxErr?.message ?? 'aucune ligne'}`)
    sameAgencyTxId = sameTx.id

    const { data: sameOffer, error: sameOfferErr } = await svc
      .from('crm_offers')
      .insert({ agency_id: agency, deal_id: sameAgencyTxId, kind: 'offer', from_party: 'buyer', by_label: 'Acheteur autre deal', amount: 2_400_000, status: 'pending', expires_at: future() })
      .select('id').single()
    if (sameOfferErr || !sameOffer) throw new Error(`seed offre autre deal : ${sameOfferErr?.message ?? 'aucune ligne'}`)
    sameAgencyOfferId = sameOffer.id

    const { error: portalsErr } = await svc.from('seller_portals').insert([
      { token: tokenActive, agency_id: agency, contact_id: contactId, property_id: propertyId, agent_id: agent, status: 'active', expires_at: future() },
      { token: tokenExpired, agency_id: agency, contact_id: contactId, property_id: propertyId, agent_id: agent, status: 'active', expires_at: past() },
      { token: tokenRevoked, agency_id: agency, contact_id: contactId, property_id: propertyId, agent_id: agent, status: 'revoked', expires_at: future() },
    ])
    if (portalsErr) throw new Error(`seed seller_portals : ${portalsErr.message}`)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    await svc.from('seller_portals').delete().in('token', [tokenActive, tokenExpired, tokenRevoked]).then(() => {}, () => {})
    for (const id of [offerId, sameAgencyOfferId, otherAgencyOfferId]) {
      if (id) await svc.from('crm_offers').delete().eq('id', id).then(() => {}, () => {})
    }
    for (const id of [txId, sameAgencyTxId, otherAgencyTxId]) {
      if (id) await svc.from('transactions').delete().eq('id', id).then(() => {}, () => {})
    }
    for (const id of [propertyId, sameAgencyPropertyId, otherAgencyPropertyId]) {
      if (id) await svc.from('properties').delete().eq('id', id).then(() => {}, () => {})
    }
    for (const id of [contactId, otherAgencyContactId]) {
      if (id) await svc.from('contacts').delete().eq('id', id).then(() => {}, () => {})
    }
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

  // ── Isolation ────────────────────────────────────────────────────────────
  // Un lien vendeur est PUBLIC : sa seule protection est le token. Ces deux cas
  // vérifient que le périmètre du payload est bien celui du token, et rien de
  // plus. On assèche le payload entier plutôt que champ par champ : une fuite
  // arrive par le champ qu'on n'avait pas pensé à regarder.

  it('cloisonnement inter-agences : rien de l\'agence B dans le payload de A', async () => {
    const { body } = await getData(tokenActive)
    expect(body.ok).toBe(true)

    const serialise = JSON.stringify(body)
    for (const trace of [otherAgencyPropertyId, otherAgencyTxId, otherAgencyOfferId,
                         otherAgencyContactId, setup.agencyBId,
                         'Bien AGENCE B', 'Acheteur agence B']) {
      expect(serialise, `fuite inter-agences : « ${trace} » présent dans le payload`)
        .not.toContain(trace)
    }
  })

  it('cloisonnement par deal : l\'offre d\'un autre bien de la même agence ne remonte pas', async () => {
    const { body } = await getData(tokenActive)
    const offers = (body.offers ?? []) as Array<{ id: string }>
    expect(offers.map(o => o.id)).toEqual([offerId])
    expect(JSON.stringify(body)).not.toContain(sameAgencyOfferId)
  })

  // ── Écritures sur lien mort ──────────────────────────────────────────────
  // Lire avec un lien périmé ne coûte rien ; ÉCRIRE avec, si. Un lien révoqué
  // qui accepterait encore une offre au nom du vendeur serait le pire défaut
  // possible de cette surface — d'où un cas par action et par état.

  const deadLinks: Array<[string, () => string, number]> = [
    ['expiré', () => tokenExpired, 410],
    ['révoqué', () => tokenRevoked, 410],
    ['inconnu', () => `nope-${crypto.randomUUID()}`, 401],
  ]

  for (const [label, tokenOf, expected] of deadLinks) {
    it(`offer_decision refusée sur un lien ${label} (${expected})`, async () => {
      const { status } = await call({
        token: tokenOf(), action: 'offer_decision', offerId, decision: 'accept',
      })
      expect(status).toBe(expected)
    })

    it(`save_preferences refusée sur un lien ${label} (${expected})`, async () => {
      const { status } = await call({
        token: tokenOf(), action: 'save_preferences', preferences: { canaux: ['email'] },
      })
      expect(status).toBe(expected)
    })
  }

  it('aucune décision n\'a été enregistrée par les tentatives sur liens morts', async () => {
    // Le contrat 401/410 ne vaut que si RIEN n'a été écrit derrière : on relit
    // le journal, seul endroit où `offer_decision` laisse une trace.
    const svc = serviceRoleClient()
    const { data } = await svc
      .from('activity_events')
      .select('id')
      .eq('action', 'seller_offer_decision')
      .eq('entity_id', offerId)
    expect(data ?? []).toHaveLength(0)
  })
})
