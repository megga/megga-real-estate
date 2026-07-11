// Brouillon de relance (voix de l'agent), généré à l'acceptation d'un suivi WhatsApp.
// La GÉNÉRATION (DeepSeek) vit dans l'edge fn whatsapp-followup-draft et est couverte
// par le helper pur (_shared/whatsapp-followup-draft.test.ts). Ici on vérifie l'ASSISE
// données du migration 20260711140000 :
//   (a) accept_followup_suggestion crée toujours un rappel NU (draft_message null) — le
//       brouillon est une surcouche best-effort, jamais un prérequis ;
//   (b) reminders.draft_message existe et accepte du texte ;
//   (c) RLS : agent A écrit le brouillon de SON rappel, agent B ne peut pas (isolation).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('brouillon de relance — colonne + rappel nu + RLS', () => {
  let setup: TwoAgenciesSetup
  let contactAId = ''
  let suggAId = ''
  let reminderAId = ''

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    const { data: c, error: ec } = await svc.from('contacts')
      .insert({
        agency_id: setup.agencyAId, first_name: 'Draft', last_name: `Relance ${setup.stamp}`,
        email: `draft-${Math.random()}@megga-test.local`, type: 'buyer', source: 'manual',
      })
      .select('id').single()
    if (ec) throw new Error(`contact: ${ec.message}`)
    contactAId = c.id

    const { data: s, error: es } = await svc.from('whatsapp_followup_suggestions')
      .insert({
        agency_id: setup.agencyAId, contact_id: contactAId, owner: 'agent',
        action: 'Relancer le contact', due_at: '2026-07-15T07:00:00.000Z', kind: 'commitment',
        dedup_key: `draft-${setup.stamp}`,
      })
      .select('id').single()
    if (es) throw new Error(`suggestion: ${es.message}`)
    suggAId = s.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (contactAId) await svc.from('reminders').delete().eq('contact_id', contactAId).then(() => {}, () => {})
    if (suggAId) await svc.from('whatsapp_followup_suggestions').delete().eq('id', suggAId).then(() => {}, () => {})
    if (contactAId) await svc.from('contacts').delete().eq('id', contactAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('accept crée un rappel NU (draft_message null par défaut)', async () => {
    const { data: rid, error } = await setup.clientA.rpc('accept_followup_suggestion', { p_id: suggAId })
    expect(error).toBeNull()
    expect(rid).toBeTruthy()
    reminderAId = rid as string

    const svc = serviceRoleClient()
    const { data: rem } = await svc.from('reminders')
      .select('draft_message, message_template').eq('id', reminderAId).single()
    expect(rem?.draft_message ?? null).toBeNull()       // rappel NU : aucun brouillon tant que rien n'est généré
    expect(rem?.message_template).toBe('Relancer le contact') // le libellé d'action, pas un message client
  })

  it('agent A écrit le brouillon de SON rappel (colonne draft_message)', async () => {
    const draft = 'Bonjour, je reviens vers vous au sujet de votre recherche — êtes-vous toujours intéressé ?'
    const { error } = await setup.clientA.from('reminders')
      .update({ draft_message: draft }).eq('id', reminderAId).eq('agency_id', setup.agencyAId)
    expect(error).toBeNull()

    const svc = serviceRoleClient()
    const { data: rem } = await svc.from('reminders').select('draft_message').eq('id', reminderAId).single()
    expect(rem?.draft_message).toBe(draft)
  })

  it('agent B NE PEUT PAS écrire le brouillon du rappel de A (isolation RLS)', async () => {
    const { data: returned } = await setup.clientB.from('reminders')
      .update({ draft_message: 'injection inter-agence' }).eq('id', reminderAId).select('id')
    expect(returned, 'agent B a fui une écriture sur le rappel de A').toEqual([])

    const svc = serviceRoleClient()
    const { data: rem } = await svc.from('reminders').select('draft_message').eq('id', reminderAId).single()
    expect(rem?.draft_message).not.toBe('injection inter-agence') // brouillon de A intact
  })
})
