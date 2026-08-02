// supabase/functions/appointment-manage/index.ts
// GET  /functions/v1/appointment-manage?token=<token>   → état du rendez-vous
// POST /functions/v1/appointment-manage                 → { token, action, starts_at? }
// (public — verify_jwt=false)
//
// Le client déplace ou annule SON rendez-vous depuis le lien reçu par courriel.
// Même famille que VisitManagePage pour les visites, mais sur un jeton HMAC
// expirant plutôt qu'un uuid de capacité permanent.
//
// Le jeton DOIT porter k='appt' : son `id` désigne un rendez-vous. Un lien
// magique KYC présenté ici est refusé explicitement, au lieu de compter sur le
// fait que les UUID des deux tables ne se rencontrent pas.
//
// Fenêtre de préavis et plafond de reports sont appliqués par les RPC
// (`cancel_kyc_appointment`, `reschedule_kyc_appointment`), pas ici.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken } from '../_shared/magic-link-token.ts'
import { deleteBookingEvent, updateBookingEvent } from '../_shared/booking-calendar-write.ts'
import { sendBookingEmail } from '../_shared/booking-email.ts'
import type { CalendarProvider, TokenTable } from '../_shared/booking-oauth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const STATUS_BY_CODE: Record<string, number> = {
  appointment_not_found: 404,
  not_cancellable: 409,
  not_reschedulable: 409,
  too_late_to_change: 409,
  reschedule_limit_reached: 409,
  slot_taken: 409,
  booking_closed: 409,
  too_soon: 400,
  too_far: 400,
  outside_hours: 400,
  crosses_midnight: 400,
  bad_range: 400,
}

interface ApptRow {
  id: string
  agency_id: string
  agent_id: string
  contact_id: string
  starts_at: string
  ends_at: string
  mode: 'sur_place' | 'video'
  location: string | null
  video_link: string | null
  external_provider: CalendarProvider | null
  external_event_id: string | null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const url = new URL(req.url)
  let token = (url.searchParams.get('token') ?? '').trim()
  let action = ''
  let newStartsAt = ''

  if (req.method === 'POST') {
    let body: Record<string, unknown>
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }
    token = String(body.token ?? token).trim()
    action = String(body.action ?? '')
    newStartsAt = String(body.starts_at ?? '').trim()
    if (action !== 'cancel' && action !== 'reschedule') return json({ error: 'action invalide' }, 400)
    if (action === 'reschedule' && !Number.isFinite(Date.parse(newStartsAt))) {
      return json({ error: 'starts_at invalide' }, 400)
    }
  } else if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!token) return json({ error: 'token required' }, 400)

  const verified = await verifyMagicLinkToken(token)
  if (!verified.valid || !verified.payload) {
    return json(
      { error: verified.reason === 'expired' ? 'Link expired' : 'Invalid link', reason: verified.reason },
      verified.reason === 'expired' ? 410 : 401,
    )
  }
  if (verified.payload.k !== 'appt') {
    return json({ error: 'Invalid link', reason: 'wrong_token_kind' }, 401)
  }

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const apptId = verified.payload.id

  const { data: rowRaw } = await db
    .from('appointments')
    .select('id, agency_id, agent_id, contact_id, starts_at, ends_at, mode, location, video_link, external_provider, external_event_id')
    .eq('id', apptId)
    .maybeSingle()
  if (!rowRaw) return json({ error: 'appointment_not_found' }, 404)
  const row = rowRaw as unknown as ApptRow

  // ── GET : état courant, via la liste blanche de la RPC publique ──
  if (req.method === 'GET') {
    const { data: pub } = await db.rpc('get_kyc_appointment_public', { p_appointment_id: apptId })
    return json({ appointment: pub })
  }

  // ── POST : mutation ──
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip') || null

  const { error: rpcError } = action === 'cancel'
    ? await db.rpc('cancel_kyc_appointment', { p_appointment_id: apptId, p_client_ip: clientIp })
    : await db.rpc('reschedule_kyc_appointment', {
        p_appointment_id: apptId,
        p_new_starts_at: new Date(newStartsAt).toISOString(),
        p_client_ip: clientIp,
      })

  if (rpcError) {
    const raw = String(rpcError.message ?? '')
    const code = Object.keys(STATUS_BY_CODE).find(c => raw.includes(c))
    if (code) return json({ error: code, reason: code }, STATUS_BY_CODE[code])
    console.error('appointment-manage: échec RPC inattendu', raw)
    return json({ error: 'Could not update appointment' }, 500)
  }

  // ── Le changement est acté en base. Le reste est en meilleur effort. ──

  const [{ data: pub }, { data: contact }, { data: agency }, { data: agent }, { data: settings }] =
    await Promise.all([
      db.rpc('get_kyc_appointment_public', { p_appointment_id: apptId }),
      db.from('contacts').select('first_name, last_name, email').eq('id', row.contact_id).maybeSingle(),
      db.from('agencies').select('name').eq('id', row.agency_id).maybeSingle(),
      db.from('profiles').select('full_name').eq('id', row.agent_id).maybeSingle(),
      db.from('agent_booking_settings').select('timezone').eq('agent_id', row.agent_id).maybeSingle(),
    ])

  const publicAppt = (pub ?? {}) as Record<string, unknown>
  const timeZone = String(settings?.timezone ?? 'Europe/Zurich')
  const contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : null

  const readTokens = async (table: TokenTable, userId: string) => {
    const { data } = await db.from(table).select('*').eq('user_id', userId).maybeSingle()
    return (data ?? null) as Record<string, unknown> | null
  }

  // Agenda externe : suivre le changement, sinon l'agent garde un créneau
  // fantôme (annulation) ou le voit à la mauvaise heure (report).
  try {
    if (row.external_provider && row.external_event_id) {
      if (action === 'cancel') {
        const removed = await deleteBookingEvent(readTokens, row.agent_id, row.external_provider, row.external_event_id)
        if (removed) {
          await db.from('appointments')
            .update({ external_provider: null, external_event_id: null })
            .eq('id', apptId)
        }
      } else {
        await updateBookingEvent(readTokens, row.agent_id, row.external_provider, row.external_event_id, {
          appointmentId: apptId,
          summary: `Vérification d'identité — ${contactName ?? 'client'}`,
          description: 'Rendez-vous de vérification d\'identité (KYC), déplacé par le client via MEGGA.',
          location: (publicAppt.location as string | null) ?? row.location,
          startIso: String(publicAppt.starts_at ?? row.starts_at),
          endIso: String(publicAppt.ends_at ?? row.ends_at),
          timeZone,
        })
      }
    }
  } catch (e) {
    console.error('appointment-manage: écho agenda externe échoué', e)
  }

  try {
    if (contact?.email) {
      await sendBookingEmail({
        kind: action === 'cancel' ? 'cancelled' : 'rescheduled',
        to: contact.email,
        contactName,
        // Sur une annulation, on rappelle la date ANNULÉE — c'est ce que le
        // client cherche à reconnaître dans sa boîte.
        startIso: action === 'cancel' ? row.starts_at : String(publicAppt.starts_at ?? row.starts_at),
        timeZone,
        mode: (publicAppt.mode as 'sur_place' | 'video') ?? row.mode,
        location: (publicAppt.location as string | null) ?? row.location,
        videoLink: (publicAppt.video_link as string | null) ?? row.video_link,
        agencyName: agency?.name ?? null,
        agentName: agent?.full_name ?? null,
        // Un rendez-vous annulé n'a plus rien à gérer ; le jeton reste valide
        // jusqu'à son exp mais les RPC refusent déjà toute action dessus.
        manageUrl: null,
      })
    }
  } catch (e) {
    console.error('appointment-manage: envoi du courriel échoué', e)
  }

  return json({ ok: true, appointment: publicAppt })
})
