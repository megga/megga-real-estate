// supabase/functions/onboarding-call-book/index.ts
//
// Réservation de l'appel d'accueil. Écriture.
//
// L'ORDRE DES OPÉRATIONS EST LA FONCTIONNALITÉ. On écrit la ligne AVANT de toucher
// l'agenda ou les e-mails, parce que c'est l'index unique en base qui arbitre la
// course entre deux réservations simultanées. Créer l'événement d'agenda d'abord
// laisserait une entrée fantôme chez l'hôte quand l'insertion perd la course.
//
// Symétriquement, rien de ce qui vient après l'insertion ne peut faire échouer la
// réservation : un lien de visioconférence manquant ou un e-mail perdu se rattrapent,
// un rendez-vous perdu non.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { loadAvailability } from '../_shared/onboarding-availability.ts'
import { pickHostForSlot, recheckWindow } from '../_shared/onboarding-slots.ts'
import { createHostEvent } from '../_shared/host-freebusy.ts'
import { sendResendEmail, toBase64 } from '../_shared/resend.ts'
import { buildAttendeeEmail, buildHostEmail, buildIcs } from '../_shared/onboarding-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

/** Code Postgres d'une violation de contrainte d'unicité. */
const PG_UNIQUE_VIOLATION = '23505'

interface BookRequest {
  slot?: string
  phone?: string
  note?: string
  answers?: unknown
  timezone?: string
  locale?: string
}

/**
 * Ne garde que des paires chaîne -> chaîne, coupées et plafonnées.
 *
 * `null` plutôt qu'un objet vide quand il ne reste rien : la colonne distingue alors
 * « pas de réponses » de « des réponses toutes vides », ce qu'un `{}` effacerait.
 */
function sanitizeAnswers(raw: unknown): Record<string, string> | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
    if (typeof v !== 'string') continue
    const val = v.trim().slice(0, 500)
    if (val) out[k.slice(0, 60)] = val
  }
  return Object.keys(out).length > 0 ? out : null
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: db } = auth

  let body: BookRequest = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid body' }, 400)
  }

  const slotMs = Date.parse(body.slot ?? '')
  if (!Number.isFinite(slotMs)) return json({ error: 'invalid slot' }, 400)

  const nowMs = Date.now()
  if (slotMs <= nowMs) return json({ error: 'slot_in_past' }, 409)

  // Seuls les dirigeants réservent : c'est le parcours de sortie du wizard d'identité,
  // et l'appel engage l'agence. Un agent simple n'a pas à poser ce rendez-vous.
  if (!['admin', 'manager'].includes(profile.role ?? '')) {
    return json({ error: 'forbidden: agency admin only' }, 403)
  }

  // ── 1. Le créneau est-il encore libre, et pour qui ──
  // Fenêtre resserrée autour du créneau demandé, mais assez large pour contenir le
  // rendez-vous ENTIER : un créneau dont la fin déborde la fenêtre n'est pas rendu
  // par le moteur (cf. `recheckWindow`).
  const { fromMs, toMs } = recheckWindow(slotMs)
  const snapshot = await loadAvailability(db, fromMs, toMs, nowMs)
  if (snapshot.poolEmpty) return json({ error: 'no_host_available' }, 409)

  const hostId = pickHostForSlot(snapshot.slots, slotMs, snapshot.loadByHost)
  if (!hostId) return json({ error: 'slot_taken' }, 409)

  const host = snapshot.hostsById.get(hostId)
  if (!host) return json({ error: 'slot_taken' }, 409)

  // ── 2. L'écriture, qui arbitre ──
  const { data: inserted, error: insertError } = await db
    .from('onboarding_calls')
    .insert({
      agency_id: profile.agency_id,
      booked_by: profile.id,
      host_id: hostId,
      host_display_name: host.display_name,
      scheduled_at: new Date(slotMs).toISOString(),
      duration_minutes: host.duration_minutes,
      attendee_phone: typeof body.phone === 'string' ? body.phone.slice(0, 40) || null : null,
      attendee_note: typeof body.note === 'string' ? body.note.slice(0, 2000) || null : null,
      // Déclaratif, borné, et JAMAIS repris tel quel du corps de la requête : seules
      // des paires chaîne -> chaîne courtes entrent, au plus 20. Un client peut poster
      // ce qu'il veut ; sans ce filtre, la colonne accepterait un objet arbitraire —
      // profondeur incluse — que rien en aval ne saurait lire ni borner.
      attendee_answers: sanitizeAnswers(body.answers),
    })
    .select('id, manage_token, scheduled_at, duration_minutes')
    .single()

  if (insertError || !inserted) {
    // Deux causes distinctes derrière le même code, et le client doit pouvoir les
    // distinguer : le créneau vient d'être pris, ou l'agence a déjà un appel.
    if (insertError?.code === PG_UNIQUE_VIOLATION) {
      const taken = (insertError.message ?? '').includes('idx_onboarding_calls_agency_active')
      return json({ error: taken ? 'already_booked' : 'slot_taken' }, 409)
    }
    console.error('[onboarding-call-book] insert failed', insertError)
    return json({ error: 'booking failed' }, 500)
  }

  // ── 3. Tout ce qui suit est best-effort ──
  // `/rendez-vous-accueil/` et NON `/rendez-vous/` : ce dernier appartient au RDV de
  // vérification KYC (appointment-book), et sa route est déclarée AVANT dans App.tsx —
  // le lien atterrissait donc sur l'écran KYC, qui ne connaît pas ce jeton. Corrigé le
  // 04.08.2026, en même temps que la route et les deux autres fonctions qui bâtissent
  // cette URL (-manage, -reminder).
  const manageUrl = `${appOrigin(req)}/rendez-vous-accueil/${inserted.manage_token}`
  const { data: agency } = await db
    .from('agencies').select('name').eq('id', profile.agency_id).maybeSingle()
  const { data: hostProfile } = host.profile_id
    ? await db.from('profiles').select('email, full_name').eq('id', host.profile_id).maybeSingle()
    : { data: null }
  const { data: bookerProfile } = await db
    .from('profiles').select('email, full_name').eq('id', profile.id).maybeSingle()

  const agencyName = agency?.name ?? 'Votre agence'
  const attendeeName = bookerProfile?.full_name ?? ''
  const attendeeEmail = bookerProfile?.email ?? user.email ?? ''
  // Un hôte Workspace n'a pas de profil : c'est sa boîte qui reçoit l'avis de
  // réservation, et c'est aussi elle qui organise l'événement dans l'`.ics`.
  const hostEmail = hostProfile?.email ?? host.calendar_email ?? null

  const summary = `Appel d'accueil MEGGA · ${agencyName}`
  const description = [
    `Appel d'accueil avec ${agencyName}.`,
    attendeeName ? `Contact : ${attendeeName}` : null,
    attendeeEmail ? `E-mail : ${attendeeEmail}` : null,
    body.phone ? `Telephone : ${body.phone}` : null,
    body.note ? `Note : ${body.note}` : null,
  ].filter(Boolean).join('\n')

  let meetingUrl: string | null = null
  const event = await createHostEvent(
    db,
    { profileId: host.profile_id, calendarEmail: host.calendar_email },
    {
      summary,
      description,
      startMs: slotMs,
      durationMinutes: host.duration_minutes,
      timezone: host.timezone,
      requestId: `megga-onboarding-${inserted.id}`,
      withMeetLink: true,
      // Porter le réservant comme invité de l'événement, et pas seulement dans le
      // corps du texte : sans cela, la visioconférence créée par la boîte Workspace le
      // laisse frapper à la porte au lieu de le laisser entrer.
      attendeeEmail,
      attendeeName,
    },
  )

  if (event) {
    meetingUrl = event.meetingUrl
    await db.from('onboarding_calls')
      .update({
        meeting_url: event.meetingUrl,
        calendar_provider: event.provider,
        calendar_event_id: event.eventId,
      })
      .eq('id', inserted.id)
  }

  const locale = body.locale === 'en' ? 'en' : 'fr'
  const timezone = typeof body.timezone === 'string' && body.timezone ? body.timezone : host.timezone
  const emailData = {
    callId: inserted.id,
    attendeeName,
    attendeeEmail,
    agencyName,
    hostName: host.display_name,
    startMs: slotMs,
    durationMinutes: host.duration_minutes,
    timezone,
    meetingUrl,
    manageUrl,
    locale: locale as 'fr' | 'en',
  }

  const ics = buildIcs({
    callId: inserted.id,
    summary,
    description,
    startMs: slotMs,
    durationMinutes: host.duration_minutes,
    organizerEmail: hostEmail ?? 'noreply@megga.ch',
    attendeeEmail,
    meetingUrl,
    method: 'REQUEST',
    sequence: 0,
  })

  const attendeeMail = buildAttendeeEmail(emailData)
  const hostMail = buildHostEmail({ ...emailData, timezone: host.timezone }, 'booked')

  const [attendeeSent] = await Promise.all([
    attendeeEmail
      ? sendResendEmail({
          to: attendeeEmail,
          subject: attendeeMail.subject,
          html: attendeeMail.html,
          attachments: [{
            filename: 'appel-accueil-megga.ics',
            content: toBase64(ics),
            content_type: 'text/calendar; method=REQUEST',
          }],
        })
      : Promise.resolve({ ok: false, error: 'no attendee email' }),
    hostEmail
      ? sendResendEmail({ to: hostEmail, subject: hostMail.subject, html: hostMail.html })
      : Promise.resolve({ ok: false, error: 'no host email' }),
  ])

  if (attendeeSent.ok) {
    await db.from('onboarding_calls')
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq('id', inserted.id)
  } else {
    console.error('[onboarding-call-book] confirmation email failed', attendeeSent.error)
  }

  // ── 4. Audit ──
  // `actor_kind='system'` impose `actor_id` à NULL (contrainte
  // activity_events_actor_kind_coherence) : c'est la plateforme qui enregistre, et
  // c'est cette forme qui fait remonter l'événement dans la cloche agent et le flux
  // live admin sans un seul branchement supplémentaire.
  await db.from('activity_events').insert({
    agency_id: profile.agency_id,
    actor_id: null,
    actor_kind: 'system',
    action: 'onboarding_call_booked',
    entity_type: 'onboarding_call',
    entity_id: inserted.id,
    category: 'onboarding',
    severity: 'info',
    object_label: `${agencyName} · ${host.display_name}`,
    metadata: {
      host_id: hostId,
      scheduled_at: inserted.scheduled_at,
      has_meeting_url: !!meetingUrl,
    },
  })

  return json({
    id: inserted.id,
    manage_token: inserted.manage_token,
    manage_url: manageUrl,
    scheduled_at: inserted.scheduled_at,
    duration_minutes: inserted.duration_minutes,
    host_name: host.display_name,
    meeting_url: meetingUrl,
  })
})
