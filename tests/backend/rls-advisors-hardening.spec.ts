// Durcissement RLS (migration 20260711190000) — verrouille les failles advisors :
//   (a) support_tickets : plus AUCUNE lecture anon (l'ancienne policy
//       `anon_select_own_ticket` avait qual `true` → tous les tickets lisibles anon).
//       (ticket_messages, droppée à l'audit du 18.07.2026, était couverte ici aussi.)
//   (b) visits : les policies anon `manage_token IS NOT NULL` (≈ true) sont remplacées
//       par des RPC SECURITY DEFINER scopées token — l'anon ne lit/modifie plus la table
//       en direct, mais le flux public /visit/:id/edit (lire, replanifier, annuler,
//       feedback) marche à l'identique via les RPC.
// Tourne en CI sur le Supabase local (migrations du repo) ET en live (skipIf clés).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('durcissement RLS — tickets + visites par token', () => {
  let setup: TwoAgenciesSetup
  let contactId = ''
  let propertyId = ''
  let visitId = ''
  let manageToken = ''
  let ticketId = ''

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    const { data: c, error: ec } = await svc.from('contacts')
      .insert({
        agency_id: setup.agencyAId, first_name: 'Visite', last_name: `Token ${setup.stamp}`,
        email: `visit-${Math.random()}@megga-test.local`, type: 'buyer',
      }).select('id').single()
    if (ec) throw new Error(`contact: ${ec.message}`)
    contactId = c.id

    const { data: p, error: ep } = await svc.from('properties')
      .insert({
        agency_id: setup.agencyAId, title: `Bien visite ${setup.stamp}`,
        type: 'apartment', status: 'active', city: 'Genève', canton: 'GE',
      }).select('id').single()
    if (ep) throw new Error(`property: ${ep.message}`)
    propertyId = p.id

    const { data: v, error: ev } = await svc.from('visits')
      .insert({
        agency_id: setup.agencyAId, property_id: propertyId, contact_id: contactId,
        scheduled_at: '2026-07-20T14:00:00.000Z', status: 'planned',
        buyer_name: 'Visiteur Test', buyer_email: 'visiteur@megga-test.local',
        manage_token: crypto.randomUUID(),
      }).select('id, manage_token').single()
    if (ev) throw new Error(`visit: ${ev.message}`)
    visitId = v.id
    manageToken = v.manage_token as string

    const { data: t, error: et } = await svc.from('support_tickets')
      .insert({
        ticket_number: `RLS-${setup.stamp}`, subject: `Ticket RLS ${setup.stamp}`,
        submitter_name: 'Test RLS', submitter_email: `rls-${setup.stamp}@megga-test.local`,
      }).select('id').single()
    if (et) throw new Error(`ticket: ${et.message}`)
    ticketId = t.id
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (ticketId) await svc.from('support_tickets').delete().eq('id', ticketId).then(() => {}, () => {})
    if (visitId) await svc.from('visits').delete().eq('id', visitId).then(() => {}, () => {})
    if (propertyId) await svc.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    if (contactId) await svc.from('contacts').delete().eq('id', contactId).then(() => {}, () => {})
    await setup.cleanup()
  })

  // ── (a) tickets : lecture anon coupée ──────────────────────────────────────
  it('anon ne lit AUCUN ticket support (ancienne policy qual=true supprimée)', async () => {
    const { data } = await anonClient().from('support_tickets').select('id').eq('id', ticketId)
    expect(data ?? []).toEqual([])
  })

  // ── (b) visits : la table est fermée à l'anon, le flux token passe par RPC ──
  it('anon ne lit plus la table visits en direct (même avec un token posé)', async () => {
    const { data } = await anonClient().from('visits').select('id').eq('id', visitId)
    expect(data ?? []).toEqual([])
  })

  it('anon ne modifie plus une visite en direct par manage_token', async () => {
    const { data: returned } = await anonClient().from('visits')
      .update({ status: 'cancelled' }).eq('manage_token', manageToken).select('id')
    expect(returned ?? []).toEqual([])
    const svc = serviceRoleClient()
    const { data: row } = await svc.from('visits').select('status').eq('id', visitId).single()
    expect(row?.status).toBe('planned') // intacte
  })

  it('get_visit_by_token (anon) : bon token → la visite + le bien ; mauvais token → null', async () => {
    const anon = anonClient()
    const { data, error } = await anon.rpc('get_visit_by_token', { p_token: manageToken })
    expect(error).toBeNull()
    const visit = data as { id: string; buyer_name: string; property: { title: string } | null } | null
    expect(visit?.id).toBe(visitId)
    expect(visit?.buyer_name).toBe('Visiteur Test')
    expect(visit?.property?.title).toContain('Bien visite')

    const { data: wrong } = await anon.rpc('get_visit_by_token', { p_token: crypto.randomUUID() })
    expect(wrong ?? null).toBeNull()
  })

  it('reschedule_visit_by_token (anon) : replanifie SA visite, pas une autre', async () => {
    const anon = anonClient()
    const { data: ok, error } = await anon.rpc('reschedule_visit_by_token', {
      p_token: manageToken, p_new_at: '2026-07-22T10:00:00.000Z',
    })
    expect(error).toBeNull()
    expect(ok).toBe(true)
    const svc = serviceRoleClient()
    const { data: row } = await svc.from('visits').select('scheduled_at, status').eq('id', visitId).single()
    expect(new Date(row!.scheduled_at as string).toISOString()).toBe('2026-07-22T10:00:00.000Z')
    expect(row?.status).toBe('planned')

    const { data: miss } = await anon.rpc('reschedule_visit_by_token', {
      p_token: crypto.randomUUID(), p_new_at: '2026-07-23T10:00:00.000Z',
    })
    expect(miss).toBe(false) // token inconnu → aucune ligne touchée
  })

  it('submit_visit_feedback_by_token (anon) : dépose le feedback et clôt la visite', async () => {
    const anon = anonClient()
    const { data: ok, error } = await anon.rpc('submit_visit_feedback_by_token', {
      p_token: manageToken, p_rating: 4, p_comment: 'Très belle visite',
      p_ai: { strengths: ['lumineux'], objections: [], offer_interest: 'yes' },
    })
    expect(error).toBeNull()
    expect(ok).toBe(true)
    const svc = serviceRoleClient()
    const { data: row } = await svc.from('visits')
      .select('rating, feedback_buyer, status, feedback_sent').eq('id', visitId).single()
    expect(row?.rating).toBe(4)
    expect(row?.feedback_buyer).toBe('Très belle visite')
    expect(row?.status).toBe('done')
    expect(row?.feedback_sent).toBe(true)
  })

  it('cancel_visit_by_token (anon) : annule par token', async () => {
    const anon = anonClient()
    const { data: ok, error } = await anon.rpc('cancel_visit_by_token', { p_token: manageToken })
    expect(error).toBeNull()
    expect(ok).toBe(true)
    const svc = serviceRoleClient()
    const { data: row } = await svc.from('visits').select('status').eq('id', visitId).single()
    expect(row?.status).toBe('cancelled')
  })
})
