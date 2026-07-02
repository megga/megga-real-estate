// Apprentissage T2 par l'exemple — tables de corrections.
// (a) whatsapp_message_corrections : corpus appris (contenu client) → RLS doit
//     isoler les agences. (b) whatsapp_rejected_drafts : éphémère, PK
//     (profile_id, contact_id) → upsert = au plus 1 brouillon par agent×contact.
// La logique de capture/appariement vit dans le webhook (deno check + manuel).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, findLeakedRows, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('apprentissage corrections — tables + RLS', () => {
  let setup: TwoAgenciesSetup
  let contactAId = ''
  const corrIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    const { data: c, error: ec } = await svc.from('contacts')
      .insert({
        agency_id: setup.agencyAId, first_name: 'Client', last_name: `Corr ${setup.stamp}`,
        email: `corr-${Math.random()}@megga-test.local`, type: 'buyer',
      })
      .select('id').single()
    if (ec) throw new Error(`contact: ${ec.message}`)
    contactAId = c.id

    const { data, error } = await svc.from('whatsapp_message_corrections').insert([
      { profile_id: setup.agentAId, agency_id: setup.agencyAId, contact_id: contactAId,
        megga_draft: 'Bonjour Monsieur Dupont.', agent_final: 'Salut Marc.' },
      { profile_id: setup.agentBId, agency_id: setup.agencyBId, contact_id: null,
        megga_draft: 'Cordialement.', agent_final: 'À+' },
    ]).select('id')
    if (error) throw new Error(`corrections: ${error.message}`) // attrape colonne/RLS manquante
    for (const r of data ?? []) corrIds.push(r.id)
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (corrIds.length) await svc.from('whatsapp_message_corrections').delete().in('id', corrIds)
    await svc.from('whatsapp_rejected_drafts').delete().eq('profile_id', setup.agentAId)
    if (contactAId) await svc.from('contacts').delete().eq('id', contactAId)
    await setup.cleanup()
  })

  it('agent A ne voit que les corrections de SON agence (0 fuite)', async () => {
    const leaked = await findLeakedRows(setup.clientA, 'whatsapp_message_corrections', setup.agencyAId)
    expect(leaked).toEqual([])
  })

  it("agent B ne voit pas les corrections de l'agence A", async () => {
    const { data } = await setup.clientB.from('whatsapp_message_corrections')
      .select('id').in('id', corrIds)
    // B ne voit que la sienne, jamais celle de A
    expect((data ?? []).length).toBeLessThanOrEqual(1)
    const aId = corrIds[0]
    expect((data ?? []).some((r) => r.id === aId)).toBe(false)
  })

  it('anon ne voit aucune correction', async () => {
    const { data } = await anonClient().from('whatsapp_message_corrections').select('id').in('id', corrIds)
    expect(data ?? []).toEqual([])
  })

  it('whatsapp_rejected_drafts : upsert (PK agent×contact) garde 1 seul brouillon', async () => {
    const svc = serviceRoleClient()
    const up = (draft: string) => svc.from('whatsapp_rejected_drafts').upsert(
      { profile_id: setup.agentAId, agency_id: setup.agencyAId, contact_id: contactAId, draft },
      { onConflict: 'profile_id,contact_id' },
    )
    expect((await up('brouillon 1')).error).toBeNull()
    expect((await up('brouillon 2')).error).toBeNull()
    const { data } = await svc.from('whatsapp_rejected_drafts')
      .select('draft').eq('profile_id', setup.agentAId).eq('contact_id', contactAId)
    expect((data ?? []).length).toBe(1)
    expect((data ?? [])[0]?.draft).toBe('brouillon 2') // remplacé
  })
})
