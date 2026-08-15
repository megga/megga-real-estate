// MEGGA — send-relance-email Edge Function
// Wires DBRelanceSession's "Envoyer & suivant" CTA to real Resend sends.
// Companion of send-property-email (which has a fixed property-card template).
// This one accepts a free-form subject + body composed by the agent (or by
// MEGGA AI in the relance editor) so the agent owns the wording.

import { buildRelanceEmail } from '../_shared/relance-email.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { emailSendAllowed, unsubscribeHeaders, unsubscribeFooterHtml } from '../_shared/email-guard.ts'

interface SendRequest {
  /** Pied de page de désinscription, injecté par la garde. Vide = pas de lien signé. */
  unsubscribeHtml?: string
  to: string
  subject: string
  body: string
  agentName?: string
  agentSignature?: string
  // Optional metadata that ends up as Resend `tags` for analytics +
  // delivery-report cross-reference.
  leadId?: string
  agencyId?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Gabarit dans `_shared/relance-email.ts` depuis le 15.08.2026 : pur, donc testable et
// visible au banc de rendu.

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    // Auth réelle : valide le JWT (auth.getUser) ET exige un profil avec agency_id.
    // Avant, on ne vérifiait que le préfixe « Bearer » → un faux jeton déclenchait
    // un envoi Resend réel depuis noreply@megga.ch (usurpation d'expéditeur).
    const auth = await requireAgentAuth(req, CORS_HEADERS)
    if (auth instanceof Response) return auth
    const { profile } = auth

    const body: SendRequest = await req.json()

    if (!body.to || !body.subject || !body.body) {
      return new Response(
        JSON.stringify({ error: 'to, subject and body are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    if (!EMAIL_REGEX.test(body.to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const tags = [
      { name: 'kind', value: 'relance' },
      ...(body.leadId ? [{ name: 'lead_id', value: body.leadId }] : []),
      // agency_id pris du profil authentifié, pas du body (non falsifiable).
      { name: 'agency_id', value: profile.agency_id },
    ]

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    // ⛔ GARDE. Une relance est un envoi que NOUS initions : un STOP reçu sur WhatsApp
    // (channel='all') la bloque, tout comme un clic « se désinscrire » sur un e-mail
    // précédent. C'est le trou que ce chantier ferme — le refus était enregistré et
    // opposable, et ce canal-ci l'ignorait.
    const verdict = await emailSendAllowed(admin, { to: body.to, purpose: 'relance' })
    if (!verdict.allowed) {
      return new Response(
        JSON.stringify({ error: verdict.reason, blocked: true }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      )
    }

    const unsub = await unsubscribeHeaders(body.to)
    const { html } = buildRelanceEmail({
      ...body,
      unsubscribeHtml: unsub ? unsubscribeFooterHtml(unsub.url) : undefined,
    })

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'MEGGA Immobilier <noreply@megga.ch>',
        to: [body.to],
        subject: body.subject,
        html,
        tags,
        // `List-Unsubscribe` + one-click : ce que Gmail et Outlook ATTENDENT. Leur absence
        // pèse sur la délivrabilité de tout le domaine, pas seulement de ce message.
        ...(unsub ? { headers: unsub.headers } : {}),
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({
          error: resendData.message ?? 'Resend API error',
          details: resendData,
        }),
        { status: resendResponse.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id, to: body.to }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
