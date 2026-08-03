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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

type Locale = 'fr' | 'de' | 'en' | 'it'

function normalizeLocale(lang: string | null | undefined): Locale {
  const l = (lang ?? '').toLowerCase().slice(0, 2)
  if (l === 'de' || l === 'en' || l === 'it') return l
  return 'fr'
}

interface TemplateStrings {
  subject: (agencyName: string) => string
  preheader: string
  greeting: (firstName: string) => string
  intro: (agentFullName: string, agencyName: string) => string
  cta: string
  expiryNote: string
  reassuranceTitle: string
  reassurance: { title: string; sub: string }[]
  closing: string
  footer: (agencyName: string) => string
  privacyMention: string
}

const STRINGS: Record<Locale, TemplateStrings> = {
  fr: {
    subject: (a) => `${a} — Finaliser votre dossier KYC`,
    preheader: 'Pour finaliser votre dossier, vérifions votre identité en quelques minutes.',
    greeting: (n) => `Bonjour ${n},`,
    intro: (agent, agency) =>
      `Pour finaliser votre dossier avec <strong>${agent}</strong> (${agency}), il nous reste à vérifier votre identité. Comptez environ 5 minutes.`,
    cta: 'Déposer mes pièces',
    expiryNote: 'Ce lien est sécurisé et expire dans 7 jours.',
    reassuranceTitle: 'Vos données restent protégées',
    reassurance: [
      { title: 'Données en Suisse', sub: 'Hébergement Genève' },
      { title: 'Chiffré bout-en-bout', sub: 'AES-256 · TLS 1.3' },
      { title: 'Vu par 2 personnes', sub: 'Votre agent + conformité' },
      { title: 'Conservé 10 ans', sub: 'LBA art. 7, puis supprimé' },
    ],
    closing: 'À très vite,',
    footer: (a) =>
      `Cet email vous a été envoyé par ${a} via MEGGA. Si vous n'attendiez pas cette demande, ignorez ce message — le lien expirera automatiquement.`,
    privacyMention:
      'Traitement de vos données conforme à la nLPD suisse et à la LBA (art. 7 — conservation 10 ans).',
  },
  de: {
    subject: (a) => `${a} — Vervollständigen Sie Ihr KYC-Dossier`,
    preheader: 'Lassen Sie uns Ihre Identität in wenigen Minuten verifizieren.',
    greeting: (n) => `Guten Tag ${n},`,
    intro: (agent, agency) =>
      `Um Ihr Dossier mit <strong>${agent}</strong> (${agency}) abzuschliessen, müssen wir Ihre Identität verifizieren. Dauer ca. 5 Minuten.`,
    cta: 'Dokumente bereitstellen',
    expiryNote: 'Dieser sichere Link läuft in 7 Tagen ab.',
    reassuranceTitle: 'Ihre Daten bleiben geschützt',
    reassurance: [
      { title: 'Daten in der Schweiz', sub: 'Hosting Genf' },
      { title: 'Ende-zu-Ende verschlüsselt', sub: 'AES-256 · TLS 1.3' },
      { title: 'Eingesehen von 2 Personen', sub: 'Ihr Berater + Compliance' },
      { title: '10 Jahre aufbewahrt', sub: 'GwG Art. 7, dann gelöscht' },
    ],
    closing: 'Mit freundlichen Grüssen,',
    footer: (a) =>
      `Diese E-Mail wurde Ihnen von ${a} über MEGGA gesendet. Falls Sie diese Anfrage nicht erwartet haben, ignorieren Sie diese Nachricht — der Link läuft automatisch ab.`,
    privacyMention:
      'Verarbeitung Ihrer Daten gemäss revDSG und GwG (Art. 7 — 10 Jahre Aufbewahrung).',
  },
  en: {
    subject: (a) => `${a} — Complete your KYC file`,
    preheader: "Let's verify your identity in a few minutes to finalize your file.",
    greeting: (n) => `Hello ${n},`,
    intro: (agent, agency) =>
      `To finalize your file with <strong>${agent}</strong> (${agency}), we need to verify your identity. About 5 minutes.`,
    cta: 'Upload my documents',
    expiryNote: 'This secure link expires in 7 days.',
    reassuranceTitle: 'Your data stays protected',
    reassurance: [
      { title: 'Data in Switzerland', sub: 'Hosting in Geneva' },
      { title: 'End-to-end encrypted', sub: 'AES-256 · TLS 1.3' },
      { title: 'Seen by 2 people', sub: 'Your agent + compliance' },
      { title: 'Kept 10 years', sub: 'AML Art. 7, then deleted' },
    ],
    closing: 'Kind regards,',
    footer: (a) =>
      `This email was sent to you by ${a} through MEGGA. If you did not expect this request, please ignore this message — the link will expire automatically.`,
    privacyMention:
      'Your data is processed in accordance with the Swiss FDPA and AML Act (Art. 7 — 10-year retention).',
  },
  it: {
    subject: (a) => `${a} — Finalizzare la sua pratica KYC`,
    preheader: 'Verifichiamo la sua identità in pochi minuti per finalizzare la pratica.',
    greeting: (n) => `Buongiorno ${n},`,
    intro: (agent, agency) =>
      `Per finalizzare la sua pratica con <strong>${agent}</strong> (${agency}), dobbiamo verificare la sua identità. Circa 5 minuti.`,
    cta: 'Caricare i miei documenti',
    expiryNote: 'Questo link sicuro scade tra 7 giorni.',
    reassuranceTitle: 'I suoi dati restano protetti',
    reassurance: [
      { title: 'Dati in Svizzera', sub: 'Hosting Ginevra' },
      { title: 'Crittografati end-to-end', sub: 'AES-256 · TLS 1.3' },
      { title: 'Visti da 2 persone', sub: 'Il suo agente + compliance' },
      { title: 'Conservati 10 anni', sub: 'LRD art. 7, poi cancellati' },
    ],
    closing: 'A presto,',
    footer: (a) =>
      `Questa email le è stata inviata da ${a} tramite MEGGA. Se non si aspettava questa richiesta, ignori questo messaggio — il link scadrà automaticamente.`,
    privacyMention:
      'Trattamento dei dati conforme alla nLPD svizzera e alla LRD (art. 7 — conservazione 10 anni).',
  },
}

function buildHtmlEmail(input: {
  locale: Locale
  firstName: string
  agentFullName: string
  agencyName: string
  url: string
  customMessage: string | null
}): string {
  const t = STRINGS[input.locale]
  const safe = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  // Compact, inline-CSS, Outlook-safe HTML
  return `<!doctype html>
<html lang="${input.locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${safe(t.subject(input.agencyName))}</title>
</head>
<body style="margin:0;padding:0;background:#EDEFF3;font-family:Manrope,Arial,sans-serif;color:#0B0C0E;">
<div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">${safe(t.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#EDEFF3;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;background:#FFFFFF;border-radius:24px;padding:40px 32px;box-shadow:0 12px 40px rgba(15,23,42,0.06);">
      <tr><td style="padding-bottom:24px;">
        <div style="font-family:Manrope,Arial,sans-serif;font-size:18px;font-weight:800;letter-spacing:-1px;color:#0B0C0E;">MEGGA</div>
      </td></tr>
      <tr><td style="padding-bottom:6px;font-size:11px;font-weight:700;color:#7A8088;letter-spacing:1.4px;text-transform:uppercase;">
        ${safe(input.agencyName)}
      </td></tr>
      <tr><td style="padding-bottom:18px;font-size:26px;font-weight:700;letter-spacing:-0.6px;line-height:1.15;color:#0B0C0E;">
        ${safe(t.greeting(input.firstName))}
      </td></tr>
      <tr><td style="padding-bottom:24px;font-size:14.5px;line-height:1.6;color:#3A3D44;font-weight:500;">
        ${t.intro(safe(input.agentFullName), safe(input.agencyName))}
      </td></tr>
      ${
        input.customMessage
          ? `<tr><td style="padding-bottom:24px;">
        <div style="background:#F7F8FA;border-radius:14px;padding:16px 18px;font-size:13.5px;line-height:1.55;color:#3A3D44;font-style:italic;white-space:pre-wrap;">${safe(input.customMessage)}</div>
      </td></tr>`
          : ''
      }
      <tr><td align="center" style="padding-bottom:14px;">
        <a href="${safe(input.url)}" style="display:inline-block;background:#0B0C0E;color:#FFFFFF;text-decoration:none;padding:18px 32px;border-radius:999px;font-size:15px;font-weight:600;letter-spacing:0.1px;box-shadow:0 8px 20px rgba(11,12,14,0.20);">${safe(t.cta)} →</a>
      </td></tr>
      <tr><td align="center" style="padding-bottom:32px;font-size:11.5px;color:#7A8088;font-weight:500;">
        ${safe(t.expiryNote)}
      </td></tr>
      <tr><td style="padding:24px 0 12px;border-top:1px solid #F0F1F4;font-size:11px;font-weight:700;color:#7A8088;letter-spacing:1.2px;text-transform:uppercase;">
        ${safe(t.reassuranceTitle)}
      </td></tr>
      <tr><td style="padding-bottom:24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:separate;border-spacing:8px 0;">
          <tr>
            ${t.reassurance
              .map(
                (r) => `<td valign="top" width="25%" style="padding:12px 8px;background:#F7F8FA;border-radius:12px;">
              <div style="font-size:12.5px;font-weight:700;color:#0B0C0E;letter-spacing:-0.1px;margin-bottom:2px;">${safe(r.title)}</div>
              <div style="font-size:11px;color:#7A8088;font-weight:500;line-height:1.4;">${safe(r.sub)}</div>
            </td>`,
              )
              .join('')}
          </tr>
        </table>
      </td></tr>
      <tr><td style="padding-top:12px;font-size:11.5px;color:#7A8088;line-height:1.5;font-weight:500;">
        ${safe(t.footer(input.agencyName))}
      </td></tr>
      <tr><td style="padding-top:10px;font-size:11px;color:#B5BAC2;line-height:1.5;font-weight:500;">
        ${safe(t.privacyMention)}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

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
  const t = STRINGS[locale]
  // Même constructeur que magic-link-create : le bouton de l'e-mail mène là où
  // l'agent croit l'envoyer.
  const url = kycMagicLinkUrl(link.token)

  const html = buildHtmlEmail({
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
      subject: t.subject(agency?.name ?? 'MEGGA'),
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
    const errSafe = redactPII(errText).text
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
