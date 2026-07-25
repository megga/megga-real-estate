// P8b — Factures Stripe détaillées d'une agence (edge admin-stripe-agency-billing).
// Appel À LA DEMANDE (enabled=false ; refetch au clic) — l'API Stripe est coûteuse.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AgencyInvoice {
  id: string
  number: string | null
  status: string | null
  amount_paid: number
  amount_due: number
  currency: string
  created: number
  hosted_invoice_url: string | null
}

export interface AgencyBilling {
  configured: boolean
  agency_name: string
  subscription: { status: string; current_period_end: number; cancel_at_period_end: boolean } | null
  invoices: AgencyInvoice[]
  upcoming: { amount_due: number; currency: string; next_payment_attempt: number | null } | null
}

export function useAgencyInvoices(agencyId: string) {
  return useQuery({
    queryKey: ['admin-agency-invoices', agencyId],
    enabled: false, // chargé à la demande (clic « Charger les factures »)
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AgencyBilling> => {
      const { data, error } = await supabase.functions.invoke('admin-stripe-agency-billing', {
        body: { agency_id: agencyId },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data as AgencyBilling
    },
  })
}
