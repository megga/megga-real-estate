// Engagements actionnables (WhatsApp Conversation Intelligence).
// (a) whatsapp_followup_suggestions : RLS isole les agences (l'agent ne voit que les
//     siennes). (b) accept_followup_suggestion : crée un VRAI rappel + marque accepté,
//     refuse hors agence. (c) dédup (contact_id, dedup_key) : pas de doublon au re-run.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('engagements actionnables — table + RLS + accept', () => {
  let setup: TwoAgenciesSetup
  let contactAId = ''
  const suggIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    const { data: c, error: ec } = await svc.from('contacts')
      .insert({
        agency_id: setup.agencyAId, first_name: 'Client', last_name: `Followup ${setup.stamp}`,
        email: `fu-${Math.random()}@megga-test.local`, type: 'buyer',
      })
      .select('id').single()
    if (ec) throw new Error(`contact: ${ec.message}`)
    contactAId = c.id

    const { data, error } = await svc.from('whatsapp_followup_suggestions').insert([
      { agency_id: setup.agencyAId, contact_id: contactAId, owner: 'agent',
        action: 'Rappeler le client', due_at: '2026-07-02T07:00:00.000Z', kind: 'commitment', dedup_key: `k-${setup.stamp}-1` },
      { agency_id: setup.agencyBId, contact_id: contactAId, owner: 'agent',
        action: 'Envoyer le dossier', due_at: null, kind: 'commitment', dedup_key: `k-${setup.stamp}-2` },
    ]).select('id')
    if (error) throw new Error(`followups: ${error.message}`) // attrape colonne/RLS/CHECK manquante
    for (const r of data ?? []) suggIds.push(r.id)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    // les reminders créés par accept sont rattachés au contact → nettoyés avec lui
    if (contactAId) await svc.from('reminders').delete().eq('contact_id', contactAId)
    if (suggIds.length) await svc.from('whatsapp_followup_suggestions').delete().in('id', suggIds)
    if (contactAId) await svc.from('contacts').delete().eq('id', contactAId)
    await setup.cleanup()
  })

  it('agent A ne voit que les suggestions de SON agence (0 fuite)', async () => {
    const leaked = await findLeakedRows(setup.clientA, 'whatsapp_followup_suggestions', setup.agencyAId)
    expect(leaked).toEqual([])
  })

  it("agent B ne voit pas les suggestions de l'agence A", async () => {
    const { data } = await setup.clientB.from('whatsapp_followup_suggestions').select('id').in('id', suggIds)
    const aId = suggIds[0]
    expect((data ?? []).some((r) => r.id === aId)).toBe(false)
  })

  it('anon ne voit aucune suggestion', async () => {
    const { data } = await anonClient().from('whatsapp_followup_suggestions').select('id').in('id', suggIds)
    expect(data ?? []).toEqual([])
  })

  it('accept (agent A) crée un rappel daté + marque accepté', async () => {
    const sId = suggIds[0]
    const { data: rid, error } = await setup.clientA.rpc('accept_followup_suggestion', { p_id: sId })
    expect(error).toBeNull()
    expect(rid).toBeTruthy()

    const svc = serviceRoleClient()
    const { data: rem } = await svc.from('reminders').select('trigger_at, message_template, type, channel, status').eq('id', rid as string).single()
    expect(rem?.type).toBe('custom')
    expect(rem?.channel).toBe('task')
    expect(rem?.status).toBe('pending')
    expect(rem?.message_template).toBe('Rappeler le client')
    expect(new Date(rem!.trigger_at as string).toISOString()).toBe('2026-07-02T07:00:00.000Z')

    const { data: sug } = await svc.from('whatsapp_followup_suggestions').select('status, reminder_id').eq('id', sId).single()
    expect(sug?.status).toBe('accepted')
    expect(sug?.reminder_id).toBe(rid)
  })

  it('ré-accepter est idempotent (renvoie le même rappel, pas de doublon)', async () => {
    const sId = suggIds[0]
    const svc = serviceRoleClient()
    const { count: before } = await svc.from('reminders').select('id', { count: 'exact', head: true }).eq('contact_id', contactAId)
    const { data: rid2, error } = await setup.clientA.rpc('accept_followup_suggestion', { p_id: sId })
    expect(error).toBeNull()
    const { count: after } = await svc.from('reminders').select('id', { count: 'exact', head: true }).eq('contact_id', contactAId)
    expect(after).toBe(before) // aucun rappel supplémentaire
    expect(rid2).toBeTruthy()
  })

  it("accept refusé hors de son agence (B ne peut pas accepter une suggestion de A)", async () => {
    const { error } = await setup.clientB.rpc('accept_followup_suggestion', { p_id: suggIds[0] })
    expect(error).not.toBeNull()
  })

  it('dédup (contact_id, dedup_key) : upsert ignoreDuplicates garde la 1re', async () => {
    const svc = serviceRoleClient()
    const key = `k-dedup-${setup.stamp}`
    const up = (action: string) => svc.from('whatsapp_followup_suggestions').upsert(
      { agency_id: setup.agencyAId, contact_id: contactAId, owner: 'agent', action, kind: 'commitment', dedup_key: key },
      { onConflict: 'contact_id,dedup_key', ignoreDuplicates: true },
    )
    expect((await up('Action initiale')).error).toBeNull()
    expect((await up('Action remplaçante')).error).toBeNull()
    const { data } = await svc.from('whatsapp_followup_suggestions')
      .select('id, action').eq('contact_id', contactAId).eq('dedup_key', key)
    expect((data ?? []).length).toBe(1)
    expect((data ?? [])[0]?.action).toBe('Action initiale') // 1re conservée
    for (const r of data ?? []) suggIds.push(r.id) // pour le teardown
  })
})
