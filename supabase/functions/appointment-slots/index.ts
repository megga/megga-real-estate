// supabase/functions/appointment-slots/index.ts
// GET /functions/v1/appointment-slots?token=<token>&days=<n>   (public — verify_jwt=false)
//
// Créneaux proposables au client pour son RDV de vérification KYC, au bout du
// lien magique qu'il détient déjà. Aucun compte, aucune session.
//
// CE QUE CET ENDPOINT NE RENVOIE JAMAIS
//   Rien du contenu de l'agenda de l'agent. Les occupations externes sont lues
//   via `freeBusy` / `getSchedule`, qui ne retournent que des bornes temporelles
//   (cf. _shared/booking-freebusy.ts) ; les occupations internes passent par
//   `kyc_booking_busy_ranges`, dont on ne conserve que start/end. À la sortie il
//   ne reste que des créneaux LIBRES — jamais l'inverse, jamais un motif.
//
// Chaîne de confiance : HMAC vérifié en crypto d'abord, puis le lien est
// revalidé en base (token identique, statut, expiration). Même ordre que
// magic-link-get et buyer-reception-react. ⚠ Le « statut » de cette phrase
// n'était PAS testé jusqu'au 14.09.2026 : seule la date l'était, et un lien
// révoqué — passé à `expired` avant son échéance — listait encore les créneaux.
// C'est désormais une liste BLANCHE (MAGIC_LINK_BOOKING_STATUSES).
//
// UN APPEL AU FOURNISSEUR PAR AGENT ET PAR MINUTE, AU PLUS. Les occupations
// externes viennent de l'instantané de l'agent (_shared/booking-freebusy-cache.ts,
// table kyc_booking_freebusy_cache) : sans lui, chaque requête — un lien
// transféré suffit — déclenchait un freeBusy Google ou Graph au nom de l'agent.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'
import { isMagicLinkBookable } from '../_shared/magic-link-limits.ts'
import { computeSlots, type BookingSettings, type BusyRange } from '../_shared/booking-slots.ts'
import { externalBusyRanges } from '../_shared/booking-freebusy.ts'
import {
  COLONNES_INSTANTANE,
  FREEBUSY_TTL_S,
  borneALaCouverture,
  occupationsExternes,
  type DependancesInstantane,
  type LigneInstantane,
} from '../_shared/booking-freebusy-cache.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const url = new URL(req.url)
  const token = (url.searchParams.get('token') ?? '').trim()
  if (!token) return json({ error: 'token query param required' }, 400)

  // 1) Crypto d'abord : inutile de toucher la base pour un token qui ne tient pas.
  const verified = await verifyMagicLinkToken(token)
  if (!verified.valid || !verified.payload) {
    // Motif réduit à expired/invalid (audit S10, 13.09.2026) : `no_secret` dirait à un
    // appelant anonyme que le secret manque sur ce déploiement, `malformed` vs
    // `invalid_signature` quand il a touché la grammaire du jeton. Même règle que
    // magic-link-get ; l'UI ne lit que le statut HTTP (useAppointmentSlots).
    const expire = verified.reason === 'expired'
    return json(
      { error: expire ? 'Link expired' : 'Invalid link', reason: expire ? 'expired' : 'invalid' },
      expire ? 410 : 401,
    )
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // 2) Deux porteurs légitimes, deux résolutions.
  //    - lien magique KYC (k absent) : première réservation ;
  //    - jeton de rendez-vous (k='appt') : REPORT, où le client n'a plus le lien
  //      magique en main. Sans cette branche, « déplacer » serait impossible à
  //      servir : il faut bien une liste de créneaux pour en choisir un autre.
  let agentId: string
  //   Le rendez-vous en cours de report ne doit pas se compter lui-même comme
  //   occupé, sinon aucun créneau proche du sien ne ressortirait jamais.
  let excludeAppointmentId: string | null = null

  if (verified.payload.k === 'appt') {
    const { data: appt } = await db
      .from('appointments')
      .select('id, agent_id, status')
      .eq('id', verified.payload.id)
      .maybeSingle()
    if (!appt) return json({ error: 'appointment_not_found' }, 404)
    if (appt.status !== 'confirmed') return json({ error: 'not_reschedulable', reason: 'not_reschedulable' }, 409)
    agentId = appt.agent_id
    excludeAppointmentId = appt.id
  } else {
    const { data: link } = await db
      .from('kyc_magic_links')
      .select('id, token, agency_id, contact_id, status, expires_at, created_by')
      .eq('id', verified.payload.id)
      .maybeSingle()
    if (!link) return json({ error: 'Invalid link' }, 401)

    // Un lien régénéré par l'agent doit invalider le précédent : le token signé
    // reste cryptographiquement valide jusqu'à son exp, seul ce contrôle le révoque.
    if (link.token !== token) return json({ error: 'Token superseded', reason: 'regenerated' }, 410)
    // Statut PUIS date, et AVANT toute autre lecture : un lien révoqué ne dit plus
    // rien, pas même le rendez-vous qu'il porte déjà. Liste blanche — un statut
    // inconnu refuse. Motif réduit à `expired` pour l'appelant anonyme (#1319).
    if (!isMagicLinkBookable(link.status) || new Date(link.expires_at) < new Date()) {
      return json({ error: 'Link expired', reason: 'expired' }, 410)
    }
    if (!link.created_by) return json({ error: 'booking_unavailable', reason: 'no_agent' }, 409)

    // Un lien ne porte qu'un RDV : s'il existe déjà, on le renvoie au lieu de
    // proposer des créneaux que book_kyc_appointment refuserait (already_booked).
    const { data: existing } = await db
      .from('appointments')
      .select('id')
      .eq('magic_link_id', link.id)
      .eq('status', 'confirmed')
      .maybeSingle()
    if (existing) {
      const { data: appt } = await db.rpc('get_kyc_appointment_public', { p_appointment_id: existing.id })
      return json({ already_booked: true, appointment: appt })
    }

    agentId = link.created_by
  }

  // 3) Réglages de l'agent. Absence de ligne = auto-réservation jamais configurée,
  //    ce qui n'est pas une erreur : c'est un opt-in non exercé.
  const { data: settingsRow } = await db
    .from('agent_booking_settings')
    .select('is_open, timezone, slot_minutes, buffer_minutes, min_notice_hours, max_advance_days, weekly_hours, default_mode, location_label')
    .eq('agent_id', agentId)
    .maybeSingle()
  if (!settingsRow || !settingsRow.is_open) {
    return json({ slots: [], booking_open: false, reason: 'booking_closed' })
  }
  const settings = settingsRow as unknown as BookingSettings & { default_mode: string; location_label: string | null }

  // 5) Fenêtre interrogée, bornée par max_advance_days. Elle ne cadre que la
  //    lecture INTERNE : l'instantané externe couvre toujours l'horizon entier,
  //    puisqu'il sert toutes les requêtes de l'agent (fenetreDeLecture).
  const requestedDays = Number(url.searchParams.get('days') ?? settings.max_advance_days)
  const days = Math.max(1, Math.min(Number.isFinite(requestedDays) ? requestedDays : settings.max_advance_days, settings.max_advance_days))
  const nowMs = Date.now()
  const fromIso = new Date(nowMs).toISOString()
  const toIso = new Date(nowMs + days * 86_400_000).toISOString()

  // 6) Occupations internes : RDV confirmés + visites de bien + absences.
  const { data: busyRows, error: busyErr } = await db.rpc('kyc_booking_busy_ranges', {
    p_agent_id: agentId,
    p_from: fromIso,
    p_to: toIso,
    p_exclude_id: excludeAppointmentId,
  })
  if (busyErr) return json({ error: 'Could not read availability' }, 500)

  const busy: BusyRange[] = ((busyRows ?? []) as Array<{ starts_at: string; ends_at: string }>)
    .map(r => ({ start: Date.parse(r.starts_at), end: Date.parse(r.ends_at) }))
    .filter(r => Number.isFinite(r.start) && Number.isFinite(r.end))

  // 7) Occupations externes, depuis l'instantané de l'agent : un appel au
  //    fournisseur au plus par agent et par fenêtre, sous bail. Agenda connecté
  //    mais injoignable — ou bail tenu ailleurs sans instantané à temps — → on ne
  //    propose rien : mieux vaut un message honnête qu'un créneau déjà pris.
  //    Les E/S restent ici, dans le gestionnaire : la porte lint:edge-auth les y
  //    voit, APRÈS la vérification du jeton.
  const acces: DependancesInstantane = {
    lire: async () => {
      const { data, error } = await db
        .from('kyc_booking_freebusy_cache')
        .select(COLONNES_INSTANTANE)
        .eq('agent_id', agentId)
        .maybeSingle()
      if (error) console.error('appointment-slots: instantané illisible', error.code)
      return (data ?? null) as LigneInstantane | null
    },
    prendreBail: async () => {
      const { data, error } = await db.rpc('kyc_booking_freebusy_claim', {
        p_agent_id: agentId,
        p_ttl_seconds: FREEBUSY_TTL_S,
      })
      if (error) console.error('appointment-slots: bail refusé par la base', error.code)
      return typeof data === 'string' ? data : null
    },
    interroger: (from, to) => externalBusyRanges(
      async (table, userId) => {
        const { data } = await db.from(table).select('*').eq('user_id', userId).maybeSingle()
        return (data ?? null) as Record<string, unknown> | null
      },
      agentId, from, to,
    ),
    // Sous le bail, jamais à côté : si l'instantané a été jeté (réservation) ou le
    // bail repris entre-temps, cette écriture ne touche aucune ligne — un résultat
    // lu AVANT la réservation ne redevient pas l'instantané.
    ecrire: async (bail, champs) => {
      const { error } = await db
        .from('kyc_booking_freebusy_cache')
        .update(champs)
        .eq('agent_id', agentId)
        .eq('lease_id', bail)
      if (error) console.error('appointment-slots: instantané non écrit', error.code)
    },
    attendre: (ms) => new Promise((r) => setTimeout(r, ms)),
    maintenant: () => Date.now(),
  }
  const instantane = await occupationsExternes(acces, settings)
  if (!instantane) {
    return json({ slots: [], booking_open: true, reason: 'calendar_unavailable' }, 503)
  }
  if (!instantane.occupations.ok) {
    return json({ slots: [], booking_open: true, reason: 'calendar_unavailable', provider: instantane.occupations.provider }, 503)
  }
  busy.push(...instantane.occupations.busy)

  const slots = borneALaCouverture(
    computeSlots({ settings, busy, nowMs, horizonDays: days }),
    instantane.couvertJusqua,
    settings.buffer_minutes,
  )

  return json({
    booking_open: true,
    slots,
    timezone: settings.timezone,
    slot_minutes: settings.slot_minutes,
    mode: settings.default_mode,
    location: settings.location_label,
    // Bornes rendues explicites pour que l'UI puisse expliquer une liste vide
    // (« rien avant demain », « rien au-delà d'un mois ») au lieu de rester muette.
    min_notice_hours: settings.min_notice_hours,
    max_advance_days: settings.max_advance_days,
  })
})
