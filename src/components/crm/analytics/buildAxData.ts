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
  AxPeriodId, AxPeriodData, AxSeries, AxKpi, AxCompositionItem, AxSource, AxDeal, AxBucketId, AxBucket, AxRecord,
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
  // `comm`/`won` = commission RÉALISÉE + nb de deals gagnés attribués au canal
  // (analytics_funnel, migration 20260711120000). Optionnels : rétro-compat avant
  // application de la migration → traités comme 0.
  sources: Array<{ source: string; v: number; conv: number; prev: number; comm?: number; won?: number }>
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
    case 'Visite': return t('analytics.stage.visit')
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

// ── Bucket de composition d'un stage BRUT (cohérent avec la décompo pondérée) ──
function stageToBucket(rawStage: string): AxBucketId {
  switch (rawStage) {
    case 'Signé':
    case 'Compromis': return 'secured'
    case 'Offre': return 'probable'
    default: return 'possible'
  }
}

// ── Records du popover de composition : dérivés des VRAIS contributeurs cockpit
// (déjà top-5 par montant côté SQL), regroupés par bucket. Aucun chiffre inventé :
// un bucket sans contributeur dans le top-5 renvoie une liste vide → le popover
// dégrade honnêtement (« ouvrir le Pipeline »). Le total du bucket reste porté
// par la composition pondérée (source unique), pas par la somme des items listés.
function buildRecords(
  contributors: CockpitJson['contributors'],
  composition: AxCompositionItem[],
  t: TFunction,
): Record<AxBucketId, AxBucket> {
  const byBucket: Record<AxBucketId, AxRecord[]> = { secured: [], probable: [], possible: [] }
  for (const c of contributors ?? []) {
    const bucket = stageToBucket(c.stage)
    byBucket[bucket].push({
      prop: c.name ?? t('analytics.dealFallback'),
      loc: '',
      gmv: 0,
      comm: c.price_missing ? 0 : (c.amount ?? 0),
      prob: probaForStage(c.stage),
      state: stageLabel(c.stage, t),
    })
  }
  const metaOf = (k: AxBucketId): AxCompositionItem | undefined => composition.find(c => c.k === k)
  const mk = (k: AxBucketId): AxBucket => ({
    label: metaOf(k)?.label ?? k,
    hint: metaOf(k)?.hint ?? '',
    items: byBucket[k].sort((a, b) => b.comm - a.comm),
  })
  return { secured: mk('secured'), probable: mk('probable'), possible: mk('possible') }
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
      // pas de N-1 de volume calculé : on n'affiche PAS `delta_deals` (variation
      // en % du nombre de deals) à côté d'un montant CHF — ce serait un delta
      // trompeur, il ne parle pas de la même grandeur.
      delta: 0,
      spark: volumeSpark,
    },
    {
      label: t('analytics.kpi.transactions'),
      value: String(cockpit.deals ?? 0),
      /**
       * ⛔ `delta_deals` EST UN POURCENTAGE, et il s'affichait comme un COMPTE.
       *
       * Le SQL rend `ROUND((deals − deals_prev) * 100 / deals_prev)` — une
       * variation en %, pas un écart de deals. La tuile portait `abs: true`, qui
       * masque le suffixe : sur « 12 transactions », un `delta_deals` de 2 se
       * lisait « +2 » — donc « deux deals de plus », alors que la donnée dit
       * « +2 % ». Le commentaire de la tuile au-dessus portait la même
       * méprise, et c'est probablement lui qui a fait poser `abs`.
       *
       * ⚠ Une lecture du seul client ne pouvait pas trancher : les deux
       * interprétations rendent un petit entier plausible à côté d'un compte.
       * L'oracle est le SQL — `20260614150000_analytics_rpcs.sql`.
       */
      delta: cockpit.delta_deals ?? 0,
      spark: [],
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
      delta: deltaPts(conversion, convPrev),
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
    deals: s.v,                    // volume de leads (inchangé — lu par le mobile)
    comm: s.comm ?? 0,             // commission RÉALISÉE attribuée au canal (live)
    won: s.won ?? 0,               // nombre de deals gagnés du canal
    pct: totalLeads > 0 ? Math.round((s.v * 100) / totalLeads) : 0,  // % de LEADS (inchangé)
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
    // Popover de composition : contributeurs réels regroupés par bucket (jamais
    // de fixture). Bucket vide → dégradation honnête côté UI.
    records: buildRecords(cockpit.contributors ?? [], composition, t),
  }
}

/* ── Les deux deltas, côte à côte ─────────────────────────────────────────────
 *
 * ⚠ DEUX FONCTIONS, PAS UNE : elles ne calculent pas la même chose. `deltaPct`
 * rend une variation RELATIVE en % (« ce canal a fait 20 % de plus »),
 * `deltaPts` un écart ABSOLU en points entre deux pourcentages (« le taux est
 * passé de 21 % à 26 %, soit +5 points »). Les fondre donnerait une variation
 * relative d'un pourcentage — un nombre que personne ne sait lire.
 *
 * Ce qu'elles ont en commun est la seule chose qui compte ici : elles ARRONDISSENT
 * à la frontière. Tout delta qui entre dans `AxKpi.delta` ou `AxSource.delta`
 * passe par l'une des deux ; un nouveau delta a désormais un endroit évident où
 * aller, au lieu d'une soustraction posée en ligne.
 */

/** Variation RELATIVE, en % — `prev` nul ⇒ 100 % si l'on part de zéro. */
function deltaPct(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0
  return Math.round(((curr - prev) / prev) * 100)
}

/**
 * Écart ABSOLU entre deux pourcentages, en POINTS — arrondi, et nul si l'une
 * des deux valeurs manque.
 *
 * ⛔ L'ARRONDI EST LE POINT. L'écart s'écrivait `conversion - convPrev`, en
 * ligne, sans arrondi : la seule soustraction du fichier qui faisait CONFIANCE
 * à la précision de son entrée. Le RPC rend aujourd'hui deux entiers
 * (`ROUND(…)::int`), donc la production n'a jamais vu le défaut — mais un
 * flottant de chaque côté suffit à afficher « +0.0500000000000000 pt »
 * (mesuré sur le banc `/dev/crm`, dont la fixture portait des ratios). Une
 * garde de rendu ne l'aurait pas attrapé : la pilule était peinte correctement,
 * c'est son CONTENU qui était faux.
 *
 * ⚠ Arrondi à l'ENTIER, comme `deltaPct`, parce que la VALEUR comparée est un
 * entier (`ROUND(n_signed * 100 / total)::int`). Un delta plus précis que la
 * valeur qu'il commente serait un faux gain. Le jour où le RPC rendrait des
 * décimales, c'est ici qu'il faut revenir.
 */
function deltaPts(curr: number | null | undefined, prev: number | null | undefined): number {
  if (curr === null || curr === undefined || prev === null || prev === undefined) return 0
  return Math.round(curr - prev)
}

// Ré-exporté pour le typage du Drawer dégradé (records null).
export type { AxBucketId, AxBucket }
