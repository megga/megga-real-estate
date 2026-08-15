// supabase/functions/whatsapp-optin-invite/index.ts
// Envoie à un contact, PAR E-MAIL, l'invitation à consentir aux messages WhatsApp.
//
// C'est le SEUL chemin d'opt-in du dispositif, et sa forme est contrainte par ce qu'elle
// doit prouver :
//   · l'invitation part sur un canal DÉJÀ consenti (e-mail) — on ne démarche pas sur
//     WhatsApp pour obtenir l'autorisation d'écrire sur WhatsApp ;
//   · elle porte l'information préalable (art. 6 al. 6 nLPD), archivée mot pour mot ;
//   · c'est la personne qui agit : elle clique, WhatsApp s'ouvre, ELLE envoie.
//
// Cette fonction n'est plus qu'une COQUILLE D'AUTHENTIFICATION : le geste vit dans
// `_shared/whatsapp-optin-send.ts`, partagé avec l'exécuteur du copilote WhatsApp. Deux
// portes d'entrée, un seul comportement — sinon l'une des deux finit par oublier une garde.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { sendOptinInvite, INVITE_DAYS, type OptinSendError } from '../_shared/whatsapp-optin-send.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const json = (o: unknown, status: number) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

/** Un refus MÉTIER n'est pas une panne : le CRM doit pouvoir l'expliquer, pas réessayer. */
const STATUS: Record<OptinSendError, number> = {
  contact_not_found: 404,
  contact_without_email: 400,
  contact_without_phone: 400,
  agency_wa_number_missing: 409,
  phone_suppressed: 409,
  invite_not_created: 500,
  email_not_configured: 500,
  email_send_failed: 502,
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await requireAgentAuth(req, CORS)
  if (auth instanceof Response) return auth
  const { profile } = auth
  if (!profile.agency_id) return json({ error: 'no_agency' }, 403)

  const { contact_id } = (await req.json().catch(() => ({}))) as { contact_id?: string }
  if (!contact_id) return json({ error: 'contact_id required' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const r = await sendOptinInvite(admin, {
    contactId: contact_id, agencyId: profile.agency_id, sentBy: profile.id,
  })
  if (!r.ok) return json({ error: r.error }, STATUS[r.error] ?? 400)

  // ⛔ Le jeton n'est PAS rendu : un agent qui pourrait se le faire remettre pourrait
  // fabriquer le consentement du contact depuis son propre téléphone.
  return json({ ok: true, invite_id: r.inviteId, lang: r.lang, expires_in_days: INVITE_DAYS }, 200)
})
