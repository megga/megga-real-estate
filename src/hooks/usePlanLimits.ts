import { useSubscription } from './useSubscription'
import { PLAN_LIMITS } from '@/lib/plans'

export function usePlanLimits() {
  const { currentPlan } = useSubscription()
  const limits = PLAN_LIMITS[currentPlan]

  return {
    limits,
    currentPlan,
    canAccess: (feature: keyof typeof limits.features) => !!limits.features[feature],
    isAtLimit: (resource: 'properties' | 'contacts', currentCount: number) => {
      const max = resource === 'properties' ? limits.maxProperties : limits.maxContacts
      return currentCount >= max
    },
  }
}
