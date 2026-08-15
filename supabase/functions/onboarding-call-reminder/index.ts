// supabase/functions/onboarding-call-reminder/index.ts
//
// Rappel J-1 des appels d'accueil. Déclenché par pg_cron.
//
// POURQUOI UN BALAYAGE ET PAS `scheduled_at` DE RESEND. Resend sait programmer un
// envoi à la réservation, ce qui éviterait ce cron. Mais un rendez-vous se replanifie
// et s'annule : il faudrait alors décommander un e-mail déjà programmé, et un rappel
// pour une date abandonnée est pire que pas de rappel. Un balayage lit l'état courant,
// donc il ne peut pas se tromper de date.
//
// `reminder_sent_at` est posé AVANT l'envoi, et seulement s'il était nul : c'est ce
// qui rend le geste idempotent si deux ticks se chevauchent.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { sendResendEmail } from '../_shared/resend.ts'
import { buildReminderEmail } from '../_shared/onboarding-email.ts'
import { parseLocale, DEFAULT_LOCALE } from '../_shared/recipient-language.ts'
import { onboardingCallManageUrl } from '../_shared/app-url.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

const HOUR_MS = 60 * 60 * 1000

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  if (!(await isServiceSecret(db, req))) {
    return json({ error: 'forbidden' }, 403)
  }

  const now = Date.now()
  const { data: due, error } = await db
    .from('onboarding_calls')
    .select('id, agency_id, booked_by, host_id, host_display_name, scheduled_at, duration_minutes, manage_token, meeting_url')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('scheduled_at', new Date(now + 12 * HOUR_MS).toISOString())
    .lte('scheduled_at', new Date(now + 36 * HOUR_MS).toISOString())

  if (error) {
    console.error('[onboarding-call-reminder] scan failed', error)
    return json({ error: 'scan failed' }, 500)
  }

  let sent = 0
  for (const call of due ?? []) {
    // Réservation du droit d'envoyer : la clause `is('reminder_sent_at', null)` fait
    // que deux exécutions concurrentes ne peuvent pas envoyer deux fois.
    const { data: claimed } = await db
      .from('onboarding_calls')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', call.id)
      .is('reminder_sent_at', null)
      .select('id')
      .maybeSingle()
    if (!claimed) continue

    const [{ data: booker }, { data: agency }, { data: host }] = await Promise.all([
      db.from('profiles').select('email, full_name, language').eq('id', call.booked_by).maybeSingle(),
      db.from('agencies').select('name').eq('id', call.agency_id).maybeSingle(),
      db.from('onboarding_hosts').select('timezone').eq('id', call.host_id).maybeSingle(),
    ])

    if (!booker?.email) continue

    const mail = buildReminderEmail({
      callId: call.id,
      attendeeName: booker.full_name ?? '',
      attendeeEmail: booker.email,
      agencyName: agency?.name ?? '',
      hostName: call.host_display_name,
      startMs: Date.parse(call.scheduled_at),
      durationMinutes: call.duration_minutes,
      timezone: host?.timezone ?? 'Europe/Zurich',
      meetingUrl: call.meeting_url,
      manageUrl: onboardingCallManageUrl(call.manage_token),
      // ⛔ C'ÉTAIT `'fr'` EN DUR. Ce rappel part d'un cron : il n'y a AUCUNE requête
      // d'où lire une langue, donc un anglophone ayant réservé en anglais recevait la
      // veille un message en français. La préférence enregistrée est la seule source
      // qu'un envoi automatique puisse consulter, et elle SUIT les changements : si
      // l'agence bascule en allemand entre la réservation et le rappel, le rappel
      // arrive en allemand.
      locale: parseLocale(booker.language) ?? DEFAULT_LOCALE,
    })

    const result = await sendResendEmail({
      to: booker.email,
      subject: mail.subject,
      html: mail.html,
    })

    if (result.ok) {
      sent++
    } else {
      // Rendre le droit d'envoyer : un rappel perdu doit pouvoir repartir au tick
      // suivant, sinon l'échec d'un envoi vaut renoncement définitif.
      console.error('[onboarding-call-reminder] send failed', call.id, result.error)
      await db.from('onboarding_calls')
        .update({ reminder_sent_at: null })
        .eq('id', call.id)
    }
  }

  return json({ scanned: (due ?? []).length, sent })
})
