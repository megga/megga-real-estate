// MEGGA — Orchestrateur IA (Premier jour Day 0)
// Types pour la table ai_actions_queue et les sorties des fonctions Postgres
// compute_agent_preferences / can_auto_send / is_within_sla_window.
//
// Voir supabase/migrations/20260522_002_ai_day0_orchestration.sql.

import type { Autonomy, Dispo, Priorite, Specialite } from '@/components/premier-jour-sugar/types'

// ─── Table ai_actions_queue ──────────────────────────────────────────

export type AiActionStatus =
  | 'pending'
  | 'sent'
  | 'dismissed'
  | 'cancelled'
  | 'expired'

export type AiActionEntityType =
  | 'contact'
  | 'deal'
  | 'visit'
  | 'briefing'
  | 'property'
  | 'kyc'

/**
 * Taxonomie ouverte (TEXT côté SQL pour ajouter sans migration).
 * Liste actuelle alignée avec automation-engine.reminderTypeToTrigger
 * + nouvelles actions IA déclenchées par le calibrage Premier jour.
 */
export type AiActionType =
  // Relances classiques (automation-engine)
  | 'relance_simple'
  | 'sms_courtoisie'
  | 'accuse_reception'
  | 'email_followup'
  | 'post_visit_feedback'
  | 'dormant_lead'
  | 'missing_document'
  | 'follow_up_sent_property'
  // Nouvelles actions Premier jour
  | 'briefing_today'      // 3 actions du matin sur Today
  | 'proposal_send'       // envoi de proposition commerciale (jamais auto)
  | 'sourcing_suggestion' // suggestion d'un lead à activer (priorité acquisition)
  | (string & {})         // permet l'extension sans casser le type

export interface AiAction {
  id: string
  agent_id: string
  agency_id: string
  entity_type: AiActionEntityType
  entity_id: string | null
  action_type: AiActionType
  payload: Record<string, unknown>
  status: AiActionStatus
  autonomy_required: Autonomy
  scheduled_at: string  // ISO timestamptz
  expires_at: string | null
  validated_by: string | null
  sent_at: string | null
  dismissed_at: string | null
  source_event_id: string | null
  created_at: string
  updated_at: string
}

// ─── Sortie de compute_agent_preferences() ───────────────────────────

/**
 * Fenêtre SLA dérivée de `day0_payload.dispo`.
 * - hours_start/hours_end : 0-24, heures locales Europe/Zurich
 * - days_of_week : 1=lundi … 7=dimanche (ISO)
 * - response_target_hours : null pour '247' (libre)
 */
export interface AgentSlaWindow {
  hours_start: number
  hours_end: number
  days_of_week: number[]
  response_target_hours: number | null
}

/**
 * Gate par type d'action. Chaque clé = AiActionType,
 * chaque valeur = peut partir sans validation humaine ?
 */
export type AutonomyGate = Partial<Record<AiActionType, boolean>>

/**
 * Pondération relative par catégorie d'opportunité.
 * Pilote le ranking du morning briefing + scoring downstream.
 */
export interface PrioriteWeights {
  new_lead: number     // 0..1
  dormant: number      // 0..1
  deal_active: number  // 0..1
  sourcing: number     // 0..1
}

/**
 * Retour de compute_agent_preferences(agent_id).
 * NULL si l'agent n'a pas encore joué le sas Premier jour
 * (les engines doivent skip dans ce cas — fail-safe).
 */
export interface AgentPreferences {
  agent_id: string
  specialite: Specialite
  zone_ids: string[]
  dispo: Dispo
  priorite: Priorite
  autonomy: Autonomy
  sla: AgentSlaWindow | null
  autonomy_gate: AutonomyGate
  priorite_weights: PrioriteWeights
  has_calibrated: true
}
