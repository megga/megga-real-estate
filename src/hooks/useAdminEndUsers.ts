// P6b — Supervision des audiences sans compte (super-admin).
// Stats agrégées (get_admin_end_user_stats) + liste des parcours KYC publics
// (RPC scopées, JAMAIS de token ni de PII IP).
// Le bloc « portails vendeurs » a disparu avec la fonctionnalité (2026-07-26).

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface EndUserStats {
  magic_links: { total_30d: number; opened: number; uploaded: number; confirmed: number; expired: number; conversion_pct: number }
  leads: { by_status: { status: string; count: number }[]; by_source: { source: string; count: number }[]; total: number; new_30d: number }
  contact_messages: { by_status: { status: string; count: number }[]; total: number }
}

export interface KycMagicLinkRow {
  id: string
  status: string
  mode: string
  sent_at: string
  opened_at: string | null
  uploaded_at: string | null
  confirmed_at: string | null
  expires_at: string
  agency_name: string | null
  contact_name: string | null
}

export function useEndUserStats() {
  return useQuery({
    queryKey: ['admin-end-user-stats'],
    queryFn: async (): Promise<EndUserStats | null> => {
      const { data, error } = await supabase.rpc('get_admin_end_user_stats')
      if (error) throw error
      return (data as unknown as EndUserStats) ?? null
    },
    staleTime: 60_000,
  })
}

export function useKycMagicLinks(status: string | null) {
  return useQuery({
    queryKey: ['admin-kyc-magic-links', status],
    queryFn: async (): Promise<KycMagicLinkRow[]> => {
      const { data, error } = await supabase.rpc('get_admin_kyc_magic_links', {
        p_status: status ?? undefined,
        p_limit: 50,
      })
      if (error) throw error
      return (data as KycMagicLinkRow[] | null) ?? []
    },
    staleTime: 60_000,
  })
}
