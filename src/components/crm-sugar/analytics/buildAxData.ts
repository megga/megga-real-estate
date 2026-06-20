// MEGGA CRM — Adaptateur pur des 3 payloads RPC analytics_* vers la shape
// AxPeriodData consommée par AxDashboard. Zéro JSX, zéro effet de bord.
//
// CONTRAT TRANCHÉ (anti chiffres incohérents à l'écran) :
//   - Hero (target/realizedNow/projectedEnd/paceFrac/series/axisLabels)
//     ← analytics_objectif (extrapolation linéaire, cohérent avec la Trajectoire).
//   - Composition + contributeurs (closing) ← analytics_cockpit (décompo pondérée).
//   - Sources ← analytics_funnel (volume de leads par canal — la commission par
//     canal n'est PAS stockée en base, le sous-libellé devient « N leads »).
// On ne dérive JAMAIS un même chiffre des deux sources.

import type { TFunction } from 'i18next'
import { formatCHF } from '@/lib/utils'
import type {
  AxPeriodId, AxPeriodData, AxSeries, AxKpi, AxCompositionItem, AxSource, AxDeal, AxBucketId, AxBucket,
} from './tokens'

// i18n : adaptateur PUR mais à libellés traduits → un traducteur `t` (lié au
// namespace 'dashboard', clés dashboard:analytics.*) est injecté par le hook
// appelant (useAxDashboardData), qui recalcule au changement de langue.

// ── Shapes des payloads RPC (JSON renvoyé par supabase.rpc) ──────────────────
type DecompCat = 'signed' | 'compromis' | 'offres' | 'pipeline'

export interface CockpitJson {
  scope: 'me' | 'agency'
  period: AxPeriodId
  velocity_source: string
  decomp: Record<DecompCat, number>
  decomp_flags: Record<DecompCat, { n_default_pct: number; n_missing_price: number }>
  projected: number
  contributors: Array<{
    name: string | null
    stage: string
    amount: number
    price_missing: boolean
    pct_default: boolean
  }>
  deals: number
  n_signed: number
  volume_signed: number | null
  conversion: number | null
  conversion_prev: number | null
  delta_deals: number
  velocity: number
  kyc_risk: number
  kyc_urgent: number
  kyc_risk_prev: number
}

export interface ObjectifJson {
  period: AxPeriodId
  trunc: string
  target: number
  target_is_set: boolean
  realized: number
  buckets: number
  realIdx: number
  xLabels: string[]
  real: number[]
  median: number[]
  projected: number
  label: string
}

export interface FunnelJson {
  funnel: {
    leads: number
    leads_prev: number
    qualif: number
    qualif_prev: number
    visits: number
    offers: number
    compromis: number
  }
  sources: Array<{ source: string; v: number; conv: number; prev: number }>
  forecast: {
    n30: number; mid30: number
    n60: number; mid60: number
    n90: number; mid90: number
  }
}

// ── Probabilité de réalisation par catégorie (cohérent avec le RPC cockpit) ──
const DECOMP_PROBABILITY: Record<DecompCat, number> = {
  signed: 1.0,
  compromis: 0.95,
  offres: 0.70,
  pipeline: 0.35,
}

// ── Libellés de période (traduits ; clés dashboard:analytics.period.*) ───────
function periodMeta(period: AxPeriodId, t: TFunction): { period: string; granularity: string; pointWord: string } {
  return {
    period: t(`analytics.period.${period}.label`),
    granularity: t(`analytics.period.${period}.granularity`),
    pointWord: t(`analytics.period.${period}.pointWord`),
  }
}

// ── Libellés des canaux de source (traduits ; canaux connus, sinon brut) ─────
function sourceLabel(source: string, t: TFunction): string {
  const key = source === 'import' ? 'manual' : source
  const known = ['website', 'onboarding', 'referral', 'manual']
  return known.includes(key) ? t(`analytics.source.${key}`) : source
}

// ── Libellé d'étape affiché (drill) ; le code BRUT reste la clé de probaForStage ──
function stageLabel(raw: string, t: TFunction): string {
  switch (raw) {
    case 'Signé': return t('analytics.stage.signed')
    case 'Compromis': return t('analytics.stage.compromis')
    case 'Offre': return t('analytics.stage.offer')
    default: return raw
  }
}

// ── Drapeaux fallback commission agrégés (somme sur les 4 catégories) ────────
export interface AxCommissionFlags { nDefaultPct: number; nMissingPrice: number }

function aggregateFlags(flags: CockpitJson['decomp_flags']): AxCommissionFlags {
  const cats: DecompCat[] = ['signed', 'compromis', 'offres', 'pipeline']
  return cats.reduce<AxCommissionFlags>(
    (acc, c) => {
      const f = flags?.[c]
      if (f) {
        acc.nDefaultPct += f.n_default_pct ?? 0
        acc.nMissingPrice += f.n_missing_price ?? 0
      }
      return acc
    },
    { nDefaultPct: 0, nMissingPrice: 0 },
  )
}

// ── Série live : real = cumul réel par bucket ; proj = median ; goal = target ──
// Pas de sinusoïde décorative (« wob » supprimé). yMax = max(target, projeté)*1.06.
function buildSeriesLive(o: ObjectifJson): AxSeries {
  const n = Math.max(1, o.buckets)
  const elapsed = Math.max(0, Math.min(n - 1, o.realIdx))
  const real = (o.real ?? []).map(v => Math.max(0, Math.round(v)))
  const proj = (o.median ?? []).map(v => Math.round(v))
  const goal: number[] = []
  for (let i = 0; i < n; i++) {
    goal.push(n > 1 ? Math.round(o.target * (i / (n - 1))) : Math.round(o.target))
  }
  const yMax = Math.max(o.target, o.projected, 1) * 1.06
  return { real, proj, goal, yMax, n, elapsed }
}

// ── Resample d'une série vers ~k points (pour la sparkline conditionnelle) ───
function resample(arr: number[], k: number): number[] {
  if (!arr || arr.length === 0) return []
  if (arr.length <= k) return arr.slice()
  const out: number[] = []
  for (let i = 0; i < k; i++) {
    const idx = Math.round((i / (k - 1)) * (arr.length - 1))
    out.push(arr[idx] ?? 0)
  }
  return out
}

// La sparkline n'est rendue QUE si la série a ≥2 points non nuls (Sparkline gère
// mal une série plate/vide). Sinon on renvoie [] et la tuile masque le mini-graph.
function sparkIfMeaningful(series: number[]): number[] {
  const nonZero = series.filter(v => v > 0)
  if (nonZero.length < 2) return []
  return series
}

// ── Probabilité de réalisation (en %) pour la colonne « stage » du closing ──
function probaForStage(stage: string): number {
  switch (stage) {
    case 'Signé': return Math.round(DECOMP_PROBABILITY.signed * 100)
    case 'Compromis': return Math.round(DECOMP_PROBABILITY.compromis * 100)
    case 'Offre': return Math.round(DECOMP_PROBABILITY.offres * 100)
    default: return Math.round(DECOMP_PROBABILITY.pipeline * 100)
  }
}

// ── Adaptateur principal ─────────────────────────────────────────────────────
export function buildAxData(
  period: AxPeriodId,
  cockpit: CockpitJson,
  objectif: ObjectifJson,
  funnel: FunnelJson,
  t: TFunction,
): AxPeriodData {
  const meta = periodMeta(period, t)
  const decomp = cockpit.decomp ?? { signed: 0, compromis: 0, offres: 0, pipeline: 0 }
  const commissionFlags = aggregateFlags(cockpit.decomp_flags)

  // Série + élapsé normalisé tirés de l'objectif (source unique du Hero).
  const series = buildSeriesLive(objectif)
  const paceFrac = objectif.buckets > 1 ? objectif.realIdx / (objectif.buckets - 1) : 0

  // Composition : 3 buckets dérivés de la décompo pondérée du cockpit.
  const composition: AxCompositionItem[] = [
    { k: 'secured',  label: t('analytics.composition.secured.label'),  hint: t('analytics.composition.secured.hint'),  v: (decomp.signed ?? 0) + (decomp.compromis ?? 0) },
    { k: 'probable', label: t('analytics.composition.probable.label'), hint: t('analytics.composition.probable.hint'), v: decomp.offres ?? 0 },
    { k: 'possible', label: t('analytics.composition.possible.label'), hint: t('analytics.composition.possible.hint'), v: decomp.pipeline ?? 0 },
  ]

  // KPI : 4 tuiles live, sparkline conditionnelle.
  const volumeSpark = sparkIfMeaningful(resample(objectif.real ?? [], 8))
  const conversion = cockpit.conversion
  const convPrev = cockpit.conversion_prev
  const kpis: AxKpi[] = [
    {
      label: t('analytics.kpi.volume'),
      value: (cockpit.volume_signed && cockpit.volume_signed > 0) ? formatCHF(cockpit.volume_signed) : 'CHF —',
      // pas de N-1 de volume calculé : on n'affiche PAS delta_deals (variation du NOMBRE
      // de deals) à côté d'un montant CHF — ce serait un delta trompeur.
      delta: 0,
      spark: volumeSpark,
    },
    {
      label: t('analytics.kpi.transactions'),
      value: String(cockpit.deals ?? 0),
      delta: cockpit.delta_deals ?? 0,
      spark: [],
      abs: true,
    },
    {
      label: t('analytics.kpi.avgCommission'),
      value: (cockpit.n_signed && cockpit.n_signed > 0)
        ? formatCHF(Math.round((decomp.signed ?? 0) / cockpit.n_signed))
        : 'CHF —',
      delta: 0,
      spark: [],
    },
    {
      label: t('analytics.kpi.conversionRate'),
      value: conversion === null || conversion === undefined ? t('analytics.insufficientData') : `${conversion} %`,
      delta: (conversion !== null && conversion !== undefined && convPrev !== null && convPrev !== undefined)
        ? conversion - convPrev
        : 0,
      spark: [],
      pts: true,
    },
  ]

  // Sources : volume de leads par canal (commission absente en DB).
  const srcs = funnel.sources ?? []
  const totalLeads = srcs.reduce((s, x) => s + (x.v ?? 0), 0)
  const sources: AxSource[] = srcs.map(s => ({
    label: sourceLabel(s.source, t),
    // sous-libellé = taux de qualification du canal (conv = qualifiés / leads).
    sub: s.conv > 0 ? t('analytics.qualifiedPct', { pct: s.conv }) : '',
    deals: s.v,
    comm: 0,
    pct: totalLeads > 0 ? Math.round((s.v * 100) / totalLeads) : 0,
    delta: deltaPct(s.v, s.prev),
  }))

  // Closing : contributeurs cockpit triés par probabilité de stage (déjà top5 par
  // montant côté SQL). Champs décoratifs when/days vides (masqués si vide).
  const closing: AxDeal[] = (cockpit.contributors ?? [])
    .map(c => ({
      prop: c.name ?? t('analytics.dealFallback'),
      loc: '',
      gmv: 0,
      comm: c.price_missing ? 0 : (c.amount ?? 0),
      prob: probaForStage(c.stage),     // probabilité tirée du code BRUT
      stage: stageLabel(c.stage, t),    // libellé affiché traduit
      when: '',
      days: 0,
    }))
    .sort((a, b) => b.prob - a.prob || b.comm - a.comm)

  return {
    key: period,
    label: objectif.label,
    scopeLabel: cockpit.scope === 'me' ? t('analytics.scope.me') : t('analytics.scope.agency'),
    period: meta.period,
    granularity: meta.granularity,
    pointWord: meta.pointWord,
    target: objectif.target ?? 0,
    realizedNow: objectif.realized ?? 0,
    projectedEnd: objectif.projected ?? 0,
    paceFrac,
    series,
    axisLabels: objectif.xLabels ?? [],
    composition,
    kpis,
    sources,
    // Extensions optionnelles (couche d'honnêteté) :
    targetIsSet: !!objectif.target_is_set,
    commissionFlags,
    closing,
    records: null, // Drawer drill-down différé V1 → « détails indisponibles ».
  }
}

function deltaPct(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

// Ré-exporté pour le typage du Drawer dégradé (records null).
export type { AxBucketId, AxBucket }
