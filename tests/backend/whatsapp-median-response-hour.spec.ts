// whatsapp_median_response_hour — RPC pur SQL (migration 20260710191000)
//
//  Item audit Fable « Relances au timing appris du client » : heure médiane de
//  réponse d'un contact = paires out→in (un ENTRANT qui suit un SORTANT dans le
//  fil), heure murale Europe/Zurich, percentile_disc(0.5) + count.
//
//  Test 1 — Médiane + comptage : 5 paires aux heures Zurich [10,10,11,14,20]
//    → n=5, median_hour=11. Vérifie aussi la conversion TZ (UTC → Europe/Zurich).
//  Test 2 — Signal faible : 3 paires → n=3 (< 5 ; le repli 09:00 est côté appelant).
//  Test 3 — Aucune paire : un contact sans out→in → n=0, median_hour NULL.
//  Test 4 — Gate : un agent authentifié est rejeté (EXECUTE = service_role seul).
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('whatsapp_median_response_hour — heure médiane de réponse', () => {
  let setup: TwoAgenciesSetup
  // Init paresseuse : serviceRoleClient() jette sans clés → hors du corps describe
  // (qui s'exécute à la collecte, avant skipIf). Assigné dans beforeAll.
  let svc: ReturnType<typeof serviceRoleClient>
  const contactIds: string[] = []
  let seq = 0

  // Un contact dans l'agence A.
  const mkContact = async (tag: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'MED', last_name: `${tag}-${setup.stamp}`,
    }).select('id').single()
    if (error) throw new Error(`contact ${tag}: ${error.message}`)
    contactIds.push(data.id)
    return data.id
  }

  // Un message daté (created_at explicite) — direction ∈ inbound|outbound.
  const insertMsg = async (contactId: string, direction: 'inbound' | 'outbound', createdAt: string) => {
    const { error } = await svc.from('whatsapp_messages').insert({
      provider: 'openwa', provider_message_id: `med-${setup.stamp}-${seq++}`,
      direction, wa_from: direction === 'inbound' ? '41790000001' : '41790000099',
      contact_id: contactId, agency_id: setup.agencyAId, status: 'received',
      created_at: createdAt,
    })
    if (error) throw new Error(`msg: ${error.message}`)
  }

  // Une paire out→in : sortant puis entrant (réponse). L'entrant porte l'heure.
  const pair = async (contactId: string, outISO: string, inISO: string) => {
    await insertMsg(contactId, 'outbound', outISO)
    await insertMsg(contactId, 'inbound', inISO)
  }

  const callRpc = async (contactId: string) => {
    const { data, error } = await svc.rpc('whatsapp_median_response_hour', { p_contact_id: contactId })
    if (error) throw new Error(`rpc: ${error.message}`)
    const row = (Array.isArray(data) ? data[0] : data) as { n: number; median_hour: number | null }
    return row
  }

  let c5: string, c3: string, c0: string

  beforeAll(async () => {
    svc = serviceRoleClient()
    setup = await setupTwoAgencies()

    // Contact « 5 paires » — heures Zurich (CEST, UTC+2) : 10,10,11,14,20 → médiane 11.
    c5 = await mkContact('c5')
    await pair(c5, '2026-07-01T07:58:00Z', '2026-07-01T08:00:00Z') // 10:00 Zurich
    await pair(c5, '2026-07-02T07:58:00Z', '2026-07-02T08:00:00Z') // 10:00
    await pair(c5, '2026-07-03T08:58:00Z', '2026-07-03T09:00:00Z') // 11:00
    await pair(c5, '2026-07-04T11:58:00Z', '2026-07-04T12:00:00Z') // 14:00
    await pair(c5, '2026-07-05T17:58:00Z', '2026-07-05T18:00:00Z') // 20:00

    // Contact « 3 paires » — toutes à 09:00 Zurich (07:00Z).
    c3 = await mkContact('c3')
    await pair(c3, '2026-07-01T06:58:00Z', '2026-07-01T07:00:00Z')
    await pair(c3, '2026-07-02T06:58:00Z', '2026-07-02T07:00:00Z')
    await pair(c3, '2026-07-03T06:58:00Z', '2026-07-03T07:00:00Z')

    // Contact « aucune paire » — que des entrants (jamais précédés d'un sortant).
    c0 = await mkContact('c0')
    await insertMsg(c0, 'inbound', '2026-07-01T08:00:00Z')
    await insertMsg(c0, 'inbound', '2026-07-02T08:00:00Z')
  })

  afterAll(async () => {
    if (contactIds.length) {
      await svc.from('whatsapp_messages').delete().in('contact_id', contactIds).then(() => {}, () => {})
      await svc.from('contacts').delete().in('id', contactIds).then(() => {}, () => {})
    }
    if (setup) await setup.cleanup()
  })

  it('5 paires out→in → n=5 et médiane 11h (Europe/Zurich)', async () => {
    const row = await callRpc(c5)
    expect(row.n).toBe(5)
    expect(row.median_hour).toBe(11)
  })

  it('3 paires → n=3 (signal faible, repli décidé côté appelant)', async () => {
    const row = await callRpc(c3)
    expect(row.n).toBe(3)
    expect(row.median_hour).toBe(9) // 09:00 Zurich pour info ; l'appelant ignore n<5
  })

  it('aucune paire out→in → n=0, median_hour NULL', async () => {
    const row = await callRpc(c0)
    expect(row.n).toBe(0)
    expect(row.median_hour).toBeNull()
  })

  it('gate : un agent authentifié est rejeté (EXECUTE = service_role seul)', async () => {
    const { error } = await setup.clientA.rpc('whatsapp_median_response_hour', { p_contact_id: c5 })
    expect(error).toBeTruthy()
  })
})
