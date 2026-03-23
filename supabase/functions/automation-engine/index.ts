// supabase/functions/automation-engine/index.ts
// Moteur de relances automatiques — scanne les événements et crée des reminders
// Appelé par pg_cron toutes les heures

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RequestBody {
  agency_id: string
}

interface ReminderInsert {
  agency_id: string
  contact_id: string
  property_id: string | null
  transaction_id: string | null
  match_id: string | null
  type: string
  trigger_rule: string
  trigger_days: number
  status: 'pending'
  trigger_at: string
  channel: string
  message_template: string | null
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

    const { agency_id } = (await req.json()) as RequestBody

    if (!agency_id) {
      throw new Error('agency_id is required')
    }

    let remindersCreated = 0
    const now = new Date()

    // ── Helper: check for existing reminder to avoid duplicates ──
    async function reminderExists(
      contactId: string,
      type: string,
      extraFilters?: { property_id?: string; match_id?: string; transaction_id?: string }
    ): Promise<boolean> {
      let query = supabase
        .from('reminders')
        .select('id')
        .eq('agency_id', agency_id)
        .eq('contact_id', contactId)
        .eq('type', type)
        .in('status', ['pending', 'triggered', 'snoozed'])

      if (extraFilters?.property_id) {
        query = query.eq('property_id', extraFilters.property_id)
      }
      if (extraFilters?.match_id) {
        query = query.eq('match_id', extraFilters.match_id)
      }
      if (extraFilters?.transaction_id) {
        query = query.eq('transaction_id', extraFilters.transaction_id)
      }

      const { data } = await query.limit(1)
      return (data?.length ?? 0) > 0
    }

    // ── Helper: insert reminder + audit event ──
    async function createReminder(reminder: ReminderInsert): Promise<boolean> {
      const { data: inserted } = await supabase
        .from('reminders')
        .insert(reminder)
        .select('id')
        .single()

      if (inserted) {
        await supabase.from('activity_events').insert({
          agency_id,
          actor_id: 'ai',
          action: 'reminder_created',
          entity_type: 'reminder',
          entity_id: inserted.id,
          metadata: {
            type: reminder.type,
            contact_id: reminder.contact_id,
            trigger_at: reminder.trigger_at,
            channel: reminder.channel,
          },
        })
        remindersCreated++
        return true
      }
      return false
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 1. Bien envoyé sans réponse après 3 jours
    // Condition: match.status = 'sent' AND match.response_at IS NULL AND sent_at < NOW() - 3 days
    // ══════════════════════════════════════════════════════════════════════════
    {
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()

      const { data: unresponsedMatches } = await supabase
        .from('matches')
        .select('id, contact_id, property_id')
        .eq('agency_id', agency_id)
        .eq('status', 'sent')
        .is('response_at', null)
        .lt('sent_at', threeDaysAgo)

      for (const match of unresponsedMatches || []) {
        const exists = await reminderExists(match.contact_id, 'follow_up_sent_property', {
          match_id: match.id,
        })
        if (!exists) {
          await createReminder({
            agency_id,
            contact_id: match.contact_id,
            property_id: match.property_id,
            transaction_id: null,
            match_id: match.id,
            type: 'follow_up_sent_property',
            trigger_rule: 'no_response',
            trigger_days: 3,
            status: 'pending',
            trigger_at: now.toISOString(),
            channel: 'email',
            message_template: null,
          })
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 2. Visite effectuée sans feedback après 1 jour
    // Condition: visits.status = 'done' AND feedback_buyer IS NULL AND completed_at < NOW() - 1 day
    // ══════════════════════════════════════════════════════════════════════════
    {
      const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()

      const { data: visitsMissingFeedback } = await supabase
        .from('visits')
        .select('id, contact_id, property_id, transaction_id')
        .eq('agency_id', agency_id)
        .eq('status', 'done')
        .is('feedback_buyer', null)
        .lt('completed_at', oneDayAgo)

      for (const visit of visitsMissingFeedback || []) {
        const exists = await reminderExists(visit.contact_id, 'post_visit_feedback', {
          property_id: visit.property_id,
        })
        if (!exists) {
          await createReminder({
            agency_id,
            contact_id: visit.contact_id,
            property_id: visit.property_id,
            transaction_id: visit.transaction_id,
            match_id: null,
            type: 'post_visit_feedback',
            trigger_rule: 'days_after_event',
            trigger_days: 1,
            status: 'pending',
            trigger_at: now.toISOString(),
            channel: 'email',
            message_template: null,
          })
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3. Lead inactif depuis 30 jours
    // Condition: contacts.last_interaction_at < NOW() - 30 days AND type IN (buyer, lead, investor)
    // ══════════════════════════════════════════════════════════════════════════
    {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: dormantLeads } = await supabase
        .from('contacts')
        .select('id')
        .eq('agency_id', agency_id)
        .in('type', ['buyer', 'lead', 'investor', 'both'])
        .lt('last_interaction_at', thirtyDaysAgo)

      for (const contact of dormantLeads || []) {
        const exists = await reminderExists(contact.id, 'dormant_lead')
        if (!exists) {
          await createReminder({
            agency_id,
            contact_id: contact.id,
            property_id: null,
            transaction_id: null,
            match_id: null,
            type: 'dormant_lead',
            trigger_rule: 'inactivity',
            trigger_days: 30,
            status: 'pending',
            trigger_at: now.toISOString(),
            channel: 'email',
            message_template: null,
          })
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 4. Acheteur chaud non relancé depuis 7 jours
    // Condition: contacts.score = 'hot' AND last_interaction_at < NOW() - 7 days AND type IN (buyer, both)
    // ══════════════════════════════════════════════════════════════════════════
    {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: hotBuyers } = await supabase
        .from('contacts')
        .select('id')
        .eq('agency_id', agency_id)
        .eq('score', 'hot')
        .in('type', ['buyer', 'both'])
        .lt('last_interaction_at', sevenDaysAgo)

      for (const contact of hotBuyers || []) {
        const exists = await reminderExists(contact.id, 'follow_up_sent_property')
        if (!exists) {
          await createReminder({
            agency_id,
            contact_id: contact.id,
            property_id: null,
            transaction_id: null,
            match_id: null,
            type: 'follow_up_sent_property',
            trigger_rule: 'inactivity',
            trigger_days: 7,
            status: 'pending',
            trigger_at: now.toISOString(),
            channel: 'notification',
            message_template: null,
          })
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 5. Vendeur sans suivi depuis 14 jours
    // Condition: contacts.type = 'seller' AND last_interaction_at < NOW() - 14 days
    // ══════════════════════════════════════════════════════════════════════════
    {
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

      const { data: neglectedSellers } = await supabase
        .from('contacts')
        .select('id')
        .eq('agency_id', agency_id)
        .eq('type', 'seller')
        .lt('last_interaction_at', fourteenDaysAgo)

      for (const contact of neglectedSellers || []) {
        const exists = await reminderExists(contact.id, 'custom')
        if (!exists) {
          await createReminder({
            agency_id,
            contact_id: contact.id,
            property_id: null,
            transaction_id: null,
            match_id: null,
            type: 'custom',
            trigger_rule: 'inactivity',
            trigger_days: 14,
            status: 'pending',
            trigger_at: now.toISOString(),
            channel: 'notification',
            message_template: null,
          })
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 6. Document KYC manquant — dossier en cours depuis 3+ jours avec completion < 100%
    // Condition: kyc_cases.status = 'in_progress' AND completion_pct < 100 AND created_at < NOW() - 3 days
    // ══════════════════════════════════════════════════════════════════════════
    {
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()

      const { data: incompleteKyc } = await supabase
        .from('kyc_cases')
        .select('id, contact_id, transaction_id')
        .eq('agency_id', agency_id)
        .eq('status', 'in_progress')
        .lt('completion_pct', 100)
        .lt('created_at', threeDaysAgo)

      for (const kyc of incompleteKyc || []) {
        const exists = await reminderExists(kyc.contact_id, 'missing_document', {
          transaction_id: kyc.transaction_id,
        })
        if (!exists) {
          await createReminder({
            agency_id,
            contact_id: kyc.contact_id,
            property_id: null,
            transaction_id: kyc.transaction_id,
            match_id: null,
            type: 'missing_document',
            trigger_rule: 'days_after_event',
            trigger_days: 3,
            status: 'pending',
            trigger_at: now.toISOString(),
            channel: 'email',
            message_template: null,
          })
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // Auto-trigger: mark pending reminders as triggered when trigger_at is past
    // ══════════════════════════════════════════════════════════════════════════
    {
      await supabase
        .from('reminders')
        .update({ status: 'triggered' })
        .eq('agency_id', agency_id)
        .eq('status', 'pending')
        .lte('trigger_at', now.toISOString())
    }

    return new Response(JSON.stringify({ remindersCreated, agency_id }), {
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
