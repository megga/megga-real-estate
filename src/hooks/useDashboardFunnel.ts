// MEGGA CRM Sugar v3 — Source de vérité pour DBEntonnoir (Dashboard Analytics).
// 3 datasets calculés depuis Supabase :
//   - funnel  : 5 paliers (Leads / Qualifiés / Visites / Offres / Compromis)
//               + deltas vs période N-1 + convDelta entre paliers
//   - sources : breakdown par contacts.source dans la fenêtre + tendance
//   - forecast: deals à clôturer sous 30/60/90 jours (par stage avancé)
//
// Mapping libellés de sources : 'website'→'Site agence', 'onboarding'→'Marketplace MEGGA',
// 'referral'→'Recommandations', 'import'/'manual'→'Importé manuel'.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TransactionStage } from '@/lib/constants'
import type {
  FunnelStage,
  SourceItem,
  ForecastHorizon,
  PeriodKey,
  ScopeKey,
} from '@/components/crm-sugar-v3/dashboard/data'

// Fenêtre temporelle (alignée sur useDashboardCockpit)
function periodWindow(period: PeriodKey): { from: Date; to: Date; prevFrom: Date; prevTo: Date; compareLabel: string } {
  const now = new Date()
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevTo = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
    return { from, to, prevFrom, prevTo, compareLabel: 'vs mois dernier' }
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const from = new Date(now.getFullYear(), q * 3, 1)
    const to = new Date(now.getFullYear(), (q + 1) * 3, 0, 23, 59, 59)
    const prevFrom = new Date(now.getFullYear(), (q - 1) * 3, 1)
    const prevTo = new Date(now.getFullYear(), q * 3, 0, 23, 59, 59)
    return { from, to, prevFrom, prevTo, compareLabel: 'vs T précédent' }
  }
  const from = new Date(now.getFullYear(), 0, 1)
  const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  const prevFrom = new Date(now.getFullYear() - 1, 0, 1)
  const prevTo = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
  return { from, to, prevFrom, prevTo, compareLabel: 'vs année dernière' }
}

// Source DB → libellé UI + couleur
const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  website:    { label: 'Site agence',        color: '#1E5BC6' },
  onboarding: { label: 'Marketplace MEGGA',  color: '#0B0C0E' },
  referral:   { label: 'Recommandations',    color: '#059669' },
  manual:     { label: 'Importé manuel',     color: '#7A8088' },
  import:     { label: 'Importé manuel',     color: '#7A8088' },
}

function deltaPct(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

function commissionFrom(price: number | null, pct: number | null): number {
  if (!price) return 0
  return Math.round((price * (pct ?? 3)) / 100)
}

// Stages avancés par horizon forecast — un deal en `notary` signera plus vite
// qu'un deal en `visit_planned`.
const HORIZON_30D_STAGES: TransactionStage[] = ['notary', 'financing', 'reserved']
const HORIZON_60D_STAGES: TransactionStage[] = ['offer', 'negotiation', 'interest_confirmed']
const HORIZON_90D_STAGES: TransactionStage[] = ['visit_done', 'visit_planned']

interface ContactRow {
  id: string
  source: string
  score: 'hot' | 'warm' | 'cold' | null
  created_at: string
}

interface TransactionStageRow {
  id: string
  stage: TransactionStage
  price_offered: number | null
  price_final: number | null
  contact_buyer_id: string | null
  property: { price: number | null; mandate_commission_pct: number | null } | { price: number | null; mandate_commission_pct: number | null }[] | null
}

interface VisitContactRow { contact_id: string | null }
interface OfferTxRow { transaction_id: string | null }

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

export interface UseDashboardFunnelReturn {
  funnel: FunnelStage[]
  sources: SourceItem[]
  forecast: ForecastHorizon[]
  compareLabel: string
  isLoading: boolean
}

export function useDashboardFunnel(period: PeriodKey, scope: ScopeKey): UseDashboardFunnelReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  const userId = profile?.id

  const win = useMemo(() => periodWindow(period), [period])

  const { data: contactsCurr = [], isLoading: cLoad } = useQuery({
    queryKey: ['dashboard-funnel-contacts', agencyId, period, scope],
    queryFn: async (): Promise<ContactRow[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('id, source, score, created_at')
        .eq('agency_id', agencyId)
        .gte('created_at', win.from.toISOString())
        .lte('created_at', win.to.toISOString())
      if (error) throw error
      return (data ?? []) as ContactRow[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const { data: contactsPrev = [] } = useQuery({
    queryKey: ['dashboard-funnel-contacts-prev', agencyId, period, scope],
    queryFn: async (): Promise<ContactRow[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('id, source, score, created_at')
        .eq('agency_id', agencyId)
        .gte('created_at', win.prevFrom.toISOString())
        .lte('created_at', win.prevTo.toISOString())
      if (error) throw error
      return (data ?? []) as ContactRow[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const { data: transactions = [], isLoading: tLoad } = useQuery({
    queryKey: ['dashboard-funnel-tx', agencyId, period, scope, userId],
    queryFn: async (): Promise<TransactionStageRow[]> => {
      if (!agencyId) return []
      let q = supabase
        .from('transactions')
        .select('id, stage, price_offered, price_final, contact_buyer_id, property:properties(price, mandate_commission_pct)')
        .eq('agency_id', agencyId)
        .neq('stage', 'lost')
      if (scope === 'me' && userId) q = q.eq('assigned_to', userId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as TransactionStageRow[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const { data: visitsCurr = [], isLoading: vLoad } = useQuery({
    queryKey: ['dashboard-funnel-visits', agencyId, period],
    queryFn: async (): Promise<VisitContactRow[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('visits')
        .select('contact_id')
        .eq('agency_id', agencyId)
        .gte('scheduled_at', win.from.toISOString())
        .lte('scheduled_at', win.to.toISOString())
      if (error) throw error
      return (data ?? []) as VisitContactRow[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const { data: offersCurr = [], isLoading: oLoad } = useQuery({
    queryKey: ['dashboard-funnel-offers', agencyId, period],
    queryFn: async (): Promise<OfferTxRow[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('crm_offers')
        .select('transaction_id')
        .gte('created_at', win.from.toISOString())
        .lte('created_at', win.to.toISOString())
      if (error) throw error
      return (data ?? []) as OfferTxRow[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const isLoading = cLoad || tLoad || vLoad || oLoad

  const computed = useMemo(() => {
    // ─── Funnel ────────────────────────────────────────────────────────
    const leadsCurr = contactsCurr.length
    const qualifCurr = contactsCurr.filter(c => c.score != null).length
    const visitsCount = new Set(visitsCurr.map(v => v.contact_id).filter(Boolean)).size
    const offersCount = new Set(offersCurr.map(o => o.transaction_id).filter(Boolean)).size
    const compromisCount = transactions.filter(
      t => ['interest_confirmed', 'reserved', 'financing', 'notary', 'signed'].includes(t.stage),
    ).length

    const leadsPrev = contactsPrev.length
    const qualifPrev = contactsPrev.filter(c => c.score != null).length

    // Largeur visuelle de la barre — plancher 20% pour rester lisible
    const wOf = (n: number, max: number) => max > 0 ? Math.max(20, Math.round((n / max) * 100)) : 20
    const maxN = Math.max(leadsCurr, 1)

    // Conversion entre paliers
    const conv = (n: number, prev: number) => prev > 0 ? Math.round((n / prev) * 100) : 0
    const cVisits = conv(visitsCount, qualifCurr)
    const cOffres = conv(offersCount, visitsCount)
    const cCompromis = conv(compromisCount, offersCount)

    // Bottleneck : le palier où la conversion chute le plus
    const convs = [
      { stage: 'Visites' as const, c: cVisits },
      { stage: 'Offres' as const, c: cOffres },
      { stage: 'Compromis' as const, c: cCompromis },
    ]
    const bottleneckStage = convs.reduce(
      (min, cur) => (cur.c < min.c ? cur : min),
      { stage: '' as string, c: 100 },
    ).stage

    const funnel: FunnelStage[] = [
      {
        n: 'Leads', v: leadsCurr, w: wOf(leadsCurr, maxN),
        c: 'rgba(11,12,14,0.92)', desc: 'Prospects entrés',
        delta: deltaPct(leadsCurr, leadsPrev),
      },
      {
        n: 'Qualifiés', v: qualifCurr, w: wOf(qualifCurr, maxN),
        c: 'rgba(11,12,14,0.78)', desc: 'Critères de matching validés',
        delta: deltaPct(qualifCurr, qualifPrev),
        convDelta: 0,
      },
      {
        n: 'Visites', v: visitsCount, w: wOf(visitsCount, maxN),
        c: 'rgba(11,12,14,0.62)', desc: '1ère visite effectuée',
        delta: 0, convDelta: 0,
        bottleneck: bottleneckStage === 'Visites',
      },
      {
        n: 'Offres', v: offersCount, w: wOf(offersCount, maxN),
        c: 'rgba(11,12,14,0.48)', desc: 'Offre reçue, KYC en cours',
        delta: 0, convDelta: 0,
        bottleneck: bottleneckStage === 'Offres',
      },
      {
        n: 'Compromis', v: compromisCount, w: wOf(compromisCount, maxN),
        c: 'rgba(11,12,14,0.34)', desc: 'Acte signé sous 60 j',
        delta: 0, convDelta: 0,
        bottleneck: bottleneckStage === 'Compromis',
      },
    ]

    // ─── Sources ───────────────────────────────────────────────────────
    const sourceMap = new Map<string, { curr: number; prev: number; qualifs: number }>()
    for (const c of contactsCurr) {
      const e = sourceMap.get(c.source) ?? { curr: 0, prev: 0, qualifs: 0 }
      e.curr++
      if (c.score != null) e.qualifs++
      sourceMap.set(c.source, e)
    }
    for (const c of contactsPrev) {
      const e = sourceMap.get(c.source) ?? { curr: 0, prev: 0, qualifs: 0 }
      e.prev++
      sourceMap.set(c.source, e)
    }

    const sources: SourceItem[] = Array.from(sourceMap.entries())
      .map(([key, e]) => {
        const meta = SOURCE_LABELS[key] ?? { label: key, color: '#7A8088' }
        const convPct = e.curr > 0 ? Math.round((e.qualifs / e.curr) * 100) : 0
        return {
          n: meta.label,
          v: e.curr,
          conv: convPct,
          c: meta.color,
          hot: convPct >= 40,
          delta: deltaPct(e.curr, e.prev),
        }
      })
      .filter(s => s.v > 0)
      .sort((a, b) => b.v - a.v)

    // ─── Forecast ──────────────────────────────────────────────────────
    function horizonFor(stages: TransactionStage[]): { n: number; commission: number } {
      const filtered = transactions.filter(t => stages.includes(t.stage))
      const commission = filtered.reduce((sum, t) => {
        const prop = unwrap(t.property)
        const price = t.price_final ?? t.price_offered ?? prop?.price ?? 0
        return sum + commissionFrom(price, prop?.mandate_commission_pct ?? null)
      }, 0)
      return { n: filtered.length, commission }
    }

    const h30 = horizonFor(HORIZON_30D_STAGES)
    const h60bis = horizonFor(HORIZON_60D_STAGES)
    const h90bis = horizonFor(HORIZON_90D_STAGES)
    // Cumul : un deal en 30j est aussi à <60j et <90j
    const h60 = { n: h30.n + h60bis.n, commission: h30.commission + h60bis.commission }
    const h90 = { n: h60.n + h90bis.n, commission: h60.commission + h90bis.commission }

    const forecast: ForecastHorizon[] = [
      { h: '30 jours', n: h30.n, low: Math.round(h30.commission * 0.85), mid: h30.commission, high: Math.round(h30.commission * 1.20), label: 'deals à clôturer' },
      { h: '60 jours', n: h60.n, low: Math.round(h60.commission * 0.85), mid: h60.commission, high: Math.round(h60.commission * 1.20), label: 'deals à clôturer' },
      { h: '90 jours', n: h90.n, low: Math.round(h90.commission * 0.85), mid: h90.commission, high: Math.round(h90.commission * 1.20), label: 'deals à clôturer' },
    ]

    return { funnel, sources, forecast, compareLabel: win.compareLabel }
  }, [contactsCurr, contactsPrev, transactions, visitsCurr, offersCurr, win])

  return { ...computed, isLoading }
}
