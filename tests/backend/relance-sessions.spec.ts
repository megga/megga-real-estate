// Lot 4 « Aujourd'hui » — la session de relance persiste et se reprend.
// Migration : 20260803190000_relance_sessions.sql
//
// Ce que ce fichier verrouille :
//  1. UNE SEULE session ouverte par agent. C'est ce qui rend « reprendre »
//     déterministe : sans cette contrainte, deux onglets ouvriraient deux
//     sessions et la reprise ne saurait pas laquelle choisir. L'index partiel
//     l'impose en BASE — la seule garantie qui survit à un double onglet.
//  2. Un contact = un item par session. La reprise se lit par DIFFÉRENCE entre
//     la file du jour et les contacts déjà traités ; un doublon la fausserait.
//  3. Le cloisonnement : un agent ne voit ni n'écrit la session d'un autre.
//  4. Une session close libère la place pour la suivante.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('relance_sessions / relance_items (Lot 4)', () => {
  let setup: TwoAgenciesSetup
  let contactA = ''
  let contactB = ''

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()
    const { data, error } = await svc
      .from('contacts')
      .insert([
        { agency_id: setup.agencyAId, first_name: 'Rel', last_name: `A ${setup.stamp}`, type: 'buyer' },
        { agency_id: setup.agencyBId, first_name: 'Rel', last_name: `B ${setup.stamp}`, type: 'buyer' },
      ])
      .select('id, agency_id')
    if (error) throw new Error(`contacts: ${error.message}`)
    contactA = data!.find((c) => c.agency_id === setup.agencyAId)!.id as string
    contactB = data!.find((c) => c.agency_id === setup.agencyBId)!.id as string
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    // `relance_items` tombe en cascade avec sa session.
    await svc.from('relance_sessions').delete().in('agent_id', [setup.agentAId, setup.agentBId])
    await svc.from('contacts').delete().in('id', [contactA, contactB])
    await setup.cleanup()
  })

  /** Ouvre une session pour A et rend son id. */
  const openForA = async (): Promise<string> => {
    const { data, error } = await setup.clientA
      .from('relance_sessions')
      .insert({ agency_id: setup.agencyAId, agent_id: setup.agentAId })
      .select('id')
      .single()
    if (error) throw new Error(`open: ${error.message}`)
    return data!.id as string
  }

  it('⚠ refuse une DEUXIÈME session ouverte pour le même agent', async () => {
    const first = await openForA()
    const { error } = await setup.clientA
      .from('relance_sessions')
      .insert({ agency_id: setup.agencyAId, agent_id: setup.agentAId })
    expect(error, 'la 2e session ouverte doit être refusée').not.toBeNull()

    await serviceRoleClient().from('relance_sessions').delete().eq('id', first)
  })

  it('un contact ne figure qu’une fois par session, et son sort se réécrit', async () => {
    const session = await openForA()
    const base = { session_id: session, agency_id: setup.agencyAId, contact_id: contactA }

    const first = await setup.clientA.from('relance_items')
      .upsert({ ...base, status: 'sent', copied_at: new Date().toISOString() }, { onConflict: 'session_id,contact_id' })
    expect(first.error).toBeNull()

    const second = await setup.clientA.from('relance_items')
      .upsert({ ...base, status: 'skipped' }, { onConflict: 'session_id,contact_id' })
    expect(second.error).toBeNull()

    const { data } = await serviceRoleClient()
      .from('relance_items').select('status').eq('session_id', session)
    expect(data, 'un seul item pour ce contact').toHaveLength(1)
    expect(data![0].status).toBe('skipped')

    await serviceRoleClient().from('relance_sessions').delete().eq('id', session)
  })

  it('⚠ un agent ne voit ni n’écrit la session d’une autre agence', async () => {
    const session = await openForA()

    // B ne la voit pas.
    const { data: seenByB } = await setup.clientB
      .from('relance_sessions').select('id').eq('id', session)
    expect(seenByB ?? [], 'B ne doit pas voir la session de A').toHaveLength(0)

    // B ne peut pas y attacher un item.
    const { error } = await setup.clientB.from('relance_items').insert({
      session_id: session, agency_id: setup.agencyBId, contact_id: contactB, status: 'sent',
    })
    expect(error, 'B ne doit pas pouvoir écrire dans la session de A').not.toBeNull()

    await serviceRoleClient().from('relance_sessions').delete().eq('id', session)
  })

  it('une session close libère la place pour la suivante', async () => {
    const first = await openForA()
    const { error: closeErr } = await setup.clientA
      .from('relance_sessions').update({ closed_at: new Date().toISOString() }).eq('id', first)
    expect(closeErr).toBeNull()

    const second = await openForA()
    expect(second).not.toBe(first)

    await serviceRoleClient().from('relance_sessions').delete().in('id', [first, second])
  })
})
