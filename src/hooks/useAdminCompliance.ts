/**
 * Hook super-admin — supervision compliance/KYC de toutes les agences.
 * `useAdminCompliance` liste les dossiers KYC (+ stats agrégées via RPC) — en
 * LECTURE seule : la révision du niveau de risque appartient au MLRO, dans la
 * fiche KYC du CRM, pas à la console. Deux hooks nLPD complètent : couverture
 * des consentements et journal des suppressions de comptes.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface ComplianceCase {
  id: string
  type: string
  risk_level: string
  risk_score: number | null
  status: string
  completion_pct: number
  screening_status: string | null
  created_at: string
  contact_name: string
  agency_name: string | null
  agency_id: string
}

export interface ComplianceStats {
  total: number
  pending: number
  pepMatches: number
  avgCompletion: number
}

/** Dossiers KYC de toutes les agences (contact/agence résolus côté client), stats agrégées et révision du niveau de risque. */
export function useAdminCompliance() {
  const cases = useQuery({
    queryKey: ['admin-compliance'],
    queryFn: async (): Promise<ComplianceCase[]> => {
      const { data, error } = await supabase
        .from('kyc_cases')
        .select('id, type, risk_level, risk_score, status, completion_pct, screening_status, created_at, contact_id, agency_id')
        .order('created_at', { ascending: false })
        // Idem : plafond loin devant la pagination, pour que la supervision
        // plateforme ne charge pas dix ans de dossiers LBA d'un coup.
        .limit(500)
      if (error) throw error

      const contactIds = [...new Set((data ?? []).map(c => c.contact_id).filter((x): x is string => x !== null))]
      const agencyIds = [...new Set((data ?? []).map(c => c.agency_id).filter((x): x is string => x !== null))]

      const [contacts, agencies] = await Promise.all([
        contactIds.length > 0
          ? supabase.from('contacts').select('id, first_name, last_name').in('id', contactIds)
          : { data: [] },
        agencyIds.length > 0
          ? supabase.from('agencies').select('id, name').in('id', agencyIds)
          : { data: [] },
      ])

      const contactMap = Object.fromEntries(
        (contacts.data ?? []).map(c => [c.id, `${c.first_name} ${c.last_name}`])
      )
      const agencyMap = Object.fromEntries(
        (agencies.data ?? []).map(a => [a.id, a.name])
      )

      return (data ?? []).map(c => ({
        id: c.id,
        type: c.type,
        risk_level: (c.risk_level ?? 'unassessed') as 'low' | 'medium' | 'high' | 'unassessed',
        risk_score: c.risk_score ?? null,
        status: c.status,
        completion_pct: c.completion_pct ?? 0,
        screening_status: c.screening_status ?? null,
        created_at: c.created_at,
        contact_name: c.contact_id ? contactMap[c.contact_id] ?? 'Inconnu' : 'Inconnu',
        agency_name: c.agency_id ? agencyMap[c.agency_id] ?? null : null,
        agency_id: c.agency_id,
      }))
    },
    staleTime: 30_000,
  })

  // RPC unique (migration 20260518_004) — remplace 4 queries parallèles
  // (3 count:'exact' + 1 SELECT AVG) sur kyc_cases (red-team CLAUDE.md §7).
  const stats = useQuery({
    queryKey: ['admin-compliance-stats'],
    queryFn: async (): Promise<ComplianceStats> => {
      const { data, error } = await supabase.rpc('get_admin_compliance_stats')
      if (error) throw error
      const row = ((data as Array<{
        total: number
        pending: number
        screening_match: number
        avg_completion: number
      }> | null) ?? [])[0]
      return {
        total: Number(row?.total ?? 0),
        pending: Number(row?.pending ?? 0),
        pepMatches: Number(row?.screening_match ?? 0),
        avgCompletion: Math.round(Number(row?.avg_completion ?? 0)),
      }
    },
    staleTime: 60_000,
  })

  // Pas de mutation risk_level ici : la classification LBA appartient à
  // l'agence (MLRO) — l'oversight plateforme reste en lecture seule (D5).
  return {
    cases: cases.data ?? [],
    isLoading: cases.isLoading,
    isError: cases.isError,
    refetch: cases.refetch,
    stats: stats.data,
    statsLoading: stats.isLoading,
  }
}

// ── Couverture des consentements nLPD (migration 20260705170000) ─────────────
export interface ConsentStats {
  coverage: Array<{ consent_type: string; version: string; accepted: number }>
  users_with_terms: number
  users_with_privacy: number
  users_total: number
}

/** Couverture des consentements nLPD (RPC `get_admin_consent_stats`) : nombre d'acceptations par type/version. */
export function useConsentStats() {
  return useQuery({
    queryKey: ['admin-consent-stats'],
    queryFn: async (): Promise<ConsentStats> => {
      const { data, error } = await supabase.rpc('get_admin_consent_stats')
      if (error) throw error
      return data as unknown as ConsentStats
    },
    staleTime: 60_000,
  })
}

// ── Suppressions de comptes (delete-account, nLPD art. 32) ───────────────────
export interface AccountDeletionEvent {
  id: string
  created_at: string
  object_label: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
}

/** Journal des suppressions de comptes (activity_events `account_deleted`, 50 dernières) — traçabilité nLPD art. 32. */
export function useAccountDeletions() {
  return useQuery({
    queryKey: ['admin-account-deletions'],
    queryFn: async (): Promise<AccountDeletionEvent[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, created_at, object_label, entity_id, metadata')
        .eq('action', 'account_deleted')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as AccountDeletionEvent[]
    },
    staleTime: 60_000,
  })
}
