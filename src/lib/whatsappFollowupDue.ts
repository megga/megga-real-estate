// Libellé d'échéance relatif d'un suivi WhatsApp — logique PURE partagée par les
// surfaces desktop (CockpitWhatsAppFollowups) et mobile (MobileWhatsAppFollowups),
// pour qu'elles ne divergent JAMAIS sur « en retard / aujourd'hui / demain ». Chaque
// surface mappe ensuite `urgency` vers ses propres tokens (TK desktop / MobileTokens).
//
// Fuseau LOCAL du navigateur (convention cockpit ; l'agent cible est à Zurich, où
// c'est exact). Un navigateur hors fuseau près de minuit peut décaler d'un jour.

export type FollowupUrgency = 'overdue' | 'today' | 'tomorrow' | 'dated' | 'none'

export interface FollowupDue {
  text: string
  urgency: FollowupUrgency
}

/**
 * Traduit une échéance ISO en libellé relatif + niveau d'urgence.
 * `dueAt` nul ou invalide ⇒ « à faire » / `none` (jamais de throw).
 */
export function followupDueLabel(dueAt: string | null): FollowupDue {
  if (!dueAt) return { text: 'à faire', urgency: 'none' }
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return { text: 'à faire', urgency: 'none' }
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const diffDays = Math.round((dueDay.getTime() - startOfToday.getTime()) / 86400000)
  if (diffDays < 0) return { text: 'en retard', urgency: 'overdue' }
  if (diffDays === 0) return { text: "aujourd'hui", urgency: 'today' }
  if (diffDays === 1) return { text: 'demain', urgency: 'tomorrow' }
  const dd = String(due.getDate()).padStart(2, '0')
  const mm = String(due.getMonth() + 1).padStart(2, '0')
  return { text: `${dd}.${mm}`, urgency: 'dated' }
}
