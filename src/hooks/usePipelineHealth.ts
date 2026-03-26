import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// ── Types ──

export type AnomalyType = 'stale_deal' | 'cold_lead' | 'no_visits' | 'kyc_incomplete' | 'overdue_reminder' | 'unresponsive_buyer'
export type AnomalySeverity = 'critical' | 'warning' | 'info'

export interface PipelineAnomaly {
  id: string
  type: AnomalyType
  severity: AnomalySeverity
  title: string
  description: string
  entityType: 'contact' | 'transaction' | 'property' | 'kyc'
  entityId: string
  daysSince: number
  actionLabel: string
  actionRoute: string
}

export interface PipelineHealthScore {
  score: number // 0-100
  label: 'excellent' | 'good' | 'attention' | 'critical'
  anomalies: PipelineAnomaly[]
  stats: {
    totalDeals: number
    staleDeals: number
    coldLeads: number
    overdueReminders: number
    incompleteKyc: number
  }
}

// ── Thresholds ──

const STALE_DEAL_DAYS = 14       // Deal sans mouvement > 14 jours
const COLD_LEAD_DAYS = 21        // Lead chaud sans interaction > 21 jours
const KYC_INCOMPLETE_DAYS = 10   // KYC en cours > 10 jours

// ── Hook ──

export function usePipelineHealth() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  // Fetch stale deals
  const { data: staleDeals = [] } = useQuery({
    queryKey: ['pipeline-health-deals', agencyId],
    queryFn: async () => {
      const threshold = new Date(Date.now() - STALE_DEAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('transactions')
        .select('id, stage, status, updated_at, contact_buyer_id, property:properties(title, address, city), buyer:contacts!contact_buyer_id(first_name, last_name)')
        .eq('agency_id', agencyId!)
        .eq('status', 'active')
        .lt('updated_at', threshold)
        .not('stage', 'in', '("signed","closed","lost")')
        .order('updated_at', { ascending: true })
        .limit(20)
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 10 * 60 * 1000,
  })

  // Fetch cold hot leads (score=hot but no interaction in 21 days)
  const { data: coldLeads = [] } = useQuery({
    queryKey: ['pipeline-health-cold-leads', agencyId],
    queryFn: async () => {
      const threshold = new Date(Date.now() - COLD_LEAD_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, score, type, last_interaction_at')
        .eq('agency_id', agencyId!)
        .eq('score', 'hot')
        .lt('last_interaction_at', threshold)
        .order('last_interaction_at', { ascending: true })
        .limit(20)
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 10 * 60 * 1000,
  })

  // Fetch overdue reminders
  const { data: overdueReminders = [] } = useQuery({
    queryKey: ['pipeline-health-reminders', agencyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('reminders')
        .select('id, type, trigger_at, contact_id, contact:contacts(first_name, last_name)')
        .eq('agency_id', agencyId!)
        .eq('status', 'triggered')
        .lt('trigger_at', new Date().toISOString())
        .order('trigger_at', { ascending: true })
        .limit(20)
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 5 * 60 * 1000,
  })

  // Fetch incomplete KYC
  const { data: incompleteKyc = [] } = useQuery({
    queryKey: ['pipeline-health-kyc', agencyId],
    queryFn: async () => {
      const threshold = new Date(Date.now() - KYC_INCOMPLETE_DAYS * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabase
        .from('kyc_cases')
        .select('id, status, created_at, contact:contacts(first_name, last_name)')
        .eq('agency_id', agencyId!)
        .in('status', ['pending', 'in_progress'])
        .lt('created_at', threshold)
        .order('created_at', { ascending: true })
        .limit(20)
      return data ?? []
    },
    enabled: !!agencyId,
    staleTime: 10 * 60 * 1000,
  })

  // Build anomalies list
  const health = useMemo((): PipelineHealthScore => {
    const anomalies: PipelineAnomaly[] = []
    const unwrap = <T,>(v: T | T[] | null): T | null => Array.isArray(v) ? v[0] ?? null : v
    // eslint-disable-next-line react-hooks/purity -- Date.now() is safe in useMemo (computed once per deps change)
    const daysBetween = (date: string) => Math.floor((Date.now() - new Date(date).getTime()) / (24 * 60 * 60 * 1000))

    // Stale deals
    for (const deal of staleDeals) {
      const property = unwrap(deal.property) as { title: string; city: string } | null
      const buyer = unwrap(deal.buyer) as { first_name: string; last_name: string } | null
      const days = daysBetween(deal.updated_at)
      anomalies.push({
        id: `stale-${deal.id}`,
        type: 'stale_deal',
        severity: days > 30 ? 'critical' : 'warning',
        title: `Deal bloqué depuis ${days}j`,
        description: `${buyer ? `${buyer.first_name} ${buyer.last_name}` : 'Deal'} — ${property?.title ?? 'Bien'} (étape: ${deal.stage})`,
        entityType: 'transaction',
        entityId: deal.id,
        daysSince: days,
        actionLabel: 'Voir le deal',
        actionRoute: `/app/pipeline`,
      })
    }

    // Cold leads
    for (const lead of coldLeads) {
      const days = lead.last_interaction_at ? daysBetween(lead.last_interaction_at) : 999
      anomalies.push({
        id: `cold-${lead.id}`,
        type: 'cold_lead',
        severity: days > 30 ? 'critical' : 'warning',
        title: `Lead chaud sans contact depuis ${days}j`,
        description: `${lead.first_name} ${lead.last_name} — marqué "chaud" mais inactif`,
        entityType: 'contact',
        entityId: lead.id,
        daysSince: days,
        actionLabel: 'Relancer',
        actionRoute: `/app/contacts/${lead.id}`,
      })
    }

    // Overdue reminders
    for (const reminder of overdueReminders) {
      const contact = unwrap(reminder.contact) as { first_name: string; last_name: string } | null
      const days = daysBetween(reminder.trigger_at)
      anomalies.push({
        id: `reminder-${reminder.id}`,
        type: 'overdue_reminder',
        severity: days > 7 ? 'critical' : 'warning',
        title: `Relance en retard (${days}j)`,
        description: `${contact ? `${contact.first_name} ${contact.last_name}` : 'Contact'} — ${reminder.type}`,
        entityType: 'contact',
        entityId: reminder.contact_id,
        daysSince: days,
        actionLabel: 'Traiter',
        actionRoute: `/app/contacts/${reminder.contact_id}`,
      })
    }

    // Incomplete KYC
    for (const kyc of incompleteKyc) {
      const contact = unwrap(kyc.contact) as { first_name: string; last_name: string } | null
      const days = daysBetween(kyc.created_at)
      anomalies.push({
        id: `kyc-${kyc.id}`,
        type: 'kyc_incomplete',
        severity: days > 20 ? 'critical' : 'info',
        title: `Dossier KYC incomplet (${days}j)`,
        description: `${contact ? `${contact.first_name} ${contact.last_name}` : 'Contact'} — en attente depuis ${days} jours`,
        entityType: 'kyc',
        entityId: kyc.id,
        daysSince: days,
        actionLabel: 'Compléter',
        actionRoute: `/app/kyc/${kyc.id}`,
      })
    }

    // Sort by severity then daysSince
    const severityOrder: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 }
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.daysSince - a.daysSince)

    // Calculate health score (100 = perfect, 0 = critical)
    const totalAnomalies = anomalies.length
    const criticalCount = anomalies.filter(a => a.severity === 'critical').length
    const warningCount = anomalies.filter(a => a.severity === 'warning').length
    const rawScore = Math.max(0, 100 - (criticalCount * 15) - (warningCount * 5) - (totalAnomalies * 2))
    const score = Math.min(100, Math.max(0, rawScore))

    const label: PipelineHealthScore['label'] =
      score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'attention' : 'critical'

    return {
      score,
      label,
      anomalies,
      stats: {
        totalDeals: staleDeals.length + 10, // approximate
        staleDeals: staleDeals.length,
        coldLeads: coldLeads.length,
        overdueReminders: overdueReminders.length,
        incompleteKyc: incompleteKyc.length,
      },
    }
  }, [staleDeals, coldLeads, overdueReminders, incompleteKyc])

  return health
}
