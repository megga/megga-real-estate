/**
 * Score de santé d'une agence (vue super-admin). Agrège 5 facteurs pondérés
 * (récence d'activité, biens actifs, contacts, transactions, volume 30 j) en un
 * score /100 et un niveau healthy/warning/critical. Déterministe, 0 LLM.
 */

interface AgencyMetrics {
  daysSinceLastActivity: number
  activePropertiesCount: number
  contactsCount: number
  transactionsCount: number
  eventsLast30Days: number
}

/** Combine les 5 facteurs en un score /100, un niveau et le détail par facteur (affichage). */
export function calculateAgencyHealth(metrics: AgencyMetrics): {
  score: number
  level: 'healthy' | 'warning' | 'critical'
  factors: { label: string; score: number; max: number }[]
} {
  // Factor 1: Recency (0-30 pts)
  const recencyScore = metrics.daysSinceLastActivity <= 1 ? 30
    : metrics.daysSinceLastActivity <= 3 ? 25
    : metrics.daysSinceLastActivity <= 7 ? 20
    : metrics.daysSinceLastActivity <= 14 ? 10
    : metrics.daysSinceLastActivity <= 30 ? 5
    : 0

  // Factor 2: Properties (0-20 pts)
  const propertyScore = Math.min(metrics.activePropertiesCount * 4, 20)

  // Factor 3: Contacts (0-20 pts)
  const contactScore = Math.min(metrics.contactsCount * 2, 20)

  // Factor 4: Transactions (0-15 pts)
  const transactionScore = Math.min(metrics.transactionsCount * 5, 15)

  // Factor 5: Activity volume (0-15 pts)
  const activityScore = metrics.eventsLast30Days >= 50 ? 15
    : metrics.eventsLast30Days >= 20 ? 12
    : metrics.eventsLast30Days >= 10 ? 8
    : metrics.eventsLast30Days >= 5 ? 4
    : 0

  const score = recencyScore + propertyScore + contactScore + transactionScore + activityScore

  const level: 'healthy' | 'warning' | 'critical' =
    score >= 60 ? 'healthy' : score >= 30 ? 'warning' : 'critical'

  return {
    score,
    level,
    factors: [
      { label: 'Activite recente', score: recencyScore, max: 30 },
      { label: 'Biens actifs', score: propertyScore, max: 20 },
      { label: 'Contacts CRM', score: contactScore, max: 20 },
      { label: 'Transactions', score: transactionScore, max: 15 },
      { label: 'Volume activite', score: activityScore, max: 15 },
    ],
  }
}
