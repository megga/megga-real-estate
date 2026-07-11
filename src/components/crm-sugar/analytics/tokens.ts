// MEGGA CRM — Dashboard Analytics « Le Cockpit Commission » (Sugar Pure, hi-fi)
// Port 1:1 du handoff `analytics-tokens.jsx` : tokens AX/AX_DARK, formatters CHF,
// générateur de séries, modèle de données des 3 périodes, helpers d'objectif.
// Grammaire Sugar Pure : surfaces blanches, accent ink #0B0C0E, ombres douces,
// zéro bordure décorative, Manrope, CHF à apostrophes, rampe monochrome.

import { createContext, useContext } from 'react'

export interface AxPill { bg: string; fg: string; sh: string }

export interface AxTheme {
  card: string
  cardSubtle: string
  cardWhisper: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  hairline: string
  hairlineSt: string
  shadowSm: string
  shadow: string
  shadowLg: string
  secured: string
  probable: string
  possible: string
  line: string
  area: string
  goal: string
  grid: string
  pillAhead: AxPill
  pillBehind: AxPill
  pillNeutral: AxPill
  onAccent: string
  skBase: string
  skShine: string
  appBlur: string
  scrim: string
  pageBg: string
}

export const AX: AxTheme = {
  card: '#FFFFFF',
  cardSubtle: '#F6F7F9',
  cardWhisper: '#FAFAFB',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#80858E',
  ghost: '#B5BAC2',
  hairline: 'rgba(11,12,14,0.07)',
  hairlineSt: 'rgba(11,12,14,0.12)',
  shadowSm: '0 4px 16px rgba(15,23,42,0.05)',
  shadow: '0 14px 44px rgba(15,23,42,0.07), 0 2px 8px rgba(15,23,42,0.04)',
  shadowLg: '0 28px 70px rgba(15,23,42,0.10), 0 6px 18px rgba(15,23,42,0.05)',
  secured: '#0B0C0E',
  probable: '#7B828C',
  possible: '#CDD1D7',
  line: '#0B0C0E',
  area: 'rgba(11,12,14,0.06)',
  goal: '#C2C6CD',
  grid: 'rgba(11,12,14,0.05)',
  pillAhead: { bg: '#15643F', fg: '#FFFFFF', sh: '0 1px 2px rgba(21,100,63,0.32), inset 0 -1px 0 rgba(0,0,0,0.10)' },
  pillBehind: { bg: '#A0521E', fg: '#FFFFFF', sh: '0 1px 2px rgba(160,82,30,0.32), inset 0 -1px 0 rgba(0,0,0,0.10)' },
  pillNeutral: { bg: '#202127', fg: '#FFFFFF', sh: '0 1px 2px rgba(32,33,39,0.30), inset 0 -1px 0 rgba(0,0,0,0.10)' },
  onAccent: '#FFFFFF',
  skBase: '#ECEDF0',
  skShine: '#F8F9FB',
  appBlur: 'rgba(239,239,241,0.82)',
  scrim: 'rgba(11,12,14,0.34)',
  pageBg: 'radial-gradient(ellipse 120% 80% at 50% 100%, #D7D8DB 0%, #E6E7E9 50%, #EFEFF1 100%)',
}

export const AX_DARK: AxTheme = {
  ...AX,
  card: '#191B1F', cardSubtle: '#23262B', cardWhisper: '#1F2126',
  ink: '#F3F4F6', inkSoft: '#B4B9C2', muted: '#7C818B', ghost: '#454953',
  hairline: 'rgba(255,255,255,0.08)', hairlineSt: 'rgba(255,255,255,0.18)',
  shadowSm: '0 4px 16px rgba(0,0,0,0.40)',
  shadow: '0 16px 44px rgba(0,0,0,0.50), 0 2px 8px rgba(0,0,0,0.35)',
  shadowLg: '0 30px 70px rgba(0,0,0,0.60), 0 6px 18px rgba(0,0,0,0.40)',
  secured: '#F3F4F6', probable: '#878D98', possible: '#41454D',
  line: '#F3F4F6', area: 'rgba(255,255,255,0.08)', goal: '#565A62', grid: 'rgba(255,255,255,0.07)',
  onAccent: '#0B0C0E',
  skBase: '#23262B', skShine: '#2F333A',
  appBlur: 'rgba(13,14,17,0.78)',
  scrim: 'rgba(0,0,0,0.58)',
  pageBg: 'radial-gradient(ellipse 120% 80% at 50% 0%, #16181C 0%, #0C0D0F 55%, #090A0B 100%)',
}

// Contexte de thème — le composant lit useAX() (provider posé par la page).
export const AXCtx = createContext<AxTheme>(AX)
export const useAX = (): AxTheme => useContext(AXCtx)

// ── Formatters ───────────────────────────────────────────────────────────────
export const axCHF = (n: number): string =>
  'CHF ' + Math.round(n).toLocaleString('fr-CH').replace(/ |\s/g, "'")

export const axShort = (n: number): string => {
  const a = Math.abs(n)
  if (a >= 1e6) return (n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2).replace(/\.?0+$/, '') + 'M'
  if (a >= 1e3) return Math.round(n / 1e3) + 'k'
  return String(Math.round(n))
}
// ── Générateur de séries temporelles ─────────────────────────────────────────
export interface AxSeries { real: number[]; proj: number[]; goal: number[]; yMax: number; n: number; elapsed: number }

// (axBuildSeries — générateur de série décoratif — retiré : les séries sont
//  désormais construites en live par buildSeriesLive dans buildAxData.ts.)

// ── Deals « ce qui se signe bientôt » ────────────────────────────────────────
// gmv/when/days = champs décoratifs de la maquette ; en live ils sont vides
// (masqués si vides). comm/prob/stage sont alimentés depuis les contributeurs.
export interface AxDeal { prop: string; loc: string; gmv: number; comm: number; prob: number; stage: string; when: string; days: number }

// ── Dossiers derrière chaque bucket de composition (cible du drill) ──────────
// Le drill-down par bucket est différé V1 (records=null → « détails indisponibles »).
export interface AxRecord { prop: string; loc: string; gmv: number; comm: number; prob: number; state: string }
export interface AxBucket { label: string; hint: string; items: AxRecord[] }
export type AxBucketId = 'secured' | 'probable' | 'possible'

// ── Modèle de période ────────────────────────────────────────────────────────
export type AxPeriodId = 'month' | 'quarter' | 'year'

export interface AxKpi { label: string; value: string; delta: number; spark: number[]; pts?: boolean; abs?: boolean }
export interface AxCompositionItem { k: AxBucketId; label: string; hint: string; v: number }
export interface AxSource { label: string; sub: string; deals: number; comm: number; pct: number; delta: number; won?: number }

export interface AxPeriodData {
  key: AxPeriodId
  label: string
  scopeLabel: string
  period: string
  granularity: string
  pointWord: string
  target: number
  realizedNow: number
  projectedEnd: number
  paceFrac: number
  series: AxSeries
  axisLabels: string[]
  composition: AxCompositionItem[]
  kpis: AxKpi[]
  sources: AxSource[]
  // ── Extensions live (couche d'honnêteté A+C), optionnelles ────────────────
  /** L'agence a-t-elle saisi un objectif ? (false → CTA Réglages, masque pace-bar) */
  targetIsSet?: boolean
  /** Compteurs de fallback commission (taux 3% par défaut / prix manquant) */
  commissionFlags?: { nDefaultPct: number; nMissingPrice: number }
  /** Deals « ce qui se signe bientôt » (live, en prop au lieu de fixture) */
  closing?: AxDeal[]
  /** Dossiers par bucket pour le Drawer ; null = drill-down dégradé V1 */
  records?: Record<AxBucketId, AxBucket> | null
}

// ── Pace helper → objet verdict ──────────────────────────────────────────────
export interface AxPaceVerdict { paceNow: number; diff: number; ahead: boolean; projPct: number }
export const axPace = (d: AxPeriodData): AxPaceVerdict => {
  const paceNow = Math.round(d.target * d.paceFrac)
  const diff = d.realizedNow - paceNow
  const ahead = diff >= 0
  const projPct = Math.round((d.projectedEnd / d.target) * 100)
  return { paceNow, diff, ahead, projPct }
}

