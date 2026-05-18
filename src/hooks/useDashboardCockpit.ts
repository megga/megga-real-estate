// MEGGA CRM Sugar v3 — Source de vérité pour DBCockpit (Dashboard Analytics).
// Calcule un CockpitDataset depuis Supabase pour la période demandée :
//   - transactions actives (≠ lost) joint properties (price, mandate_commission_pct)
//     + contact buyer (first/last name) pour les contributeurs
//   - count kyc_cases risk_level='high' pour les vitals KYC
//   - count transactions signed vs lost dans la fenêtre pour le taux de conversion
//
// Hors scope cette PR (laissés à 0 ou heuristique) :
//   - vitals.velocity (calcul SQL complexe : moyenne jours par stage)
//   - deltaDeals/deltaConv/deltaVel/deltaKyc (vs période N-1, deuxième fenêtre)
//   - aiHint (chantier IA dédié — laissé fixture côté client)

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TransactionStage } from '@/lib/constants'
import type { CockpitDataset, PeriodKey, ScopeKey } from '@/components/crm-sugar-v3/dashboard/data'

// Mapping stage DB → 4 catégories Sugar (signed / compromis / offres / pipeline)
function stageToDecomp(s: TransactionStage): 'signed' | 'compromis' | 'offres' | 'pipeline' | null {
  switch (s) {
    case 'signed': return 'signed'
    case 'notary': return 'compromis'      // notaire = compromis acté
    case 'financing': return 'compromis'   // financement = compromis en cours
    case 'reserved': return 'compromis'
    case 'interest_confirmed': return 'compromis'
    case 'offer': return 'offres'
    case 'negotiation': return 'offres'
    case 'visit_done': return 'pipeline'
    case 'visit_planned': return 'pipeline'
    case 'active_search': return 'pipeline'
    case 'to_qualify': return 'pipeline'
    case 'new_lead': return 'pipeline'
    case 'to_recontact': return 'pipeline'
    case 'lost': return null
  }
}

// Probabilité de réalisation par catégorie (pondère la projection)
const DECOMP_PROBABILITY: Record<'signed' | 'compromis' | 'offres' | 'pipeline', number> = {
  signed: 1.0,
  compromis: 0.95,
  offres: 0.70,
  pipeline: 0.35,
}

// Label UI pour la colonne stage des contributeurs (matché ensuite dans DBCockpit)
function stageLabelFor(decomp: 'signed' | 'compromis' | 'offres' | 'pipeline'): string {
  switch (decomp) {
    case 'signed': return 'Signé'
    case 'compromis': return 'Compromis'
    case 'offres': return 'Offre'
    case 'pipeline': return 'Visite'
  }
}

// Bornes de la période précédente (pour delta vs N-1)
function previousPeriodBounds(period: PeriodKey): { from: Date; to: Date } {
  const now = new Date()
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const to = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from, to }
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const from = new Date(now.getFullYear(), (q - 1) * 3, 1)
    const to = new Date(now.getFullYear(), q * 3, 0)
    return { from, to }
  }
  const from = new Date(now.getFullYear() - 1, 0, 1)
  const to = new Date(now.getFullYear() - 1, 11, 31)
  return { from, to }
}

// Bornes temporelles selon period UI
function periodBounds(period: PeriodKey): { from: Date; to: Date; daysLeft: number; label: string; short: string; periodWord: string; compareLabel: string } {
  const now = new Date()
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const daysLeft = Math.max(0, Math.ceil((to.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    const month = now.toLocaleDateString('fr-CH', { month: 'long' })
    return {
      from, to, daysLeft,
      label: `${month.charAt(0).toUpperCase() + month.slice(1)} ${now.getFullYear()}`,
      short: now.toLocaleDateString('fr-CH', { month: 'short' }),
      periodWord: 'mois',
      compareLabel: 'vs mois dernier',
    }
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const from = new Date(now.getFullYear(), q * 3, 1)
    const to = new Date(now.getFullYear(), (q + 1) * 3, 0)
    const daysLeft = Math.max(0, Math.ceil((to.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    return {
      from, to, daysLeft,
      label: `T${q + 1} ${now.getFullYear()}`,
      short: `T${q + 1}`,
      periodWord: 'trimestre',
      compareLabel: 'vs T précédent',
    }
  }
  // 'year' ou 'ytd'
  const from = new Date(now.getFullYear(), 0, 1)
  const to = new Date(now.getFullYear(), 11, 31)
  const daysLeft = Math.max(0, Math.ceil((to.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  return {
    from, to, daysLeft,
    label: String(now.getFullYear()),
    short: String(now.getFullYear()),
    periodWord: 'année',
    compareLabel: 'vs année dernière',
  }
}

interface TransactionAggRow {
  id: string
  stage: TransactionStage
  status: string
  price_offered: number | null
  price_final: number | null
  updated_at: string
  assigned_to: string | null
  property: { price: number | null; mandate_commission_pct: number | null } | { price: number | null; mandate_commission_pct: number | null }[] | null
  buyer: { first_name: string | null; last_name: string | null } | { first_name: string | null; last_name: string | null }[] | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

// Commission en CHF pour une transaction : price * pct / 100 (pct défault 3%)
function commissionFor(t: TransactionAggRow): number {
  const prop = unwrap(t.property)
  const price = t.price_final ?? t.price_offered ?? prop?.price ?? 0
  const pct = prop?.mandate_commission_pct ?? 3
  return Math.round((price * pct) / 100)
}

export function useDashboardCockpit(period: PeriodKey, scope: ScopeKey): {
  data: CockpitDataset | null
  isLoading: boolean
} {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  const userId = profile?.id

  const bounds = useMemo(() => periodBounds(period), [period])
  const prevBounds = useMemo(() => previousPeriodBounds(period), [period])

  // 1. Transactions actives (≠ lost) updated dans la fenêtre, scope-filtered.
  // On charge tout ce qui contribue à la projection (toutes stages sauf lost).
  const { data: transactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['dashboard-cockpit-tx', agencyId, userId, period, scope],
    queryFn: async (): Promise<TransactionAggRow[]> => {
      if (!agencyId) return []
      let q = supabase
        .from('transactions')
        .select('id, stage, status, price_offered, price_final, updated_at, assigned_to, property:properties(price, mandate_commission_pct), buyer:contacts!contact_buyer_id(first_name, last_name)')
        .eq('agency_id', agencyId)
        .neq('stage', 'lost')
        .gte('updated_at', bounds.from.toISOString())
      if (scope === 'me' && userId) q = q.eq('assigned_to', userId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as TransactionAggRow[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 2. Transactions signed/lost dans la fenêtre pour calcul conversion + delta
  const { data: closed = [], isLoading: closedLoading } = useQuery({
    queryKey: ['dashboard-cockpit-closed', agencyId, userId, period, scope],
    queryFn: async () => {
      if (!agencyId) return [] as Array<{ stage: 'signed' | 'lost' }>
      let q = supabase
        .from('transactions')
        .select('stage')
        .eq('agency_id', agencyId)
        .in('stage', ['signed', 'lost'])
        .gte('updated_at', bounds.from.toISOString())
      if (scope === 'me' && userId) q = q.eq('assigned_to', userId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Array<{ stage: 'signed' | 'lost' }>
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 2b. Période précédente (mêmes 2 queries) pour les delta*
  const { data: prevTransactions = [] } = useQuery({
    queryKey: ['dashboard-cockpit-tx-prev', agencyId, userId, period, scope],
    queryFn: async (): Promise<TransactionAggRow[]> => {
      if (!agencyId) return []
      let q = supabase
        .from('transactions')
        .select('id, stage, status, price_offered, price_final, updated_at, assigned_to, property:properties(price, mandate_commission_pct), buyer:contacts!contact_buyer_id(first_name, last_name)')
        .eq('agency_id', agencyId)
        .neq('stage', 'lost')
        .gte('updated_at', prevBounds.from.toISOString())
        .lte('updated_at', prevBounds.to.toISOString())
      if (scope === 'me' && userId) q = q.eq('assigned_to', userId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as TransactionAggRow[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const { data: prevClosed = [] } = useQuery({
    queryKey: ['dashboard-cockpit-closed-prev', agencyId, userId, period, scope],
    queryFn: async () => {
      if (!agencyId) return [] as Array<{ stage: 'signed' | 'lost' }>
      let q = supabase
        .from('transactions')
        .select('stage')
        .eq('agency_id', agencyId)
        .in('stage', ['signed', 'lost'])
        .gte('updated_at', prevBounds.from.toISOString())
        .lte('updated_at', prevBounds.to.toISOString())
      if (scope === 'me' && userId) q = q.eq('assigned_to', userId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Array<{ stage: 'signed' | 'lost' }>
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 3. KYC risk_level high (= kycRisk) + dont expired soon (= kycUrgent) + delta vs N-1
  const { data: kycCounts, isLoading: kycLoading } = useQuery({
    queryKey: ['dashboard-cockpit-kyc', agencyId, period],
    queryFn: async (): Promise<{ risk: number; urgent: number; riskPrev: number }> => {
      if (!agencyId) return { risk: 0, urgent: 0, riskPrev: 0 }
      const { count: riskCount } = await supabase
        .from('kyc_cases')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('risk_level', 'high')
      const in7days = new Date(); in7days.setDate(in7days.getDate() + 7)
      const { count: urgentCount } = await supabase
        .from('kyc_cases')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('risk_level', 'high')
        .lte('expires_at', in7days.toISOString())
      // Période précédente : count des kyc_cases risk='high' créés dans la fenêtre N-1
      const { count: riskPrevCount } = await supabase
        .from('kyc_cases')
        .select('id', { count: 'exact', head: true })
        .eq('agency_id', agencyId)
        .eq('risk_level', 'high')
        .gte('created_at', prevBounds.from.toISOString())
        .lte('created_at', prevBounds.to.toISOString())
      return { risk: riskCount ?? 0, urgent: urgentCount ?? 0, riskPrev: riskPrevCount ?? 0 }
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 4. Velocity : moyenne jours entre created_at et updated_at sur transactions signed
  // dans la fenêtre. C'est une approximation de "vélocité globale du pipeline".
  // Un vrai calcul par stage_change nécessiterait une requête sur activity_events.
  const computeVelocity = (rows: Array<{ created_at: string; updated_at: string }>): number => {
    if (rows.length === 0) return 0
    const totalDays = rows.reduce((sum, r) => {
      const diff = (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()) / (24 * 60 * 60 * 1000)
      return sum + Math.max(0, diff)
    }, 0)
    return Math.round(totalDays / rows.length)
  }
  const { data: velocity = 0 } = useQuery({
    queryKey: ['dashboard-cockpit-velocity', agencyId, userId, period, scope],
    queryFn: async (): Promise<number> => {
      if (!agencyId) return 0
      let q = supabase
        .from('transactions')
        .select('created_at, updated_at')
        .eq('agency_id', agencyId)
        .eq('stage', 'signed')
        .gte('updated_at', bounds.from.toISOString())
      if (scope === 'me' && userId) q = q.eq('assigned_to', userId)
      const { data, error } = await q
      if (error) throw error
      return computeVelocity((data ?? []) as Array<{ created_at: string; updated_at: string }>)
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 4b. Velocity sur fenêtre précédente — pour calculer deltaVel (Sprint C).
  const { data: prevVelocity = 0 } = useQuery({
    queryKey: ['dashboard-cockpit-velocity-prev', agencyId, userId, period, scope],
    queryFn: async (): Promise<number> => {
      if (!agencyId) return 0
      let q = supabase
        .from('transactions')
        .select('created_at, updated_at')
        .eq('agency_id', agencyId)
        .eq('stage', 'signed')
        .gte('updated_at', prevBounds.from.toISOString())
        .lte('updated_at', prevBounds.to.toISOString())
      if (scope === 'me' && userId) q = q.eq('assigned_to', userId)
      const { data, error } = await q
      if (error) throw error
      return computeVelocity((data ?? []) as Array<{ created_at: string; updated_at: string }>)
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 5. Target depuis agencies (monthly/quarterly/yearly selon period)
  const { data: target = 0 } = useQuery({
    queryKey: ['dashboard-cockpit-target', agencyId, period],
    queryFn: async (): Promise<number> => {
      if (!agencyId) return 0
      const { data, error } = await supabase
        .from('agencies')
        .select('monthly_target, quarterly_target, yearly_target')
        .eq('id', agencyId)
        .maybeSingle<{ monthly_target: number | null; quarterly_target: number | null; yearly_target: number | null }>()
      if (error) throw error
      if (!data) return 0
      if (period === 'month') return Number(data.monthly_target ?? 0)
      if (period === 'quarter') return Number(data.quarterly_target ?? 0)
      return Number(data.yearly_target ?? 0)
    },
    enabled: !!agencyId,
    staleTime: 5 * 60_000,
  })

  const data = useMemo<CockpitDataset | null>(() => {
    if (txLoading || closedLoading || kycLoading) return null

    // Décomposition par catégorie Sugar
    const decomp = { signed: 0, compromis: 0, offres: 0, pipeline: 0 }
    const contributorsRaw: Array<{ name: string; stage: string; amount: number }> = []

    for (const t of transactions) {
      const cat = stageToDecomp(t.stage)
      if (!cat) continue
      const commission = commissionFor(t)
      decomp[cat] += commission

      const buyer = unwrap(t.buyer)
      const name = buyer
        ? `${buyer.first_name ?? ''} ${buyer.last_name ?? ''}`.trim() || `Deal #${t.id.slice(0, 6)}`
        : `Deal #${t.id.slice(0, 6)}`
      contributorsRaw.push({ name, stage: stageLabelFor(cat), amount: commission })
    }

    // Top 5 contributeurs par montant
    const contributors = contributorsRaw
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)

    // Projeté pondéré par probabilité
    const projected = Math.round(
      decomp.signed * DECOMP_PROBABILITY.signed
      + decomp.compromis * DECOMP_PROBABILITY.compromis
      + decomp.offres * DECOMP_PROBABILITY.offres
      + decomp.pipeline * DECOMP_PROBABILITY.pipeline,
    )

    // Target depuis agencies (Sprint B). Fallback heuristique si l'agence n'a
    // pas saisi de cible (target=0).
    const effectiveTarget = target > 0
      ? target
      : Math.max(projected, Math.round(projected * 1.15)) || 100000

    // Conversion : signed / (signed + lost) sur la fenêtre
    const signedCount = closed.filter(c => c.stage === 'signed').length
    const lostCount = closed.filter(c => c.stage === 'lost').length
    const conversionPct = (signedCount + lostCount) > 0
      ? Math.round((signedCount / (signedCount + lostCount)) * 100)
      : 0

    // Mêmes calculs pour la période précédente (delta*)
    const prevSignedCount = prevClosed.filter(c => c.stage === 'signed').length
    const prevLostCount = prevClosed.filter(c => c.stage === 'lost').length
    const prevConversionPct = (prevSignedCount + prevLostCount) > 0
      ? Math.round((prevSignedCount / (prevSignedCount + prevLostCount)) * 100)
      : 0
    const deltaDeals = prevTransactions.length > 0
      ? Math.round(((transactions.length - prevTransactions.length) / prevTransactions.length) * 100)
      : 0
    const deltaConv = conversionPct - prevConversionPct        // points (signed)
    // deltaVel en JOURS (négatif = plus rapide ce mois, positif = plus lent).
    // Ex : velocity=47, prevVelocity=59 → deltaVel=-12 = pipeline 12 j plus rapide.
    const deltaVel = velocity - prevVelocity
    const deltaKyc = (kycCounts?.risk ?? 0) - (kycCounts?.riskPrev ?? 0)

    // deltaPct : projeté vs target — info "% à parcourir/dépassé"
    const deltaPct = effectiveTarget > 0
      ? Math.round(((projected - effectiveTarget) / effectiveTarget) * 100)
      : 0

    return {
      label: bounds.label,
      short: bounds.short,
      periodWord: bounds.periodWord,
      projected,
      target: effectiveTarget,
      daysLeft: bounds.daysLeft,
      deltaPct,
      compareLabel: bounds.compareLabel,
      decomp,
      contributors,
      vitals: {
        deals: transactions.length,
        conversion: `${conversionPct} %`,
        velocity,
        kycRisk: kycCounts?.risk ?? 0,
        kycUrgent: kycCounts?.urgent ?? 0,
        deltaDeals,
        deltaConv,
        deltaVel,
        deltaKyc,
      },
      // aiHint statique pour cette PR — chantier IA dédié
      aiHint: {
        label: 'Action prioritaire',
        title: signedCount > 0
          ? `Boucler les ${transactions.length - signedCount} deals restants`
          : 'Activer les contacts en KYC pour lever les blocages',
        desc: `${signedCount} deal${signedCount > 1 ? 's' : ''} signé${signedCount > 1 ? 's' : ''} cette ${bounds.periodWord} · ${kycCounts?.risk ?? 0} dossier${(kycCounts?.risk ?? 0) > 1 ? 's' : ''} à risque KYC`,
        cta: 'Voir le pipeline',
      },
    }
  }, [transactions, prevTransactions, closed, prevClosed, kycCounts, target, velocity, prevVelocity, bounds, txLoading, closedLoading, kycLoading])

  return {
    data,
    isLoading: txLoading || closedLoading || kycLoading,
  }
}
