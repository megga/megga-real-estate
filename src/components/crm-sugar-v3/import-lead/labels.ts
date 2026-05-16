// Sprint 3 — Labels canoniques pour l'Import Lead.
// Reutilises par la page wizard + (a terme) par le popover Today
// "Demande de traitement - MEGGA AI - N leads en attente".

import type { LeadIntent, LeadNextAction, LeadUrgency } from '@/hooks/useExtractLead'

export const INTENT_LABELS: Record<LeadIntent, string> = {
  buyer:  'Acheteur',
  seller: 'Vendeur',
  tenant: 'Locataire',
}

export const URGENCY_LABELS: Record<LeadUrgency, string> = {
  high:   'Élevée',
  medium: 'Modérée',
  normal: 'Normale',
}

export const NEXT_ACTION_LABELS: Record<LeadNextAction, string> = {
  call:  'Appel de qualification',
  visit: 'Planifier une visite',
  match: 'Envoyer 3 biens du portefeuille',
  kyc:   'Lancer le KYC',
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
