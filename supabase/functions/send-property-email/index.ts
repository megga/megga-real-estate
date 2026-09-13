import { buildPropertyEmail } from '../_shared/property-email.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { unsubscribeHeaders, unsubscribeFooterHtml } from '../_shared/email-guard.ts'
import { guardOutboundEmail } from '../_shared/email-recipient.ts'

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

// ⚠ Ni nom ni téléphone d'agent dans le corps : la signature se lit dans le profil
// de l'appelant (voir plus bas), un champ envoyé ici serait ignoré.
interface SendRequest {
  to: string
  contactFirstName: string
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
    // faux jeton déclenchait un envoi Resend réel (usurpation d'expéditeur getmegga.com).
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // ⛔ GARDE DE SORTIE (13.09.2026) : périmètre → suppression → quota.
    //   · PÉRIMÈTRE — le destinataire doit être connu de l'agence de l'appelant. Avant, `to`
    //     était libre derrière un jeton d'agent gratuit : un relais ouvert signé DKIM.
    //   · SUPPRESSION — un STOP reçu sur WhatsApp écrit `channel='all'` : sans cette lecture,
    //     la personne continuerait de recevoir ces envois après avoir demandé qu'on la laisse
    //     tranquille.
    //   · QUOTA — 60/h, 300/j par agence, réglable dans app_config.email_send_caps.
    const refus = await guardOutboundEmail(
      admin,
      { agencyId: auth.profile.agency_id, actorId: auth.user.id },
      { to: body.to, purpose: 'relance', sender: 'send-property-email' },
      { 'Access-Control-Allow-Origin': '*' },
    )
    if (refus) return refus

    // ⛔ LA SIGNATURE VIENT DU PROFIL DE L'APPELANT, jamais du corps de la requête.
    // Le seul appelant (fiche d'annonce marché) n'envoyait ni nom ni téléphone, et le
    // hook comblait avec « Gregory Lyonnet · +41 22 000 00 00 » : chaque fiche envoyée
    // par N'IMPORTE QUELLE agence partait signée de ce nom, avec un numéro inventé.
    // Lire le profil ferme au passage l'usurpation — l'e-mail part du domaine MEGGA,
    // le nom qu'il porte ne peut pas être une saisie libre.
    const { data: signataire } = await admin
      .from('profiles')
      .select('full_name, phone')
      .eq('id', auth.user.id)
      .maybeSingle()
    const agentName = (signataire?.full_name as string | null)?.trim() || 'MEGGA'
    const agentPhone = (signataire?.phone as string | null)?.trim() || null

    // Une garde sans porte de sortie n'est qu'une moitié de mécanisme : la personne peut
    // être bloquée, mais pas se bloquer elle-même. Le jeton porte l'ADRESSE — cet envoi
    // part vers un destinataire qui n'a pas forcément de fiche chez nous.
    const unsub = await unsubscribeHeaders(body.to)
    const { subject, html } = buildPropertyEmail({
      contactFirstName: body.contactFirstName,
      property: body.property,
      message: body.message,
      agentName,
      agentPhone,
      unsubscribeHtml: unsub ? unsubscribeFooterHtml(unsub.url) : undefined,
    })

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `MEGGA Immobilier <noreply@getmegga.com>`,
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
