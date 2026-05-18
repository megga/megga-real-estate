// supabase/functions/send-visit-email/index.ts
// Edge Function pour les emails liés aux visites :
// - confirmation_buyer : confirmation à l'acheteur
// - notification_agent : notification à l'agent
// - reminder : rappel J-1 à l'acheteur

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  type: 'confirmation_buyer' | 'notification_agent' | 'reminder'
  visit_id: string
  agency_id: string
}

function formatDateFR(isoDate: string): string {
  const d = new Date(isoDate)
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function formatTimeFR(isoDate: string): string {
  const d = new Date(isoDate)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

/**
 * Génère un fichier ICS RFC 5545 valide pour la visite.
 * Le contact peut l'ajouter à n'importe quel calendrier (Google, Outlook,
 * Apple Calendar, etc.) en cliquant la pièce jointe.
 */
function buildICS(opts: {
  uid: string
  start: Date
  end: Date
  summary: string
  description: string
  location: string
  organizerEmail: string
  organizerName: string
  attendeeEmail: string
  meetUrl?: string
}): string {
  const fmt = (d: Date) =>
    d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  // Échappe les caractères réservés ICS (RFC 5545 §3.3.11)
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
  // Wrap les longues lignes à 75 chars (RFC 5545 §3.1)
  const fold = (line: string): string => {
    if (line.length <= 75) return line
    const parts: string[] = []
    let i = 0
    while (i < line.length) {
      parts.push((i === 0 ? '' : ' ') + line.slice(i, i + 74))
      i += 74
    }
    return parts.join('\r\n')
  }
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MEGGA Real Estate//Visit Booking//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${opts.uid}@megga.ch`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.start)}`,
    `DTEND:${fmt(opts.end)}`,
    `SUMMARY:${escape(opts.summary)}`,
    `DESCRIPTION:${escape(opts.description)}`,
    `LOCATION:${escape(opts.location)}`,
    `ORGANIZER;CN=${escape(opts.organizerName)}:mailto:${opts.organizerEmail}`,
    `ATTENDEE;CN=${escape(opts.attendeeEmail)};RSVP=TRUE:mailto:${opts.attendeeEmail}`,
    opts.meetUrl ? `URL:${opts.meetUrl}` : '',
    'STATUS:CONFIRMED',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).map(fold)
  return lines.join('\r\n')
}

function buildHTML(subject: string, bodyParagraphs: string[]): string {
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
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827">${subject}</h2>
    ${bodyParagraphs.map(p => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151">${p}</p>`).join('\n    ')}
  </div>
  <div style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:11px;color:#9ca3af">MEGGA Real Estate — megga.ch</p>
  </div>
</div>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { type, visit_id, agency_id }: RequestBody = await req.json()

    // ── Auth check (skip for buyer confirmations — public booking flow) ─────
    const PUBLIC_TYPES = ['confirmation_buyer']
    if (!PUBLIC_TYPES.includes(type)) {
      const authHeader = req.headers.get('Authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Fetch visit with relations
    const { data: visit, error: visitError } = await supabaseAdmin
      .from('visits')
      .select('*, property:properties(title, address, city, photos), contact:contacts(first_name, last_name, email)')
      .eq('id', visit_id)
      .single()

    if (visitError || !visit) {
      return new Response(JSON.stringify({ error: 'Visit not found' }), { status: 404, headers: corsHeaders })
    }

    const property = Array.isArray(visit.property) ? visit.property[0] : visit.property
    const contact = Array.isArray(visit.contact) ? visit.contact[0] : visit.contact
    const propertyTitle = property?.title || property?.address || 'Bien immobilier'
    const propertyAddress = `${property?.address || ''}, ${property?.city || ''}`
    const dateFR = formatDateFR(visit.scheduled_at)
    const timeFR = formatTimeFR(visit.scheduled_at)
    const manageUrl = `https://megga.ch/visite/${visit.id}/modifier?token=${visit.manage_token}`
    // feedbackUrl used in post-visit reminder (sent separately via pg_cron)
    const isVideo = visit.visit_type === 'video'
    const videoLabel = visit.video_platform === 'facetime' ? 'FaceTime' : 'Google Meet'

    // Fetch agent email
    const { data: agents } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('agency_id', agency_id)
      .limit(1)
    const agent = agents?.[0]

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), { status: 500, headers: corsHeaders })
    }

    let to = ''
    let subject = ''
    let html = ''

    if (type === 'confirmation_buyer') {
      to = visit.buyer_email || contact?.email || ''
      subject = isVideo
        ? `Votre visite vidéo est confirmée — ${propertyTitle}`
        : `Votre visite est confirmée — ${propertyTitle}`
      const videoInfo = isVideo
        ? `<strong>Mode :</strong> Visite vidéo via ${videoLabel}<br>${visit.video_link ? `<strong>Lien :</strong> <a href="${visit.video_link}" style="color:#2563eb">${visit.video_link}</a><br>` : `Le lien ${videoLabel} sera envoyé par l'agent avant la visite.<br>`}`
        : `<strong>Adresse :</strong> ${propertyAddress}`
      html = buildHTML(isVideo ? 'Visite vidéo confirmée' : 'Visite confirmée', [
        `Bonjour ${visit.buyer_name || contact?.first_name || ''},`,
        `Votre demande de visite${isVideo ? ' vidéo' : ''} pour <strong>${propertyTitle}</strong> a bien été enregistrée.`,
        `<strong>Date :</strong> ${dateFR}<br><strong>Heure :</strong> ${timeFR}<br>${videoInfo}`,
        `Vous recevrez un rappel la veille de la visite.`,
        `<a href="${manageUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">Gérer ma visite</a>`,
        `<span style="font-size:12px;color:#9ca3af">Reporter ou annuler à tout moment via le lien ci-dessus.</span>`,
      ])
    } else if (type === 'notification_agent') {
      to = agent?.email || ''
      subject = isVideo
        ? `Nouvelle demande de visite vidéo (${videoLabel}) — ${propertyTitle}`
        : `Nouvelle demande de visite — ${propertyTitle}`
      const qualif = visit.qualification || {}
      const qualifText = [
        qualif.budget ? `Budget : ${qualif.budget}` : '',
        qualif.financing ? `Financement : ${qualif.financing}` : '',
        qualif.firstVisit !== undefined ? `Première visite : ${qualif.firstVisit ? 'Oui' : 'Non'}` : '',
      ].filter(Boolean).join(' · ')
      html = buildHTML(isVideo ? `Nouvelle visite vidéo (${videoLabel})` : 'Nouvelle demande de visite', [
        `Bonjour ${agent?.full_name || ''},`,
        `Une nouvelle demande de visite${isVideo ? ` vidéo via ${videoLabel}` : ''} a été reçue via le site.`,
        `<strong>Bien :</strong> ${propertyTitle}<br><strong>Adresse :</strong> ${propertyAddress}`,
        isVideo ? `<strong>Mode :</strong> Visite vidéo via ${videoLabel}` : '',
        `<strong>Date souhaitée :</strong> ${dateFR} à ${timeFR}`,
        `<strong>Contact :</strong> ${visit.buyer_name || ''}<br>Email : ${visit.buyer_email || ''}<br>Tél : ${visit.buyer_phone || '—'}`,
        qualifText ? `<strong>Pré-qualification :</strong> ${qualifText}` : '',
        visit.buyer_message ? `<strong>Message :</strong> ${visit.buyer_message}` : '',
        `La visite apparaît dans votre calendrier MEGGA.`,
      ].filter(Boolean))
    } else if (type === 'reminder') {
      to = visit.buyer_email || contact?.email || ''
      subject = `Rappel : visite demain — ${propertyTitle}`
      html = buildHTML('Rappel de visite', [
        `Bonjour ${visit.buyer_name || contact?.first_name || ''},`,
        `Nous vous rappelons votre visite prévue <strong>demain</strong>.`,
        `<strong>Bien :</strong> ${propertyTitle}<br><strong>Heure :</strong> ${timeFR}<br><strong>Adresse :</strong> ${propertyAddress}`,
        `<a href="${manageUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500">Gérer ma visite</a>`,
        `À demain !`,
      ])
      // Mark reminder as sent
      await supabaseAdmin.from('visits').update({ reminder_sent: true }).eq('id', visit_id)
    }

    if (!to) {
      return new Response(JSON.stringify({ error: 'No recipient email' }), { status: 400, headers: corsHeaders })
    }

    // Génère l'ICS pour confirmation_buyer (le destinataire peut l'ajouter à son
    // propre calendrier en un click). On l'attache à l'email Resend.
    const resendPayload: Record<string, unknown> = {
      from: 'MEGGA <noreply@megga.ch>',
      to: [to],
      subject,
      html,
    }

    if (type === 'confirmation_buyer') {
      const start = new Date(visit.scheduled_at)
      const durationMinutes = visit.duration_minutes ?? 45
      const end = new Date(start.getTime() + durationMinutes * 60_000)
      const icsContent = buildICS({
        uid: visit.id,
        start,
        end,
        summary: isVideo ? `Visite vidéo — ${propertyTitle}` : `Visite — ${propertyTitle}`,
        description: [
          isVideo ? `Visite vidéo via ${videoLabel}.` : '',
          visit.video_link ? `Lien : ${visit.video_link}` : '',
          `Gérer ma visite : ${manageUrl}`,
        ].filter(Boolean).join('\n'),
        location: isVideo ? (visit.video_link || videoLabel) : propertyAddress,
        organizerEmail: agent?.email ?? 'noreply@megga.ch',
        organizerName: agent?.full_name ?? 'MEGGA',
        attendeeEmail: to,
        meetUrl: visit.video_link ?? undefined,
      })
      // Encode en base64 standard (Resend attend ce format)
      const icsBase64 = btoa(unescape(encodeURIComponent(icsContent)))
      resendPayload.attachments = [{
        filename: 'visite-megga.ics',
        content: icsBase64,
        content_type: 'text/calendar; charset=utf-8; method=REQUEST',
      }]
    }

    // Send via Resend
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(resendPayload),
    })

    const resendData = await resendRes.json()

    // Log activity
    await supabaseAdmin.from('activity_events').insert({
      agency_id,
      action: `visit_email_${type}`,
      entity_type: 'visit',
      entity_id: visit_id,
      metadata: { to, subject, email_id: resendData.id },
    })

    return new Response(JSON.stringify({ success: true, email_id: resendData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
