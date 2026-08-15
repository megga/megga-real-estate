// supabase/functions/send-reminder-email/index.ts
// Edge Function pour l'envoi automatique d'emails de relance
// Appelée par automation-engine quand auto_send = true sur une règle

import { buildContactReminderEmail } from '../_shared/reminder-email.ts'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { emailSendAllowed, unsubscribeHeaders, unsubscribeFooterHtml } from '../_shared/email-guard.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
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

// Gabarit dans `_shared/reminder-email.ts` depuis le 15.08.2026 : pur, donc testable et
// visible au banc de rendu. La résolution des variables, elle, reste ici : elle appartient
// au gabarit de RAPPEL (table `reminder_templates`), pas à l'habillage de l'e-mail.

/** Remplace `{{contact.first_name}}` et consorts. Une variable absente rend une chaîne
 *  vide plutôt que son propre nom — mieux vaut un blanc qu'un `{{…}}` chez le client. */
function resolveTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+\.\w+)\}\}/g, (_match, key: string) => {
    return vars[key] || ''
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Auth ────────────────────────────────────────────────────────────────
    // Cette fonction n'avait AUCUNE garde. Elle est déployée --no-verify-jwt
    // comme toutes les autres, travaille en service-role (donc hors RLS), et
    // prend `reminder_id` / `agency_id` dans le corps de la requête : n'importe
    // qui pouvait donc déclencher l'envoi d'un e-mail à un contact. Seul le
    // caractère non devinable d'un UUID limitait la casse — ce n'est pas une
    // garde. Même famille que le relais ouvert fermé dans send-email.
    //
    // Le seul appelant légitime est automation-engine, qui forwarde déjà la clé
    // service-role en Bearer : la garde ne change donc rien au chemin nominal.
    if (!(await isServiceSecret(supabase, req))) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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
      // `language` : le pied de page de désinscription se rend dans les quatre langues, et
      // il serait absurde de proposer « Se désinscrire » en français à un germanophone.
      // Domaine fr/de/en/it, identique à celui d'`unsubscribeFooterHtml` ; NULL = non
      // renseignée, le repli 'fr' vit à la lecture (20260815190000).
      .select('*, contact:contacts(first_name, last_name, email, language), property:properties(title, address, city, price, rooms, surface_m2)')
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
    // ⛔ GARDE du canal e-mail. Un STOP reçu sur WhatsApp écrit `channel='all'` : sans
    // cette lecture, la personne continuerait de recevoir ces envois après avoir demandé
    // qu'on la laisse tranquille.
    const verdict = await emailSendAllowed(supabase, {
      to: contact.email, purpose: 'relance', contactId: reminder.contact_id ?? null,
    })
    if (!verdict.allowed) {
      return new Response(
        JSON.stringify({ error: verdict.reason, blocked: true }),
        { status: 409, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    // La garde dit qui NE peut PAS recevoir ; le lien dit comment le devenir. Sans lui, un
    // rappel automatique n'offre aucune sortie depuis le message lui-même — et c'est
    // l'unique canal par lequel cette personne nous parle.
    const unsub = await unsubscribeHeaders(contact.email, reminder.contact_id ?? null)
    const { html } = buildContactReminderEmail({
      subject: resolvedSubject,
      body: resolvedBody,
      agentName,
      unsubscribeHtml: unsub ? unsubscribeFooterHtml(unsub.url, contact.language ?? 'fr') : undefined,
    })

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
        // `List-Unsubscribe` + one-click : ce que Gmail et Outlook ATTENDENT. Leur absence
        // pèse sur la délivrabilité de tout le domaine, pas seulement de ce message.
        ...(unsub ? { headers: unsub.headers } : {}),
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
      // Pas de famille « emails » au CHECK : un courriel automatique est classé par ce
      // dont il parle — ici un contact. La puce « Emails » de l'écran se dérive du couple
      // category + entity_type (§5.2), pas de la seule catégorie.
      category: 'contact',
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
