// Backend test (live CI) — Prise de rendez-vous KYC en self-service
// (tables : 20260802190000_adopte_tables_rdv · gestes : 20260803090000_kyc_appointments_rpc).
//
// Le client réserve lui-même sa vérification d'identité au bout du lien magique
// KYC. Les gestes publics passent par des RPC SECURITY DEFINER réservées au
// service_role — l'edge valide le token HMAC en amont, la base ne peut pas.
//
// Couvre :
//   A  contrainte d'exclusion : chevauchement refusé, adjacent accepté, autre
//      agent accepté, annulation libérant le créneau.
//   B  trigger weekly_hours : fin<=début, plages chevauchantes, heure illisible.
//   C  book_kyc_appointment : nominal + 9 gardes (lien, préavis, horizon,
//      horaires, battement, visite de bien, absence).
//   D  report : 2 maximum, sans se bloquer soi-même.
//   E  annulation : ligne conservée, double annulation refusée, fenêtre de préavis.
//   F  lecture publique : ni IP, ni user-agent, ni id d'événement externe.
//   G  audit : actor_kind='system' + actor_id NULL (contrainte de cohérence).
//   H  droits : ni anon ni authenticated ne peuvent appeler les RPC.
//
// Les heures sont posées en UTC et comparées à une grille 06:00-22:00 heure de
// Zurich : l'écart UTC↔Zurich (1 ou 2 h selon la saison) ne peut donc pas faire
// sortir un créneau de midi de la fenêtre, quelle que soit la date d'exécution.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

/** Instant UTC à J+days, heure ronde. */
const at = (days: number, utcHour: number, minutes = 0): string => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(utcHour, minutes, 0, 0)
  return d.toISOString()
}

const OPEN_ALL_WEEK = Object.fromEntries(
  ['1', '2', '3', '4', '5', '6', '7'].map(d => [d, [['06:00', '22:00']]])
)

describe.skipIf(!HAS_KEYS)('prise de rendez-vous KYC (live)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient
  const contactIds: string[] = []
  const caseIds: string[] = []
  const linkIds: string[] = []
  const propIds: string[] = []
  const visitIds: string[] = []

  const mkContact = async (tag: string, agencyId?: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId ?? setup.agencyAId, first_name: 'RDV', last_name: `${tag}-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contact ${tag}: ${error.message}`)
    contactIds.push(data.id); return data.id
  }
  const mkCase = async (contactId: string): Promise<string> => {
    const { data, error } = await svc.from('kyc_cases').insert({
      agency_id: setup.agencyAId, contact_id: contactId, type: 'buyer_pp',
    }).select('id').single()
    if (error) throw new Error(`kyc_case: ${error.message}`)
    caseIds.push(data.id); return data.id
  }
  /** Un lien magique KYC prêt à porter une réservation. */
  const mkLink = async (tag: string, opts: { days?: number; agent?: string | null } = {}): Promise<string> => {
    const contactId = await mkContact(tag)
    const caseId = await mkCase(contactId)
    const expiresAt = new Date(Date.now() + (opts.days ?? 30) * 86400_000)
    // Un lien est forcément envoyé AVANT d'expirer (CHECK kyc_magic_links_expires_after_sent) :
    // pour en fabriquer un DÉJÀ expiré, il faut donc antidater aussi l'envoi.
    const sentAt = new Date(Math.min(Date.now(), expiresAt.getTime() - 3600_000))
    const { data, error } = await svc.from('kyc_magic_links').insert({
      token: `rdv-${setup.stamp}-${tag}`,
      agency_id: setup.agencyAId, kyc_case_id: caseId, contact_id: contactId,
      mode: 'libre', channels: ['email'], status: 'submitted',
      sent_at: sentAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      created_by: opts.agent === null ? null : (opts.agent ?? setup.agentAId),
    }).select('id').single()
    if (error) throw new Error(`link ${tag}: ${error.message}`)
    linkIds.push(data.id); return data.id
  }
  const setSettings = async (patch: Record<string, unknown> = {}) => {
    const { error } = await svc.from('agent_booking_settings').upsert({
      agent_id: setup.agentAId, agency_id: setup.agencyAId, is_open: true,
      timezone: 'Europe/Zurich', slot_minutes: 30, buffer_minutes: 15,
      min_notice_hours: 24, max_advance_days: 30, weekly_hours: OPEN_ALL_WEEK,
      location_label: 'Rue du Rhone 12, Geneve', ...patch,
    }, { onConflict: 'agent_id' })
    if (error) throw new Error(`settings: ${error.message}`)
  }
  const book = async (linkId: string, startsAt: string) =>
    svc.rpc('book_kyc_appointment', { p_magic_link_id: linkId, p_starts_at: startsAt })

  /** Insertion directe (hors RPC) pour éprouver la contrainte d'exclusion seule. */
  const rawAppt = async (agentId: string, agencyId: string, contactId: string, startsAt: string, mins = 30) =>
    svc.from('appointments').insert({
      agency_id: agencyId, agent_id: agentId, contact_id: contactId,
      starts_at: startsAt,
      ends_at: new Date(new Date(startsAt).getTime() + mins * 60_000).toISOString(),
    }).select('id').single()

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()
    await setSettings()
  })

  afterAll(async () => {
    if (!svc) return
    // appointments AVANT setup.cleanup() : agent_id est ON DELETE RESTRICT
    // (un RDV de vérification est une pièce du dossier LAB/KYC), donc la
    // suppression des profils échouerait tant que des RDV y pointent.
    await svc.from('appointments').delete().in('agency_id', [setup.agencyAId, setup.agencyBId])
    await svc.from('agent_time_off').delete().in('agency_id', [setup.agencyAId, setup.agencyBId])
    await svc.from('agent_booking_settings').delete().in('agency_id', [setup.agencyAId, setup.agencyBId])
    if (visitIds.length) await svc.from('visits').delete().in('id', visitIds)
    if (linkIds.length) await svc.from('kyc_magic_links').delete().in('id', linkIds)
    if (caseIds.length) await svc.from('kyc_cases').delete().in('id', caseIds)
    if (propIds.length) await svc.from('properties').delete().in('id', propIds)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    await setup.cleanup()
  })

  // ── A. Contrainte d'exclusion ──────────────────────────────────────────────
  // Éprouvée par insertion DIRECTE : c'est la garantie transactionnelle qui doit
  // tenir même si une garde applicative est contournée.
  describe('A — anti-double-réservation (contrainte GiST)', () => {
    it('A1 refuse un chevauchement pour le même agent', async () => {
      const c = await mkContact('ExclA', setup.agencyBId)
      const first = await rawAppt(setup.agentBId, setup.agencyBId, c, at(3, 9))
      expect(first.error).toBeNull()
      const { error } = await rawAppt(setup.agentBId, setup.agencyBId, c, at(3, 9, 15))
      expect(error).not.toBeNull()
    })

    it('A2 accepte un créneau adjacent (bornes semi-ouvertes)', async () => {
      const c = await mkContact('ExclB', setup.agencyBId)
      const { error } = await rawAppt(setup.agentBId, setup.agencyBId, c, at(3, 9, 30))
      expect(error).toBeNull()
    })

    it('A3 accepte le même créneau pour un autre agent', async () => {
      const c = await mkContact('ExclC')
      const { error } = await rawAppt(setup.agentAId, setup.agencyAId, c, at(3, 9))
      expect(error).toBeNull()
    })

    it('A4 une annulation libère le créneau', async () => {
      const c = await mkContact('ExclD', setup.agencyBId)
      const { data } = await rawAppt(setup.agentBId, setup.agencyBId, c, at(4, 9))
      await svc.from('appointments').update({ status: 'cancelled' }).eq('id', data!.id)
      const { error } = await rawAppt(setup.agentBId, setup.agencyBId, c, at(4, 9))
      expect(error).toBeNull()
    })
  })

  // ── B. Trigger de validation de la grille hebdomadaire ─────────────────────
  // Un trigger et non une RPC : la policy abs_self_write autorise l'agent à
  // écrire directement sa ligne, une validation en RPC serait contournable.
  describe('B — grille hebdomadaire', () => {
    const bad = async (weekly: unknown) =>
      svc.from('agent_booking_settings').update({ weekly_hours: weekly }).eq('agent_id', setup.agentAId)

    it('B1 refuse une plage dont la fin précède le début', async () => {
      const { error } = await bad({ '1': [['12:00', '09:00']] })
      expect(error).not.toBeNull()
    })
    it('B2 refuse deux plages qui se chevauchent', async () => {
      const { error } = await bad({ '1': [['09:00', '12:00'], ['11:00', '14:00']] })
      expect(error).not.toBeNull()
    })
    it('B3 refuse une heure illisible', async () => {
      const { error } = await bad({ '1': [['pasuneheure', '12:00']] })
      expect(error).not.toBeNull()
    })
    it('B4 refuse un jour hors 1..7 (CHECK du socle)', async () => {
      const { error } = await bad({ '8': [['09:00', '12:00']] })
      expect(error).not.toBeNull()
    })
    it('B5 accepte une grille valide et laisse les réglages intacts', async () => {
      await setSettings()
      const { data } = await svc.from('agent_booking_settings')
        .select('weekly_hours, is_open').eq('agent_id', setup.agentAId).single()
      expect(data!.is_open).toBe(true)
      expect(Object.keys(data!.weekly_hours as object)).toHaveLength(7)
    })
  })

  // ── C. Réservation ─────────────────────────────────────────────────────────
  describe('C — book_kyc_appointment', () => {
    it('C1 réserve, et reprend le lieu par défaut des réglages', async () => {
      const link = await mkLink('Nominal')
      const { data, error } = await book(link, at(5, 12))
      expect(error).toBeNull()
      const { data: appt } = await svc.from('appointments')
        .select('location, status, booked_by, ends_at').eq('id', data as string).single()
      expect(appt!.status).toBe('confirmed')
      expect(appt!.booked_by).toBe('client')
      expect(appt!.location).toBe('Rue du Rhone 12, Geneve')
    })

    it('C2 un lien ne porte qu\'un seul rendez-vous', async () => {
      const link = await mkLink('Double')
      expect((await book(link, at(6, 12))).error).toBeNull()
      const { error } = await book(link, at(6, 15))
      expect(String(error?.message)).toContain('already_booked')
    })

    it('C3 refuse un lien expiré', async () => {
      const link = await mkLink('Expire', { days: -1 })
      expect(String((await book(link, at(5, 14))).error?.message)).toContain('link_expired')
    })

    it('C4 refuse un lien sans agent émetteur', async () => {
      const link = await mkLink('SansAgent', { agent: null })
      expect(String((await book(link, at(5, 15))).error?.message)).toContain('no_agent')
    })

    it('C5 refuse dans la fenêtre de préavis', async () => {
      const link = await mkLink('TropTot')
      const soon = new Date(Date.now() + 2 * 3600_000).toISOString()
      expect(String((await book(link, soon)).error?.message)).toContain('too_soon')
    })

    it('C6 refuse au-delà de l\'horizon', async () => {
      const link = await mkLink('TropLoin')
      expect(String((await book(link, at(60, 12))).error?.message)).toContain('too_far')
    })

    it('C7 refuse hors des plages hebdomadaires', async () => {
      const link = await mkLink('HorsHoraire')
      expect(String((await book(link, at(5, 2))).error?.message)).toContain('outside_hours')
    })

    it('C8 refuse un créneau collé au précédent (battement de 15 min)', async () => {
      const link = await mkLink('Battement')
      expect(String((await book(link, at(5, 12, 35))).error?.message)).toContain('slot_taken')
    })

    it('C9 accepte dès que le battement est respecté', async () => {
      const link = await mkLink('HorsBattement')
      expect((await book(link, at(5, 12, 45))).error).toBeNull()
    })

    it('C10 une visite de bien bloque le créneau', async () => {
      const c = await mkContact('AvecVisite')
      const { data: prop } = await svc.from('properties').insert({
        agency_id: setup.agencyAId, title: `RDV visite ${setup.stamp}`,
        type: 'apartment', status: 'draft', transaction_type: 'buy',
      }).select('id').single()
      propIds.push(prop!.id)
      const { data: visit } = await svc.from('visits').insert({
        agency_id: setup.agencyAId, property_id: prop!.id, contact_id: c,
        agent_id: setup.agentAId, scheduled_at: at(7, 12), duration_minutes: 45, status: 'planned',
      }).select('id').single()
      visitIds.push(visit!.id)

      const link = await mkLink('SurVisite')
      expect(String((await book(link, at(7, 12, 15))).error?.message)).toContain('slot_taken')
    })

    it('C11 une absence déclarée bloque le créneau', async () => {
      await svc.from('agent_time_off').insert({
        agent_id: setup.agentAId, agency_id: setup.agencyAId,
        starts_at: at(9, 0), ends_at: at(10, 0), reason: 'Conge',
      })
      const link = await mkLink('SurConge')
      expect(String((await book(link, at(9, 12))).error?.message)).toContain('slot_taken')
    })

    it('C12 refuse quand l\'agent n\'a pas ouvert l\'auto-réservation', async () => {
      await setSettings({ is_open: false })
      const link = await mkLink('Ferme')
      expect(String((await book(link, at(12, 12))).error?.message)).toContain('booking_closed')
      await setSettings() // réouvre pour la suite
    })
  })

  // ── D. Report ──────────────────────────────────────────────────────────────
  describe('D — report client', () => {
    it('D1 accepte deux reports puis refuse le troisième', async () => {
      const link = await mkLink('Report')
      const { data: id } = await book(link, at(13, 12))
      expect(id).toBeTruthy()

      expect((await svc.rpc('reschedule_kyc_appointment',
        { p_appointment_id: id, p_new_starts_at: at(14, 9) })).error).toBeNull()
      expect((await svc.rpc('reschedule_kyc_appointment',
        { p_appointment_id: id, p_new_starts_at: at(14, 11) })).error).toBeNull()

      const third = await svc.rpc('reschedule_kyc_appointment',
        { p_appointment_id: id, p_new_starts_at: at(14, 15) })
      expect(String(third.error?.message)).toContain('reschedule_limit_reached')

      const { data: appt } = await svc.from('appointments')
        .select('reschedule_count').eq('id', id as string).single()
      expect(appt!.reschedule_count).toBe(2)
    })

    it('D2 un report chevauchant sa propre plage ne se bloque pas lui-même', async () => {
      const link = await mkLink('ReportChevauchant')
      const { data: id } = await book(link, at(15, 12))
      const { error } = await svc.rpc('reschedule_kyc_appointment',
        { p_appointment_id: id, p_new_starts_at: at(15, 12, 10) })
      expect(error).toBeNull()
    })
  })

  // ── E. Annulation ──────────────────────────────────────────────────────────
  describe('E — annulation client', () => {
    it('E1 annule sans supprimer la ligne, et refuse la seconde annulation', async () => {
      const link = await mkLink('Annule')
      const { data: id } = await book(link, at(16, 12))
      expect((await svc.rpc('cancel_kyc_appointment', { p_appointment_id: id })).error).toBeNull()

      const { data: appt } = await svc.from('appointments')
        .select('status, cancelled_at, cancelled_by').eq('id', id as string).single()
      expect(appt!.status).toBe('cancelled')
      expect(appt!.cancelled_by).toBe('client')
      expect(appt!.cancelled_at).not.toBeNull()

      const again = await svc.rpc('cancel_kyc_appointment', { p_appointment_id: id })
      expect(String(again.error?.message)).toContain('not_cancellable')
    })

    it('E2 refuse une annulation dans la fenêtre de préavis', async () => {
      const c = await mkContact('Tardif')
      const { data } = await rawAppt(setup.agentAId, setup.agencyAId, c,
        new Date(Date.now() + 3 * 3600_000).toISOString())
      const { error } = await svc.rpc('cancel_kyc_appointment', { p_appointment_id: data!.id })
      expect(String(error?.message)).toContain('too_late_to_change')
    })
  })

  // ── F. Lecture publique ────────────────────────────────────────────────────
  it('F — la lecture publique n\'expose ni IP, ni user-agent, ni id externe', async () => {
    const link = await mkLink('LecturePublique')
    const { data: id } = await book(link, at(17, 12))
    await svc.from('appointments').update({
      client_ip: '203.0.113.9', client_user_agent: 'Mozilla/5.0', external_event_id: 'goog_evt_secret',
    }).eq('id', id as string)

    const { data: pub, error } = await svc.rpc('get_kyc_appointment_public', { p_appointment_id: id })
    expect(error).toBeNull()
    const raw = JSON.stringify(pub)
    expect(raw).not.toContain('203.0.113.9')
    expect(raw).not.toContain('Mozilla')
    expect(raw).not.toContain('goog_evt_secret')
    expect(pub).toHaveProperty('can_change')
    expect((pub as Record<string, unknown>).status).toBe('confirmed')
  })

  // ── G. Piste d'audit ───────────────────────────────────────────────────────
  it('G — les événements sont attribués system, jamais à un utilisateur', async () => {
    const { data } = await svc.from('activity_events')
      .select('actor_kind, actor_id, category, metadata')
      .eq('entity_type', 'appointment').eq('agency_id', setup.agencyAId)
    const events = (data ?? []) as Array<Record<string, unknown>>
    expect(events.length).toBeGreaterThan(0)
    for (const e of events) {
      expect(e.actor_kind).toBe('system')
      expect(e.actor_id).toBeNull()   // contrainte activity_events_actor_kind_coherence
      expect(e.category).toBe('kyc')
      expect((e.metadata as Record<string, unknown>).via).toBe('kyc_booking')
    }
  })

  // ── H. Droits ──────────────────────────────────────────────────────────────
  // Le point le plus coûteux à rater : ces RPC sont SECURITY DEFINER, un GRANT
  // de trop les ferait contourner toute la RLS du socle.
  describe('H — les RPC ne sont joignables que par le service_role', () => {
    const RPCS = [
      'book_kyc_appointment', 'reschedule_kyc_appointment',
      'cancel_kyc_appointment', 'get_kyc_appointment_public',
      'kyc_slot_rejection', 'kyc_booking_busy_ranges',
    ] as const

    it('H1 anon ne peut appeler aucune des 6 RPC', async () => {
      const anon = anonClient()
      for (const fn of RPCS) {
        const { error } = await anon.rpc(fn, {})
        expect(error, `${fn} joignable par anon`).not.toBeNull()
      }
    })

    it('H2 un agent authentifié ne peut appeler aucune des 6 RPC', async () => {
      for (const fn of RPCS) {
        const { error } = await setup.clientA.rpc(fn, {})
        expect(error, `${fn} joignable par authenticated`).not.toBeNull()
      }
    })

    it('H3 un agent ne voit pas les rendez-vous d\'une autre agence', async () => {
      const { data } = await setup.clientB.from('appointments').select('id, agency_id')
      expect((data ?? []).filter(r => r.agency_id === setup.agencyAId)).toHaveLength(0)
    })
  })
})
