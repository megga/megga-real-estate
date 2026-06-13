import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { trackIntercomEvent, INTERCOM_EVENTS } from '@/lib/intercom'
import type { ContactType } from '@/types/contact'
import type { ExtractedLead, LeadIntent, LeadNextAction } from '@/hooks/useExtractLead'
import type { TablesInsert } from '@/types/database'

/**
 * Sprint 3 — Orchestration de la création d'un Contact + Deal depuis un
 * lead importé. À appeler APRÈS validation de la dédup côté UI.
 *
 * Étapes :
 *   1. INSERT contact (type dérivé de l'intention)
 *   2. (optionnel) INSERT deal lié, avec stage = 'new_lead' ou 'to_qualify'
 *      selon l'urgence (cf. CHECK constraint transactions_stage_check)
 *   3. Audit côté front : un event 'Lead validé & créé' (actor_kind='user'),
 *      en complément du 'Extraction lead exécutée' (actor_kind='ai') déjà
 *      logué par l'Edge Function
 *
 * Le rawText n'est PAS stocké côté Contact dans cette V1 — la rétention
 * 90j (red-team A2) sera implémentée dans une migration ultérieure. Pour
 * l'instant, on conserve seulement les champs extraits structurés.
 *
 * Spec : RED_TEAM_SPRINT_3.md §B (intent reclassification, default deal,
 * scope agence) + §F.F1 (audit split user vs ai).
 */

/** Mapping intention IA → ContactType (extension G1 SQL). */
function contactTypeForIntent(intent: LeadIntent): ContactType {
  if (intent === 'seller') return 'seller'
  if (intent === 'tenant') return 'tenant'
  return 'buyer'
}

/**
 * Stage initial du deal selon urgence + intention.
 * Valeurs alignées sur la contrainte CHECK transactions_stage_check
 * (migration 20260319_001_enriched_crm_tables.sql:205) — format snake_case.
 */
function initialDealStage(intent: LeadIntent, urgency: ExtractedLead['urgency']): string {
  if (urgency === 'high') return 'to_qualify'
  if (intent === 'seller') return 'new_lead'
  return 'new_lead'
}

interface ImportLeadInput {
  extracted: ExtractedLead
  /** Si true (default OFF pour seller / low confidence), crée un Deal lié. */
  createDeal: boolean
  /** Compact, pour audit metadata. */
  redactionSummary: string
  /** Sprint 3 (A.7) — message brut original (PII redactée côté Edge déjà).
   *  Stocké sur contacts.import_raw_text avec rétention 90j (cron). */
  rawText?: string
}

interface ImportLeadResult {
  contactId: string
  dealId: string | null
}

async function persistLead(input: ImportLeadInput, agencyId: string | null, userId: string): Promise<ImportLeadResult> {
  const { extracted, createDeal, redactionSummary, rawText } = input

  // 1+2 — Insert atomique via RPC transactionnelle (§C.4). Si le deal échoue,
  //       le contact est rollback (pas d'orphelin).
  const contactType = contactTypeForIntent(extracted.intent)
  const dealStage   = initialDealStage(extracted.intent, extracted.urgency)
  const dealRole    = extracted.intent === 'seller' ? 'seller' : 'buyer'
  const score: 'hot' | 'warm' | 'cold' =
    extracted.urgency === 'high' ? 'hot' : extracted.urgency === 'medium' ? 'warm' : 'cold'

  const notesContact = extracted.zone || extracted.rooms
    ? [
        extracted.rooms ? `${extracted.rooms} pièces` : null,
        extracted.zone || null,
        extracted.budget ? `Budget ${extracted.budget} CHF` : null,
      ].filter(Boolean).join(' · ')
    : null

  const { data: rpcResult, error: rpcErr } = await supabase.rpc('create_lead_with_optional_deal', {
    p_first_name: extracted.firstName || 'Prénom',
    p_last_name:  extracted.lastName  || 'Nom',
    p_email:      extracted.email ?? undefined,
    p_phone:      extracted.phone ?? undefined,
    p_type:       contactType,
    p_source:     'import',
    p_score:      score,
    p_tags:       ['import-ia'],
    p_notes:      notesContact ?? undefined,
    p_budget_announced: extracted.budget ?? undefined,
    p_search_zones:     extracted.zone ? [extracted.zone] : [],
    p_import_raw_text:  rawText ?? undefined,
    p_create_deal:      createDeal && !!agencyId,
    p_deal_stage:       dealStage,
    p_deal_notes:       `Lead importé via MEGGA AI. Action suggérée : ${labelForNextAction(extracted.nextAction)}.`,
    p_deal_role:        dealRole,
  })

  if (rpcErr) throw rpcErr
  const contactId = (rpcResult as { contact_id: string; deal_id: string | null }).contact_id
  const dealId    = (rpcResult as { contact_id: string; deal_id: string | null }).deal_id ?? null

  // Récupère le nom du contact pour le label audit (la RPC ne renvoie pas la row complète).
  // À noter : on pourrait étendre la RPC pour retourner first/last_name, mais ces données
  // sont déjà en mémoire côté caller (extracted.firstName/lastName).
  const contact = {
    id: contactId,
    first_name: extracted.firstName || 'Prénom',
    last_name:  extracted.lastName  || 'Nom',
  }

  // 3. Audit nLPD — un event par entité touchée (audit Sprint 3a §A.2).
  //    On await pour garantir la persistance avant le retour (rétention 10 ans
  //    LBA art. 7 / nLPD art. 12 — pas de perte silencieuse §A.3).
  //    Si un insert audit échoue, on remonte l'erreur côté caller : la création
  //    métier est OK mais l'agent verra un toast d'avertissement.
  const auditRows: TablesInsert<'activity_events'>[] = [
    {
      agency_id: agencyId,
      actor_id: userId,
      actor_kind: 'user',
      action: 'Lead validé & créé',
      entity_type: 'contact',
      entity_id: contact.id,
      category: 'contact',
      severity: 'info',
      object_label: `${contact.first_name} ${contact.last_name}`,
      metadata: {
        intent: extracted.intent,
        urgency: extracted.urgency,
        next_action: extracted.nextAction,
        with_deal: !!dealId,
        deal_id: dealId,
        redaction_summary: redactionSummary,
        confidence: extracted.confidence,
      },
    },
  ]

  if (dealId) {
    auditRows.push({
      agency_id: agencyId,
      actor_id: userId,
      actor_kind: 'user',
      action: 'Deal créé depuis import lead',
      entity_type: 'transaction',
      entity_id: dealId,
      category: 'deal',
      severity: 'info',
      object_label: `${contact.first_name} ${contact.last_name} · ${extracted.intent}`,
      metadata: {
        contact_id: contact.id,
        intent: extracted.intent,
        urgency: extracted.urgency,
        initial_stage: initialDealStage(extracted.intent, extracted.urgency),
        next_action: extracted.nextAction,
      },
    })
  }

  const { error: auditErr } = await supabase.from('activity_events').insert(auditRows)
  if (auditErr) {
    // On NE jette PAS — le métier est déjà persisté côté contacts/transactions.
    // On remonte un signal via console + (futur) Sentry pour ne pas perdre
    // la trace. Le caller décidera s'il veut alerter l'agent.
    console.error('[useImportLead] audit insert failed (data persisted, audit lost):', auditErr.message)
  }

  return { contactId: contact.id, dealId }
}

function labelForNextAction(a: LeadNextAction): string {
  const map: Record<LeadNextAction, string> = {
    call:  'Appel de qualification',
    visit: 'Planifier une visite',
    match: 'Envoyer 3 biens du portefeuille',
    kyc:   'Lancer le KYC',
  }
  return map[a]
}

export function useImportLead() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<ImportLeadResult, Error, ImportLeadInput>({
    mutationFn: (input) => {
      if (!user) throw new Error('not_authenticated')
      return persistLead(input, profile?.agency_id ?? null, user.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      // Signal produit → Intercom : lead importé (activation, Series, ciblage).
      trackIntercomEvent(INTERCOM_EVENTS.LEAD_IMPORTED)
    },
  })
}

export { labelForNextAction }
