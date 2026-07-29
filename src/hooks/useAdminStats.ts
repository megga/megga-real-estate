/**
 * KPIs du dashboard super-admin (agences/users/biens/transactions actifs, KYC à
 * risque, nouveaux ce mois) via une RPC unique, plus les 10 derniers événements
 * d'alerte.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AdminKPIs {
  activeAgencies: number
  totalUsers: number
  activeProperties: number
  activeTransactions: number
  highRiskKyc: number
  newAgenciesThisMonth: number
  newUsersThisMonth: number
}

interface AlertEvent {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}

interface AdminStatsRow {
  active_agencies: number
  total_users: number
  active_properties: number
  active_transactions: number
  high_risk_kyc: number
  new_agencies_this_month: number
  new_users_this_month: number
}

/** KPIs admin (RPC unique) + flux des 10 derniers événements d'alerte. */
export function useAdminStats() {
  // Single RPC call replaces 7 parallel count:'exact' queries (red-team perf
  // fix — CLAUDE.md §7 violation, 7 full table scans → 1 SQL function).
  const kpis = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async (): Promise<AdminKPIs> => {
      const { data, error } = await supabase.rpc('get_admin_dashboard_stats')
      if (error) throw error
      const row = ((data as AdminStatsRow[] | null) ?? [])[0]
      return {
        activeAgencies: Number(row?.active_agencies ?? 0),
        totalUsers: Number(row?.total_users ?? 0),
        activeProperties: Number(row?.active_properties ?? 0),
        activeTransactions: Number(row?.active_transactions ?? 0),
        highRiskKyc: Number(row?.high_risk_kyc ?? 0),
        newAgenciesThisMonth: Number(row?.new_agencies_this_month ?? 0),
        newUsersThisMonth: Number(row?.new_users_this_month ?? 0),
      }
    },
    staleTime: 60_000,
  })

  // Deux filtres, pour deux raisons distinctes.
  //
  // La SÉVÉRITÉ d'abord : sans elle, la requête rendait les 10 derniers
  // événements toutes sévérités confondues — une création de contact
  // s'affichait sous le titre « Alertes » pendant qu'une vraie alerte, plus
  // ancienne, en était chassée. Filtrer par sévérité plutôt que par une liste
  // d'actions est délibéré : toute action future marquée `warn`/`critical`
  // remonte ici sans qu'on ait à y penser.
  //
  // L'EXCLUSION ensuite : `admin_console_entered` est en `warn` (migration
  // 20260725220000) pour ressortir dans le journal de sécurité, mais un
  // super-admin qui ouvre sa propre console n'a rien à s'annoncer à lui-même.
  // Depuis que l'ouverture est journalisée à chaque entrée et non plus à chaque
  // chargement de page, ces lignes noyaient tout le reste.
  //
  // L'INCLUSION enfin : `agency_created` est en `info` et le restera — une
  // agence qui arrive est une bonne nouvelle, la ranger en `warn` pour la faire
  // remonter serait mentir sur sa gravité. C'est pourtant le seul signal de
  // croissance de la plateforme, et le bento sait déjà le rendre en ton « ok ».
  // On l'ajoute donc par une règle nommée plutôt qu'en gonflant sa sévérité.
  const alerts = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: async (): Promise<AlertEvent[]> => {
      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at')
        .or('severity.in.(warn,critical),action.eq.agency_created')
        .neq('action', 'admin_console_entered')
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as AlertEvent[]
    },
    staleTime: 60_000,
  })

  return {
    kpis: kpis.data,
    kpisLoading: kpis.isLoading,
    kpisError: kpis.isError,
    alerts: alerts.data ?? [],
    alertsLoading: alerts.isLoading,
    alertsError: alerts.isError,
    refetch: () => { void kpis.refetch(); void alerts.refetch() },
  }
}
