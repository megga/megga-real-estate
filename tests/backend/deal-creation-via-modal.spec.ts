// Regression — la modale « Nouveau deal » (Pipeline v2, remplace le drawer)
// effectue 3 écritures : (1) contact si « Nouveau », (2) transaction avec
// price_offered (la valeur du deal est enfin persistée — le drawer ne
// l'écrivait pas), (3) reminder « Premier suivi » à J+2 (type custom,
// kind call) qui devient la prochaine action de la carte kanban.
// Ce spec rejoue ces flux côté Supabase pour que toute régression casse la CI.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('regression — NewDealModal insert flows', () => {
  let setup: TwoAgenciesSetup
  let propertyId: string
  const createdContactIds: string[] = []
  const createdTxIds: string[] = []
  const createdReminderIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const { data: prop, error } = await service
      .from('properties')
      .insert({ agency_id: setup.agencyAId, title: `Modal Test Property ${setup.stamp}`, price: 850000 })
      .select('id')
      .single()
    if (error) throw new Error(`property: ${error.message}`)
    propertyId = prop.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of createdReminderIds) {
      await svc.from('reminders').delete().eq('id', id).then(() => {}, () => {})
    }
    for (const id of createdTxIds) {
      await svc.from('transactions').delete().eq('id', id).then(() => {}, () => {})
    }
    for (const id of createdContactIds) {
      await svc.from('contacts').delete().eq('id', id).then(() => {}, () => {})
    }
    if (propertyId) {
      await svc.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    }
    await setup.cleanup()
  })

  it('contact existant + bien → transaction avec price_offered + reminder « Premier suivi »', async () => {
    const { data: contact } = await setup.clientA
      .from('contacts')
      .insert({
        first_name: 'Existing',
        last_name: `Buyer ${setup.stamp}`,
        email: `existing-${setup.stamp}@megga-test.local`,
        type: 'buyer',
        source: 'manual',
        agency_id: setup.agencyAId,
      })
      .select('id')
      .single()
    if (contact?.id) createdContactIds.push(contact.id)

    // Modale : transaction à l'étape choisie (to-qualify → to_qualify),
    // valeur reprise du prix du bien (price_offered).
    const { data: tx, error } = await setup.clientA
      .from('transactions')
      .insert({
        agency_id: setup.agencyAId,
        property_id: propertyId,
        contact_buyer_id: contact!.id,
        stage: 'to_qualify',
        price_offered: 850000,
      })
      .select('id, stage, contact_buyer_id, property_id, price_offered')
      .single()

    expect(error).toBeNull()
    if (tx?.id) createdTxIds.push(tx.id)
    expect(tx?.contact_buyer_id).toBe(contact!.id)
    expect(tx?.property_id).toBe(propertyId)
    expect(tx?.stage).toBe('to_qualify')
    expect(tx?.price_offered).toBe(850000)

    // Puis le reminder « Premier suivi » à J+2 — la prochaine action du deal.
    const dueAt = new Date()
    dueAt.setDate(dueAt.getDate() + 2)
    const { data: reminder, error: rErr } = await setup.clientA
      .from('reminders')
      .insert({
        agency_id: setup.agencyAId,
        transaction_id: tx!.id,
        contact_id: contact!.id,
        type: 'custom',
        kind: 'call',
        trigger_rule: 'manual',
        trigger_days: 2,
        trigger_at: dueAt.toISOString(),
        status: 'pending',
        channel: 'task',
        message_template: 'Premier suivi',
      })
      .select('id, kind, type, status, trigger_at, transaction_id')
      .single()

    expect(rErr).toBeNull()
    if (reminder?.id) createdReminderIds.push(reminder.id)
    expect(reminder?.kind).toBe('call')
    expect(reminder?.type).toBe('custom')
    expect(reminder?.transaction_id).toBe(tx!.id)
    // Échéance ≈ J+2 (tolérance 1 h autour de la cible)
    const delta = Math.abs(new Date(reminder!.trigger_at!).getTime() - dueAt.getTime())
    expect(delta).toBeLessThan(3600_000)
  })

  it('nouveau contact + sans bien → contact puis transaction (buyer, source manual)', async () => {
    const { data: contact, error: cErr } = await setup.clientA
      .from('contacts')
      .insert({
        first_name: 'Fresh',
        last_name: `Lead ${setup.stamp}`,
        email: `fresh-${setup.stamp}@megga-test.local`,
        phone: '+41 79 999 88 77',
        type: 'buyer',
        source: 'manual',
        agency_id: setup.agencyAId,
      })
      .select('id')
      .single()
    expect(cErr).toBeNull()
    if (contact?.id) createdContactIds.push(contact.id)

    const { data: tx, error } = await setup.clientA
      .from('transactions')
      .insert({
        agency_id: setup.agencyAId,
        contact_buyer_id: contact!.id,
        stage: 'active_search', // modale : 'searching' → 'active_search'
        price_offered: 1200000, // valeur saisie manuellement
      })
      .select('id, stage, contact_buyer_id, property_id, price_offered')
      .single()

    expect(error).toBeNull()
    if (tx?.id) createdTxIds.push(tx.id)
    expect(tx?.property_id).toBeNull()
    expect(tx?.stage).toBe('active_search')
    expect(tx?.price_offered).toBe(1200000)
  })

  it('reminders.kind rejette une valeur hors enum UI (CHECK constraint)', async () => {
    const { error } = await setup.clientA
      .from('reminders')
      .insert({
        agency_id: setup.agencyAId,
        type: 'custom',
        kind: 'teleportation', // hors ('call','visit','kyc','match','offer','note')
        trigger_rule: 'manual',
        status: 'pending',
        channel: 'task',
        trigger_at: new Date().toISOString(),
      })
      .select('id')

    expect(error).toBeTruthy()
    expect(error?.message.toLowerCase()).toMatch(/check|constraint|kind/)
  })

  it('garde FK : transaction avec un contact inexistant échoue (filet serveur)', async () => {
    const { error } = await setup.clientA
      .from('transactions')
      .insert({
        agency_id: setup.agencyAId,
        property_id: propertyId,
        contact_buyer_id: '00000000-0000-0000-0000-000000000001',
        stage: 'active_search',
      })
      .select('id')

    expect(error).toBeTruthy()
    expect(error?.message.toLowerCase()).toMatch(/foreign|violates|not present/)
  })
})
