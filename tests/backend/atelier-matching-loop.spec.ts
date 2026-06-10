// Backend test — Atelier Matching : boucle complète (migration 20260610_001).
//
// Rejoue le contrat HANDOFF_MATCHING_COUTURES au niveau base, en tant
// qu'AGENT AUTHENTIFIÉ (RLS réelle), sur le Supabase local de la CI
// (toutes les migrations rejouées de zéro — y compris 20260610_001) :
//
//   1. matches marché sans property_id  → s'insèrent (bug pré-migration :
//      NOT NULL violé silencieusement, 0 match marché créé depuis l'origine)
//   2. CHECK matches_target_check       → refuse un match sans aucune cible
//   3. index uniques (contact, bien)    → dédup dure du moteur
//   4. Envoyer : match→sent + deal new_lead + activity_events (la policy
//      INSERT agence est NOUVELLE — avant, consignation silencieusement
//      perdue) + reminder follow_up_sent_property à +5 j
//   5. Plus tard : snoozed_until +7 j + reminder custom ; réactivation
//   6. Écarter : status=ignored, le couple reste en base (jamais re-proposé)
//   7. Deal ↔ bien de veille : transactions.market_listing_id
//   8. RLS : un client anonyme ne voit rien
//
// NB : les écritures reproduisent celles de src/hooks/useAtelierMatching.ts
// (execSendDossier/execSnooze/execDismiss). On ne peut pas importer ces
// exécuteurs ici : ils consomment le client navigateur '@/lib/supabase'
// (URL prod). Ce spec fige donc le CONTRAT BASE (colonnes, contraintes,
// policies) que ces exécuteurs supposent.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'

const DAY_MS = 864e5

describe.skipIf(!HAS_KEYS)('Atelier Matching — boucle complète', () => {
  const STAMP = Date.now()
  const TEST_EMAIL = `atelier-agent-${STAMP}@megga-test.local`
  const TEST_PASSWORD = 'Test-Password-123!'

  let service: SupabaseClient
  let agent: SupabaseClient
  let agencyId: string
  let userId: string
  let propertyId: string
  let contactId: string
  let marketListingId: string
  let internalMatchId: string
  let dealId: string

  beforeAll(async () => {
    service = serviceRoleClient()

    // ── Agence + agent authentifié (pattern auth-rpc.spec.ts) ──
    const { data: agency, error: aErr } = await service
      .from('agencies')
      .insert({ name: `Atelier QA ${STAMP}`, slug: `atelier-qa-${STAMP}` })
      .select('id')
      .single()
    if (aErr) throw new Error(`agency: ${aErr.message}`)
    agencyId = agency.id

    const { data: user, error: uErr } = await service.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: 'Atelier QA', role: 'agent' },
    })
    if (uErr) throw new Error(`user: ${uErr.message}`)
    userId = user.user!.id

    const { error: pErr } = await service
      .from('profiles')
      .upsert({ id: userId, email: TEST_EMAIL, full_name: 'Atelier QA', role: 'agent', agency_id: agencyId })
    if (pErr) throw new Error(`profile: ${pErr.message}`)

    agent = createClient(URL, process.env.SUPABASE_TEST_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: sErr } = await agent.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD })
    if (sErr) throw new Error(`signin: ${sErr.message}`)

    // ── Bien interne actif + acheteur + annonce de veille marché ──
    // status 'draft' à dessein : un bien 'active' est PUBLIC (marketplace) et
    // polluerait les suites RLS globales (rls.spec / rls-isolation-properties
    // assertent « anon/autres agences ne voient aucune row »). La boucle testée
    // ici ne dépend pas du statut du bien (FK uniquement).
    const { data: prop, error: prErr } = await service
      .from('properties')
      .insert({
        agency_id: agencyId,
        title: `Atelier QA — 5 pièces Carouge ${STAMP}`,
        type: 'apartment',
        status: 'draft',
        price: 1100000,
        rooms: 5,
        surface_m2: 120,
        city: 'Carouge',
        canton: 'GE',
      })
      .select('id')
      .single()
    if (prErr) throw new Error(`property: ${prErr.message}`)
    propertyId = prop.id

    const { data: contact, error: cErr } = await service
      .from('contacts')
      .insert({
        agency_id: agencyId,
        first_name: 'Martin',
        last_name: 'Testmatch',
        email: `martin-${STAMP}@megga-test.local`,
        type: 'buyer',
        search_criteria: { budget_min: 900000, budget_max: 1300000, zones: ['Carouge'], type: 'apartment' },
      })
      .select('id')
      .single()
    if (cErr) throw new Error(`contact: ${cErr.message}`)
    contactId = contact.id

    const { data: ml, error: mlErr } = await service
      .from('market_listings')
      .insert({
        source_id: `atelier-qa-${STAMP}`,
        source_portal: 'flatfox',
        title: 'Atelier QA — annonce de veille',
        city: 'Carouge',
        canton: 'GE',
        type: 'apartment',
        transaction_type: 'buy',
        price: 980000,
        status: 'active',
      })
      .select('id')
      .single()
    if (mlErr) throw new Error(`market_listing: ${mlErr.message}`)
    marketListingId = ml.id
  })

  afterAll(async () => {
    // matches/transactions/contacts/properties/reminders/events cascadent avec l'agence
    if (marketListingId) await service.from('market_listings').delete().eq('id', marketListingId)
    if (agencyId) await service.from('agencies').delete().eq('id', agencyId)
    if (userId) await service.auth.admin.deleteUser(userId)
  })

  // ── 1. Bug réparé : un match marché s'insère SANS property_id ──────────
  it('insère un match marché sans property_id (cassé avant 20260610_001)', async () => {
    const { data, error } = await service
      .from('matches')
      .insert({
        agency_id: agencyId,
        contact_id: contactId,
        market_listing_id: marketListingId,
        score: 72,
        reasons: { budget: { match: true, score: 30, detail: 'Dans le budget' } },
        status: 'suggested',
        source: 'market',
      })
      .select('id, property_id')
      .single()
    expect(error).toBeNull()
    expect(data!.property_id).toBeNull()
  })

  // ── 2. CHECK : au moins une cible ───────────────────────────────────────
  it('refuse un match sans property_id NI market_listing_id (CHECK)', async () => {
    const { error } = await service.from('matches').insert({
      agency_id: agencyId,
      contact_id: contactId,
      score: 50,
      status: 'suggested',
      source: 'internal',
    })
    expect(error).not.toBeNull()
    expect(error!.message).toContain('matches_target_check')
  })

  // ── 3. Dédup dure par couple (contact, bien) ────────────────────────────
  it('refuse un doublon (contact, property) — index unique', async () => {
    const { data, error } = await service
      .from('matches')
      .insert({
        agency_id: agencyId,
        contact_id: contactId,
        property_id: propertyId,
        score: 95,
        reasons: {
          budget: { match: true, score: 30, detail: 'Dans le budget' },
          zone: { match: true, score: 25, detail: 'Carouge correspond' },
        },
        status: 'suggested',
        source: 'internal',
      })
      .select('id')
      .single()
    expect(error).toBeNull()
    internalMatchId = data!.id

    const { error: dupErr } = await service.from('matches').insert({
      agency_id: agencyId,
      contact_id: contactId,
      property_id: propertyId,
      score: 60,
      status: 'suggested',
      source: 'internal',
    })
    expect(dupErr).not.toBeNull()
    expect(dupErr!.code).toBe('23505') // unique_violation
  })

  // ── 4. Geste « Envoyer » en tant qu'agent (RLS réelle) ──────────────────
  it("Envoyer : match→sent + deal new_lead + timeline + reminder +5 j (agent, RLS)", async () => {
    // a. match → sent (writes execSendDossier §1)
    const { error: mErr } = await agent
      .from('matches')
      .update({ status: 'sent', sent_via: 'email', sent_at: new Date().toISOString() })
      .eq('id', internalMatchId)
    expect(mErr).toBeNull()

    // b. deal new_lead (§2 — aucun deal actif existant → création)
    const { data: deal, error: dErr } = await agent
      .from('transactions')
      .insert({
        agency_id: agencyId,
        contact_buyer_id: contactId,
        property_id: propertyId,
        assigned_to: userId,
        stage: 'new_lead',
        status: 'active',
      })
      .select('id, stage')
      .single()
    expect(dErr).toBeNull()
    expect(deal!.stage).toBe('new_lead')
    dealId = deal!.id

    // c. timeline contact (§3) — policy INSERT agence NOUVELLE (20260610_001) :
    // avant la migration cet insert était rejeté (super-admin uniquement)
    const { error: eErr } = await agent.from('activity_events').insert({
      agency_id: agencyId,
      actor_id: userId,
      actor_kind: 'user',
      action: 'dossier_envoye',
      entity_type: 'contact',
      entity_id: contactId,
      category: 'deal',
      severity: 'info',
      object_label: 'Martin Testmatch · Atelier QA',
      metadata: { match_id: internalMatchId, deal_id: dealId, canal: 'email' },
    })
    expect(eErr).toBeNull()

    // d. nextAction +5 j (§4)
    const { data: rem, error: rErr } = await agent
      .from('reminders')
      .insert({
        agency_id: agencyId,
        contact_id: contactId,
        property_id: propertyId,
        transaction_id: dealId,
        match_id: internalMatchId,
        type: 'follow_up_sent_property',
        trigger_rule: 'manual',
        trigger_days: 5,
        trigger_at: new Date(Date.now() + 5 * DAY_MS).toISOString(),
        status: 'pending',
        channel: 'task',
        message_template: 'Sans réponse au dossier — relancer Martin Testmatch',
      })
      .select('id, trigger_at')
      .single()
    expect(rErr).toBeNull()
    const dueIn = new Date(rem!.trigger_at).getTime() - Date.now()
    expect(dueIn).toBeGreaterThan(4.9 * DAY_MS)
    expect(dueIn).toBeLessThan(5.1 * DAY_MS)

    // e. relecture agent : tout est visible dans son agence
    const { data: seen } = await agent
      .from('matches')
      .select('status, sent_via')
      .eq('id', internalMatchId)
      .single()
    expect(seen!.status).toBe('sent')
    expect(seen!.sent_via).toBe('email')

    const { data: events } = await agent
      .from('activity_events')
      .select('action')
      .eq('entity_id', contactId)
      .eq('action', 'dossier_envoye')
    expect(events!.length).toBe(1)
  })

  // ── 5. Geste « Plus tard » + réactivation ───────────────────────────────
  it('Plus tard : snoozed_until +7 j + reminder custom ; réactivation', async () => {
    const until = new Date(Date.now() + 7 * DAY_MS).toISOString()
    const { error: sErr } = await agent
      .from('matches')
      .update({ snoozed_until: until })
      .eq('id', internalMatchId)
    expect(sErr).toBeNull()

    const { error: rErr } = await agent.from('reminders').insert({
      agency_id: agencyId,
      contact_id: contactId,
      match_id: internalMatchId,
      type: 'custom',
      trigger_rule: 'manual',
      trigger_days: 7,
      trigger_at: until,
      status: 'pending',
      channel: 'notification',
      message_template: 'Martin Testmatch — acheteur reporté, de retour dans la file matching',
    })
    expect(rErr).toBeNull()

    // wake : snoozed_until=null + reminder custom annulé
    const { error: wErr } = await agent
      .from('matches')
      .update({ snoozed_until: null })
      .eq('id', internalMatchId)
    expect(wErr).toBeNull()
    const { error: cErr } = await agent
      .from('reminders')
      .update({ status: 'cancelled' })
      .eq('match_id', internalMatchId)
      .eq('type', 'custom')
      .in('status', ['pending', 'triggered'])
    expect(cErr).toBeNull()

    const { data: m } = await agent.from('matches').select('snoozed_until').eq('id', internalMatchId).single()
    expect(m!.snoozed_until).toBeNull()
  })

  // ── 6. Geste « Écarter » : définitif, le couple reste en base ───────────
  it('Écarter : status=ignored — le couple (contact, bien) reste réservé', async () => {
    const { error } = await agent
      .from('matches')
      .update({ status: 'ignored' })
      .eq('id', internalMatchId)
    expect(error).toBeNull()

    // Le moteur vérifie l'existence AVANT d'insérer (toute statut confondu) :
    // la row écartée bloque toute re-proposition du couple.
    const { data: existing } = await service
      .from('matches')
      .select('id')
      .eq('contact_id', contactId)
      .eq('property_id', propertyId)
      .maybeSingle()
    expect(existing).not.toBeNull()
  })

  // ── 7. Deal ↔ bien de veille marché (colonne 20260610_001) ──────────────
  it('rattache un deal à un bien de veille (transactions.market_listing_id)', async () => {
    const { data, error } = await agent
      .from('transactions')
      .insert({
        agency_id: agencyId,
        contact_buyer_id: contactId,
        market_listing_id: marketListingId,
        assigned_to: userId,
        stage: 'new_lead',
        status: 'active',
      })
      .select('id, property_id, market_listing_id')
      .single()
    expect(error).toBeNull()
    expect(data!.property_id).toBeNull()
    expect(data!.market_listing_id).toBe(marketListingId)
  })

  // ── 8. RLS : l'extérieur ne voit rien ───────────────────────────────────
  it('un client anonyme ne voit aucun match ni reminder de cette agence', async () => {
    const anon = anonClient()
    const { data: matches } = await anon.from('matches').select('id').eq('agency_id', agencyId)
    expect(matches ?? []).toHaveLength(0)
    const { data: reminders } = await anon.from('reminders').select('id').eq('agency_id', agencyId)
    expect(reminders ?? []).toHaveLength(0)
  })
})
