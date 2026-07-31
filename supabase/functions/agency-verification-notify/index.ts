// supabase/functions/agency-verification-notify/index.ts
//
// Annonce a une agence la decision prise sur son dossier d'identite KYB (etape 7, tache 6).
//
// POURQUOI CETTE FONCTION EXISTE. Avant elle, ni une validation ni un rejet n'emettait quoi
// que ce soit : l'agence decouvrait la decision en se reconnectant et en lisant le bandeau.
// Le cas qui compte le plus est la CORRECTION -- son motif est obligatoire cote RPC
// precisement pour etre actionnable, et il ne l'est que s'il atteint le dirigeant. Sans ce
// courriel, il resoumettait a l'identique.
//
// POURQUOI DECLENCHEE PAR UN TRIGGER, ET NON PAR L'ECRAN DE REVUE. Un appel depuis la console
// admin apres chaque decision serait skippable : un onglet ferme entre les deux appels, et la
// decision est prise sans que personne ne l'apprenne. Le trigger
// (agencies_notify_verification_decision, 20260731160000) attrape TOUTES les transitions,
// y compris celles du moteur (auto_validated) et toute decision future, sans que la RPC
// correspondante ait a y penser. Meme motif que le declenchement de agency-verification-run
// depuis submit_agency_identity : net.http_post best-effort, jamais bloquant.
//
// POURQUOI ELLE RELIT LE MOTIF ELLE-MEME. Les RPC de decision ecrivent leur activity_events
// APRES l'UPDATE de agencies : au moment ou le trigger part, l'evenement n'existe pas encore.
// net.http_post met la requete en file et le worker pg_net la traite APRES le commit, donc
// cette fonction lit un journal deja ecrit. C'est la seule facon d'avoir le motif sans le
// faire transiter par le corps de la requete -- ou il vivrait en clair dans
// net.http_request_queue.
//
// Auth : Bearer == cle service-role, comparaison a temps constant, meme motif que
// agency-verification-run et kyc-screening. Aucun chemin utilisateur.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  isNotifiableStatus,
  noticeRecipients,
  buildVerificationNotice,
} from '../_shared/agency-verification-notice.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Les actions qui portent un motif dans metadata.reason. Une validation n'en porte pas :
 *  lire le dernier motif toutes actions confondues ressortirait celui d'un rejet anterieur. */
const REASON_ACTIONS = [
  'agency_verification_rejected',
  'agency_verification_correction_requested',
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const provided = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!serviceRoleKey || !safeEqual(provided, serviceRoleKey)) {
    return json({ error: 'unauthorized' }, 401)
  }

  let body: { agency_id?: string; status?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const agencyId = body.agency_id
  if (typeof agencyId !== 'string' || !UUID_RE.test(agencyId)) {
    return json({ error: 'agency_id required (uuid)' }, 400)
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    // 1. L'agence, et son statut RELU en base plutot que celui du corps de la requete. Le
    // worker pg_net traite la file avec du retard : entre le declenchement et ici, un second
    // relecteur a pu trancher autrement. Notifier l'etat d'avant enverrait une bonne
    // nouvelle a une agence qui vient d'etre refusee.
    const { data: agency, error: agencyErr } = await supabase
      .from('agencies')
      .select('id, name, legal_name, email, verification_status')
      .eq('id', agencyId)
      .maybeSingle<{
        id: string
        name: string | null
        legal_name: string | null
        email: string | null
        verification_status: string | null
      }>()

    if (agencyErr) throw agencyErr
    if (!agency) return json({ error: 'agency_not_found' }, 404)

    const status = agency.verification_status
    if (!isNotifiableStatus(status)) {
      // Ni une erreur ni un envoi : le statut a change entre-temps vers un etat d'attente.
      return json({ ok: true, skipped: 'status_not_notifiable', status })
    }

    // 2. Les destinataires : les dirigeants, jamais toute l'equipe (voir le module partage).
    const { data: members, error: membersErr } = await supabase
      .from('profiles')
      .select('email, role')
      .eq('agency_id', agencyId)
    if (membersErr) throw membersErr

    const recipients = noticeRecipients(members ?? [], agency.email)
    if (recipients.length === 0) {
      // Dit, jamais tu : une agence sans destinataire joignable est un fait que le support
      // doit pouvoir constater, pas un envoi qui disparait.
      await supabase.from('activity_events').insert({
        agency_id: agencyId, actor_id: null, actor_kind: 'system',
        action: 'agency_verification_notice_undeliverable', entity_type: 'agency', entity_id: agencyId,
        category: 'kyc', severity: 'warn', metadata: { status },
      })
      return json({ ok: true, skipped: 'no_recipient', status })
    }

    // 3. Le motif de la decision, relu dans le journal (voir l'en-tete). Uniquement pour les
    // actions qui en portent un.
    let reason: string | null = null
    const { data: events } = await supabase
      .from('activity_events')
      .select('action, metadata, created_at')
      .eq('agency_id', agencyId)
      .in('action', REASON_ACTIONS)
      .order('created_at', { ascending: false })
      .limit(1)
    const latest = events?.[0] as { metadata?: { reason?: unknown } } | undefined
    if (typeof latest?.metadata?.reason === 'string') reason = latest.metadata.reason

    const notice = buildVerificationNotice({
      status,
      agencyName: agency.legal_name ?? agency.name ?? 'votre agence',
      reason,
      appUrl: Deno.env.get('APP_URL') ?? 'https://app.megga.ch',
    })

    // 4. Envoi. Sans cle Resend, on ne pretend pas avoir envoye : meme discipline que les
    // connecteurs KYB, ou une source injoignable produit `unavailable` et non un verdict.
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
    if (!resendKey) {
      await supabase.from('activity_events').insert({
        agency_id: agencyId, actor_id: null, actor_kind: 'system',
        action: 'agency_verification_notice_undeliverable', entity_type: 'agency', entity_id: agencyId,
        category: 'kyc', severity: 'warn', metadata: { status, cause: 'resend_key_missing' },
      })
      return json({ ok: true, skipped: 'resend_key_missing', status })
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: 'MEGGA Immobilier <noreply@megga.ch>',
        to: recipients,
        subject: notice.subject,
        html: notice.html,
      }),
    })
    if (!res.ok) {
      // Le statut seul, jamais le corps : il peut contenir un echo de la requete, donc des
      // adresses -- et raw_response comme activity_events sont conserves dix ans.
      throw new Error(`Resend a repondu ${res.status}`)
    }

    // 5. Trace. `recipients` compte, mais les adresses elles-memes n'entrent PAS dans le
    // journal : activity_events est append-only et conserve dix ans, y recopier des adresses
    // de dirigeants creerait une seconde retention hors du registre des traitements. Le
    // nombre suffit a constater qu'un envoi a eu lieu.
    await supabase.from('activity_events').insert({
      agency_id: agencyId, actor_id: null, actor_kind: 'system',
      action: 'agency_verification_notice_sent', entity_type: 'agency', entity_id: agencyId,
      category: 'kyc', severity: 'info',
      metadata: { status, recipients: recipients.length, with_reason: reason !== null },
    })

    return json({ ok: true, status, recipients: recipients.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[agency-verification-notify]', message)
    return json({ error: message }, 500)
  }
})
