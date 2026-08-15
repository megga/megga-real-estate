// supabase/functions/magic-link-send-email/index.ts
// POST /functions/v1/magic-link-send-email
//
// Sprint 4.7.E — Envoi de l'email du lien magique KYC au client via Resend.
// DKIM/SPF megga.ch déjà configuré (cf. CLAUDE.md).
//
// Cette fonction est appelée :
//   1. Automatiquement par `magic-link-create` après création (si email
//      dans channels et contact.email non-null) — fire-and-forget côté create
//   2. Manuellement par l'agent (bouton "Renvoyer l'email") après expiration
//      ou si le client n'a pas ouvert dans 3 jours
//
// Input :
//   { magic_link_id: string }  // service_role bypass — appelable depuis create
//   OU appel auth agent avec même body
//
// Output :
//   { sent: true, recipient: string, resend_id: string }
//   { sent: false, reason: string }  // graceful (pas d'email contact, status expired, etc.)
//
// i18n : adapte le template selon `contact.language` (FR / DE / EN / IT).
// Fallback FR si null ou langue non supportée.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { kycMagicLinkUrl } from '../_shared/app-url.ts'
import { redactPII } from '../_shared/pii-redaction.ts'
import { buildMagicLinkEmail, normalizeLocale } from '../_shared/magic-link-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/**
 * Vérifie l'auth du caller. Accepte :
 *   - Appel interne magic-link-create (service_role exact)
 *   - Agent humain (JWT vérifié)
 *
 * Retourne le mode pour permettre au caller de scope les checks
 * d'ownership ensuite (le mode "agent" doit vérifier agency_id).
 *
 * Red-team finding F4 (audit 2026-05-19) : avant ce check, n'importe qui
 * connaissant un magic_link_id pouvait spammer le client cible (abus
 * Resend) + exfiltrer son email via la réponse.
 */
async function authorizeSendEmailCall(
  req: Request,
): Promise<
  | { mode: 'service_role' }
  | { mode: 'agent'; agencyId: string }
  | { mode: 'denied'; response: Response }
> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''

  if (serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`) {
    return { mode: 'service_role' }
  }

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return { mode: 'denied', response: auth }
  return { mode: 'agent', agencyId: auth.profile.agency_id }
}

const FROM_EMAIL = Deno.env.get('MEGGA_KYC_FROM_EMAIL') ?? 'kyc@megga.ch'
const FROM_NAME = Deno.env.get('MEGGA_KYC_FROM_NAME') ?? 'MEGGA'

// Le gabarit vit dans `_shared/magic-link-email.ts` depuis le 15.08.2026 : il y est PUR,
// donc testable et visible au banc de rendu (`npm run email:preview`). Cette fonction ne
// garde que le réseau et l'accès aux données.

interface SendEmailRequest {
  magic_link_id: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Auth obligatoire AVANT tout (red-team P0).
  const authz = await authorizeSendEmailCall(req)
  if (authz.mode === 'denied') return authz.response

  let body: SendEmailRequest
  try {
    body = (await req.json()) as SendEmailRequest
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!body.magic_link_id) {
    return new Response(JSON.stringify({ error: 'magic_link_id required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) {
    return new Response(
      JSON.stringify({ sent: false, reason: 'RESEND_API_KEY not configured' }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Charge le lien + contact + agence + agent
  const { data: link, error: linkErr } = await supabase
    .from('kyc_magic_links')
    .select('id, token, agency_id, contact_id, custom_message, status, channels, created_by')
    .eq('id', body.magic_link_id)
    .single()

  if (linkErr || !link) {
    return new Response(JSON.stringify({ sent: false, reason: 'Link not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Cross-agency guard pour le mode agent.
  // En service_role (pg_cron / appel interne magic-link-create), bypass —
  // le caller est trusted et l'ownership est déjà vérifié par magic-link-create.
  if (authz.mode === 'agent' && link.agency_id !== authz.agencyId) {
    return new Response(
      JSON.stringify({ error: 'forbidden: cross-agency access' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (!link.channels?.includes('email')) {
    return new Response(
      JSON.stringify({ sent: false, reason: 'email not in channels' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  if (link.status === 'expired' || link.status === 'submitted') {
    return new Response(
      JSON.stringify({ sent: false, reason: `link status is ${link.status}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const [contactRes, agencyRes, agentRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('first_name, last_name, email, language')
      .eq('id', link.contact_id)
      .single(),
    supabase.from('agencies').select('name').eq('id', link.agency_id).single(),
    link.created_by
      ? supabase.from('profiles').select('full_name').eq('id', link.created_by).single()
      : Promise.resolve({ data: null }),
  ])

  const contact = contactRes.data
  const agency = agencyRes.data
  const agent = agentRes.data

  if (!contact?.email) {
    return new Response(
      JSON.stringify({ sent: false, reason: 'contact has no email' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const locale = normalizeLocale(contact.language)
  // Même constructeur que magic-link-create : le bouton de l'e-mail mène là où
  // l'agent croit l'envoyer.
  const url = kycMagicLinkUrl(link.token)

  const { subject, html } = buildMagicLinkEmail({
    locale,
    firstName: contact.first_name,
    agentFullName: agent?.full_name ?? agency?.name ?? 'MEGGA',
    agencyName: agency?.name ?? 'MEGGA',
    url,
    customMessage: link.custom_message,
  })

  // Resend send
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [contact.email],
      subject,
      html,
      // Reply-to vers l'agence pour les questions du client
      // (l'agent reçoit la réponse directement dans son CRM email)
    }),
  })

  if (!resendRes.ok) {
    const errText = await resendRes.text()
    // Le corps d'erreur de Resend est expurgé AVANT d'aller où que ce soit : le corps de
    // requête qu'on vient de lui envoyer est le HTML de l'e-mail, lequel contient
    // `<a href=".../kyc/<jeton>">`. Un fournisseur qui recopie la requête dans son
    // diagnostic — pratique courante sur une erreur de validation — inscrirait donc le
    // capability token dans `activity_events`, table append-only conservée dix ans, ET
    // dans le corps 502 rendu à l'appelant.
    const errSafe = redactPII(errText).redactedText
    // Log silencieux dans activity_events pour debug compliance
    await supabase.from('activity_events').insert({
      agency_id: link.agency_id,
      actor_id: null,
      actor_kind: 'system',
      action: 'Email lien magique — échec envoi Resend',
      entity_type: 'kyc_magic_link',
      entity_id: link.id,
      category: 'kyc',
      severity: 'warn',
      object_label: `Lien ${link.id}`,
      metadata: {
        resend_status: resendRes.status,
        resend_error: errSafe.slice(0, 500),
        recipient: contact.email,
      },
    })
    return new Response(
      JSON.stringify({
        sent: false,
        reason: 'Resend API error',
        details: `${resendRes.status} ${errSafe.slice(0, 500)}`,
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  const resendData = await resendRes.json()

  // C'EST ICI, ET NULLE PART AILLEURS, qu'on sait qu'un message est réellement parti.
  // `kyc_magic_links.sent_at` ne le dit pas : c'est un DEFAULT now() posé à l'INSERT que
  // rien ne met à jour, donc il vaut la même chose que Resend ait répondu 200, 502, ou
  // n'ait jamais été appelé (canal `sms` seul, contact sans e-mail). Le diagnostic de
  // l'étape 19 le remettait pourtant comme preuve d'envoi.
  //
  // Best-effort ASSUMÉ : le message EST parti. Échouer la réponse parce qu'on n'a pas su
  // horodater ferait croire à l'appelant que l'envoi a raté, et `magic-link-create`
  // rejouerait — deux e-mails pour une demande. On journalise et on continue.
  // `updated_at` explicitement : le trigger d'audit ne le pose QUE dans sa branche de
  // changement de statut (`NEW.status IS DISTINCT FROM OLD.status`). Sans ça on laisserait
  // une ligne modifiée avec un `updated_at` périmé — et c'est aussi ce que font les autres
  // écrivains de cette table (admin_kyc_link_regenerate le pose à la main).
  const maintenant = new Date().toISOString()
  const { error: stampErr } = await supabase
    .from('kyc_magic_links')
    .update({ email_sent_at: maintenant, updated_at: maintenant })
    .eq('id', link.id)
  if (stampErr) {
    console.error('[magic-link-send-email] email_sent_at non posé:', stampErr.message)
  }

  // Audit envoi réussi
  await supabase.from('activity_events').insert({
    agency_id: link.agency_id,
    actor_id: null,
    actor_kind: 'system',
    action: 'Email lien magique envoyé',
    entity_type: 'kyc_magic_link',
    entity_id: link.id,
    category: 'kyc',
    severity: 'info',
    object_label: `Lien ${link.id}`,
    metadata: {
      provider: 'resend',
      resend_id: resendData?.id,
      recipient: contact.email,
      locale,
      lba_article: 'art. 3 (identification)',
    },
  })

  return new Response(
    JSON.stringify({
      sent: true,
      recipient: contact.email,
      resend_id: resendData?.id,
      locale,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
