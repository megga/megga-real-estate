// MEGGA CRM — Cockpit « Aujourd'hui » · Algo Focus · source MATCHES (RPC)
// ----------------------------------------------------------------------------
// Archi C hybride : le seul gros volume (matches ~2.6k 'suggested') passe par
// un RPC SECURITY DEFINER `focus_top_matches` qui gate (score >= match_gate),
// dédoublonne + cap 2/contact + top-N EN SQL, et renvoie des items
// auto-suffisants (contact + bien + KYC + clés de raison). L'agence vient du
// JWT (anti-IDOR) — jamais de paramètre agency_id côté client.
//
// Les RPC ne sont pas dans les types générés `Database` → on suit le pattern
// `rpcUntyped` du repo (cf useAxDashboardData.ts) pour rester sans `any`.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { FocusKyc } from './focusScore'

// snake_case renvoyé par le RPC focus_top_matches()
interface FocusMatchRow {
  match_id: string
  contact_id: string
  contact_name: string | null
  kind: 'internal' | 'market'
  score: number
  reasons_match_count: number | null
  reason_keys: string[] | null
  property_title: string | null
  property_price: number | null
  property_photo: string | null
  city: string | null
  kyc_risk_high: boolean | null
  kyc_days_to_expiry: number | null
}

export interface FocusMatch {
  matchId: string
  contactId: string
  contactName: string | null
  signalKind: 'match-internal' | 'match-market'
  score: number
  reasonsMatchCount: number
  reasonKeys: string[]
  propertyTitle: string | null
  propertyPrice: number | null
  propertyPhoto: string | null
  city: string | null
  kyc: FocusKyc
}

const rpcUntyped = supabase.rpc as unknown as
  (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>

export function useFocusMatches(limit = 30): { matches: FocusMatch[]; isLoading: boolean } {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const query = useQuery({
    queryKey: ['focus-matches', agencyId, limit],
    queryFn: async (): Promise<FocusMatch[]> => {
      const { data, error } = await rpcUntyped('focus_top_matches', { p_limit: limit })
      if (error) throw error
      const rows = (data ?? []) as FocusMatchRow[]
      return rows.map((r): FocusMatch => ({
        matchId: r.match_id,
        contactId: r.contact_id,
        contactName: r.contact_name,
        signalKind: r.kind === 'internal' ? 'match-internal' : 'match-market',
        score: r.score,
        reasonsMatchCount: r.reasons_match_count ?? 0,
        reasonKeys: r.reason_keys ?? [],
        propertyTitle: r.property_title,
        propertyPrice: r.property_price,
        propertyPhoto: r.property_photo,
        city: r.city,
        kyc: { riskHigh: r.kyc_risk_high ?? false, daysToExpiry: r.kyc_days_to_expiry },
      }))
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const matches = useMemo(() => query.data ?? [], [query.data])
  return { matches, isLoading: query.isLoading }
}

/** Snooze réel d'un match (Replanifier) : +3 j sur snoozed_until. RLS agence. */
export async function snoozeMatch(matchId: string): Promise<void> {
  const until = new Date()
  until.setDate(until.getDate() + 3)
  await supabase
    .from('matches')
    .update({ snoozed_until: until.toISOString() } as never)
    .eq('id', matchId)
}
