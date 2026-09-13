/**
 * Abonnement Stripe de l'agence courante (table `subscriptions`, RLS agency-scopée).
 *
 * Expose le plan/statut actifs + deux flux Stripe redirigés (Edge Functions) :
 * `stripe-checkout` (souscription) et `stripe-portal` (gestion). En cas d'échec
 * de la requête, on retombe sur « aucun abonnement » plutôt que de bloquer l'UI.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, urlFonction } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { PlanType } from '@/lib/plans'

// Sans identifiant Stripe ni montant : ces colonnes ne sont plus lisibles par un membre
// (audit S13, 20260913170000) — le portail et le checkout les lisent côté serveur.
interface Subscription {
  id: string
  agency_id: string
  plan: PlanType
  billing_period: 'monthly' | 'yearly'
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete'
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

/** Abonnement courant + plan/statut dérivés et actions Stripe (checkout, portail). */
export function useSubscription() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['subscription'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('id, agency_id, plan, billing_period, status, current_period_start, current_period_end, cancel_at_period_end, created_at, updated_at')
        .maybeSingle()
      if (error) throw error
      return data as Subscription | null
    },
    retry: false,
    // If the query fails (e.g. table doesn't exist yet, network error),
    // treat it as "no subscription" rather than blocking the UI
    placeholderData: null,
  })

  const currentPlan: PlanType = subscription?.plan ?? 'starter'
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing'

  const createCheckoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non connecté')

      const response = await fetch(
        urlFonction('stripe-checkout'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ priceId }),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de la création du checkout')
      }

      const { url } = await response.json()
      window.location.href = url
    },
  })

  const openPortalMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non connecté')

      const response = await fetch(
        urlFonction('stripe-portal'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({}),
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erreur lors de l\'ouverture du portail')
      }

      const { url } = await response.json()
      window.location.href = url
    },
  })

  return {
    subscription,
    isLoading,
    error,
    currentPlan,
    isActive,
    createCheckout: createCheckoutMutation.mutateAsync,
    isCheckoutLoading: createCheckoutMutation.isPending,
    openPortal: openPortalMutation.mutateAsync,
    isPortalLoading: openPortalMutation.isPending,
    invalidate: () => queryClient.invalidateQueries({ queryKey: ['subscription'] }),
  }
}
