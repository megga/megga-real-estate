// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — Data layer
// Port pixel-près de sprint-4/crm-dashboard-data.jsx
// + sprint-4/cockpit-variantes-data.jsx
// + sprint-4/objectif-variantes-data.jsx
//
// Source unique pour scaler les valeurs en fonction de :
//   • period : month / quarter / year / ytd
//   • scope  : me / team / all (caché en v1)
//
// En prod ce module sera remplacé par un appel à `GET /api/dashboard?...`
// (cf. handoff-sprint-4 §"Modèle de données à câbler").

import { DB_SP } from './tokens'

export type PeriodKey = 'month' | 'quarter' | 'year' | 'ytd'
export type ScopeKey = 'me' | 'team' | 'all'
export type ScenarioKey = 'prudent' | 'median' | 'agressif'

// ─── Multiplicateurs par période ───────────────────────────────────────
export const PERIOD_INFO: Record<
  PeriodKey,
  {
    mult: number
    label: string
    short: string
    daysLeft: number
    periodWord: string
  }
> = {
  month: {
    mult: 1,
    label: 'Mai 2026',
    short: 'Mai',
    daysLeft: 14,
    periodWord: 'mois',
  },
  quarter: {
    mult: 3.0,
    label: 'T2 2026',
    short: 'T2',
    daysLeft: 47,
    periodWord: 'trimestre',
  },
  year: {
    mult: 11.4,
    label: '2026',
    short: '2026',
    daysLeft: 229,
    periodWord: 'année',
  },
  ytd: {
    mult: 4.5,
    label: '1er janv → 16 mai',
    short: 'YTD',
    daysLeft: 0,
    periodWord: 'année',
  },
}

export const SCOPE_INFO: Record<
  ScopeKey,
  {
    mult: number
    label: string
    detail: (agent: string, role: string) => string
    agents: number
  }
> = {
  me: {
    mult: 1,
    label: 'Vue personnelle',
    detail: (n, r) => `${n} · ${r}`,
    agents: 1,
  },
  team: {
    mult: 5.4,
    label: 'Équipe Léman',
    detail: () => '5 agents · 47 mandats actifs',
    agents: 5,
  },
  all: {
    mult: 12.7,
    label: 'MEGGA Lausanne',
    detail: () => '12 agents · 124 mandats actifs',
    agents: 12,
  },
}

// ─── Cockpit — datasets par période ────────────────────────────────────
// (cf. cockpit-variantes-data.jsx → CK_DATA)
export interface CockpitDataset {
  label: string
  short: string
  periodWord: string
  projected: number
  target: number
  daysLeft: number
  deltaPct: number
  compareLabel: string
  decomp: {
    signed: number
    compromis: number
    offres: number
    pipeline: number
  }
  contributors: Array<{ name: string; stage: string; amount: number }>
  vitals: {
    deals: number
    conversion: string
    velocity: number
    kycRisk: number
    kycUrgent: number
    deltaDeals: number
    deltaConv: number
    deltaVel: number
    deltaKyc: number
  }
  aiHint: {
    label: string
    title: string
    desc: string
    cta: string
  }
}

export const CK_DATA: Record<'month' | 'quarter' | 'year', CockpitDataset> = {
  month: {
    label: 'Mai 2026',
    short: 'Mai',
    periodWord: 'mois',
    projected: 142500,
    target: 175000,
    daysLeft: 14,
    deltaPct: 18,
    compareLabel: 'vs avril',
    decomp: { signed: 62000, compromis: 32500, offres: 28000, pipeline: 20000 },
    contributors: [
      { name: 'Aebischer · Verbier', stage: 'Compromis', amount: 32500 },
      { name: 'Berset · Lausanne', stage: 'Compromis', amount: 28000 },
      { name: 'Vionnet · Pully', stage: 'Offre', amount: 21500 },
      { name: 'Margelisch · Crans', stage: 'Visite', amount: 12500 },
    ],
    vitals: {
      deals: 12,
      conversion: '34 %',
      velocity: 47,
      kycRisk: 2,
      kycUrgent: 1,
      deltaDeals: 25,
      deltaConv: 6,
      deltaVel: -12,
      deltaKyc: 1,
    },
    aiHint: {
      label: 'Action prioritaire de la semaine',
      title: 'Boucle la visite Aebischer jeudi 19.',
      desc: "Probabilité de signature compromis 87 % — gain estimé +CHF 32'500 sur ton mois.",
      cta: 'Programmer la visite',
    },
  },
  quarter: {
    label: 'T2 2026',
    short: 'T2',
    periodWord: 'trimestre',
    projected: 372000,
    target: 350000,
    daysLeft: 45,
    deltaPct: 12,
    compareLabel: 'vs T1',
    decomp: { signed: 158000, compromis: 92000, offres: 72000, pipeline: 50000 },
    contributors: [
      { name: 'Aebischer · Verbier', stage: 'Compromis', amount: 32500 },
      { name: 'Berset · Lausanne', stage: 'Compromis', amount: 28000 },
      { name: 'Sieber · Morges', stage: 'Compromis', amount: 31500 },
      { name: 'Vionnet · Pully', stage: 'Offre', amount: 21500 },
      { name: 'Margelisch · Crans', stage: 'Visite', amount: 12500 },
    ],
    vitals: {
      deals: 19,
      conversion: '32 %',
      velocity: 52,
      kycRisk: 3,
      kycUrgent: 1,
      deltaDeals: 14,
      deltaConv: 4,
      deltaVel: -8,
      deltaKyc: 0,
    },
    aiHint: {
      label: 'Levier prioritaire trimestre',
      title: 'Active 3 KYC ce trimestre.',
      desc: '3 vendeurs prêts à compromis bloqués sur KYC. Débloquage estimé +CHF 88 k.',
      cta: 'Voir les KYC bloquants',
    },
  },
  year: {
    label: '2026',
    short: '2026',
    periodWord: 'année',
    projected: 1248000,
    target: 1200000,
    daysLeft: 229,
    deltaPct: 24,
    compareLabel: 'vs 2025',
    decomp: { signed: 487000, compromis: 312000, offres: 248000, pipeline: 201000 },
    contributors: [
      { name: 'Aebischer · Verbier', stage: 'Compromis', amount: 32500 },
      { name: 'Berset · Lausanne', stage: 'Compromis', amount: 28000 },
      { name: 'Sieber · Morges', stage: 'Compromis', amount: 31500 },
      { name: 'Vionnet · Pully', stage: 'Offre', amount: 21500 },
      { name: 'Margelisch · Crans', stage: 'Visite', amount: 12500 },
    ],
    vitals: {
      deals: 47,
      conversion: '34 %',
      velocity: 47,
      kycRisk: 4,
      kycUrgent: 1,
      deltaDeals: 18,
      deltaConv: 6,
      deltaVel: -10,
      deltaKyc: 1,
    },
    aiHint: {
      label: 'Levier annuel prioritaire',
      title: 'Lance la campagne parrainage en juin.',
      desc: 'Tes recommandations convertissent à 52 %. 3 intros = +CHF 165 k sur l\'année.',
      cta: 'Préparer les messages',
    },
  },
}

// ─── Helper tone adaptatif (ratio projected / target) ──────────────────
export interface CockpitTone {
  tone: 'critical' | 'slipping' | 'ontrack' | 'ahead'
  color: string
  kicker: string
  title: string
  sub: string
  pill: {
    bg: string
    fg: string
    shadow: string
    dot: string
  }
}

export function ckTone(
  projected: number,
  target: number,
  periodWord = 'mois',
): CockpitTone {
  const ratio = projected / target
  if (ratio >= 1) {
    return {
      tone: 'ahead',
      color: DB_SP.ok,
      kicker: 'Au-dessus de l\'objectif',
      title: `Tu dépasses ton ${periodWord}. Cap sur le prochain palier.`,
      sub: `Sécurise les compromis et anticipe le ${periodWord} suivant.`,
      pill: DB_SP.pill.ok,
    }
  }
  if (ratio >= 0.8) {
    return {
      tone: 'ontrack',
      color: DB_SP.ink,
      kicker: 'Sur la trajectoire',
      title: `Ton ${periodWord} va bien. Tu peux faire mieux.`,
      sub: 'Vise les 100 % en accélérant 1 ou 2 deals.',
      pill: DB_SP.pill.neutral,
    }
  }
  if (ratio >= 0.55) {
    return {
      tone: 'slipping',
      color: DB_SP.warn,
      kicker: 'Sous la trajectoire',
      title: `${periodWord.charAt(0).toUpperCase() + periodWord.slice(1)} en risque. Tu peux rattraper.`,
      sub: 'Concentre-toi sur les leviers à fort impact ci-dessous.',
      pill: DB_SP.pill.warn,
    }
  }
  return {
    tone: 'critical',
    color: DB_SP.err,
    kicker: 'Action urgente',
    title: `${periodWord.charAt(0).toUpperCase() + periodWord.slice(1)} en alerte. Active les leviers maintenant.`,
    sub: 'MEGGA AI a préparé les actions à plus haut ROI.',
    pill: DB_SP.pill.danger,
  }
}

// ─── Stages décompo (4 tranches de revenu) ─────────────────────────────
export interface DecompStage {
  id: 'signed' | 'compromis' | 'offres' | 'pipeline'
  label: string
  hint: string
  color: string
  certainty: string
}

export const CK_DECOMP_STAGES: DecompStage[] = [
  {
    id: 'signed',
    label: 'Signé',
    hint: 'Déjà encaissé',
    color: 'rgba(11,12,14,0.92)',
    certainty: '100 %',
  },
  {
    id: 'compromis',
    label: 'Compromis',
    hint: 'Signature programmée',
    color: 'rgba(11,12,14,0.72)',
    certainty: '95 %',
  },
  {
    id: 'offres',
    label: 'Offres',
    hint: 'Acceptées, en KYC',
    color: 'rgba(11,12,14,0.50)',
    certainty: '70 %',
  },
  {
    id: 'pipeline',
    label: 'Visites',
    hint: 'Probables',
    color: 'rgba(11,12,14,0.30)',
    certainty: '35 %',
  },
]

// ─── Objectif — datasets par période (cf. OV_DATA) ─────────────────────
export interface ObjectifDataset {
  label: string
  short: string
  target: number
  realized: number
  projected: number
  low: number
  high: number
  xLabels: string[]
  realIdx: number
  real: number[]
  median: number[]
  lowCurve: number[]
  highCurve: number[]
  daysLeft: number
}

// Génère une progression douce avec petite volatilité — projection plausible.
function generateNoisy(
  start: number,
  end: number,
  n: number,
  vol = 0.04,
  seed = 1,
): number[] {
  let s = seed
  const rand = (): number => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const pts: number[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const base = start + (end - start) * t
    const noise = (rand() - 0.5) * 2 * vol * (end - start)
    pts.push(base + noise)
  }
  pts[0] = start
  pts[n - 1] = end
  return pts
}

export const OV_DATA: Record<'month' | 'quarter' | 'year', ObjectifDataset> = {
  year: {
    label: 'Année 2026',
    short: '2026',
    target: 1200000,
    realized: 487000,
    projected: 1248000,
    low: 1080000,
    high: 1410000,
    xLabels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'],
    realIdx: 4,
    real: [86000, 174000, 268000, 370000, 487000],
    median: [487000, 605000, 720000, 805000, 920000, 1035000, 1150000, 1248000],
    lowCurve: [487000, 580000, 670000, 740000, 825000, 910000, 985000, 1080000],
    highCurve: [487000, 640000, 780000, 890000, 1030000, 1180000, 1310000, 1410000],
    daysLeft: 229,
  },
  quarter: {
    label: 'T2 2026',
    short: 'T2',
    target: 350000,
    realized: 217000,
    projected: 372000,
    low: 320000,
    high: 425000,
    xLabels: ['S14', 'S15', 'S16', 'S17', 'S18', 'S19', 'S20', 'S21', 'S22', 'S23', 'S24', 'S25', 'S26'],
    realIdx: 6,
    real: [22000, 48000, 78000, 102000, 138000, 178000, 217000],
    median: [217000, 245000, 268000, 295000, 318000, 348000, 372000],
    lowCurve: [217000, 235000, 252000, 270000, 285000, 305000, 320000],
    highCurve: [217000, 262000, 295000, 330000, 360000, 395000, 425000],
    daysLeft: 45,
  },
  month: {
    label: 'Mai 2026',
    short: 'Mai',
    target: 175000,
    realized: 79000,
    projected: 142500,
    low: 112000,
    high: 175000,
    xLabels: Array.from({ length: 31 }, (_, i) => (i + 1).toString()),
    realIdx: 15,
    real: generateNoisy(0, 79000, 16, 0.025, 42),
    median: generateNoisy(79000, 142500, 16, 0.02, 91),
    lowCurve: generateNoisy(79000, 112000, 16, 0.015, 51),
    highCurve: generateNoisy(79000, 175000, 16, 0.03, 19),
    daysLeft: 15,
  },
}

// ─── Scénarios (Prudent / Médian / Agressif) ───────────────────────────
export interface ScenarioFactor {
  v: ScenarioKey
  l: string
  curve: 'lowCurve' | 'median' | 'highCurve'
  desc: string
}

export const OV_SCENARIOS_FACTORS: ScenarioFactor[] = [
  {
    v: 'prudent',
    l: 'Prudent',
    curve: 'lowCurve',
    desc: 'Hypothèses conservatrices : taux conv. −10 %, vélocité actuelle.',
  },
  {
    v: 'median',
    l: 'Médian',
    curve: 'median',
    desc: 'Hypothèses constantes : taux conv. 34 %, ticket moyen 1.42 M.',
  },
  {
    v: 'agressif',
    l: 'Agressif',
    curve: 'highCurve',
    desc: 'Hypothèses ambitieuses : taux conv. +6 pts, ticket +15 %.',
  },
]

// ─── Jalons / Paliers (T1 - T4 en année) ───────────────────────────────
export interface Milestone {
  id: string
  title: string
  subtitle: string
  done: boolean
  current: boolean
  value: number | null
  target: number
  valueProjected?: number
  status: string
}

export const OV_MILESTONES: Record<'month' | 'quarter' | 'year', Milestone[]> = {
  year: [
    { id: 'T1', title: 'T1', subtitle: 'Jan – Mar', done: true, current: false, value: 268000, target: 250000, status: 'Atteint à +7 %' },
    { id: 'T2', title: 'T2', subtitle: 'Avr – Juin', done: false, current: true, value: 487000, target: 600000, valueProjected: 645000, status: 'En cours · 81 %' },
    { id: 'T3', title: 'T3', subtitle: 'Juil – Sep', done: false, current: false, value: null, target: 900000, valueProjected: 920000, status: 'Projection médiane' },
    { id: 'T4', title: 'T4', subtitle: 'Oct – Déc', done: false, current: false, value: null, target: 1200000, valueProjected: 1248000, status: 'Projection médiane' },
  ],
  quarter: [
    { id: 'Avr', title: 'Avril', subtitle: 'S14 – S17', done: true, current: false, value: 102000, target: 110000, status: 'Atteint à 93 %' },
    { id: 'Mai', title: 'Mai', subtitle: 'S18 – S22', done: false, current: true, value: 79000, target: 120000, valueProjected: 142500, status: 'En cours · 66 %' },
    { id: 'Juin', title: 'Juin', subtitle: 'S23 – S26', done: false, current: false, value: null, target: 120000, valueProjected: 110000, status: 'Projection médiane' },
  ],
  month: [
    { id: 'S1', title: 'S20', subtitle: '11 – 17 mai', done: true, current: false, value: 32000, target: 40000, status: '−20 % vs cible' },
    { id: 'S2', title: 'S21', subtitle: '18 – 24 mai', done: false, current: true, value: 0, target: 45000, valueProjected: 48000, status: 'À jouer' },
    { id: 'S3', title: 'S22', subtitle: '25 – 31 mai', done: false, current: false, value: null, target: 45000, valueProjected: 38000, status: 'Projection médiane' },
  ],
}

// ─── Dashboard data — generator central ────────────────────────────────
export interface FunnelStage {
  n: string
  v: number
  w: number
  c?: string
  desc?: string
  bottleneck?: boolean
  /** Delta en % vs période précédente — handoff §"Polish Entonnoir". */
  delta?: number
  /** Delta du taux de conversion entre ce palier et le précédent, en points. */
  convDelta?: number
}

export interface SourceItem {
  n: string
  v: number
  conv: number
  c: string
  hot?: boolean
  /** Delta du volume en % vs période précédente — handoff §"Polish Entonnoir". */
  delta?: number
}

export interface ForecastHorizon {
  h: string
  low: number
  mid: number
  high: number
  n: number
  label: string
}

export interface DashboardData {
  period: typeof PERIOD_INFO[PeriodKey]
  scope: typeof SCOPE_INFO[ScopeKey]
  M: number
  funnel: FunnelStage[]
  sources: SourceItem[]
  forecast: ForecastHorizon[]
  funnelMult: number
  /** Libellé humain de la comparaison ("vs avril", "vs T1", "vs 2025"). */
  compareLabel: string
}

export function getDashboardData(
  period: PeriodKey,
  scope: ScopeKey,
): DashboardData {
  const P = PERIOD_INFO[period] || PERIOD_INFO.month
  const S = SCOPE_INFO[scope] || SCOPE_INFO.me
  const M = P.mult * S.mult

  const baseFunnelHead = 248
  const baseForecast30 = 198000
  const baseForecast60 = 412000
  const baseForecast90 = 745000

  const funnelMult =
    period === 'month'
      ? 0.4
      : period === 'quarter'
        ? 1
        : period === 'year'
          ? 4.2
          : 1.6

  // Deltas vs période précédente (mockés — handoff §"Polish Entonnoir") :
  // les bons paliers (Leads, Qualifiés) progressent, le bottleneck Visites
  // régresse, les paliers aval (Offres, Compromis) progressent grâce au pipeline.
  // `convDelta` (en points) compare le taux de conversion stade N / N-1 vs la
  // période précédente — un -8 pts sur Visites→Offres signale une dégradation.
  const funnel: FunnelStage[] = [
    { n: 'Leads',     v: Math.round(baseFunnelHead * S.mult * funnelMult),         w: 100, c: 'rgba(11,12,14,0.92)', desc: 'Prospects entrés',           delta: 12 },
    { n: 'Qualifiés', v: Math.round(baseFunnelHead * S.mult * funnelMult * 0.63),  w: 80,  c: 'rgba(11,12,14,0.78)', desc: 'Critères de matching validés', delta: 8,   convDelta: -3 },
    { n: 'Visites',   v: Math.round(baseFunnelHead * S.mult * funnelMult * 0.26),  w: 50,  c: 'rgba(11,12,14,0.62)', desc: '1ère visite effectuée',       delta: -14, convDelta: -8, bottleneck: true },
    { n: 'Offres',    v: Math.round(baseFunnelHead * S.mult * funnelMult * 0.11),  w: 32,  c: 'rgba(11,12,14,0.48)', desc: 'Offre reçue, KYC en cours',   delta: 6,   convDelta: 4 },
    { n: 'Compromis', v: Math.round(baseFunnelHead * S.mult * funnelMult * 0.048), w: 20,  c: 'rgba(11,12,14,0.34)', desc: 'Acte signé sous 60 j',        delta: 18,  convDelta: 7 },
  ]

  const forecast: ForecastHorizon[] = [
    {
      h: '30 jours',
      n: Math.max(3, Math.round(4 * S.mult * 0.6)),
      low: Math.round(baseForecast30 * S.mult * 0.8),
      mid: Math.round(baseForecast30 * S.mult),
      high: Math.round(baseForecast30 * S.mult * 1.25),
      label: 'deals à clôturer',
    },
    {
      h: '60 jours',
      n: Math.max(6, Math.round(9 * S.mult * 0.7)),
      low: Math.round(baseForecast60 * S.mult * 0.78),
      mid: Math.round(baseForecast60 * S.mult),
      high: Math.round(baseForecast60 * S.mult * 1.24),
      label: 'deals à clôturer',
    },
    {
      h: '90 jours',
      n: Math.max(10, Math.round(16 * S.mult * 0.8)),
      low: Math.round(baseForecast90 * S.mult * 0.78),
      mid: Math.round(baseForecast90 * S.mult),
      high: Math.round(baseForecast90 * S.mult * 1.23),
      label: 'deals à clôturer',
    },
  ]

  // Tendances par canal vs période précédente (handoff §"Polish Entonnoir") :
  // Marketplace en accélération, Réseaux sociaux en déclin → l'agent voit
  // d'un coup d'œil quel canal mérite plus d'investissement.
  const sources: SourceItem[] = [
    { n: 'Marketplace MEGGA', v: Math.round(112 * S.mult * funnelMult), conv: 38, c: '#0B0C0E', hot: true,  delta: 18 },
    { n: 'Site agence',       v: Math.round(64  * S.mult * funnelMult), conv: 28, c: '#1E5BC6',             delta: 4  },
    { n: 'Recommandations',   v: Math.round(38  * S.mult * funnelMult), conv: 52, c: '#059669', hot: true,  delta: 24 },
    { n: 'Réseaux sociaux',   v: Math.round(24  * S.mult * funnelMult), conv: 12, c: '#C45A00',             delta: -22 },
    { n: 'Importé manuel',    v: Math.round(10  * S.mult * funnelMult), conv: 22, c: '#7A8088',             delta: -8 },
  ]

  // Libellé humain de comparaison — cohérent avec CK_DATA.compareLabel
  const compareLabel =
    period === 'month'   ? 'vs avril'
    : period === 'quarter' ? 'vs T1'
    : period === 'year'    ? 'vs 2025'
    : 'vs période précédente'

  return { period: P, scope: S, M, funnel, sources, forecast, funnelMult, compareLabel }
}

// ─── Helpers de mapping shell → données ────────────────────────────────
export const ckMapPeriod = (p: PeriodKey): 'month' | 'quarter' | 'year' =>
  !p || p === 'ytd' ? 'year' : (p as 'month' | 'quarter' | 'year')

export const objMapPeriod = (p: PeriodKey): 'month' | 'quarter' | 'year' =>
  !p || p === 'ytd' ? 'year' : (p as 'month' | 'quarter' | 'year')
