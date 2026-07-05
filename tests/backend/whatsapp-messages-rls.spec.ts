// RLS isolation — whatsapp_messages. Un agent ne voit que les messages de SON
// agence ; les messages non mappés (agency_id NULL) ne fuitent pas ; et les fils
// copilote 1:1 agent↔MEGGA d'un AUTRE agent de la même agence restent privés.
//
// Comme les autres specs RLS du repo, ce test tourne contre un projet de TEST
// (SUPABASE_TEST_*), pas la prod — setupTwoAgencies crée de vraies agences.
// skipIf saute proprement si les clés de test ne sont pas fournies.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const PASSWORD = 'Test-Password-123!'
const A2_NUMBER = '41790000042' // numéro WhatsApp lié de l'agent A2 (≠ du wa_from générique)

describe.skipIf(!HAS_KEYS)('RLS isolation — whatsapp_messages', () => {
  let setup: TwoAgenciesSetup
  let msgAId: string
  let msgBId: string
  let msgOrphanId: string
  // Fil copilote 1:1 d'un 2e agent (A2) de l'agence A.
  let agentA2Id: string
  let clientA2: SupabaseClient
  let msgCopilotA2Id: string     // entrant : wa_from = numéro A2
  let msgCopilotA2ToId: string   // sortant MEGGA→A2 : wa_to = numéro A2 (branche sensible)
  let msgCopilotA2FmtId: string  // entrant, numéro A2 en format national (test normalize_phone)

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    const mk = async (
      agencyId: string | null, pmid: string,
      waFrom = '41790000000', waTo: string | null = null, direction = 'inbound',
    ) => {
      const { data, error } = await service.from('whatsapp_messages').insert({
        provider: 'openwa', provider_message_id: pmid, wa_from: waFrom, wa_to: waTo,
        direction, agency_id: agencyId, body: 'test', status: 'received',
      }).select('id').single()
      if (error) throw new Error(`${pmid}: ${error.message}`)
      return data.id as string
    }
    msgAId = await mk(setup.agencyAId, `pmid-A-${Date.now()}`)
    msgBId = await mk(setup.agencyBId, `pmid-B-${Date.now()}`)
    msgOrphanId = await mk(null, `pmid-orphan-${Date.now()}`)

    // 2e agent DANS L'AGENCE A + son numéro WhatsApp lié → fil copilote privé.
    const emailA2 = `agent-a2-${setup.stamp}@megga-test.local`
    const { data: uA2, error: uErr } = await service.auth.admin.createUser({
      email: emailA2, password: PASSWORD, email_confirm: true,
      user_metadata: { full_name: 'Agent A2', role: 'agent' },
    })
    if (uErr) throw new Error(`userA2: ${uErr.message}`)
    agentA2Id = uA2!.user!.id
    await service.from('profiles').upsert(
      { id: agentA2Id, email: emailA2, full_name: 'Agent A2', role: 'agent', agency_id: setup.agencyAId },
      { onConflict: 'id' },
    )
    const { error: linkErr } = await service.from('whatsapp_agent_links').insert({
      profile_id: agentA2Id, agency_id: setup.agencyAId, wa_number: A2_NUMBER, verified: true,
    })
    if (linkErr) throw new Error(`linkA2: ${linkErr.message}`)
    msgCopilotA2Id = await mk(setup.agencyAId, `pmid-copilotA2-${Date.now()}`, A2_NUMBER)
    // Fil copilote SORTANT (réponse MEGGA → A2) : le numéro d'A2 est en wa_to (branche sensible).
    msgCopilotA2ToId = await mk(setup.agencyAId, `pmid-copilotA2to-${Date.now()}`, 'megga', A2_NUMBER, 'outbound')
    // A2 mais numéro en format NATIONAL (0790000042) ≠ E.164 stocké au lien (41790000042) :
    // le masquage doit tenir via normalize_phone (9 derniers chiffres).
    msgCopilotA2FmtId = await mk(setup.agencyAId, `pmid-copilotA2fmt-${Date.now()}`, '0790000042')

    const c = createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error: siErr } = await c.auth.signInWithPassword({ email: emailA2, password: PASSWORD })
    if (siErr) throw new Error(`signin A2: ${siErr.message}`)
    clientA2 = c
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    for (const id of [msgAId, msgBId, msgOrphanId, msgCopilotA2Id, msgCopilotA2ToId, msgCopilotA2FmtId]) {
      if (id) await service.from('whatsapp_messages').delete().eq('id', id)
    }
    // Supprimer l'user A2 cascade son profil + son whatsapp_agent_links (ON DELETE CASCADE).
    if (agentA2Id) await service.auth.admin.deleteUser(agentA2Id).catch(() => {})
    await setup.cleanup()
  })

  it('agent A voit le message de son agence', async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgAId)
    expect(data).toHaveLength(1)
  })

  it("agent A NE voit PAS le message de l'agence B", async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgBId)
    expect(data ?? []).toHaveLength(0)
  })

  it('agent A NE voit PAS un message non mappé (agency_id NULL)', async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgOrphanId)
    expect(data ?? []).toHaveLength(0)
  })

  it("agent A NE voit PAS le fil copilote 1:1 d'un autre agent de son agence", async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgCopilotA2Id)
    expect(data ?? []).toHaveLength(0)
  })

  it('agent A2 voit son propre fil copilote 1:1', async () => {
    const { data } = await clientA2.from('whatsapp_messages').select('id').eq('id', msgCopilotA2Id)
    expect(data).toHaveLength(1)
  })

  it('agent A NE voit PAS le fil copilote SORTANT (MEGGA→A2, numéro en wa_to)', async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgCopilotA2ToId)
    expect(data ?? []).toHaveLength(0)
  })

  it('le masquage tient si le numéro est écrit en format national (normalize_phone)', async () => {
    const { data } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', msgCopilotA2FmtId)
    expect(data ?? []).toHaveLength(0)
  })
})
