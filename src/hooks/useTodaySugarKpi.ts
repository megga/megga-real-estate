// MEGGA CRM Sugar v2 — KPIs live pour TodaySugarPage.
// 5 tuiles en tête de page (Exécutées / Actives / Pipeline / Matchs / Risque).
// Toutes les sources de vérité = Supabase (reminders, transactions, matches).
//
// Scope : ce hook ne remplit pas les colonnes mock (relances/qualif/offres/comm)
// — celles-ci restent câblées via SugarTodayComponents et feront l'objet d'une
// PR séparée. On se concentre ici sur les chiffres en haut de page.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface TodaySugarKpi {
  isLoading: boolean
  // Tâches du jour (reminders)
  executedToday: number
  executedTotal: number     // exécutées + actives = base pour le donut
  activeTasks: number
  activeTarget: number      // objectif d'actives traitées dans la journée
  // Pipeline (transactions)
  pipelineValue: number     // CHF, somme des deals actifs
  atRisk: number            // transactions status='on_hold' ou stalled
  // Matching
  newMatchesToday: number   // matches.created_at >= aujourd'hui
}

function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useTodaySugarKpi(): TodaySugarKpi {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  // 1. Reminders exécutés aujourd'hui (status='done' AND completed_at >= today)
  const { data: executedToday = 0, isLoading: execLoading } = useQuery({
    queryKey: ['today-sugar-kpi', 'executed', agencyId],
    queryFn: async () => {
      if (!agencyId) return 0
      const { count, error } = await supabase
        .from('reminders')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('status', 'done')
        .gte('completed_at', startOfTodayISO())
      if (error) throw error
      return count ?? 0
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 2. Reminders actifs (pending/triggered/snoozed)
  const { data: activeTasks = 0, isLoading: activeLoading } = useQuery({
    queryKey: ['today-sugar-kpi', 'active', agencyId],
    queryFn: async () => {
      if (!agencyId) return 0
      const { count, error } = await supabase
        .from('reminders')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .in('status', ['pending', 'triggered', 'snoozed'])
      if (error) throw error
      return count ?? 0
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 3. Pipeline value (transactions actives — somme price_final ?? price_offered ?? property.price)
  // On n'agrège pas en SQL pour éviter une RPC dédiée — petits volumes attendus en CRM.
  const { data: pipelineStats, isLoading: txLoading } = useQuery({
    queryKey: ['today-sugar-kpi', 'pipeline', agencyId],
    queryFn: async () => {
      if (!agencyId) return { value: 0, atRisk: 0 }
      const { data, error } = await supabase
        .from('transactions')
        .select('price_offered, price_final, status, stage, property:properties(price)')
        .eq('agency_id', agencyId)
        .neq('stage', 'signed')
        .neq('stage', 'lost')
      if (error) throw error
      let value = 0
      let atRisk = 0
      for (const row of data ?? []) {
        const prop = Array.isArray(row.property) ? row.property[0] : row.property
        const v = (row.price_final ?? row.price_offered ?? prop?.price ?? 0) as number
        value += v
        if (row.status === 'on_hold' || row.status === 'cancelled') atRisk++
      }
      return { value, atRisk }
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 4. Nouveaux matchs du jour
  const { data: newMatchesToday = 0, isLoading: matchesLoading } = useQuery({
    queryKey: ['today-sugar-kpi', 'matches', agencyId],
    queryFn: async () => {
      if (!agencyId) return 0
      const { count, error } = await supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .gte('created_at', startOfTodayISO())
      if (error) throw error
      return count ?? 0
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const executedTotal = executedToday + activeTasks
  const activeTarget = Math.max(activeTasks, 10)   // baseline visuel pour le donut

  return {
    isLoading: execLoading || activeLoading || txLoading || matchesLoading,
    executedToday,
    executedTotal,
    activeTasks,
    activeTarget,
    pipelineValue: pipelineStats?.value ?? 0,
    atRisk: pipelineStats?.atRisk ?? 0,
    newMatchesToday,
  }
}
