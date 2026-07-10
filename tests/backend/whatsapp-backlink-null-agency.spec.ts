// Back-link des orphelins WhatsApp « agence inconnue » (agency_id NULL) — migration
// 20260710120000. Exercé LIVE contre un projet de TEST (setupTwoAgencies). skipIf
// saute proprement sans les clés SUPABASE_TEST_*.
//
// Le trigger trg_backlink_whatsapp (wrapper) et la passe de réparation partagent le
// helper backlink_whatsapp_orphans_for_contact(). On couvre : rescue classe B via le
// trigger, via l'appel DIRECT du helper (= chemin de la passe de réparation), la
// visibilité RLS, la garde cross-tenant (avec contrôle positif), l'exclusion des
// numéros d'agents, la non-régression classe A, et la garde direction.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('whatsapp back-link — orphelins agency_id NULL (live)', () => {
  let setup: TwoAgenciesSetup
  let service: ReturnType<typeof serviceRoleClient>
  const msgIds: string[] = []
  const contactIds: string[] = []
  const agentLinkIds: string[] = []

  // Numéros à 9 derniers chiffres GLOBALEMENT uniques (la garde d'unicité compte
  // toutes agences) : tail7 dérivé du stamp de setup + index à 2 chiffres par test.
  let tail7 = ''
  let waTo = ''                                          // wa_to dérivé du stamp (jamais un numéro d'agent seedé ailleurs)
  const e164 = (idx: string) => `41${tail7}${idx}`       // 11 chiffres → normalize = last 9
  const national = (idx: string) => `0${tail7}${idx}`    // même numéro normalisé, valeur différente

  const insertOrphan = async (opts: {
    waFrom: string; agencyId: string | null; direction?: 'inbound' | 'outbound'
  }) => {
    const pmid = `pmid-backlink-${setup.stamp}-${opts.waFrom}-${opts.direction ?? 'inbound'}`
    const { data, error } = await service.from('whatsapp_messages').insert({
      provider: 'openwa', provider_message_id: pmid,
      wa_from: opts.waFrom, wa_to: waTo,
      direction: opts.direction ?? 'inbound',
      contact_id: null, agency_id: opts.agencyId,
      body: 'bonjour, je cherche un 3 pièces', status: 'received',
      wa_timestamp: new Date().toISOString(),
    }).select('id').single()
    if (error) throw new Error(`insert orphan: ${error.message}`)
    const id = (data as { id: string }).id
    msgIds.push(id)
    return id
  }

  const createContact = async (agencyId: string, phone: string) => {
    const { data, error } = await service.from('contacts')
      .insert({ agency_id: agencyId, first_name: 'Prospect', last_name: phone.slice(-4), phone, source: 'manual' })
      .select('id').single()
    if (error) throw new Error(`insert contact: ${error.message}`)
    const id = (data as { id: string }).id
    contactIds.push(id)
    return id
  }

  const readMsg = async (id: string) => {
    const { data } = await service.from('whatsapp_messages')
      .select('contact_id, agency_id').eq('id', id).single()
    return data as { contact_id: string | null; agency_id: string | null }
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    service = serviceRoleClient()
    tail7 = setup.stamp.replace(/\D/g, '').slice(-7).padStart(7, '0')
    waTo = `41${tail7}99`                                 // dérivé du stamp → normalize unique à ce run
  })
  afterAll(async () => {
    for (const id of msgIds) await service.from('whatsapp_messages').delete().eq('id', id)
    for (const id of agentLinkIds) await service.from('whatsapp_agent_links').delete().eq('id', id)
    for (const id of contactIds) await service.from('contacts').delete().eq('id', id)
    await setup.cleanup()
  })

  it('classe B : orphelin agency_id NULL → rattaché (contact_id + agency_id posés) à la création de la fiche', async () => {
    const num = e164('11')
    const orphanId = await insertOrphan({ waFrom: num, agencyId: null })
    // avant : ni contact ni agence
    let m = await readMsg(orphanId)
    expect(m.contact_id).toBeNull()
    expect(m.agency_id).toBeNull()

    const contactId = await createContact(setup.agencyAId, num)   // INSERT → trigger back-link
    m = await readMsg(orphanId)
    expect(m.contact_id).toBe(contactId)
    expect(m.agency_id).toBe(setup.agencyAId)                     // agency_id POSÉ (clé : visible sous RLS)

    // Recency rafraîchie depuis le message désormais lié (le back-link est un UPDATE,
    // n'aurait pas déclenché le bump AFTER INSERT ; la colonne n'a pas de défaut).
    const { data: c } = await service.from('contacts')
      .select('last_interaction_at').eq('id', contactId).single()
    expect((c as { last_interaction_at: string | null }).last_interaction_at).not.toBeNull()
  })

  it('passe de réparation : helper direct rattache un orphelin agency_id NULL (parité trigger)', async () => {
    const num = e164('70')
    // Fiche créée AVANT l'orphelin → le trigger fire mais ne trouve rien ; l'orphelin
    // inséré ensuite reste non lié (aucune écriture de contact ne re-fait feu). C'est
    // exactement l'état « orphelin historique » que la passe de réparation doit soigner.
    const contactId = await createContact(setup.agencyAId, num)
    const orphanId = await insertOrphan({ waFrom: num, agencyId: null })
    let m = await readMsg(orphanId)
    expect(m.contact_id).toBeNull()

    // Appel DIRECT du helper = ligne exacte exécutée par la boucle de réparation.
    const { data: linked, error } = await service
      .rpc('backlink_whatsapp_orphans_for_contact', { p_contact_id: contactId })
    expect(error).toBeNull()
    expect(linked).toBe(1)
    m = await readMsg(orphanId)
    expect(m.contact_id).toBe(contactId)
    expect(m.agency_id).toBe(setup.agencyAId)
  })

  it('visibilité RLS : après rattachement, l\'agent de l\'agence A le voit, l\'agent B non', async () => {
    const num = e164('12')
    const orphanId = await insertOrphan({ waFrom: num, agencyId: null })
    await createContact(setup.agencyAId, num)
    const m = await readMsg(orphanId)
    expect(m.agency_id).toBe(setup.agencyAId)

    const { data: seenByA } = await setup.clientA.from('whatsapp_messages').select('id').eq('id', orphanId).maybeSingle()
    const { data: seenByB } = await setup.clientB.from('whatsapp_messages').select('id').eq('id', orphanId).maybeSingle()
    expect((seenByA as { id: string } | null)?.id).toBe(orphanId)  // agence A : visible
    expect(seenByB).toBeNull()                                     // agence B : masqué (isolation tenant)
  })

  it('garde cross-tenant : numéro partagé par 2 agences → NON attribué ; redevenu unique → attribué', async () => {
    const num = e164('30')
    // Le même numéro existe dans A et dans B → globalement ambigu.
    const contactA = await createContact(setup.agencyAId, num)
    const contactB = await createContact(setup.agencyBId, num)
    // Orphelin inséré APRÈS (le trigger ne fire qu'aux écritures de contacts).
    const orphanId = await insertOrphan({ waFrom: num, agencyId: null })
    // Force le trigger via une maj de phone (valeur normalisée identique, écriture réelle).
    await service.from('contacts').update({ phone: national('30') }).eq('id', contactA)

    let m = await readMsg(orphanId)
    expect(m.contact_id).toBeNull()   // ambigu → on ne devine pas
    expect(m.agency_id).toBeNull()

    // CONTRÔLE POSITIF : supprime le doublon de B → numéro globalement unique → le MÊME
    // orphelin s'attache au re-déclenchement. Prouve que le NULL ci-dessus venait de la
    // garde, pas d'un trigger qui n'aurait jamais fait feu.
    await service.from('contacts').delete().eq('id', contactB)
    await service.from('contacts').update({ phone: e164('30') }).eq('id', contactA)
    m = await readMsg(orphanId)
    expect(m.contact_id).toBe(contactA)
    expect(m.agency_id).toBe(setup.agencyAId)
  })

  it('garde numéro AGENT : orphelin dont wa_from = numéro d\'un agent vérifié → jamais rattaché', async () => {
    const num = e164('60')
    const { data: link, error: linkErr } = await service.from('whatsapp_agent_links')
      .insert({ profile_id: setup.agentAId, agency_id: setup.agencyAId, wa_number: num, verified: true })
      .select('id').single()
    if (linkErr) throw new Error(`insert agent link: ${linkErr.message}`)
    agentLinkIds.push((link as { id: string }).id)

    const orphanId = await insertOrphan({ waFrom: num, agencyId: null })
    await createContact(setup.agencyAId, num)             // fire trigger
    const m = await readMsg(orphanId)
    expect(m.contact_id).toBeNull()                       // numéro d'agent → exclu du back-link client
    expect(m.agency_id).toBeNull()
  })

  it('non-régression classe A : orphelin agency_id connu, contact_id NULL → toujours rattaché', async () => {
    const num = e164('40')
    const orphanId = await insertOrphan({ waFrom: num, agencyId: setup.agencyAId })
    const contactId = await createContact(setup.agencyAId, num)
    const m = await readMsg(orphanId)
    expect(m.contact_id).toBe(contactId)
    expect(m.agency_id).toBe(setup.agencyAId)
  })

  it('garde direction : un SORTANT orphelin n\'est jamais rattaché (wa_from = MEGGA, pas le client)', async () => {
    const num = e164('50')
    const orphanId = await insertOrphan({ waFrom: num, agencyId: null, direction: 'outbound' })
    await createContact(setup.agencyAId, num)
    const m = await readMsg(orphanId)
    expect(m.contact_id).toBeNull()
    expect(m.agency_id).toBeNull()
  })
})
