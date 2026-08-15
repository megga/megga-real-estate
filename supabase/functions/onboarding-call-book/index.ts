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
import { onboardingCallManageUrl } from '../_shared/app-url.ts'
import { profileLocale } from '../_shared/recipient-language.ts'

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
  // Assaini UNE fois : la colonne et l'avis à l'équipe lisent la même valeur, sinon
  // l'e-mail pourrait montrer autre chose que ce que la console affiche.
  const answers = sanitizeAnswers(body.answers)
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
      attendee_answers: answers,
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
  // Le segment `/rendez-vous-accueil/` appartient au constructeur partagé — il est le
  // piège de ce lien : `/rendez-vous/` appartient au RDV de vérification KYC
  // (appointment-book), sa route est déclarée AVANT dans App.tsx, et le lien atterrissait
  // sur l'écran KYC qui ne connaît pas ce jeton.
  const manageUrl = onboardingCallManageUrl(inserted.manage_token)
  const { data: agency } = await db
    .from('agencies').select('name').eq('id', profile.agency_id).maybeSingle()
  const { data: hostProfile } = await db
    .from('profiles').select('email, full_name').eq('id', host.profile_id).maybeSingle()
  const { data: bookerProfile } = await db
    .from('profiles').select('email, full_name').eq('id', profile.id).maybeSingle()

  const agencyName = agency?.name ?? 'Votre agence'
  const attendeeName = bookerProfile?.full_name ?? ''
  const attendeeEmail = bookerProfile?.email ?? user.email ?? ''

  const summary = `Appel d'accueil MEGGA · ${agencyName}`
  const description = [
    `Appel d'accueil avec ${agencyName}.`,
    attendeeName ? `Contact : ${attendeeName}` : null,
    attendeeEmail ? `E-mail : ${attendeeEmail}` : null,
    body.phone ? `Telephone : ${body.phone}` : null,
    body.note ? `Note : ${body.note}` : null,
  ].filter(Boolean).join('\n')

  let meetingUrl: string | null = null
  const event = await createHostEvent(db, { profileId: host.profile_id, calendarEmail: host.calendar_email }, {
    summary,
    description,
    startMs: slotMs,
    durationMinutes: host.duration_minutes,
    timezone: host.timezone,
    requestId: `megga-onboarding-${inserted.id}`,
    withMeetLink: true,
  })

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

  // ⛔ C'ÉTAIT `body.locale === 'en' ? 'en' : 'fr'` : 'de' et 'it' tombaient dans le
  // `else` et l'agence recevait du français. La requête prime (l'agent vient de
  // choisir), le profil sert de mémoire (migration 20260815250000).
  const locale = await profileLocale(db, profile.id, body.locale)
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
    locale,
  }

  // ⚠ TOUT CE BLOC EST SOUS FILET, et l'en-tête dit pourquoi : « rien de ce qui vient
  // après l'insertion ne peut faire échouer la réservation ». Cette promesse n'était
  // vraie que par chance tant que les gabarits ne lisaient que des valeurs venues de la
  // base. Depuis que l'avis d'équipe rend `answers` — saisi par le client — la
  // composition d'un e-mail touche de la donnée arbitraire, et une exception ici rendait
  // 500 APRÈS l'écriture : rendez-vous confirmé en base, agenda occupé, personne
  // prévenue, et l'agence verrouillée par l'index unique sur son propre appel.
  // Le rattrapage journalise et laisse le reste se dérouler ; c'est exactement le
  // « e-mail perdu qui se rattrape » de l'en-tête, par opposition au rendez-vous perdu.
  let attendeeSent: { ok: boolean; error?: unknown } = { ok: false, error: 'not attempted' }
  try {
    const ics = buildIcs({
      callId: inserted.id,
      summary,
      description,
      startMs: slotMs,
      durationMinutes: host.duration_minutes,
      organizerEmail: hostProfile?.email ?? 'noreply@megga.ch',
      attendeeEmail,
      meetingUrl,
      method: 'REQUEST',
      sequence: 0,
    })

    const attendeeMail = buildAttendeeEmail(emailData)
    const hostMail = buildHostEmail({ ...emailData, timezone: host.timezone }, 'booked', answers)

  // ⚠ L'avis va à la BOÎTE D'ÉQUIPE, pas au profil de l'hôte.
  // `calendar_email` est la boîte Workspace dont l'agenda fait foi (hello@megga.ai) :
  // elle reçoit déjà l'invitation Google, et c'est là que l'équipe regarde. Le profil
  // reste le repli pour un hôte resté sur la voie OAuth personnelle (calendar_email
  // NULL), pour qui la boîte du profil EST la bonne.
  //
  // Ce n'était pas un manque mais une mauvaise adresse : l'avis partait vers le profil,
  // et les deux envois du 15.08.2026 y sont morts en `suppressed` — l'adresse était sur
  // la liste de suppression Resend depuis le 05.08. Un avis interne invisible se
  // constate dix jours trop tard.
    const hostNoticeTo = host.calendar_email ?? hostProfile?.email ?? null

    ;[attendeeSent] = await Promise.all([
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
      hostNoticeTo
        ? sendResendEmail({ to: hostNoticeTo, subject: hostMail.subject, html: hostMail.html })
        : Promise.resolve({ ok: false, error: 'no host email' }),
    ])
  } catch (err) {
    // La réservation TIENT. On perd l'e-mail, pas le rendez-vous — et il reste
    // rattrapable : la console admin le montre, le rappel J-1 repartira, et
    // `confirmation_sent_at` resté NULL dit précisément ce qui a manqué.
    console.error('[onboarding-call-book] emails failed', err)
    attendeeSent = { ok: false, error: String(err) }
  }

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
