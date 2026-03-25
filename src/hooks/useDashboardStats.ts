import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TransactionStage } from '@/lib/constants'

/* ─── Types ─── */

export interface DashboardKPIs {
  activeProperties: number
  activeTransactions: number
  pipelineValue: number
  totalContacts: number
  visitsThisMonth: number
}

export interface PipelineStageCount {
  stage: TransactionStage
  count: number
  value: number
}

export interface AtRiskDeal {
  id: string
  stage: TransactionStage
  updated_at: string
  daysSinceUpdate: number
  buyer: { first_name: string; last_name: string } | null
  property: { address: string; city: string; price: number } | null
}

export interface ActivityEvent {
  id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor: { full_name: string } | null
}

/* ─── Hook ─── */

export function useDashboardStats() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  /* ── KPIs ── */
  const kpis = useQuery({
    queryKey: ['dashboard-stats', agencyId],
    queryFn: async (): Promise<DashboardKPIs> => {
      if (!agencyId) throw new Error('No agency')

      const now = new Date()
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [properties, transactions, contacts, visits] = await Promise.all([
        supabase
          .from('properties')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .eq('status', 'active'),
        supabase
          .from('transactions')
          .select('price_offered, price_final')
          .eq('agency_id', agencyId)
          .eq('status', 'active'),
        supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId),
        supabase
          .from('visits')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .gte('scheduled_at', monthStart),
      ])

      const txData = transactions.data || []
      const pipelineValue = txData.reduce((sum, tx) => {
        const price = tx.price_final ?? tx.price_offered ?? 0
        return sum + price
      }, 0)

      return {
        activeProperties: properties.count ?? 0,
        activeTransactions: txData.length,
        pipelineValue,
        totalContacts: contacts.count ?? 0,
        visitsThisMonth: visits.count ?? 0,
      }
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })

  /* ── Pipeline by stage ── */
  const pipeline = useQuery({
    queryKey: ['dashboard-pipeline', agencyId],
    queryFn: async (): Promise<PipelineStageCount[]> => {
      if (!agencyId) throw new Error('No agency')

      const { data, error } = await supabase
        .from('transactions')
        .select('stage, price_offered, price_final')
        .eq('agency_id', agencyId)
        .eq('status', 'active')

      if (error) throw error

      const stageMap = new Map<TransactionStage, { count: number; value: number }>()
      for (const tx of data || []) {
        const stage = tx.stage as TransactionStage
        const existing = stageMap.get(stage) || { count: 0, value: 0 }
        existing.count += 1
        existing.value += tx.price_final ?? tx.price_offered ?? 0
        stageMap.set(stage, existing)
      }

      return Array.from(stageMap.entries()).map(([stage, { count, value }]) => ({
        stage,
        count,
        value,
      }))
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })

  /* ── Deals at risk ── */
  const atRiskDeals = useQuery({
    queryKey: ['dashboard-at-risk', agencyId],
    queryFn: async (): Promise<AtRiskDeal[]> => {
      if (!agencyId) throw new Error('No agency')

      const now = new Date()
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('transactions')
        .select('id, stage, updated_at, buyer:contacts!contact_buyer_id(first_name, last_name), property:properties(address, city, price)')
        .eq('agency_id', agencyId)
        .eq('status', 'active')
        .lt('updated_at', fourteenDaysAgo)
        .order('updated_at', { ascending: true })
        .limit(10)

      if (error) throw error

      // Also fetch critical stage deals (offer/negotiation/reserved) stale > 7 days
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: criticalData, error: criticalError } = await supabase
        .from('transactions')
        .select('id, stage, updated_at, buyer:contacts!contact_buyer_id(first_name, last_name), property:properties(address, city, price)')
        .eq('agency_id', agencyId)
        .eq('status', 'active')
        .in('stage', ['offer', 'negotiation', 'reserved'])
        .lt('updated_at', sevenDaysAgo)
        .gte('updated_at', fourteenDaysAgo) // avoid duplicates with first query
        .order('updated_at', { ascending: true })
        .limit(10)

      if (criticalError) throw criticalError

      const allDeals = [...(data || []), ...(criticalData || [])]

      return allDeals.map((deal) => {
        const daysSince = Math.floor((now.getTime() - new Date(deal.updated_at).getTime()) / (24 * 60 * 60 * 1000))
        const buyer = Array.isArray(deal.buyer) ? deal.buyer[0] : deal.buyer
        const property = Array.isArray(deal.property) ? deal.property[0] : deal.property
        return {
          id: deal.id,
          stage: deal.stage as TransactionStage,
          updated_at: deal.updated_at,
          daysSinceUpdate: daysSince,
          buyer: buyer || null,
          property: property || null,
        }
      })
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })

  /* ── Recent activity ── */
  const activity = useQuery({
    queryKey: ['dashboard-activity', agencyId],
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (!agencyId) throw new Error('No agency')

      const { data, error } = await supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at, actor:profiles!actor_id(full_name)')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      return (data || []).map((evt) => ({
        ...evt,
        actor: Array.isArray(evt.actor) ? evt.actor[0] : evt.actor,
      })) as ActivityEvent[]
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })

  return {
    kpis: kpis.data,
    kpisLoading: kpis.isLoading,
    pipeline: pipeline.data || [],
    pipelineLoading: pipeline.isLoading,
    atRiskDeals: atRiskDeals.data || [],
    atRiskLoading: atRiskDeals.isLoading,
    activity: activity.data || [],
    activityLoading: activity.isLoading,
  }
}
