import { buildPropertyEmail } from '../_shared/property-email.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { emailSendAllowed, unsubscribeHeaders, unsubscribeFooterHtml } from '../_shared/email-guard.ts'

interface PropertyPayload {
  title: string
  price: number
  address: string
  city: string
  rooms: number | null
  surface_m2: number | null
  type: string
  photo_url: string | null
  source_url: string
  source_agency: string | null
  source_portal: string
}

interface SendRequest {
  to: string
  contactFirstName: string
  agentName: string
  agentPhone: string
  property: PropertyPayload
  message?: string
}

// Gabarit et formatage vivent dans `_shared/property-email.ts` depuis le 15.08.2026 :
// purs, donc testables et visibles au banc de rendu.

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    // Auth réelle (agent authentifié) : valide le JWT (auth.getUser) ET exige un
    // profil avec agency_id. Avant, seul le préfixe « Bearer » était vérifié → un
    // faux jeton déclenchait un envoi Resend réel (usurpation d'expéditeur megga.ch).
    const auth = await requireAgentAuth(req, { 'Access-Control-Allow-Origin': '*' })
    if (auth instanceof Response) return auth

    const body: SendRequest = await req.json()

    // Validate required fields
    if (!body.to || !body.property) {
      return new Response(JSON.stringify({ error: 'to and property are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.to)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Send via Resend
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    // ⛔ GARDE du canal e-mail. Un STOP reçu sur WhatsApp écrit `channel='all'` : sans
    // cette lecture, la personne continuerait de recevoir ces envois après avoir demandé
    // qu'on la laisse tranquille.
    const verdict = await emailSendAllowed(admin, { to: body.to, purpose: 'relance' })
    if (!verdict.allowed) {
      return new Response(
        JSON.stringify({ error: verdict.reason, blocked: true }),
        { status: 409, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
      )
    }

    // Une garde sans porte de sortie n'est qu'une moitié de mécanisme : la personne peut
    // être bloquée, mais pas se bloquer elle-même. Le jeton porte l'ADRESSE — cet envoi
    // part vers un destinataire qui n'a pas forcément de fiche chez nous.
    const unsub = await unsubscribeHeaders(body.to)
    const { subject, html } = buildPropertyEmail({
      ...body,
      unsubscribeHtml: unsub ? unsubscribeFooterHtml(unsub.url) : undefined,
    })

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `MEGGA Immobilier <noreply@megga.ch>`,
        to: [body.to],
        subject,
        html,
        // `List-Unsubscribe` + one-click : ce que Gmail et Outlook ATTENDENT. Leur absence
        // pèse sur la délivrabilité de tout le domaine, pas seulement de ce message.
        ...(unsub ? { headers: unsub.headers } : {}),
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({
        error: resendData.message || 'Resend API error',
        details: resendData,
      }), {
        status: resendResponse.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      emailId: resendData.id,
      to: body.to,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
