interface AgencyMetrics {
  daysSinceLastActivity: number
  activePropertiesCount: number
  contactsCount: number
  transactionsCount: number
  eventsLast30Days: number
}

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
