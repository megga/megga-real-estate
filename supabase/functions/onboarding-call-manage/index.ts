// supabase/functions/onboarding-call-manage/index.ts
//
// Replanifier ou annuler un appel d'accueil.
//
// PUBLIQUE, MAIS À JETON. Le porteur du lien reçu par e-mail agit sans compte : c'est
// tout l'intérêt du geste, un empêchement se règle en deux clics et non par un fil de
// courriels. Le jeton est un uuid non devinable, vérifié AVANT tout accès aux données,
// et il ne donne accès qu'à CE rendez-vous. Un super-admin peut passer par la même
// porte avec sa session, pour annuler côté MEGGA.
//
// Ce qui n'est PAS ici, volontairement : marquer l'issue d'un appel passé (`done`,
// `no_show`). Cela n'envoie rien et ne touche aucun agenda, donc c'est une RPC de
// console, pas une fonction d'edge.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { loadAvailability } from '../_shared/onboarding-availability.ts'
import { MAX_RESCHEDULES, recheckWindow } from '../_shared/onboarding-slots.ts'
import { moveHostEvent, deleteHostEvent, type CalendarProvider } from '../_shared/host-freebusy.ts'
import { sendResendEmail, toBase64 } from '../_shared/resend.ts'
import { buildAttendeeEmail, buildHostEmail, buildIcs } from '../_shared/onboarding-email.ts'
import { requireSuperAdmin } from '../_shared/require-super-admin.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

const PG_UNIQUE_VIOLATION = '23505'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface ManageRequest {
  action?: 'reschedule' | 'cancel'
  manage_token?: string
  call_id?: string
  slot?: string
  reason?: string
  timezone?: string
  locale?: string
}

interface CallRow {
  id: string
  agency_id: string
  booked_by: string
  host_id: string
  host_display_name: string
  scheduled_at: string
  duration_minutes: number
  status: string
  manage_token: string
  meeting_url: string | null
  calendar_provider: string | null
  calendar_event_id: string | null
  rescheduled_count: number
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function appOrigin(req: Request): string {
  const origin = req.headers.get('origin') ?? ''
  return /^https?:\/\//.test(origin) ? origin : 'https://app.megga.ch'
}

const CALL_COLUMNS =
  'id, agency_id, booked_by, host_id, host_display_name, scheduled_at, duration_minutes, status, manage_token, meeting_url, calendar_provider, calendar_event_id, rescheduled_count'

/** Contexte d'envoi : qui prévenir, et sous quel nom. */
async function loadParties(db: SupabaseClient, call: CallRow) {
  const [{ data: agency }, { data: booker }, { data: host }] = await Promise.all([
    db.from('agencies').select('name').eq('id', call.agency_id).maybeSingle(),
    db.from('profiles').select('email, full_name').eq('id', call.booked_by).maybeSingle(),
    db.from('onboarding_hosts').select('profile_id, timezone').eq('id', call.host_id).maybeSingle(),
  ])
  const hostEmail = host?.profile_id
    ? (await db.from('profiles').select('email').eq('id', host.profile_id).maybeSingle()).data?.email ?? null
    : null
  return {
    agencyName: agency?.name ?? 'Agence',
    attendeeName: booker?.full_name ?? '',
    attendeeEmail: booker?.email ?? '',
    hostProfileId: host?.profile_id ?? null,
    hostTimezone: host?.timezone ?? 'Europe/Zurich',
    hostEmail,
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  let body: ManageRequest = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid body' }, 400)
  }

  // ── Garde ──
  // Le jeton vérifie AVANT toute lecture : un jeton mal formé n'atteint jamais la base.
  let call: CallRow | null = null
  const token = typeof body.manage_token === 'string' ? body.manage_token.trim() : ''

  if (token) {
    if (!UUID_RE.test(token)) return json({ error: 'invalid token' }, 403)
    const { data } = await db
      .from('onboarding_calls').select(CALL_COLUMNS).eq('manage_token', token).maybeSingle()
    call = (data as CallRow | null) ?? null
    if (!call) return json({ error: 'invalid token' }, 403)
  } else {
    const auth = await requireSuperAdmin(req, corsHeaders)
    if (auth instanceof Response) return auth
    if (!body.call_id || !UUID_RE.test(body.call_id)) return json({ error: 'invalid call_id' }, 400)
    const { data } = await db
      .from('onboarding_calls').select(CALL_COLUMNS).eq('id', body.call_id).maybeSingle()
    call = (data as CallRow | null) ?? null
    if (!call) return json({ error: 'not found' }, 404)
  }

  const nowMs = Date.now()
  const currentStartMs = Date.parse(call.scheduled_at)

  if (call.status !== 'confirmed') return json({ error: 'call_not_active' }, 409)
  if (currentStartMs <= nowMs) return json({ error: 'call_in_past' }, 409)

  const parties = await loadParties(db, call)
  const manageUrl = `${appOrigin(req)}/rendez-vous/${call.manage_token}`
  const locale = body.locale === 'en' ? 'en' : 'fr'
  const timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : parties.hostTimezone

  // ── Annulation ──
  if (body.action === 'cancel') {
    const { error } = await db
      .from('onboarding_calls')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancel_reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) || null : null,
      })
      .eq('id', call.id)
      .eq('status', 'confirmed')

    if (error) {
      console.error('[onboarding-call-manage] cancel failed', error)
      return json({ error: 'cancel failed' }, 500)
    }

    if (call.calendar_provider && call.calendar_event_id && parties.hostProfileId) {
      await deleteHostEvent(
        db, parties.hostProfileId,
        call.calendar_provider as CalendarProvider, call.calendar_event_id,
      )
    }

    const emailData = {
      callId: call.id,
      attendeeName: parties.attendeeName,
      attendeeEmail: parties.attendeeEmail,
      agencyName: parties.agencyName,
      hostName: call.host_display_name,
      startMs: currentStartMs,
      durationMinutes: call.duration_minutes,
      timezone: parties.hostTimezone,
      meetingUrl: null,
      manageUrl,
      locale: locale as 'fr' | 'en',
    }
    const hostMail = buildHostEmail(emailData, 'cancelled')
    if (parties.hostEmail) {
      await sendResendEmail({ to: parties.hostEmail, subject: hostMail.subject, html: hostMail.html })
    }
    // Une annulation `.ics` retire l'entrée de l'agenda du client, ce qu'un simple
    // e-mail ne fait pas : sans elle, le rendez-vous annulé reste affiché chez lui.
    if (parties.attendeeEmail) {
      const ics = buildIcs({
        callId: call.id,
        summary: `Appel d'accueil MEGGA · ${parties.agencyName}`,
        description: 'Ce rendez-vous a ete annule.',
        startMs: currentStartMs,
        durationMinutes: call.duration_minutes,
        organizerEmail: parties.hostEmail ?? 'noreply@megga.ch',
        attendeeEmail: parties.attendeeEmail,
        meetingUrl: null,
        method: 'CANCEL',
        sequence: call.rescheduled_count + 1,
      })
      await sendResendEmail({
        to: parties.attendeeEmail,
        subject: locale === 'fr' ? 'Votre appel d’accueil est annule' : 'Your welcome call is cancelled',
        html: `<p style="font-family:Helvetica,Arial,sans-serif;font-size:15px;">${
          locale === 'fr'
            ? 'Votre appel d’accueil a bien ete annule. Vous pouvez en reserver un nouveau depuis votre espace MEGGA.'
            : 'Your welcome call has been cancelled. You can book a new one from your MEGGA workspace.'
        }</p>`,
        attachments: [{
          filename: 'appel-accueil-megga.ics',
          content: toBase64(ics),
          content_type: 'text/calendar; method=CANCEL',
        }],
      })
    }

    await db.from('activity_events').insert({
      agency_id: call.agency_id,
      actor_id: null,
      actor_kind: 'system',
      action: 'onboarding_call_cancelled',
      entity_type: 'onboarding_call',
      entity_id: call.id,
      category: 'onboarding',
      severity: 'info',
      object_label: `${parties.agencyName} · ${call.host_display_name}`,
      metadata: { was_scheduled_at: call.scheduled_at, via: token ? 'token' : 'admin' },
    })

    return json({ status: 'cancelled' })
  }

  // ── Replanification ──
  if (body.action !== 'reschedule') return json({ error: 'unknown action' }, 400)

  if (call.rescheduled_count >= MAX_RESCHEDULES) {
    return json({ error: 'reschedule_limit_reached', limit: MAX_RESCHEDULES }, 409)
  }

  const slotMs = Date.parse(body.slot ?? '')
  if (!Number.isFinite(slotMs)) return json({ error: 'invalid slot' }, 400)
  if (slotMs <= nowMs) return json({ error: 'slot_in_past' }, 409)

  // Le créneau doit être libre POUR L'HÔTE DÉJÀ ATTRIBUÉ : replanifier ne rebat pas
  // les cartes de l'attribution, sans quoi le client changerait d'interlocuteur en
  // déplaçant l'heure.
  const { fromMs, toMs } = recheckWindow(slotMs)
  const snapshot = await loadAvailability(db, fromMs, toMs, nowMs)
  const freeForSameHost = snapshot.slots.some(
    (s) => s.startMs === slotMs && s.hostId === call!.host_id,
  )
  if (!freeForSameHost) return json({ error: 'slot_taken' }, 409)

  const { error: updateError } = await db
    .from('onboarding_calls')
    .update({
      scheduled_at: new Date(slotMs).toISOString(),
      rescheduled_count: call.rescheduled_count + 1,
      reminder_sent_at: null,
    })
    .eq('id', call.id)
    .eq('status', 'confirmed')

  if (updateError) {
    if (updateError.code === PG_UNIQUE_VIOLATION) return json({ error: 'slot_taken' }, 409)
    console.error('[onboarding-call-manage] reschedule failed', updateError)
    return json({ error: 'reschedule failed' }, 500)
  }

  // Déplacer, et non recréer : deux entrées dans l'agenda de l'hôte pour un seul
  // rendez-vous, c'est exactement ce que la fonctionnalité doit éviter.
  if (call.calendar_provider && call.calendar_event_id && parties.hostProfileId) {
    await moveHostEvent(
      db, parties.hostProfileId,
      call.calendar_provider as CalendarProvider, call.calendar_event_id,
      slotMs, call.duration_minutes,
    )
  }

  const emailData = {
    callId: call.id,
    attendeeName: parties.attendeeName,
    attendeeEmail: parties.attendeeEmail,
    agencyName: parties.agencyName,
    hostName: call.host_display_name,
    startMs: slotMs,
    durationMinutes: call.duration_minutes,
    timezone,
    meetingUrl: call.meeting_url,
    manageUrl,
    locale: locale as 'fr' | 'en',
  }

  const attendeeMail = buildAttendeeEmail(emailData)
  const hostMail = buildHostEmail({ ...emailData, timezone: parties.hostTimezone }, 'rescheduled')

  if (parties.attendeeEmail) {
    const ics = buildIcs({
      callId: call.id,
      summary: `Appel d'accueil MEGGA · ${parties.agencyName}`,
      description: `Appel d'accueil avec ${parties.agencyName}.`,
      startMs: slotMs,
      durationMinutes: call.duration_minutes,
      organizerEmail: parties.hostEmail ?? 'noreply@megga.ch',
      attendeeEmail: parties.attendeeEmail,
      meetingUrl: call.meeting_url,
      method: 'REQUEST',
      // Sans incrément, le client d'agenda considère la mise a jour comme deja vue
      // et garde l'ancienne heure.
      sequence: call.rescheduled_count + 1,
    })
    await sendResendEmail({
      to: parties.attendeeEmail,
      subject: attendeeMail.subject,
      html: attendeeMail.html,
      attachments: [{
        filename: 'appel-accueil-megga.ics',
        content: toBase64(ics),
        content_type: 'text/calendar; method=REQUEST',
      }],
    })
  }
  if (parties.hostEmail) {
    await sendResendEmail({ to: parties.hostEmail, subject: hostMail.subject, html: hostMail.html })
  }

  await db.from('activity_events').insert({
    agency_id: call.agency_id,
    actor_id: null,
    actor_kind: 'system',
    action: 'onboarding_call_rescheduled',
    entity_type: 'onboarding_call',
    entity_id: call.id,
    category: 'onboarding',
    severity: 'info',
    object_label: `${parties.agencyName} · ${call.host_display_name}`,
    metadata: {
      from: call.scheduled_at,
      to: new Date(slotMs).toISOString(),
      count: call.rescheduled_count + 1,
      via: token ? 'token' : 'admin',
    },
  })

  return json({
    status: 'rescheduled',
    scheduled_at: new Date(slotMs).toISOString(),
    rescheduled_count: call.rescheduled_count + 1,
  })
})
