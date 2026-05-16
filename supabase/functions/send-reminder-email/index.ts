// supabase/functions/send-reminder-email/index.ts
// Edge Function pour l'envoi automatique d'emails de relance
// Appelée par automation-engine quand auto_send = true sur une règle

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  reminder_id: string
  agency_id: string
}

// ── Templates par défaut (utilisés si pas de template en base) ──────────────

interface DefaultTemplate {
  subject: string
  body: string
}

const DEFAULT_TEMPLATES: Record<string, DefaultTemplate> = {
  follow_up_sent_property: {
    subject: 'Suite à notre sélection de biens',
    body: `Bonjour {{contact.first_name}},

Je vous ai envoyé récemment une sélection de biens qui correspond à vos critères de recherche.

Avez-vous eu l'occasion de la consulter ? Je reste à votre disposition pour organiser des visites ou répondre à vos questions.

Cordialement,
{{agent.full_name}}
{{agency.name}}`,
  },
  post_visit_feedback: {
    subject: 'Votre avis suite à la visite',
    body: `Bonjour {{contact.first_name}},

Suite à notre visite récente, j'aimerais connaître votre impression.

Quels sont les points qui vous ont plu ? Y a-t-il des éléments qui ne correspondent pas à vos attentes ?

Votre retour m'aidera à affiner ma recherche pour mieux répondre à vos critères.

Cordialement,
{{agent.full_name}}`,
  },
  dormant_lead: {
    subject: 'Des nouvelles de votre projet immobilier',
    body: `Bonjour {{contact.first_name}},

Je me permets de prendre de vos nouvelles concernant votre projet immobilier.

De nouveaux biens sont disponibles qui pourraient correspondre à vos critères. Souhaitez-vous que je vous envoie une sélection actualisée ?

N'hésitez pas à me contacter si votre projet a évolué.

Cordialement,
{{agent.full_name}}
{{agency.name}}`,
  },
  missing_document: {
    subject: 'Document requis pour votre dossier',
    body: `Bonjour {{contact.first_name}},

Afin de poursuivre le traitement de votre dossier, il nous manque encore certains documents.

Pourriez-vous nous les transmettre à votre meilleure convenance ? Cela nous permettra d'avancer rapidement.

Je reste disponible si vous avez des questions.

Cordialement,
{{agent.full_name}}
{{agency.name}}`,
  },
  custom: {
    subject: 'Point sur votre projet immobilier',
    body: `Bonjour {{contact.first_name}},

Je souhaitais faire un point avec vous concernant votre projet immobilier.

N'hésitez pas à me contacter pour en discuter. Je suis à votre disposition.

Cordialement,
{{agent.full_name}}
{{agency.name}}`,
  },
}

// ── HTML email builder ──────────────────────────────────────────────────────

function buildEmailHtml(subject: string, body: string, agentName: string): string {
  const bodyHtml = body
    .split('\n\n')
    .map((p) => `<p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px 0;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">MEGGA</span>
      <span style="font-size:11px;color:#9ca3af;display:block;margin-top:2px;">Immobilier Suisse</span>
    </div>

    <!-- Body -->
    <div style="background:#ffffff;border-radius:16px;padding:32px 28px;border:1px solid #e5e7eb;">
      ${bodyHtml}
    </div>

    <!-- Agent signature -->
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="font-size:13px;color:#374151;margin:0;font-weight:600;">${agentName}</p>
      <p style="font-size:12px;color:#9ca3af;margin:4px 0 0 0;">MEGGA Immobilier</p>
    </div>

    <!-- Disclaimer -->
    <p style="font-size:10px;color:#d1d5db;text-align:center;margin-top:24px;line-height:1.5;">
      Cet email a été envoyé automatiquement via MEGGA Real Estate.
      Si vous souhaitez ne plus recevoir ces messages, contactez votre agent.
    </p>
  </div>
</body>
</html>`
}

// ── Variable resolution ─────────────────────────────────────────────────────

function resolveTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+\.\w+)\}\}/g, (_match, key: string) => {
    return vars[key] || ''
  })
}

// ── Main handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const { reminder_id, agency_id } = (await req.json()) as RequestBody

    if (!reminder_id || !agency_id) {
      throw new Error('reminder_id and agency_id are required')
    }

    // ── 1. Load reminder with relations ──
    const { data: reminder, error: remErr } = await supabase
      .from('reminders')
      .select('*, contact:contacts(first_name, last_name, email), property:properties(title, address, city, price, rooms, surface_m2)')
      .eq('id', reminder_id)
      .single()

    if (remErr || !reminder) {
      throw new Error(`Reminder not found: ${reminder_id}`)
    }

    // Normalize joins (may be array)
    const contact = Array.isArray(reminder.contact) ? reminder.contact[0] : reminder.contact
    const property = Array.isArray(reminder.property) ? reminder.property[0] : reminder.property

    if (!contact?.email) {
      throw new Error(`Contact has no email address (reminder ${reminder_id})`)
    }

    // ── 2. Load agent profile ──
    const { data: agent } = await supabase
      .from('profiles')
      .select('full_name, email, phone')
      .eq('agency_id', agency_id)
      .limit(1)
      .single()

    const agentName = agent?.full_name || 'Votre agent MEGGA'

    // ── 3. Load agency ──
    const { data: agency } = await supabase
      .from('agencies')
      .select('name')
      .eq('id', agency_id)
      .single()

    const agencyName = agency?.name || 'MEGGA Immobilier'

    // ── 4. Resolve template ──
    let subject: string
    let body: string

    // Try to load DB template first
    if (reminder.message_template) {
      const { data: tpl } = await supabase
        .from('message_templates')
        .select('subject, body')
        .eq('id', reminder.message_template)
        .single()

      if (tpl) {
        subject = tpl.subject || DEFAULT_TEMPLATES[reminder.type]?.subject || 'Information MEGGA'
        body = tpl.body
      } else {
        const defaults = DEFAULT_TEMPLATES[reminder.type] || DEFAULT_TEMPLATES.custom
        subject = defaults.subject
        body = defaults.body
      }
    } else {
      const defaults = DEFAULT_TEMPLATES[reminder.type] || DEFAULT_TEMPLATES.custom
      subject = defaults.subject
      body = defaults.body
    }

    // Build variable map
    const vars: Record<string, string> = {
      'contact.first_name': contact.first_name || '',
      'contact.last_name': contact.last_name || '',
      'contact.email': contact.email || '',
      'property.title': property?.title || '',
      'property.address': property?.address || '',
      'property.city': property?.city || '',
      'property.price': property?.price ? formatCHF(property.price) : '',
      'property.rooms': property?.rooms ? `${property.rooms}` : '',
      'property.surface_m2': property?.surface_m2 ? `${property.surface_m2}` : '',
      'agent.full_name': agentName,
      'agent.phone': agent?.phone || '',
      'agent.email': agent?.email || '',
      'agency.name': agencyName,
    }

    const resolvedSubject = resolveTemplate(subject, vars)
    const resolvedBody = resolveTemplate(body, vars)

    // ── 5. Build HTML and send via Resend ──
    const html = buildEmailHtml(resolvedSubject, resolvedBody, agentName)

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `MEGGA Immobilier <noreply@megga.ch>`,
        to: [contact.email],
        subject: resolvedSubject,
        html,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      throw new Error(`Resend error: ${resendData.message || resendResponse.status}`)
    }

    // ── 6. Mark reminder as done ──
    await supabase
      .from('reminders')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', reminder_id)

    // ── 7. Audit trail ──
    await supabase.from('activity_events').insert({
      agency_id,
      actor_id: null,
      actor_kind: 'ai',
      action: 'auto_email_sent',
      entity_type: 'reminder',
      entity_id: reminder_id,
      metadata: {
        to: contact.email,
        subject: resolvedSubject,
        reminder_type: reminder.type,
        contact_id: reminder.contact_id,
        email_id: resendData.id,
      },
    })

    return new Response(JSON.stringify({
      success: true,
      emailId: resendData.id,
      to: contact.email,
      reminder_id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCHF(amount: number): string {
  return `CHF ${amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
}
