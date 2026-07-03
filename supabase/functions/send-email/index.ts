// supabase/functions/send-email/index.ts
// Generic email Edge Function — handles seller estimation, agent notification, portal access emails
// Uses Resend API with MEGGA branding

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SendEmailRequest {
  to: string
  subject: string
  template: string
  data: Record<string, unknown>
}

function formatCHF(amount: number): string {
  return `CHF ${amount.toLocaleString('fr-CH').replace(/,/g, "'")}`
}

// ── HTML wrapper ──────────────────────────────────────────────────

function wrapHTML(subject: string, bodyHTML: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#1a1a1a;padding:24px 32px;text-align:center">
    <span style="color:white;font-size:20px;font-weight:700;letter-spacing:2px">MEGGA</span>
    <span style="display:block;color:#9ca3af;font-size:11px;margin-top:2px">Immobilier Suisse</span>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 20px;font-size:18px;color:#111827">${subject}</h2>
    ${bodyHTML}
  </div>
  <div style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:11px;color:#9ca3af">MEGGA Real Estate &mdash; megga.ch</p>
  </div>
</div>
</body>
</html>`
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151">${text}</p>`
}

function cta(label: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0 16px">
    <a href="${url}" style="display:inline-block;padding:12px 28px;background:#2563EB;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600">${label}</a>
  </div>`
}

function box(content: string): string {
  return `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:16px 0">${content}</div>`
}

function row(label: string, value: string): string {
  return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px">
    <span style="color:#6b7280">${label}</span>
    <span style="color:#111827;font-weight:500">${value}</span>
  </div>`
}

// ── Template: Seller Estimation ───────────────────────────────────

function sellerEstimation(data: Record<string, unknown>): { subject: string; html: string } {
  const name = data.name as string || ''
  const address = data.address as string || ''
  const city = data.city as string || ''
  const estMin = data.estimation_min as number
  const estMax = data.estimation_max as number
  const confidence = data.confidence as string || 'medium'

  const firstName = name.split(' ')[0] || name

  const confidenceLabel = confidence === 'high' ? 'Confiance haute' : confidence === 'medium' ? 'Confiance moyenne' : 'Confiance faible'

  const subject = `Votre estimation MEGGA — ${address || city}`

  const bodyHTML = [
    p(`Bonjour ${firstName},`),
    p(`Merci pour votre demande d'estimation pour le bien situé à <strong>${address}${city ? `, ${city}` : ''}</strong>.`),
    box(`
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px">Valeur estimée</p>
      <p style="margin:0;font-size:24px;font-weight:700;color:#111827">${estMin ? formatCHF(estMin) : '—'} — ${estMax ? formatCHF(estMax) : '—'}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#9ca3af">${confidenceLabel}</p>
    `),
    p('<strong>Prochaines étapes :</strong>'),
    p('1. Un agent MEGGA de votre région vous contactera sous 24h'),
    p('2. Visite gratuite et sans engagement de votre bien'),
    p('3. Proposition de mandat personnalisée'),
    cta('En savoir plus sur MEGGA', 'https://megga.ch'),
    p('<span style="font-size:12px;color:#9ca3af">Questions ? Répondez directement à cet email.</span>'),
  ].join('\n')

  return { subject, html: wrapHTML(subject, bodyHTML) }
}

// ── Template: Agent New Seller Lead ──────────────────────────────

function agentNewSellerLead(data: Record<string, unknown>): { subject: string; html: string } {
  const sellerName = data.seller_name as string || 'Vendeur'
  const sellerEmail = data.seller_email as string || ''
  const sellerPhone = data.seller_phone as string || 'Non renseigné'
  const address = data.address as string || ''
  const city = data.city as string || ''
  const canton = data.canton as string || ''
  const type = data.type as string || ''
  const rooms = data.rooms as string || ''
  const surface = data.surface as number || 0
  const estimationRange = data.estimation_range as string || ''
  const motivation = data.motivation as string || ''
  const dashboardUrl = data.dashboard_url as string || 'https://megga.ch/dashboard'

  const typeLabel = type === 'apartment' ? 'Appartement' : type === 'house' ? 'Maison' : type === 'villa' ? 'Villa' : type === 'land' ? 'Terrain' : type || 'Bien'
  const motivLabel = motivation === 'immediate' ? 'Immédiate' : motivation === '3months' ? 'Dans les 3 mois' : motivation === '6months' ? 'Dans les 6 mois' : motivation === 'exploring' ? 'En exploration' : motivation

  const subject = `Nouveau lead vendeur — ${sellerName}, ${typeLabel} ${rooms}p à ${city || canton}`

  const bodyHTML = [
    p(`<strong>Nouveau lead vendeur sur MEGGA</strong>`),
    box(`
      ${row('Vendeur', sellerName)}
      ${row('Téléphone', sellerPhone)}
      ${row('Email', sellerEmail)}
      <div style="border-top:1px solid #e5e7eb;margin:8px 0"></div>
      ${row('Adresse', `${address}${city ? `, ${city}` : ''}${canton ? ` (${canton})` : ''}`)}
      ${row('Type', `${typeLabel} ${rooms}p`)}
      ${row('Surface', `${surface} m²`)}
      ${row('Estimation', estimationRange)}
      ${row('Motivation', motivLabel)}
    `),
    cta('Voir dans mon dashboard', dashboardUrl),
  ].join('\n')

  return { subject, html: wrapHTML(subject, bodyHTML) }
}

// ── Template: Seller Portal Access ──────────────────────────────

function sellerPortalAccess(data: Record<string, unknown>): { subject: string; html: string } {
  const name = data.name as string || ''
  const portalUrl = data.portal_url as string || ''
  const address = data.address as string || ''
  const agentName = data.agent_name as string || 'Votre agent MEGGA'

  const firstName = name.split(' ')[0] || name

  const subject = 'Votre espace vendeur MEGGA est prêt'

  const bodyHTML = [
    p(`Bonjour ${firstName},`),
    p(`<strong>${agentName}</strong> prend en charge la vente de votre bien${address ? ` situé à <strong>${address}</strong>` : ''}.`),
    p('Suivez l\'avancement de votre vente en temps réel depuis votre espace vendeur :'),
    cta('Accéder à mon espace vendeur', portalUrl),
    p('Dans votre espace, vous pourrez :'),
    p('&bull; Suivre les visites et les retours acquéreurs<br>&bull; Consulter les offres reçues<br>&bull; Échanger avec votre agent<br>&bull; Analyser le positionnement marché de votre bien'),
    p('<span style="font-size:12px;color:#9ca3af">Ce lien est personnel et sécurisé. Ne le partagez pas.</span>'),
  ].join('\n')

  return { subject, html: wrapHTML(subject, bodyHTML) }
}

// ── Template: Ticket Confirmation (to client) ───────────────────

function ticketConfirmation(data: Record<string, unknown>): { subject: string; html: string } {
  const name = data.name as string || ''
  const ticketNumber = data.ticket_number as string || ''
  const subject = data.subject as string || ''
  const trackingUrl = data.tracking_url as string || ''

  const firstName = name.split(' ')[0] || name
  const emailSubject = `Votre demande ${ticketNumber} a été reçue`

  const bodyHTML = [
    p(`Bonjour ${firstName},`),
    p(`Nous avons bien reçu votre demande concernant <strong>&laquo; ${subject} &raquo;</strong>.`),
    p('Notre équipe vous répondra sous <strong>24h en jours ouvrés</strong>.'),
    cta('Suivre mon ticket', trackingUrl),
    p(`<span style="font-size:12px;color:#9ca3af">Numéro de référence : ${ticketNumber}</span>`),
  ].join('\n')

  return { subject: emailSubject, html: wrapHTML(emailSubject, bodyHTML) }
}

// ── Template: Ticket Notification Admin ─────────────────────────

function ticketNotificationAdmin(data: Record<string, unknown>): { subject: string; html: string } {
  const ticketNumber = data.ticket_number as string || ''
  const subject = data.subject as string || ''
  const submitterName = data.submitter_name as string || ''
  const submitterEmail = data.submitter_email as string || ''
  const category = data.category as string || ''
  const message = data.message as string || ''
  const dashboardUrl = data.dashboard_url as string || ''

  const emailSubject = `Nouveau ticket ${ticketNumber} — ${subject}`

  const bodyHTML = [
    p(`<strong>Nouveau ticket support</strong>`),
    box(`
      ${row('Ticket', ticketNumber)}
      ${row('Client', submitterName)}
      ${row('Email', submitterEmail)}
      ${row('Catégorie', category)}
      <div style="border-top:1px solid #e5e7eb;margin:8px 0"></div>
      <p style="margin:0;font-size:13px;color:#374151">${message.substring(0, 200)}${message.length > 200 ? '...' : ''}</p>
    `),
    cta('Voir dans le dashboard', dashboardUrl),
  ].join('\n')

  return { subject: emailSubject, html: wrapHTML(emailSubject, bodyHTML) }
}

// ── Template: Ticket Reply (agent to client) ────────────────────

function ticketReply(data: Record<string, unknown>): { subject: string; html: string } {
  const name = data.name as string || ''
  const ticketNumber = data.ticket_number as string || ''
  const replyBody = data.reply_body as string || ''
  const trackingUrl = data.tracking_url as string || ''

  const firstName = name.split(' ')[0] || name
  const emailSubject = `Re: Votre demande ${ticketNumber}`

  const bodyHTML = [
    p(`Bonjour ${firstName},`),
    p("L'équipe MEGGA a répondu à votre demande :"),
    box(`<p style="margin:0;font-size:14px;line-height:1.6;color:#374151;white-space:pre-wrap">${replyBody}</p>`),
    cta('Répondre', trackingUrl),
    p(`<span style="font-size:12px;color:#9ca3af">Référence : ${ticketNumber}</span>`),
  ].join('\n')

  return { subject: emailSubject, html: wrapHTML(emailSubject, bodyHTML) }
}

// ── Template: Ticket Resolved + CSAT ────────────────────────────

function ticketResolved(data: Record<string, unknown>): { subject: string; html: string } {
  const name = data.name as string || ''
  const ticketNumber = data.ticket_number as string || ''
  const feedbackUrl = data.feedback_url as string || ''

  const firstName = name.split(' ')[0] || name
  const emailSubject = `Votre demande ${ticketNumber} a été résolue`

  const bodyHTML = [
    p(`Bonjour ${firstName},`),
    p(`Votre demande <strong>${ticketNumber}</strong> a été traitée et marquée comme résolue.`),
    p('Êtes-vous satisfait du support reçu ?'),
    `<div style="text-align:center;margin:20px 0">
      <a href="${feedbackUrl}&rating=1" style="text-decoration:none;font-size:28px;margin:0 4px">😡</a>
      <a href="${feedbackUrl}&rating=2" style="text-decoration:none;font-size:28px;margin:0 4px">😕</a>
      <a href="${feedbackUrl}&rating=3" style="text-decoration:none;font-size:28px;margin:0 4px">😐</a>
      <a href="${feedbackUrl}&rating=4" style="text-decoration:none;font-size:28px;margin:0 4px">🙂</a>
      <a href="${feedbackUrl}&rating=5" style="text-decoration:none;font-size:28px;margin:0 4px">😀</a>
    </div>`,
    p('<span style="font-size:12px;color:#9ca3af">Si le problème persiste, répondez à ce ticket et il sera automatiquement rouvert.</span>'),
  ].join('\n')

  return { subject: emailSubject, html: wrapHTML(emailSubject, bodyHTML) }
}

// ── Template: Contact Form — confirmation au visiteur ──────────

function contactConfirmation(data: Record<string, unknown>): { subject: string; html: string } {
  const name    = (data.name    as string) || ''
  const subject = (data.subject as string) || ''
  const message = (data.message as string) || ''
  const firstName = name.split(' ')[0] || name

  const emailSubject = 'Nous avons bien reçu votre message — MEGGA'

  const bodyHTML = [
    p(`Bonjour ${firstName},`),
    p('Merci de nous avoir écrit. Votre message est bien arrivé et un membre de l\'équipe MEGGA vous répondra <strong>sous 24 heures ouvrées</strong>.'),
    box(`
      ${subject ? row('Sujet', subject) : ''}
      <div style="border-top:1px solid #e5e7eb;margin:8px 0"></div>
      <p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap">${message.substring(0, 400)}${message.length > 400 ? '…' : ''}</p>
    `),
    p('En attendant, vous pouvez explorer nos biens disponibles ou estimer votre logement en moins de 2 minutes :'),
    cta('Voir les biens disponibles', 'https://megga.ch/acheter'),
    p('<span style="font-size:12px;color:#9ca3af">Vous pouvez répondre directement à cet email pour compléter votre demande.</span>'),
  ].join('\n')

  return { subject: emailSubject, html: wrapHTML(emailSubject, bodyHTML) }
}

// ── Template: Contact Form — notification admin ─────────────────

function contactNotificationAdmin(data: Record<string, unknown>): { subject: string; html: string } {
  const name    = (data.name    as string) || 'Inconnu'
  const email   = (data.email   as string) || ''
  const phone   = (data.phone   as string) || 'Non renseigné'
  const subject = (data.subject as string) || '(sans sujet)'
  const message = (data.message as string) || ''
  const lang    = (data.lang    as string) || 'fr'
  const dashboardUrl = (data.dashboard_url as string) || 'https://megga.ch/dashboard'

  const emailSubject = `Nouveau message contact — ${name}`

  const bodyHTML = [
    p('<strong>Nouveau message via la page /contact</strong>'),
    box(`
      ${row('Nom', name)}
      ${row('Email', email)}
      ${row('Téléphone', phone)}
      ${row('Langue', lang.toUpperCase())}
      ${row('Sujet', subject)}
      <div style="border-top:1px solid #e5e7eb;margin:8px 0"></div>
      <p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap">${message}</p>
    `),
    cta('Voir dans le back-office', dashboardUrl),
    p(`<span style="font-size:12px;color:#9ca3af">Pour répondre, écrivez directement à <a href="mailto:${email}">${email}</a>.</span>`),
  ].join('\n')

  return { subject: emailSubject, html: wrapHTML(emailSubject, bodyHTML) }
}

// ── Main handler ────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject: overrideSubject, template, data }: SendEmailRequest = await req.json()

    // ── Auth ────────────────────────────────────────────────────────────────
    // Templates PUBLICS = contenu 100% rendu serveur (formulaires contact / ticket).
    // Tout le reste — dont le case `default` avec `data.html` arbitraire — exige une
    // VRAIE session agent. Sous --no-verify-jwt, `startsWith('Bearer ')` ne prouvait
    // rien (relais email ouvert). Le destinataire de la notif admin est forcé
    // côté serveur plus bas (jamais `body.to`).
    const PUBLIC_TEMPLATES = ['ticket_confirmation', 'contact_confirmation', 'contact_notification_admin']
    const isPublicTemplate = PUBLIC_TEMPLATES.includes(template)
    if (!isPublicTemplate) {
      const auth = await requireAgentAuth(req, corsHeaders)
      if (auth instanceof Response) return auth
    }

    const isEmail = (s: unknown): s is string =>
      typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
    if (!isEmail(to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid "to" address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Build email from template
    let emailSubject: string
    let emailHtml: string

    switch (template) {
      case 'seller_estimation': {
        const result = sellerEstimation(data)
        emailSubject = overrideSubject || result.subject
        emailHtml = result.html
        break
      }
      case 'agent_new_seller_lead': {
        const result = agentNewSellerLead(data)
        emailSubject = overrideSubject || result.subject
        emailHtml = result.html
        break
      }
      case 'seller_portal_access': {
        const result = sellerPortalAccess(data)
        emailSubject = overrideSubject || result.subject
        emailHtml = result.html
        break
      }
      case 'ticket_confirmation': {
        const result = ticketConfirmation(data)
        emailSubject = overrideSubject || result.subject
        emailHtml = result.html
        break
      }
      case 'ticket_notification_admin': {
        const result = ticketNotificationAdmin(data)
        emailSubject = overrideSubject || result.subject
        emailHtml = result.html
        break
      }
      case 'ticket_reply': {
        const result = ticketReply(data)
        emailSubject = overrideSubject || result.subject
        emailHtml = result.html
        break
      }
      case 'ticket_resolved': {
        const result = ticketResolved(data)
        emailSubject = overrideSubject || result.subject
        emailHtml = result.html
        break
      }
      case 'contact_confirmation': {
        const result = contactConfirmation(data)
        emailSubject = overrideSubject || result.subject
        emailHtml = result.html
        break
      }
      case 'contact_notification_admin': {
        const result = contactNotificationAdmin(data)
        emailSubject = overrideSubject || result.subject
        emailHtml = result.html
        break
      }
      default: {
        // Fallback: just send raw HTML if provided in data.html
        emailSubject = overrideSubject || 'MEGGA Notification'
        const rawHtml = data.html as string
        emailHtml = rawHtml || wrapHTML(emailSubject, p(data.body as string || ''))
        break
      }
    }

    // Send via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      console.error('RESEND_API_KEY not configured')
      return new Response(JSON.stringify({ error: 'Email service not configured' }), { status: 500, headers: corsHeaders })
    }

    // La notification admin ne part JAMAIS vers un `to` fourni par l'appelant :
    // destinataire dérivé serveur (anti-relais via le template public admin).
    const recipient = template === 'contact_notification_admin'
      ? (Deno.env.get('CONTACT_NOTIFICATION_TO') ?? 'contact@megga.ch')
      : to

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'MEGGA <noreply@megga.ch>',
        to: [recipient],
        subject: emailSubject,
        html: emailHtml,
      }),
    })

    const resData = await res.json()

    if (!res.ok) {
      console.error('Resend error:', resData)
      return new Response(JSON.stringify({ error: 'Failed to send email', details: resData }), { status: res.status, headers: corsHeaders })
    }

    return new Response(JSON.stringify({ success: true, id: resData.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('send-email error:', err)
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders })
  }
})
