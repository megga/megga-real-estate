// Backend test (live CI) — Instrumentation comportementale PR1 : socle de
// triggers structurels (migration 20260617090000_instrumentation_structural.sql).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : exécuté contre un Supabase local seedé
// (jamais la prod) et DOIT réellement passer. Tous les signaux sont déterministes.
//
// Couvre :
//   I1  stage_change : un UPDATE de stage émet 1 event 'stage_change' (metadata old/new/contact_id), scoped agence.
//   I2  status_change : un UPDATE de status émet 'status_change' (capte on_hold/cancelled = at-risk).
//   I3  idempotence : un UPDATE de stage à la MÊME valeur n'émet AUCUN event (garde IS DISTINCT).
//   I4  bypass fermé : archive (status='cancelled' en direct) → 'status_change' capturé (plus de trou).
//   I5  attribution 'user' : un agent authentifié qui bouge un deal → actor_kind='user', actor_id=agent.
//   I6  attribution 'ai' (GUC) : wa_move_transaction_stage → 'stage_change' actor_kind='ai', via='whatsapp' ;
//       et GRANT : un agent authentifié NE PEUT PAS appeler la RPC (service_role only).
//   I7  published_at : posé au 1er 'active' ; null en 'draft' ; IMMUABLE ensuite (neutralise la réécriture app).
//   I8  visits.completed_at : posé quand status='done' (filet de l'invariant dupliqué ≥5×).
//   I9  last_interaction_at (activity_events) : event allowlisté bump GREATEST ; match_suggested NON ;
//       event plus ancien ne régresse pas.
//   I10 last_interaction_at (whatsapp_messages) : un message lié à un contact bump la recency.
//   I11 multi-tenant : un event d'une AUTRE agence ne bump pas un contact (scope agency_id).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('instrumentation structurelle PR1 — triggers (live + isolation)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient

  const txIds: string[] = []
  const propIds: string[] = []
  const contactIds: string[] = []
  const visitIds: string[] = []
  const waIds: string[] = []
  let urlCfg: { had: boolean; value: string | null } = { had: false, value: null }

  // contacts (porteurs / cibles recency)
  let cBuyer = ''     // buyer des transactions de test
  let cNote = ''      // bump via activity_events 'note_added'
  let cClean = ''     // ne doit JAMAIS être bumpé (anti-corruption match_suggested)
  let cWa = ''        // bump via whatsapp_messages
  let cMt = ''        // multi-tenant (event agence B ne le touche pas)
  let cDead = ''      // deal perdu/annulé → NE doit PAS rafraîchir la recency

  // transactions
  let txStage = '', txStatus = '', txNoop = '', txArchive = '', txUser = '', txWa = ''
  let txDeadStage = '', txDeadStatus = ''

  const mkContact = async (agencyId: string, tag: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'INSTR', last_name: `${tag}-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contact ${tag}: ${error.message}`)
    contactIds.push(data.id)
    return data.id
  }

  const mkTx = async (agencyId: string, buyerId: string, stage: string, status: string): Promise<string> => {
    const { data, error } = await svc.from('transactions').insert({
      agency_id: agencyId, contact_buyer_id: buyerId, stage, status,
    }).select('id').single()
    if (error) throw new Error(`tx ${stage}/${status}: ${error.message}`)
    txIds.push(data.id)
    return data.id
  }

  const mkProperty = async (agencyId: string, tag: string, status: string): Promise<string> => {
    const { data, error } = await svc.from('properties').insert({
      agency_id: agencyId, title: `INSTR ${tag} ${setup.stamp}`,
      type: 'apartment', status, transaction_type: 'buy',
    }).select('id, published_at').single()
    if (error) throw new Error(`property ${tag}: ${error.message}`)
    propIds.push(data.id)
    return data.id
  }

  const stageEvents = async (txId: string, action: string): Promise<Record<string, unknown>[]> => {
    const { data } = await svc.from('activity_events')
      .select('action, actor_kind, actor_id, entity_type, entity_id, category, metadata, agency_id, created_at')
      .eq('entity_id', txId).eq('action', action).order('created_at', { ascending: false })
    return (data ?? []) as Record<string, unknown>[]
  }

  const lastInteraction = async (contactId: string): Promise<string | null> => {
    const { data } = await svc.from('contacts').select('last_interaction_at').eq('id', contactId).single()
    return (data?.last_interaction_at as string | null) ?? null
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()

    // PARADE CI : un INSERT/UPDATE de bien en 'active' déclenche on_property_active
    // (net.http_post). On pose une URL factice NON-NULL (évite la violation NOT NULL
    // http_request_queue ; l'appel échoue en async, ignoré). Restaurée en afterAll.
    {
      const { data: row } = await svc.from('app_config').select('value').eq('key', 'supabase_url').maybeSingle()
      urlCfg = { had: row !== null, value: (row?.value as string | null) ?? null }
      await svc.from('app_config').upsert({ key: 'supabase_url', value: 'http://invalid.local' }, { onConflict: 'key' })
    }

    cBuyer = await mkContact(setup.agencyAId, 'Buyer')
    cNote = await mkContact(setup.agencyAId, 'Note')
    cClean = await mkContact(setup.agencyAId, 'Clean')
    cWa = await mkContact(setup.agencyAId, 'Wa')
    cMt = await mkContact(setup.agencyAId, 'Mt')
    cDead = await mkContact(setup.agencyAId, 'Dead')

    txStage = await mkTx(setup.agencyAId, cBuyer, 'lead', 'active')
    txStatus = await mkTx(setup.agencyAId, cBuyer, 'lead', 'active')
    txNoop = await mkTx(setup.agencyAId, cBuyer, 'lead', 'active')
    txArchive = await mkTx(setup.agencyAId, cBuyer, 'lead', 'active')
    txUser = await mkTx(setup.agencyAId, cBuyer, 'lead', 'active')
    txWa = await mkTx(setup.agencyAId, cBuyer, 'lead', 'active')
    txDeadStage = await mkTx(setup.agencyAId, cDead, 'lead', 'active')
    txDeadStatus = await mkTx(setup.agencyAId, cDead, 'lead', 'active')
  })

  afterAll(async () => {
    if (!svc) return
    // activity_events est APPEND-ONLY (trigger d'immuabilité) → on ne les supprime pas.
    if (waIds.length) await svc.from('whatsapp_messages').delete().in('id', waIds)
    if (visitIds.length) await svc.from('visits').delete().in('id', visitIds)
    if (txIds.length) await svc.from('transactions').delete().in('id', txIds)
    if (propIds.length) await svc.from('properties').delete().in('id', propIds)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    if (urlCfg.had) await svc.from('app_config').update({ value: urlCfg.value }).eq('key', 'supabase_url')
    else await svc.from('app_config').delete().eq('key', 'supabase_url')
    await setup.cleanup()
  })

  it('I1 — stage_change : 1 event avec metadata old/new/contact_id, scoped agence', async () => {
    await svc.from('transactions').update({ stage: 'qualified' }).eq('id', txStage)
    const evs = await stageEvents(txStage, 'stage_change')
    expect(evs.length).toBe(1)
    const ev = evs[0]
    expect(ev.entity_type).toBe('transaction')
    expect(ev.category).toBe('deal')
    expect(ev.agency_id).toBe(setup.agencyAId)
    const meta = ev.metadata as Record<string, unknown>
    expect(meta.old_stage).toBe('lead')
    expect(meta.new_stage).toBe('qualified')
    expect(meta.contact_id).toBe(cBuyer)
  })

  it('I2 — status_change : un UPDATE de status émet status_change (at-risk capturé)', async () => {
    await svc.from('transactions').update({ status: 'on_hold' }).eq('id', txStatus)
    const evs = await stageEvents(txStatus, 'status_change')
    expect(evs.length).toBe(1)
    const meta = evs[0].metadata as Record<string, unknown>
    expect(meta.old_status).toBe('active')
    expect(meta.new_status).toBe('on_hold')
  })

  it('I3 — idempotence : UPDATE de stage à la même valeur → 0 event', async () => {
    await svc.from('transactions').update({ stage: 'lead' }).eq('id', txNoop) // déjà 'lead'
    const evs = await stageEvents(txNoop, 'stage_change')
    expect(evs.length).toBe(0)
  })

  it('I4 — bypass fermé : archive (status=cancelled en direct) → status_change capturé', async () => {
    await svc.from('transactions').update({ status: 'cancelled' }).eq('id', txArchive)
    const evs = await stageEvents(txArchive, 'status_change')
    expect(evs.length).toBe(1)
    const meta = evs[0].metadata as Record<string, unknown>
    expect(meta.new_status).toBe('cancelled')
  })

  it('I5 — attribution user : un agent authentifié qui bouge un deal → actor_kind=user, actor_id=agent', async () => {
    const { error } = await setup.clientA.from('transactions').update({ stage: 'qualified' }).eq('id', txUser)
    expect(error, 'agent A devrait pouvoir déplacer un deal de son agence').toBeNull()
    const evs = await stageEvents(txUser, 'stage_change')
    expect(evs.length).toBe(1)
    expect(evs[0].actor_kind).toBe('user')
    expect(evs[0].actor_id).toBe(setup.agentAId)
  })

  it('I6 — attribution ai (GUC) via wa_move_transaction_stage + GRANT service_role only', async () => {
    const { error } = await svc.rpc('wa_move_transaction_stage', {
      p_transaction_id: txWa, p_stage: 'qualified', p_agency_id: setup.agencyAId, p_profile_id: setup.agentAId,
    })
    expect(error).toBeNull()
    const evs = await stageEvents(txWa, 'stage_change')
    expect(evs.length).toBe(1)
    expect(evs[0].actor_kind).toBe('ai')
    expect(evs[0].actor_id).toBeNull() // cohérence : actor_id NULL quand kind != 'user'
    const meta = evs[0].metadata as Record<string, unknown>
    expect(meta.via).toBe('whatsapp')
    expect(meta.profile_id).toBe(setup.agentAId)
    // GRANT : un agent authentifié ne peut pas appeler la RPC (service_role only)
    const { error: denied } = await setup.clientA.rpc('wa_move_transaction_stage', {
      p_transaction_id: txWa, p_stage: 'offer', p_agency_id: setup.agencyAId, p_profile_id: setup.agentAId,
    })
    expect(denied).not.toBeNull()
  })

  it('I7 — published_at : posé au 1er active, null en draft, IMMUABLE ensuite', async () => {
    // insert direct en 'active' → published_at posé
    const pActive = await mkProperty(setup.agencyAId, 'Active', 'active')
    const { data: a } = await svc.from('properties').select('published_at').eq('id', pActive).single()
    expect(a?.published_at, 'published_at posé au 1er active').not.toBeNull()
    const firstPub = a!.published_at as string

    // insert en 'draft' → published_at null
    const pDraft = await mkProperty(setup.agencyAId, 'Draft', 'draft')
    const { data: d } = await svc.from('properties').select('published_at').eq('id', pDraft).single()
    expect(d?.published_at).toBeNull()
    // promotion draft → active : published_at posé
    await svc.from('properties').update({ status: 'active' }).eq('id', pDraft)
    const { data: d2 } = await svc.from('properties').select('published_at').eq('id', pDraft).single()
    expect(d2?.published_at, 'published_at posé à la promotion active').not.toBeNull()

    // immuabilité : tenter de réécrire published_at à une date passée → ignoré (garde OLD)
    await svc.from('properties').update({ published_at: '2020-01-01T00:00:00Z' }).eq('id', pActive)
    const { data: a2 } = await svc.from('properties').select('published_at').eq('id', pActive).single()
    expect(a2?.published_at).toBe(firstPub)
  })

  it('I8 — visits.completed_at : posé quand status=done', async () => {
    const prop = await mkProperty(setup.agencyAId, 'VisitProp', 'draft')
    // insert direct en 'done' → completed_at posé
    const { data: vd, error: ed } = await svc.from('visits').insert({
      agency_id: setup.agencyAId, contact_id: cBuyer, property_id: prop,
      scheduled_at: new Date().toISOString(), status: 'done',
    }).select('id, completed_at').single()
    if (ed) throw new Error(`visit done: ${ed.message}`)
    visitIds.push(vd.id)
    expect(vd.completed_at, 'completed_at posé à l\'insert done').not.toBeNull()

    // insert 'planned' (completed_at null) puis update → 'done'
    const { data: vp, error: ep } = await svc.from('visits').insert({
      agency_id: setup.agencyAId, contact_id: cBuyer, property_id: prop,
      scheduled_at: new Date().toISOString(), status: 'planned',
    }).select('id, completed_at').single()
    if (ep) throw new Error(`visit planned: ${ep.message}`)
    visitIds.push(vp.id)
    expect(vp.completed_at).toBeNull()
    await svc.from('visits').update({ status: 'done' }).eq('id', vp.id)
    const { data: vp2 } = await svc.from('visits').select('completed_at').eq('id', vp.id).single()
    expect(vp2?.completed_at, 'completed_at posé à la transition done').not.toBeNull()
  })

  it('I9 — last_interaction_at (activity_events) : bump GREATEST ; match_suggested NON ; pas de régression', async () => {
    // (a) event allowlisté 'note_added' → bump
    const noteTs = new Date().toISOString()
    const { error: e1 } = await svc.from('activity_events').insert({
      agency_id: setup.agencyAId, action: 'note_added', entity_type: 'contact', entity_id: cNote,
      created_at: noteTs,
    })
    if (e1) throw new Error(`note event: ${e1.message}`)
    const after = await lastInteraction(cNote)
    expect(after, 'contact bumpé par note_added').not.toBeNull()
    expect(new Date(after!).getTime()).toBe(new Date(noteTs).getTime())

    // (b) anti-corruption : match_suggested (ai + metadata.contact_id) NE bump PAS
    const { error: e2 } = await svc.from('activity_events').insert({
      agency_id: setup.agencyAId, actor_kind: 'ai', actor_id: null,
      action: 'match_suggested', entity_type: 'match',
      metadata: { contact_id: cClean },
    })
    if (e2) throw new Error(`match event: ${e2.message}`)
    expect(await lastInteraction(cClean), 'match_suggested ne doit JAMAIS bumper').toBeNull()

    // (c) GREATEST : un event PLUS ANCIEN ne régresse pas la valeur
    const { error: e3 } = await svc.from('activity_events').insert({
      agency_id: setup.agencyAId, action: 'note_added', entity_type: 'contact', entity_id: cNote,
      created_at: '2020-01-01T00:00:00Z',
    })
    if (e3) throw new Error(`old note event: ${e3.message}`)
    const after2 = await lastInteraction(cNote)
    expect(new Date(after2!).getTime()).toBe(new Date(noteTs).getTime()) // inchangé
  })

  it('I10 — last_interaction_at (whatsapp_messages) : un message lié bump la recency', async () => {
    const ts = new Date().toISOString()
    const { data, error } = await svc.from('whatsapp_messages').insert({
      provider: 'openwa', provider_message_id: `instr-${setup.stamp}-1`, direction: 'inbound',
      wa_from: '41790000001', status: 'received', processing_status: 'done',
      contact_id: cWa, agency_id: setup.agencyAId, wa_timestamp: ts, body: 'bonjour',
    }).select('id').single()
    if (error) throw new Error(`wa msg: ${error.message}`)
    waIds.push(data.id)
    const after = await lastInteraction(cWa)
    expect(after, 'contact bumpé par message WhatsApp lié').not.toBeNull()
    expect(new Date(after!).getTime()).toBe(new Date(ts).getTime())
  })

  it('I11 — multi-tenant : un event d\'une AUTRE agence ne bump pas le contact', async () => {
    // event entity=contact A mais agency_id = agence B → le scope (c.agency_id=NEW.agency_id) bloque
    const { error } = await svc.from('activity_events').insert({
      agency_id: setup.agencyBId, action: 'note_added', entity_type: 'contact', entity_id: cMt,
    })
    if (error) throw new Error(`mt event: ${error.message}`)
    expect(await lastInteraction(cMt), 'event agence B ne doit pas bumper un contact agence A').toBeNull()
  })

  it('I12 — deal perdu/annulé : l\'event est capturé MAIS la recency n\'est PAS rafraîchie (relance protégée)', async () => {
    await svc.from('transactions').update({ stage: 'lost' }).eq('id', txDeadStage)
    await svc.from('transactions').update({ status: 'cancelled' }).eq('id', txDeadStatus)
    // la capture du mouvement a bien lieu (vélocité / audit)…
    expect((await stageEvents(txDeadStage, 'stage_change')).length).toBe(1)
    expect((await stageEvents(txDeadStatus, 'status_change')).length).toBe(1)
    // …mais le contact n'est PAS bumpé (sinon un lead au deal mort sortirait à tort de la relance)
    expect(await lastInteraction(cDead)).toBeNull()
  })
})
