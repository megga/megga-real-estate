// supabase/functions/automation-engine/index.ts
// Moteur de relances automatiques — scanne les événements et crée des reminders
// Appelé par pg_cron toutes les heures

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import {
  RADAR_DEFAULTS, isDealStagnant, isMatchIgnored, stagnantDealReason, ignoredMatchReason,
} from '../_shared/radar-detectors.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}

interface RequestBody {
  agency_id: string
}

/**
 * Vérifie l'auth du caller avant tout accès service_role.
 * Accepte 2 modes :
 *   - pg_cron interne : header `Authorization: Bearer <SERVICE_ROLE_KEY>` exact
 *   - Agent humain   : JWT valide + profile.agency_id == agency_id ciblé
 *
 * Red-team finding F3 (audit 2026-05-19) : avant ce check, n'importe qui
 * pouvait POST agency_id arbitraire → création de reminders dans des
 * agences tierces (cross-tenant DoS + pollution timeline).
 */
async function authorizeAutomationCall(
  req: Request,
  targetAgencyId: string,
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''

  // Mode 1 : appel pg_cron interne (service_role exact)
  if (serviceRoleKey.length > 0 && authHeader === `Bearer ${serviceRoleKey}`) {
    return { ok: true }
  }

  // Mode 2 : appel agent humain (JWT vérifié + agency match)
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return { ok: false, response: auth }
  if (auth.profile.agency_id !== targetAgencyId) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'forbidden: cross-agency access' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      ),
    }
  }
  return { ok: true }
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
    const { agency_id } = (await req.json()) as RequestBody

    if (!agency_id) {
      throw new Error('agency_id is required')
    }

    // Auth + agency check obligatoire AVANT toute opération service_role.
    const authz = await authorizeAutomationCall(req, agency_id)
    if (!authz.ok) return authz.response

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    let remindersCreated = 0
    let emailsSent = 0
    const now = new Date()

    // ── Helper: map reminder type to trigger_event for rule lookup ──
    function reminderTypeToTrigger(type: string): string {
      switch (type) {
        case 'follow_up_sent_property': return 'property_sent'
        case 'post_visit_feedback': return 'visit_completed'
        case 'dormant_lead': return 'lead_inactive'
        case 'missing_document': return 'document_missing'
        default: return 'lead_inactive'
      }
    }

    // ── Helper: check if auto_send is enabled for this reminder type ──
    async function shouldAutoSend(reminderType: string): Promise<boolean> {
      const triggerEvent = reminderTypeToTrigger(reminderType)
      const { data } = await supabase
        .from('automation_rules')
        .select('auto_send')
        .eq('agency_id', agency_id)
        .eq('trigger_event', triggerEvent)
        .eq('is_active', true)
        .eq('auto_send', true)
        .limit(1)

      return (data?.length ?? 0) > 0
    }

    // ── Helper: call send-reminder-email Edge Function ──
    async function sendAutoEmail(reminderId: string): Promise<boolean> {
      try {
        const baseUrl = Deno.env.get('SUPABASE_URL')!
        const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const response = await fetch(`${baseUrl}/functions/v1/send-reminder-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${svcKey}`,
          },
          body: JSON.stringify({ reminder_id: reminderId, agency_id }),
        })

        if (response.ok) {
          emailsSent++
          return true
        }
        return false
      } catch {
        return false
      }
    }

    // ── Helper: check for existing reminder to avoid duplicates ──
    async function reminderExists(
      contactId: string,
      type: string,
      extraFilters?: { property_id?: string; match_id?: string; transaction_id?: string },
      // anyStatus=true : dédup sur TOUS les statuts (y compris done/cancelled). Utilisé
      // par le RADAR pour ne PAS re-créer un signal qu'un agent a déjà classé sans
      // toucher le fond (sinon re-nag horaire). Les 6 détecteurs historiques gardent
      // la dédup « active seulement » (défaut) pour pouvoir re-relancer après clôture.
      anyStatus = false,
    ): Promise<boolean> {
      let query = supabase
        .from('reminders')
        .select('id')
        .eq('agency_id', agency_id)
        .eq('contact_id', contactId)
        .eq('type', type)
      if (!anyStatus) query = query.in('status', ['pending', 'triggered', 'snoozed'])

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

    // ── Helper: insert reminder + audit event + auto-send if enabled ──
    async function createReminder(reminder: ReminderInsert): Promise<boolean> {
      const { data: inserted } = await supabase
        .from('reminders')
        .insert(reminder)
        .select('id')
        .single()

      if (inserted) {
        await supabase.from('activity_events').insert({
          agency_id,
          actor_id: null,
          actor_kind: 'ai',
          action: 'reminder_created',
      // Même famille que les deux autres émetteurs de `reminder_created`
      // (copilot-actions, whatsapp-actions) : un rappel porte sur un contact.
      category: 'contact',
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

        // Phase B: auto-send email if rule has auto_send = true
        if (reminder.channel === 'email') {
          const autoSend = await shouldAutoSend(reminder.type)
          if (autoSend) {
            await sendAutoEmail(inserted.id)
          }
        }

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
    // RADAR (fin de Phase 3) — 2 détecteurs déterministes SUPPLÉMENTAIRES, gardés
    // par app_config automation_radar_enabled (OFF par défaut). Ils créent des
    // rappels TYPÉS avec une raison chiffrée (message_template) que la file Focus
    // affiche et que le copilote relaie. Seuils : radar-detectors.ts (module pur).
    // ══════════════════════════════════════════════════════════════════════════
    {
      const { data: radarFlag } = await supabase
        .from('app_config').select('value').eq('key', 'automation_radar_enabled').maybeSingle()
      if (radarFlag?.value === 'true') {
        const nowMs = now.getTime()

        // (R1) Dossier stagnant : transaction active, étape en cours, updated_at ancien.
        // Bornée (.limit) + dédup TOUS-STATUTS : au 1er scan on ne flague qu'un lot ;
        // les scans suivants épongent le reste, sans jamais re-nager un objet déjà classé.
        {
          const cutoff = new Date(nowMs - RADAR_DEFAULTS.dealStagnantDays * 24 * 60 * 60 * 1000).toISOString()
          const { data: deals } = await supabase
            .from('transactions')
            .select('id, stage, status, updated_at, contact_buyer_id, contact_seller_id')
            .eq('agency_id', agency_id)
            .eq('status', 'active')
            .lt('updated_at', cutoff)
            .order('updated_at', { ascending: true })
            .limit(50)
          for (const d of deals || []) {
            const contactId = (d.contact_buyer_id ?? d.contact_seller_id) as string | null
            if (!contactId) continue
            if (!isDealStagnant({ status: d.status, stage: d.stage, updatedAt: d.updated_at, now: nowMs })) continue
            const exists = await reminderExists(contactId, 'deal_stagnant', { transaction_id: d.id }, true)
            if (exists) continue
            const days = Math.floor((nowMs - Date.parse(d.updated_at)) / 86_400_000)
            await createReminder({
              agency_id, contact_id: contactId, property_id: null, transaction_id: d.id, match_id: null,
              type: 'deal_stagnant', trigger_rule: 'inactivity', trigger_days: RADAR_DEFAULTS.dealStagnantDays,
              status: 'pending', trigger_at: now.toISOString(), channel: 'notification',
              message_template: stagnantDealReason(d.stage, days),
            })
          }
        }

        // (R2) Correspondance forte ignorée : match suggéré, score élevé, jamais envoyé, ancien.
        // matches est volumineux et 100% 'suggested' → la requête est bornée (.limit) ET
        // plafonnée en âge (on ignore les suggestions > 90 j, mortes) pour éviter une
        // rafale de rappels au 1er scan ; dédup TOUS-STATUTS anti re-nag.
        {
          const cutoff = new Date(nowMs - RADAR_DEFAULTS.matchIgnoredDays * 24 * 60 * 60 * 1000).toISOString()
          const floor = new Date(nowMs - 90 * 24 * 60 * 60 * 1000).toISOString()
          const { data: matches } = await supabase
            .from('matches')
            .select('id, contact_id, property_id, score, status, sent_at, created_at')
            .eq('agency_id', agency_id)
            .eq('status', 'suggested')
            .is('sent_at', null)
            .gte('score', RADAR_DEFAULTS.matchIgnoredMinScore)
            .lt('created_at', cutoff)
            .gte('created_at', floor)
            .order('score', { ascending: false })
            .limit(50)
          for (const m of matches || []) {
            if (!m.contact_id) continue
            if (!isMatchIgnored({ status: m.status, score: m.score, sentAt: m.sent_at, createdAt: m.created_at, now: nowMs })) continue
            const exists = await reminderExists(m.contact_id, 'match_ignored', { match_id: m.id }, true)
            if (exists) continue
            const days = Math.floor((nowMs - Date.parse(m.created_at)) / 86_400_000)
            await createReminder({
              agency_id, contact_id: m.contact_id, property_id: m.property_id, transaction_id: null, match_id: m.id,
              type: 'match_ignored', trigger_rule: 'no_response', trigger_days: RADAR_DEFAULTS.matchIgnoredDays,
              status: 'pending', trigger_at: now.toISOString(), channel: 'notification',
              message_template: ignoredMatchReason(m.score, days),
            })
          }
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

    return new Response(JSON.stringify({ remindersCreated, emailsSent, agency_id }), {
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
