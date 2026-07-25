/**
 * Limites et capacités du plan d'abonnement courant.
 *
 * Dérive les quotas (biens, contacts) et les features accessibles depuis
 * `PLAN_LIMITS[plan]` selon l'abonnement actif (`useSubscription`).
 */
import { useSubscription } from './useSubscription'
import { PLAN_LIMITS } from '@/lib/plans'

/**
 * Expose les limites du plan courant + deux gardes : `canAccess(feature)` et
 * `isAtLimit(resource, count)` (quota atteint quand `count >= max`).
 */
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
