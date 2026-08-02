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

  /**
   * Une visite NEUVE par geste. Les gestes par token sont désormais à sens unique
   * (un avis ne se redépose pas, une visite close ne se replanifie pas) : partager
   * une seule ligne entre les tests les rendrait dépendants de leur ordre, et le
   * premier qui change d'ordre casse les suivants pour une raison sans rapport.
   *
   * `decalageHeures` positionne `scheduled_at` par rapport à MAINTENANT — négatif
   * pour une visite déjà passée (seul cas où un avis est recevable), positif pour
   * une visite à venir.
   */
  async function creerVisite(opts: { decalageHeures: number; status?: string }) {
    const svc = serviceRoleClient()
    const quand = new Date(Date.now() + opts.decalageHeures * 3600_000).toISOString()
    const { data, error } = await svc.from('visits')
      .insert({
        agency_id: setup.agencyAId, property_id: propertyId, contact_id: contactId,
        scheduled_at: quand, status: opts.status ?? 'planned',
        buyer_name: 'Visiteur Test', buyer_email: 'visiteur@megga-test.local',
        manage_token: crypto.randomUUID(),
      }).select('id, manage_token').single()
    if (error) throw new Error(`visit: ${error.message}`)
    return { id: data.id as string, token: data.manage_token as string }
  }

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

    // ⚠ Date RELATIVE, jamais littérale : `get_visit_by_token` ne sert plus une visite
    // au-delà de `scheduled_at + 30 jours` (migration 20260802210000). Une date en dur
    // sortirait de la fenêtre à une échéance fixe et ferait rougir la suite un matin,
    // sur un code inchangé.
    const { id, token } = await creerVisite({ decalageHeures: -2 })
    visitId = id
    manageToken = token

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

  it('get_visit_by_token ne renvoie PLUS le manage_token', async () => {
    // Réémettre la capability dans sa propre réponse l'exposait pour rien : aucun
    // écran ne la lit, et tout ce qui journalise la réponse la recopiait.
    const { data } = await anonClient().rpc('get_visit_by_token', { p_token: manageToken })
    expect(Object.keys((data ?? {}) as Record<string, unknown>)).not.toContain('manage_token')
  })

  it('reschedule_visit_by_token (anon) : replanifie SA visite, pas une autre', async () => {
    const anon = anonClient()
    const { id, token } = await creerVisite({ decalageHeures: 24 })
    const cible = new Date(Date.now() + 72 * 3600_000).toISOString()

    const { data: ok, error } = await anon.rpc('reschedule_visit_by_token', { p_token: token, p_new_at: cible })
    expect(error).toBeNull()
    expect(ok).toBe(true)
    const svc = serviceRoleClient()
    const { data: row } = await svc.from('visits').select('scheduled_at, status').eq('id', id).single()
    expect(new Date(row!.scheduled_at as string).toISOString()).toBe(cible)
    expect(row?.status).toBe('planned')

    const { data: miss } = await anon.rpc('reschedule_visit_by_token', {
      p_token: crypto.randomUUID(), p_new_at: cible,
    })
    expect(miss).toBe(false) // token inconnu → aucune ligne touchée
  })

  it('reschedule_visit_by_token refuse une date passée et une visite terminale', async () => {
    const anon = anonClient()
    const { token } = await creerVisite({ decalageHeures: 24 })
    const passe = new Date(Date.now() - 3600_000).toISOString()
    expect(await anon.rpc('reschedule_visit_by_token', { p_token: token, p_new_at: passe })
      .then((r) => r.data)).toBe(false)

    // Une visite annulée ne se ressuscite pas : c'était le trou d'origine, le
    // `status = 'planned'` était posé sans condition.
    const { token: jetonAnnule } = await creerVisite({ decalageHeures: 24, status: 'cancelled' })
    expect(await anon.rpc('reschedule_visit_by_token', {
      p_token: jetonAnnule, p_new_at: new Date(Date.now() + 48 * 3600_000).toISOString(),
    }).then((r) => r.data)).toBe(false)
  })

  it('submit_visit_feedback_by_token (anon) : dépose le feedback et clôt la visite', async () => {
    const anon = anonClient()
    // Visite DÉJÀ passée : c'est l'état normal au moment de l'avis (l'agent a clos,
    // puis la relance part). Un avis sur une visite à venir n'a pas de sens.
    const { id, token } = await creerVisite({ decalageHeures: -2 })
    const { data: ok, error } = await anon.rpc('submit_visit_feedback_by_token', {
      p_token: token, p_rating: 4, p_comment: 'Très belle visite',
      p_ai: { strengths: ['lumineux'], objections: [], offer_interest: 'yes' },
    })
    expect(error).toBeNull()
    expect(ok).toBe(true)
    const svc = serviceRoleClient()
    const { data: row } = await svc.from('visits')
      .select('rating, feedback_buyer, status, feedback_sent').eq('id', id).single()
    expect(row?.rating).toBe(4)
    expect(row?.feedback_buyer).toBe('Très belle visite')
    expect(row?.status).toBe('done')
    expect(row?.feedback_sent).toBe(true)
  })

  it("un avis déjà déposé ne se réécrit pas, et `status = 'done'` ne bloque PAS le premier", async () => {
    const anon = anonClient()
    // `done` est le statut NORMAL au dépôt (automation-engine ne relance QUE des
    // visites déjà closes) : le refuser fermerait le seul chemin d'arrivée d'un avis.
    const { id, token } = await creerVisite({ decalageHeures: -2, status: 'done' })
    expect(await anon.rpc('submit_visit_feedback_by_token', {
      p_token: token, p_rating: 5, p_comment: 'Parfait', p_ai: {},
    }).then((r) => r.data)).toBe(true)

    // Le rejeu, lui, est refusé — la marque d'unicité est l'avis, pas le statut.
    expect(await anon.rpc('submit_visit_feedback_by_token', {
      p_token: token, p_rating: 1, p_comment: 'Réécriture', p_ai: {},
    }).then((r) => r.data)).toBe(false)

    const svc = serviceRoleClient()
    const { data: row } = await svc.from('visits').select('rating, feedback_buyer').eq('id', id).single()
    expect(row?.rating).toBe(5)
    expect(row?.feedback_buyer).toBe('Parfait')
  })

  it('une note hors barème est refusée proprement, sans remonter la contrainte CHECK', async () => {
    // Avant, `p_rating = 9` atteignait `visits_rating_check` et renvoyait un 23514
    // à un appelant anonyme au lieu d'un booléen.
    const anon = anonClient()
    const { token } = await creerVisite({ decalageHeures: -2 })
    const { data, error } = await anon.rpc('submit_visit_feedback_by_token', {
      p_token: token, p_rating: 9, p_comment: '', p_ai: {},
    })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })

  it('cancel_visit_by_token (anon) : annule par token, une seule fois', async () => {
    const anon = anonClient()
    const { id, token } = await creerVisite({ decalageHeures: 24 })
    const { data: ok, error } = await anon.rpc('cancel_visit_by_token', { p_token: token })
    expect(error).toBeNull()
    expect(ok).toBe(true)
    const svc = serviceRoleClient()
    const { data: row } = await svc.from('visits').select('status').eq('id', id).single()
    expect(row?.status).toBe('cancelled')

    // Rejeu : refusé, et surtout SANS réécrire quoi que ce soit.
    expect(await anon.rpc('cancel_visit_by_token', { p_token: token }).then((r) => r.data)).toBe(false)
  })

  it('le jeton meurt 30 jours après la visite — lecture ET écriture', async () => {
    // Le trou d'origine : `manage_token` n'expirait JAMAIS, aucune colonne ne le
    // bornait. La fenêtre est dérivée de `scheduled_at`, donc éprouvable ici.
    const anon = anonClient()
    const { token } = await creerVisite({ decalageHeures: -24 * 31 })
    expect(await anon.rpc('get_visit_by_token', { p_token: token }).then((r) => r.data ?? null)).toBeNull()
    expect(await anon.rpc('cancel_visit_by_token', { p_token: token }).then((r) => r.data)).toBe(false)
    expect(await anon.rpc('submit_visit_feedback_by_token', {
      p_token: token, p_rating: 3, p_comment: '', p_ai: {},
    }).then((r) => r.data)).toBe(false)
  })

  it('chaque geste par token laisse une trace dans activity_events', async () => {
    // La règle du projet — « activity_events pour toute action » — n'était pas tenue
    // par ces trois gestes publics : l'agent voyait l'effet sans savoir qui l'a posé.
    const anon = anonClient()
    const { id, token } = await creerVisite({ decalageHeures: 24 })
    await anon.rpc('cancel_visit_by_token', { p_token: token })
    const svc = serviceRoleClient()
    const { data: events } = await svc.from('activity_events')
      .select('action, actor_kind, actor_id, category, entity_type')
      .eq('entity_id', id).eq('entity_type', 'visit')
    expect((events ?? []).map((e) => e.action)).toContain('visit_cancelled_by_token')
    const trace = (events ?? []).find((e) => e.action === 'visit_cancelled_by_token')
    // L'acheteur n'a pas de compte : `actor_id` NULL impose `actor_kind = 'system'`
    // (contrainte activity_events_actor_kind_coherence).
    expect(trace?.actor_id).toBeNull()
    expect(trace?.actor_kind).toBe('system')
  })
})
