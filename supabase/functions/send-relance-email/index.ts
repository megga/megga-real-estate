// MEGGA — send-relance-email Edge Function
// Wires DBRelanceSession's "Envoyer & suivant" CTA to real Resend sends.
// It accepts a free-form subject + body composed by the agent (or by
// MEGGA AI in the relance editor) so the agent owns the wording.
//
// L'envoi lui-même — validation, garde de sortie, gabarit, Resend — vit dans
// `_shared/relance-email-send.ts` depuis le 14.09.2026. Il y est partagé avec l'exécuteur
// WhatsApp (le « oui » de l'agent au copilote), qui appelait jusque-là cette fonction par
// HTTP sous la clé de service et recevait 401 à chaque fois. ⛔ Ce n'est PAS en ouvrant
// cette fonction à la clé de service que ça se corrigeait : elle devrait alors croire
// l'agence du corps de la requête, et redeviendrait le relais ouvert que la garde a fermé.
// Elle reste réservée au JWT d'un agent.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { sendRelanceEmail } from '../_shared/relance-email-send.ts'

interface SendRequest {
  to: string
  subject: string
  body: string
  agentName?: string
  agentSignature?: string
  // Optional metadata that ends up as Resend `tags` for analytics +
  // delivery-report cross-reference.
  leadId?: string
  /** Ignoré : l'agence est celle du profil authentifié. */
  agencyId?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    // Auth réelle : valide le JWT (auth.getUser) ET exige un profil avec agency_id.
    // Avant, on ne vérifiait que le préfixe « Bearer » → un faux jeton déclenchait
    // un envoi Resend réel depuis noreply@getmegga.com (usurpation d'expéditeur).
    const auth = await requireAgentAuth(req, CORS_HEADERS)
    if (auth instanceof Response) return auth
    const { profile } = auth

    const body: SendRequest = await req.json()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // L'agence est celle du profil authentifié, jamais celle du corps (non falsifiable) :
    // c'est elle qui juge le périmètre du destinataire et porte le quota.
    return await sendRelanceEmail(
      admin,
      { agencyId: profile.agency_id, actorId: auth.user.id, sender: 'send-relance-email' },
      {
        to: body.to,
        subject: body.subject,
        body: body.body,
        agentName: body.agentName,
        agentSignature: body.agentSignature,
        leadId: body.leadId,
      },
      CORS_HEADERS,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
