// supabase/functions/appointment-book/index.ts
// POST /functions/v1/appointment-book   (public — verify_jwt=false)
//
// Le client réserve son RDV de vérification KYC depuis le lien magique qu'il
// détient. Body : { token, starts_at, mode?, note? }
//
// Toute la validation métier vit dans `book_kyc_appointment` (RPC SECURITY
// DEFINER, migration 20260802200000) : préavis, horizon, plages hebdomadaires,
// battement, occupations, unicité par lien. Cette fonction ne la redouble pas —
// elle authentifie le porteur, appelle la RPC, puis traduit son code d'erreur.
// Dupliquer les règles ici les ferait diverger au premier changement.
//
// SURFACE DE SPAM. Elle est bornée par construction plutôt que par un compteur :
// il faut un jeton signé HMAC (donc émis par un agent) et un lien ne porte
// qu'UN rendez-vous (garde `already_booked` en base). Un limiteur de débit par
// IP ajouterait de l'état sans réduire ce qu'un attaquant peut réellement créer.
//
// Effets de bord en MEILLEUR EFFORT — agenda externe et courriel. Aucun des deux
// ne peut faire échouer une réservation déjà écrite : le rendez-vous existe, et
// punir le client d'une panne chez Google serait absurde.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyMagicLinkToken, signMagicLinkToken } from '../_shared/magic-link-token.ts'
import { createBookingEvent } from '../_shared/booking-calendar-write.ts'
import { sendBookingEmail } from '../_shared/booking-email.ts'
import type { TokenTable } from '../_shared/booking-oauth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const APP_URL = (Deno.env.get('MEGGA_APP_URL') ?? Deno.env.get('APP_URL') ?? 'https://app.megga.ch').replace(/\/$/, '')

/** Code d'erreur de la RPC → statut HTTP. Tout le reste est un 500 légitime. */
const STATUS_BY_CODE: Record<string, number> = {
  link_not_found: 401,
  link_expired: 410,
  no_agent: 409,
  already_booked: 409,
  booking_closed: 409,
  slot_taken: 409,      // 409 et non 400 : l'UI doit recharger les créneaux
  too_soon: 400,
  too_far: 400,
  outside_hours: 400,
  crosses_midnight: 400,
  bad_range: 400,
  bad_mode: 400,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const token = String(body.token ?? '').trim()
  const startsAt = String(body.starts_at ?? '').trim()
  const mode = body.mode != null ? String(body.mode) : null
  const note = body.note != null ? String(body.note).slice(0, 500) : null

  if (!token) return json({ error: 'token required' }, 400)
  if (!startsAt || !Number.isFinite(Date.parse(startsAt))) return json({ error: 'starts_at invalide' }, 400)
  if (mode !== null && mode !== 'sur_place' && mode !== 'video') return json({ error: 'mode invalide' }, 400)

  // 1) Crypto d'abord.
  const verified = await verifyMagicLinkToken(token)
  if (!verified.valid || !verified.payload) {
    return json(
      { error: verified.reason === 'expired' ? 'Link expired' : 'Invalid link', reason: verified.reason },
      verified.reason === 'expired' ? 410 : 401,
    )
  }
  // Un jeton de GESTION de rendez-vous (k='appt') ne réserve pas : son `id`
  // désigne un rendez-vous, pas un lien magique. Sans ce contrôle, la sécurité
  // reposerait sur le fait que les UUID des deux tables ne se croisent pas.
  if (verified.payload.k === 'appt') return json({ error: 'Invalid link', reason: 'wrong_token_kind' }, 401)

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // 2) Revalidation du lien en base (un lien régénéré révoque le précédent).
  const { data: link } = await db
    .from('kyc_magic_links')
    .select('id, token, agency_id, contact_id, expires_at, created_by')
    .eq('id', verified.payload.id)
    .maybeSingle()
  if (!link) return json({ error: 'Invalid link' }, 401)
  if (link.token !== token) return json({ error: 'Token superseded', reason: 'regenerated' }, 410)
  if (new Date(link.expires_at) < new Date()) return json({ error: 'Link expired' }, 410)

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip') || null
  const clientUa = req.headers.get('user-agent')

  // 3) La réservation elle-même. La RPC tranche ; on ne fait que traduire.
  const { data: appointmentId, error: rpcError } = await db.rpc('book_kyc_appointment', {
    p_magic_link_id: link.id,
    p_starts_at: new Date(startsAt).toISOString(),
    p_mode: mode,
    p_client_note: note,
    p_client_ip: clientIp,
    p_client_user_agent: clientUa,
  })

  if (rpcError) {
    const raw = String(rpcError.message ?? '')
    const code = Object.keys(STATUS_BY_CODE).find(c => raw.includes(c))
    if (code) return json({ error: code, reason: code }, STATUS_BY_CODE[code])
    console.error('appointment-book: échec RPC inattendu', raw)
    return json({ error: 'Could not book appointment' }, 500)
  }

  const apptId = String(appointmentId)

  // ── À partir d'ici, le rendez-vous EXISTE. Plus rien ne doit le remettre en
  //    cause : tout échec en aval est journalisé, pas propagé. ──

  const [{ data: appt }, { data: contact }, { data: agency }, { data: agent }, { data: settings }] =
    await Promise.all([
      db.rpc('get_kyc_appointment_public', { p_appointment_id: apptId }),
      db.from('contacts').select('first_name, last_name, email').eq('id', link.contact_id).maybeSingle(),
      db.from('agencies').select('name').eq('id', link.agency_id).maybeSingle(),
      db.from('profiles').select('full_name').eq('id', link.created_by).maybeSingle(),
      db.from('agent_booking_settings').select('timezone').eq('agent_id', link.created_by).maybeSingle(),
    ])

  const publicAppt = (appt ?? {}) as Record<string, unknown>
  const timeZone = String(settings?.timezone ?? 'Europe/Zurich')
  const startIso = String(publicAppt.starts_at ?? startsAt)
  const endIso = String(publicAppt.ends_at ?? startsAt)
  const contactName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(' ') : null

  const readTokens = async (table: TokenTable, userId: string) => {
    const { data } = await db.from(table).select('*').eq('user_id', userId).maybeSingle()
    return (data ?? null) as Record<string, unknown> | null
  }

  // 4) Écho dans l'agenda de l'agent : sans lui, l'agent verrait ce créneau
  //    libre dans Google alors qu'il vient d'être pris.
  try {
    const written = await createBookingEvent(readTokens, link.created_by, {
      appointmentId: apptId,
      summary: `Vérification d'identité — ${contactName ?? 'client'}`,
      description: [
        'Rendez-vous de vérification d\'identité (KYC), réservé par le client via MEGGA.',
        contactName ? `Client : ${contactName}` : null,
        contact?.email ? `E-mail : ${contact.email}` : null,
        note ? `Message du client : ${note}` : null,
      ].filter(Boolean).join('\n'),
      location: (publicAppt.location as string | null) ?? null,
      startIso, endIso, timeZone,
    })
    if (written) {
      await db.from('appointments')
        .update({ external_provider: written.provider, external_event_id: written.eventId })
        .eq('id', apptId)
    }
  } catch (e) {
    console.error('appointment-book: écho agenda externe échoué', e)
  }

  // 5) Confirmation au client, avec un lien de gestion signé pour CE rendez-vous.
  //    Il expire un jour après la séance : au-delà, il n'a plus d'objet.
  try {
    if (contact?.email) {
      const exp = Math.floor(new Date(endIso).getTime() / 1000) + 86_400
      const manageToken = await signMagicLinkToken({ id: apptId, exp, k: 'appt' })
      await sendBookingEmail({
        kind: 'confirmed',
        to: contact.email,
        contactName,
        startIso,
        timeZone,
        mode: (publicAppt.mode as 'sur_place' | 'video') ?? 'sur_place',
        location: (publicAppt.location as string | null) ?? null,
        videoLink: (publicAppt.video_link as string | null) ?? null,
        agencyName: agency?.name ?? null,
        agentName: agent?.full_name ?? null,
        manageUrl: `${APP_URL}/rendez-vous/${apptId}?token=${encodeURIComponent(manageToken)}`,
      })
      await db.from('appointments')
        .update({ confirmation_sent_at: new Date().toISOString() })
        .eq('id', apptId)
    }
  } catch (e) {
    console.error('appointment-book: envoi du courriel échoué', e)
  }

  return json({ ok: true, appointment: publicAppt })
})
