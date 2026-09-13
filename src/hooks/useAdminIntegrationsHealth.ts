// P7 — Santé des intégrations (RPC get_admin_integrations_health).

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface IntegrationsHealth {
  /**
   * Resend : les échecs de remise (email_delivery_events, resend-webhook, 7 j) et les erreurs
   * des fonctions send-%. Plus de « envoyés » (13.09.2026) : ils comptaient l'action
   * `email_sent`, que seule la Messagerie écrit — jamais Resend.
   */
  emails: { delivery_incidents_7d: number; errors_7d: number }
  stripe_webhook: {
    last_event_at: string | null
    age_hours: number | null
    events_7d: number
    payment_failed_7d: number
    active_subscriptions: number
  }
  calendar: {
    google: { connected: number; stale: number; expired: number }
    outlook: { connected: number; stale: number; expired: number }
    stale_total: number
  }
}

export function useAdminIntegrationsHealth() {
  return useQuery({
    queryKey: ['admin-integrations-health'],
    queryFn: async (): Promise<IntegrationsHealth | null> => {
      const { data, error } = await supabase.rpc('get_admin_integrations_health')
      if (error) throw error
      return (data as unknown as IntegrationsHealth) ?? null
    },
    staleTime: 60_000,
  })
}
