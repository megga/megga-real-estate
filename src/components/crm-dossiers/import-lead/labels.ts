// Sprint 3 — Labels canoniques pour l'Import Lead.
// Reutilises par la page wizard + (a terme) par le popover Today
// "Demande de traitement - MEGGA AI - N leads en attente".

import type { LeadIntent, LeadNextAction, LeadUrgency } from '@/hooks/useExtractLead'
// i18n : libellés en getters (singleton, sans changer les appelants
// INTENT_LABELS[x] etc.). INTENT réutilise contacts:contactType.* (mêmes codes
// buyer/seller/tenant). Cf docs/i18n-conventions §6.
import i18n from '@/i18n'

export const INTENT_LABELS: Record<LeadIntent, string> = {
  get buyer()  { return i18n.t('contacts:contactType.buyer') },
  get seller() { return i18n.t('contacts:contactType.seller') },
  get tenant() { return i18n.t('contacts:contactType.tenant') },
}

export const URGENCY_LABELS: Record<LeadUrgency, string> = {
  get high()   { return i18n.t('contacts:import.urgency.high') },
  get medium() { return i18n.t('contacts:import.urgency.medium') },
  get normal() { return i18n.t('contacts:import.urgency.normal') },
}

export const NEXT_ACTION_LABELS: Record<LeadNextAction, string> = {
  get call()  { return i18n.t('contacts:import.nextAction.call') },
  get visit() { return i18n.t('contacts:import.nextAction.visit') },
  get match() { return i18n.t('contacts:import.nextAction.match') },
  get kyc()   { return i18n.t('contacts:import.nextAction.kyc') },
}

/** Formate un budget en CHF, avec /mois si tenant. Apostrophe suisse pour les milliers. */
export function formatBudget(amount: number | null, intent: LeadIntent): string {
  if (amount == null) return '—'
  // toLocaleString('fr-CH') retourne NBSP (U+00A0) ou NNBSP (U+202F) ;
  // on normalise vers l'apostrophe suisse attendue par la charte MEGGA.
  const fmt = amount.toLocaleString('fr-CH').replace(/[\u00A0\u202F,]/g, "'")
  if (intent === 'tenant') return `CHF ${fmt}/mois`
  return `CHF ${fmt}`
}
