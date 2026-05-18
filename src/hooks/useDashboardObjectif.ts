// MEGGA CRM Sugar v3 — Source de vérité pour DBObjectif (Dashboard Analytics).
// ObjectifDataset + Milestones[] live depuis Supabase (Sprint C complète) :
//   - target           : agencies.{monthly,quarterly,yearly}_target
//   - realized         : Σ commission transactions signed dans la fenêtre
//   - real[] cumulé    : par jour (month) / semaine (quarter) / mois (year)
//   - median/low/high  : extrapolation linéaire depuis real[realIdx] jusqu'à fin
//   - milestones[]     : 3-4 jalons par période (Sprint C) dérivés du target
//                        proportionnel + real[] + median[]

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Milestone, ObjectifDataset, PeriodKey } from '@/components/crm-sugar-v3/dashboard/data'

interface SignedTxRow {
  updated_at: string
  price_offered: number | null
  price_final: number | null
  property: { price: number | null; mandate_commission_pct: number | null } | { price: number | null; mandate_commission_pct: number | null }[] | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function commissionFor(t: SignedTxRow): number {
  const prop = unwrap(t.property)
  const price = t.price_final ?? t.price_offered ?? prop?.price ?? 0
  const pct = prop?.mandate_commission_pct ?? 3
  return Math.round((price * pct) / 100)
}

interface PeriodAxis {
  from: Date
  to: Date
  xLabels: string[]
  buckets: number             // nb d'unités (jours/semaines/mois)
  realIdx: number             // index actuel (0-based)
  daysLeft: number
  label: string
  short: string
  /** Renvoie l'index du bucket (jour/semaine/mois) auquel appartient une date. */
  bucketIndexFor: (d: Date) => number
}

const FR_MONTHS_SHORT = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
const FR_MONTHS_LONG = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

// Découpe une période en N jalons (year=4 trimestres, quarter=3 mois, month=3 sub-périodes hebdo)
interface MilestoneSpec {
  id: string
  title: string
  subtitle: string
  fromBucket: number       // index de bucket inclusif (sur l'axis du graph)
  toBucket: number         // index de bucket inclusif
}

function buildMilestoneSpecs(period: PeriodKey): MilestoneSpec[] {
  const now = new Date()
  if (period === 'month') {
    // 3 jalons par mois (1 par semaine de calendrier — semaines ISO partielles OK)
    const buckets = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const w1End = Math.min(7, buckets) - 1
    const w2End = Math.min(14, buckets) - 1
    const w3End = Math.min(21, buckets) - 1
    return [
      { id: 'm-w1', title: 'Semaine 1', subtitle: `1 – ${w1End + 1} ${FR_MONTHS_SHORT[now.getMonth()].toLowerCase()}`, fromBucket: 0, toBucket: w1End },
      { id: 'm-w2', title: 'Semaine 2', subtitle: `${w1End + 2} – ${w2End + 1} ${FR_MONTHS_SHORT[now.getMonth()].toLowerCase()}`, fromBucket: w1End + 1, toBucket: w2End },
      { id: 'm-w3', title: 'Semaine 3', subtitle: `${w2End + 2} – ${w3End + 1} ${FR_MONTHS_SHORT[now.getMonth()].toLowerCase()}`, fromBucket: w2End + 1, toBucket: w3End },
      { id: 'm-w4', title: 'Semaine 4+', subtitle: `${w3End + 2} – ${buckets} ${FR_MONTHS_SHORT[now.getMonth()].toLowerCase()}`, fromBucket: w3End + 1, toBucket: buckets - 1 },
    ]
  }
  if (period === 'quarter') {
    // 3 jalons par trimestre = 3 mois ; buckets axis = semaines (~13)
    const q = Math.floor(now.getMonth() / 3)
    const month1 = q * 3
    const month2 = q * 3 + 1
    const month3 = q * 3 + 2
    // ~4-5 semaines par mois sur l'axis quarter
    return [
      { id: `q-m${month1}`, title: FR_MONTHS_LONG[month1], subtitle: 'S1 – S4', fromBucket: 0, toBucket: 3 },
      { id: `q-m${month2}`, title: FR_MONTHS_LONG[month2], subtitle: 'S5 – S8', fromBucket: 4, toBucket: 8 },
      { id: `q-m${month3}`, title: FR_MONTHS_LONG[month3], subtitle: 'S9 – S13', fromBucket: 9, toBucket: 12 },
    ]
  }
  // year → 4 trimestres
  return [
    { id: 'y-t1', title: 'T1', subtitle: 'Jan – Mar', fromBucket: 0, toBucket: 2 },
    { id: 'y-t2', title: 'T2', subtitle: 'Avr – Juin', fromBucket: 3, toBucket: 5 },
    { id: 'y-t3', title: 'T3', subtitle: 'Juil – Sep', fromBucket: 6, toBucket: 8 },
    { id: 'y-t4', title: 'T4', subtitle: 'Oct – Déc', fromBucket: 9, toBucket: 11 },
  ]
}

// Construit les Milestones live à partir des données calculées du Cockpit
function buildMilestones(
  specs: MilestoneSpec[],
  realIdx: number,
  realCumul: number[],
  median: number[],
  effectiveTarget: number,
): Milestone[] {
  const totalBuckets = specs[specs.length - 1].toBucket + 1
  const projectedAtBucket = (i: number): number => {
    if (i <= realIdx) return realCumul[i] ?? 0
    const offsetInProj = i - realIdx
    return median[offsetInProj] ?? median[median.length - 1] ?? 0
  }
  return specs.map(spec => {
    const milestoneEnd = spec.toBucket
    const done = milestoneEnd < realIdx
    const current = spec.fromBucket <= realIdx && realIdx <= milestoneEnd
    // Target proportionnel : part de la période totale
    const proportion = (milestoneEnd + 1) / totalBuckets
    const target = Math.round(effectiveTarget * proportion)
    // Value cumulée à la fin du jalon (réel si passé, valeur courante si current)
    let value: number | null = null
    if (done || current) {
      const endIdx = Math.min(milestoneEnd, realIdx)
      value = realCumul[endIdx] ?? 0
    }
    // ValueProjected : courbe median au bucket de fin du jalon
    const valueProjected = Math.round(projectedAtBucket(milestoneEnd))
    // Status humain
    let status: string
    if (done && value != null) {
      const pct = target > 0 ? Math.round((value / target) * 100) : 0
      status = pct >= 100 ? `Atteint à +${pct - 100} %` : `Atteint à ${pct} %`
    } else if (current && value != null) {
      const pct = target > 0 ? Math.round((value / target) * 100) : 0
      status = `En cours · ${pct} %`
    } else {
      status = 'Projection médiane'
    }
    return {
      id: spec.id,
      title: spec.title,
      subtitle: spec.subtitle,
      done,
      current,
      value,
      target,
      valueProjected,
      status,
    }
  })
}

function periodAxis(period: PeriodKey): PeriodAxis {
  const now = new Date()
  if (period === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    const days = to.getDate()
    const xLabels = Array.from({ length: days }, (_, i) => (i + 1).toString())
    const realIdx = Math.min(days - 1, now.getDate() - 1)
    const daysLeft = Math.max(0, Math.ceil((to.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    const monthLabel = now.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' })
    return {
      from, to, xLabels, buckets: days, realIdx, daysLeft,
      label: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
      short: FR_MONTHS_SHORT[now.getMonth()],
      bucketIndexFor: (d) => Math.max(0, Math.min(days - 1, d.getDate() - 1)),
    }
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3)
    const from = new Date(now.getFullYear(), q * 3, 1)
    const to = new Date(now.getFullYear(), (q + 1) * 3, 0, 23, 59, 59)
    // Numérotation ISO 8601 approximée : N° de semaine = floor((day - first day) / 7)
    const totalDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
    const buckets = Math.ceil(totalDays / 7)
    const firstWeek = Math.floor((from.getTime() - new Date(from.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7))
    const xLabels = Array.from({ length: buckets }, (_, i) => `S${firstWeek + i + 1}`)
    const elapsedDays = Math.floor((now.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
    const realIdx = Math.min(buckets - 1, Math.floor(elapsedDays / 7))
    const daysLeft = Math.max(0, Math.ceil((to.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    return {
      from, to, xLabels, buckets, realIdx, daysLeft,
      label: `T${q + 1} ${now.getFullYear()}`,
      short: `T${q + 1}`,
      bucketIndexFor: (d) => {
        const diff = Math.floor((d.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
        return Math.max(0, Math.min(buckets - 1, Math.floor(diff / 7)))
      },
    }
  }
  // 'year' or 'ytd' → 12 buckets mensuels
  const from = new Date(now.getFullYear(), 0, 1)
  const to = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
  const xLabels = FR_MONTHS_SHORT.slice()
  const realIdx = now.getMonth()
  const daysLeft = Math.max(0, Math.ceil((to.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  return {
    from, to, xLabels, buckets: 12, realIdx, daysLeft,
    label: `Année ${now.getFullYear()}`,
    short: String(now.getFullYear()),
    bucketIndexFor: (d) => Math.max(0, Math.min(11, d.getMonth())),
  }
}

export function useDashboardObjectif(period: PeriodKey): {
  data: ObjectifDataset | null
  milestones: Milestone[]
  isLoading: boolean
} {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const axis = useMemo(() => periodAxis(period), [period])

  // 1. Transactions signed dans la fenêtre, avec commission
  const { data: signed = [], isLoading: sLoad } = useQuery({
    queryKey: ['dashboard-objectif-signed', agencyId, period],
    queryFn: async (): Promise<SignedTxRow[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('updated_at, price_offered, price_final, property:properties(price, mandate_commission_pct)')
        .eq('agency_id', agencyId)
        .eq('stage', 'signed')
        .gte('updated_at', axis.from.toISOString())
        .lte('updated_at', axis.to.toISOString())
      if (error) throw error
      return (data ?? []) as SignedTxRow[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  // 2. Target (même query que Cockpit, dupliquée pour modularité)
  const { data: target = 0, isLoading: tLoad } = useQuery({
    queryKey: ['dashboard-objectif-target', agencyId, period],
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

  return useMemo<{ data: ObjectifDataset | null; milestones: Milestone[]; isLoading: boolean }>(() => {
    const isLoading = sLoad || tLoad
    if (isLoading) return { data: null, milestones: [], isLoading: true }

    // Commission cumulée par bucket (jour/semaine/mois)
    const perBucket = new Array(axis.buckets).fill(0)
    for (const tx of signed) {
      const idx = axis.bucketIndexFor(new Date(tx.updated_at))
      perBucket[idx] += commissionFor(tx)
    }
    // Cumul progressif
    const realCumul: number[] = []
    let running = 0
    for (let i = 0; i <= axis.realIdx; i++) {
      running += perBucket[i] ?? 0
      realCumul.push(running)
    }
    const realized = realCumul[realCumul.length - 1] ?? 0

    // Extrapolation linéaire depuis realIdx jusqu'à fin (buckets - 1)
    // pour median[] / lowCurve[] / highCurve[]. real[] reste cumulé jusqu'à
    // realIdx ; la courbe projetée prend le relais.
    const remainingBuckets = Math.max(0, axis.buckets - 1 - axis.realIdx)
    const slopeMed = remainingBuckets > 0 && axis.realIdx > 0
      ? (realized / axis.realIdx) * 1.0  // continue au rythme actuel
      : 0
    const projectedEnd = realized + slopeMed * remainingBuckets

    const median: number[] = [realized]
    const lowCurve: number[] = [realized]
    const highCurve: number[] = [realized]
    for (let i = 1; i <= remainingBuckets; i++) {
      median.push(realized + slopeMed * i)
      lowCurve.push(realized + slopeMed * i * 0.85)
      highCurve.push(realized + slopeMed * i * 1.20)
    }

    // Effective target : si l'agence n'a pas saisi, fallback projected * 1.15
    const effectiveTarget = target > 0 ? target : Math.max(projectedEnd, Math.round(projectedEnd * 1.15)) || 100000

    const data: ObjectifDataset = {
      label: axis.label,
      short: axis.short,
      target: effectiveTarget,
      realized,
      projected: Math.round(projectedEnd),
      low: Math.round(lowCurve[lowCurve.length - 1] ?? projectedEnd),
      high: Math.round(highCurve[highCurve.length - 1] ?? projectedEnd),
      xLabels: axis.xLabels,
      realIdx: axis.realIdx,
      real: realCumul,
      median,
      lowCurve,
      highCurve,
      daysLeft: axis.daysLeft,
    }
    // Milestones live (Sprint C) — dérivés du target proportionnel + real[] + median[]
    const specs = buildMilestoneSpecs(period)
    const milestones = buildMilestones(specs, axis.realIdx, realCumul, median, effectiveTarget)

    return { data, milestones, isLoading: false }
  }, [signed, target, axis, period, sLoad, tLoad])
}
