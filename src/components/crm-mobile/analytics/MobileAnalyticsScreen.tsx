/**
 * Écran Analytics mobile (« Ton cockpit commission ») et l'ensemble de ses
 * sous-blocs de présentation : hero, barre de rythme, trajectoire, KPI,
 * closing, composition, sources. Le composant exporté `MobileAnalyticsScreen`
 * porte le câblage données ; les fonctions plus bas sont purement visuelles.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useAxDashboardData } from '@/hooks/useAxDashboardData'
import { axCHF, axPace, type AxPeriodData, type AxPeriodId } from '@/components/crm/analytics/tokens'
import { MOBILE_FONT, type MobileTokens } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

const PERIODS: AxPeriodId[] = ['month', 'quarter', 'year']
const noCHF = (s: string) => s.replace('CHF ', '')

// ─── Démo (harnais /dev/mobile) — gated, jamais de fetch Supabase ─────────
const DEMO_AX: AxPeriodData = {
  key: 'year', label: '2026', scopeLabel: 'Moi', period: '2026', granularity: '12 mois', pointWord: 'mois',
  target: 1200000, realizedNow: 1070000, projectedEnd: 1310000, paceFrac: 0.5,
  series: {
    real: [120000, 260000, 410000, 600000, 790000, 940000, 1070000],
    proj: [1070000, 1140000, 1210000, 1260000, 1300000, 1310000],
    goal: [100000, 200000, 300000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1100000, 1200000],
    yMax: 1400000, n: 12, elapsed: 6,
  },
  axisLabels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
  composition: [
    { k: 'secured', label: 'Sécurisé', hint: 'Actes + compromis', v: 620000 },
    { k: 'probable', label: 'Probable', hint: 'Offres en cours', v: 430000 },
    { k: 'possible', label: 'Possible', hint: 'Mandats & visites', v: 260000 },
  ],
  kpis: [
    { label: 'Volume signé', value: 'CHF 21.4M', delta: 12, spark: [3, 4, 3, 5, 6, 7, 8] },
    // ⚠ PAS de `abs` : `delta_deals` est une VARIATION EN %
    // (`ROUND((deals − prev) * 100 / prev)` côté SQL), pas un écart de deals.
    // La démo portait `abs: true`, qui masque le suffixe — « +3 » à côté de
    // 14 transactions se lisait « trois deals de plus ». Elle enseignait donc la
    // mauvaise lecture, à l'écran même qui sert à relire cet écran.
    { label: 'Transactions', value: '14', delta: 3, spark: [] },
    { label: 'Commission moy.', value: 'CHF 76k', delta: -4, spark: [] },
    { label: 'Taux de conversion', value: '28 %', delta: 5, spark: [], pts: true },
  ],
  sources: [
    { label: 'Site web', sub: '', deals: 12, comm: 0, pct: 42, delta: 8 },
    { label: 'Recommandation', sub: '', deals: 7, comm: 0, pct: 26, delta: 3 },
    { label: 'Onboarding', sub: '', deals: 5, comm: 0, pct: 18, delta: -2 },
    { label: 'Manuel', sub: '', deals: 4, comm: 0, pct: 14, delta: 0 },
  ],
  targetIsSet: true,
  commissionFlags: { nDefaultPct: 2, nMissingPrice: 1 },
  closing: [
    { prop: 'Appartement 5p', loc: 'Carouge', gmv: 1190000, comm: 35700, prob: 80, stage: 'Compromis', when: 'cette semaine', days: 4 },
    { prop: 'Villa', loc: 'Cologny', gmv: 3850000, comm: 115500, prob: 60, stage: 'Offre', when: 'ce mois', days: 18 },
  ],
  records: null,
}

/**
 * Analytics mobile (P9) — « Ton cockpit commission », port read-focused du proto.
 * 100 % câblé `useAxDashboardData(period, 'me')` (mêmes RPC que le desktop).
 * Hero commission projetée + barre de rythme (gardée sur `targetIsSet`),
 * bannière d'honnêteté (commissions estimées), trajectoire, KPI 2×2, deals à
 * signer, composition, sources de leads. Drill-down différé (`records` = null en
 * prod → pas de sheet). Toolbar export/partage différée (pas de backend).
 * `demo` alimente le harnais sans toucher Supabase ni naviguer.
 */
export function MobileAnalyticsScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('dashboard')
  const { tk } = useMobileTokens()
  const live = !demo

  const [period, setPeriod] = useState<AxPeriodId>('year')
  const [spinning, setSpinning] = useState(false)
  const spinTimer = useRef<number | null>(null)
  useEffect(() => () => { if (spinTimer.current !== null) window.clearTimeout(spinTimer.current) }, [])
  const { data: liveData, isLoading, isError, refetch } = useAxDashboardData(period, 'me', { enabled: live })
  const d = demo ? DEMO_AX : liveData

  const onRefresh = () => {
    if (spinning) return
    setSpinning(true)
    if (live) refetch()
    spinTimer.current = window.setTimeout(() => setSpinning(false), 1000)
  }
  const goSettings = () => { if (live) navigate('/dashboard/settings') }

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink }}>
      {/* En-tête : retour vers le hub Plus + rafraîchir */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 14px) 18px 4px' }}>
        <button type="button" onClick={() => { if (live) navigate('/dashboard/more') }} aria-label={t('mobile.analytics.back')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 38, padding: '0 var(--crm-space-2xl) 0 var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, fontFamily: 'inherit' }}>
          <MEIcon name="chevron-left" size={18} color={tk.ink} strokeWidth={2.2} />
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink }}>{t('mobile.analytics.back')}</span>
        </button>
        <button type="button" onClick={onRefresh} aria-label={t('analytics.toolbar.refresh')} style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, display: 'grid', placeItems: 'center' }}>
          <span style={{ display: 'inline-flex', transition: 'transform 1s cubic-bezier(.2,.8,.2,1)', transform: spinning ? 'rotate(-360deg)' : 'none' }}>
            <MEIcon name="refresh" size={17} color={tk.ink} strokeWidth={2} />
          </span>
        </button>
      </header>

      <div style={{ padding: 'var(--crm-space-xs) var(--crm-space-4xl) var(--crm-space-7xl)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-6xl)', fontWeight: 500, letterSpacing: -1, color: tk.ink, lineHeight: 1.05 }}>{t('mobile.analytics.title')}</h1>

        <Segment period={period} onChange={setPeriod} t={t} tk={tk} />

        {live && isLoading && !d ? (
          <Skeleton tk={tk} />
        ) : live && isError && !d ? (
          <ErrorCard t={t} tk={tk} onRetry={() => refetch()} />
        ) : !d ? (
          <NoData t={t} tk={tk} onRetry={() => refetch()} />
        ) : (
          <div key={period} style={{ animation: 'axmRise .42s cubic-bezier(.2,.8,.2,1) both' }}>
            <Hero d={d} t={t} tk={tk} onSettings={goSettings} />
            <HonestyBanner d={d} t={t} tk={tk} />
            <Trajectory d={d} t={t} tk={tk} />
            <Kpis d={d} tk={tk} />
            <Closing d={d} t={t} tk={tk} />
            <Composition d={d} t={t} tk={tk} />
            <Sources d={d} t={t} tk={tk} />
          </div>
        )}
      </div>

      <style>{'@keyframes axmRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'}</style>
    </div>
  )
}

// ─── Période ──────────────────────────────────────────────────────────────
/** Sélecteur de période (mois / trimestre / année) en pilule segmentée. */
function Segment({ period, onChange, t, tk }: { period: AxPeriodId; onChange: (p: AxPeriodId) => void; t: TFunction; tk: MobileTokens }) {
  return (
    <div style={{ marginTop: 16, display: 'flex', padding: 'var(--crm-space-xs)', borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, gap: 'var(--crm-space-2xs)' }}>
      {PERIODS.map((p) => {
        const on = p === period
        return (
          <button key={p} type="button" onClick={() => onChange(p)} style={{ flex: 1, height: 38, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', background: on ? tk.accent : 'transparent', color: on ? tk.accentInk : tk.inkSoft, fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.1, boxShadow: on ? tk.shadowSm : 'none' }}>
            {t(`analytics.selector.${p}`)}
          </button>
        )
      })}
    </div>
  )
}

// ─── Hero (commission projetée, carte immersive) ──────────────────────────
/** Carte hero : commission projetée en fin de période, avec barre de rythme si un objectif est fixé, sinon CTA « fixer un objectif ». */
function Hero({ d, t, tk, onSettings }: { d: AxPeriodData; t: TFunction; tk: MobileTokens; onSettings: () => void }) {
  const targetSet = d.targetIsSet ?? d.target > 0
  const ink = tk.relanceInk
  const mut = tk.relanceMuted
  const pace = targetSet ? axPace(d) : null
  return (
    <div style={{ marginTop: 18, background: tk.relanceBg, border: `1px solid ${tk.relanceBorder}`, borderRadius: 'var(--crm-radius-5xl)', padding: 'var(--crm-space-6xl) var(--crm-space-6xl) var(--crm-space-5xl)', boxShadow: tk.shadowLg, color: ink }}>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: mut }}>
        {t('analytics.hero.eyebrow')} · {d.label}
      </div>
      <div style={{ marginTop: 9, fontSize: 40, fontWeight: 500, letterSpacing: -1.6, lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {axCHF(d.projectedEnd)}
      </div>

      {targetSet && pace ? (
        <>
          <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: pace.ahead ? '#15643F' : '#A0521E', color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: -0.1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              <MEIcon name={pace.ahead ? 'arrow-up' : 'arrow-down'} size={11} color="#fff" strokeWidth={2.6} />
              {pace.ahead ? t('analytics.hero.ahead') : t('analytics.hero.behind')} {noCHF(axCHF(Math.abs(pace.diff)))}
            </span>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: mut, whiteSpace: 'nowrap' }}>{t('analytics.hero.vsTempo')}</span>
          </div>
          <PaceBar d={d} ink={ink} mut={mut} t={t} />
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: mut, flexWrap: 'wrap' }}>
            <MEIcon name="lock" size={12} color={mut} strokeWidth={1.9} />
            <span>{t('analytics.hero.targetSetByAgency')} ·</span>
            <button type="button" onClick={onSettings} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ink, textDecoration: 'underline', textUnderlineOffset: 2 }}>
              {t('analytics.hero.editInSettings')}
            </button>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: mut, lineHeight: 1.5 }}>{t('analytics.hero.noTarget', { period: d.label })}</div>
          <button type="button" onClick={onSettings} style={{ marginTop: 14, height: 44, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: tk.ctaBg, color: tk.ctaInk }}>
            {t('analytics.hero.setInSettings')}
          </button>
        </div>
      )}
    </div>
  )
}

/** Barre de rythme : réalisé (plein) vs projeté (hachures) vs objectif, avec repère « tempo » = fraction de période écoulée. */
function PaceBar({ d, ink, mut, t }: { d: AxPeriodData; ink: string; mut: string; t: TFunction }) {
  const realW = d.target ? Math.min(100, (d.realizedNow / d.target) * 100) : 0
  const projW = d.target ? Math.min(100, (d.projectedEnd / d.target) * 100) : 0
  const paceX = Math.min(100, d.paceFrac * 100)
  const legend = [
    { sw: ink, t: t('analytics.pace.realized'), v: noCHF(axCHF(d.realizedNow)) },
    { sw: 'hatch' as const, t: t('analytics.pace.projected'), v: noCHF(axCHF(d.projectedEnd)) },
    { sw: null, t: t('analytics.pace.target'), v: noCHF(axCHF(d.target)) },
  ]
  return (
    <div>
      <div style={{ position: 'relative', height: 16, borderRadius: 'var(--crm-radius-pill)', background: 'rgba(255,255,255,0.13)', overflow: 'visible', marginTop: 26 }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${projW}%`, borderRadius: 'var(--crm-radius-pill)', backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.34) 0 5px, transparent 5px 10px)' }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${realW}%`, borderRadius: 'var(--crm-radius-pill)', background: ink, transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} />
        <div style={{ position: 'absolute', left: `${paceX}%`, top: -5, bottom: -5, width: 2, background: mut, transform: 'translateX(-1px)', borderRadius: 'var(--crm-radius-2xs)' }} />
        <div style={{ position: 'absolute', left: `${paceX}%`, top: -19, transform: 'translateX(-50%)', fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: mut, whiteSpace: 'nowrap'}}>{t('analytics.pace.tempo')}</div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 'var(--crm-space-2xl)', flexWrap: 'wrap' }}>
        {legend.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            <span style={{ width: 10, height: 10, borderRadius: 'var(--crm-radius-2xs)', flexShrink: 0, background: l.sw === 'hatch' ? undefined : (l.sw || 'transparent'), backgroundImage: l.sw === 'hatch' ? `repeating-linear-gradient(45deg, ${mut} 0 3px, transparent 3px 6px)` : undefined, boxShadow: l.sw ? 'none' : `inset 0 0 0 1.5px ${mut}` }} />
            <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: mut }}>{l.t}</span>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: ink, fontVariantNumeric: 'tabular-nums' }}>{l.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Bannière d'honnêteté (commissions estimées) ──────────────────────────
/** Bandeau d'honnêteté : signale les commissions estimées (taux par défaut / prix manquant) ; masqué si aucun flag. */
function HonestyBanner({ d, t, tk }: { d: AxPeriodData; t: TFunction; tk: MobileTokens }) {
  const f = d.commissionFlags
  if (!f || (f.nDefaultPct === 0 && f.nMissingPrice === 0)) return null
  const parts: string[] = []
  if (f.nDefaultPct > 0) parts.push(t('analytics.fallback.defaultRate', { count: f.nDefaultPct }))
  if (f.nMissingPrice > 0) parts.push(t('analytics.fallback.missingPrice', { count: f.nMissingPrice }))
  return (
    <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-2xl)', background: tk.riskBg }}>
      <MEIcon name="sparkle" size={15} color={tk.riskFg} strokeWidth={1.9} />
      <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: tk.riskFg, lineHeight: 1.5 }}>{t('analytics.fallback.summary', { parts: parts.join(', ') })}</div>
    </div>
  )
}

// ─── Trajectoire ──────────────────────────────────────────────────────────
/** Graphe SVG de trajectoire : réalisé (trait plein), projeté (pointillé), objectif (tirets) ; masqué si la série est vide. */
function Trajectory({ d, t, tk }: { d: AxPeriodData; t: TFunction; tk: MobileTokens }) {
  const s = d.series
  const W = 300, H = 132, padT = 12, padB = 16, padX = 2
  if (!s.n || !s.yMax || !s.real.length) return null
  const X = (i: number) => padX + (i / (s.n - 1)) * (W - 2 * padX)
  const Y = (v: number) => H - padB - (v / s.yMax) * (H - padT - padB)
  const realPts = s.real.map((v, i) => [X(i), Y(v)] as const)
  const projPts = s.proj.map((v, k) => [X(s.elapsed + k), Y(v)] as const)
  const goalPts = s.goal.map((v, i) => [X(i), Y(v)] as const)
  const toPath = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = realPts[realPts.length - 1]
  const area = `${toPath(realPts)} L${last[0].toFixed(1)} ${(H - padB).toFixed(1)} L${realPts[0][0].toFixed(1)} ${(H - padB).toFixed(1)} Z`
  return (
    <div style={{ marginTop: 24, background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-3xl)', padding: 'var(--crm-space-4xl) var(--crm-space-3xl) var(--crm-space-2xl)', boxShadow: tk.shadowSm }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--crm-space-lg)', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.3 }}>{t('analytics.chart.title')}</h3>
        <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, whiteSpace: 'nowrap' }}>{d.granularity}</span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', height: 132 }} role="img" aria-label={t('analytics.chart.title')}>
        <path d={area} fill={tk.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(3,3,3,0.05)'} stroke="none" />
        {d.target ? <path d={toPath(goalPts)} fill="none" stroke={tk.goal} strokeWidth={1.6} strokeDasharray="4 4" strokeLinecap="round" /> : null}
        <path d={toPath(realPts)} fill="none" stroke={tk.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        {projPts.length > 1 ? <path d={toPath(projPts)} fill="none" stroke={tk.ink} strokeWidth={2.4} strokeDasharray="2 5" strokeLinecap="round" opacity={0.55} /> : null}
        <circle cx={last[0]} cy={last[1]} r={3.4} fill={tk.ink} stroke={tk.card} strokeWidth={2} />
      </svg>
      <div style={{ display: 'flex', gap: 'var(--crm-space-3xl)', marginTop: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.inkSoft }}>
          <span style={{ width: 14, height: 3, borderRadius: 'var(--crm-radius-2xs)', background: tk.ink }} /> {t('analytics.chart.realized')}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.inkSoft }}>
          <span style={{ width: 14, height: 0, borderTop: `2px dashed ${tk.goal}` }} /> {t('analytics.chart.target')}
        </span>
      </div>
    </div>
  )
}

// ─── KPI 2×2 ───────────────────────────────────────────────────────────────
/** Pastille de variation ±% (vert au-dessus / ocre en-dessous) ; `pts` affiche « pt », `abs` masque le suffixe. */
function Delta({ v, pts, abs, tk }: { v: number; pts?: boolean; abs?: boolean; tk: MobileTokens }) {
  if (v === 0) return <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted }}>—</span>
  const up = v > 0
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', background: up ? '#15643F' : '#A0521E', color: '#fff', fontSize: 'var(--crm-text-xs)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <MEIcon name={up ? 'arrow-up' : 'arrow-down'} size={9} color="#fff" strokeWidth={3} />
      {up ? '+' : ''}{v}{pts ? ' pt' : abs ? '' : '%'}
    </span>
  )
}

/** Mini-sparkline SVG d'un KPI ; rien en dessous de 2 points. */
function Spark({ data, up, tk }: { data: number[]; up: boolean; tk: MobileTokens }) {
  if (data.length < 2) return null
  const W = 58, H = 22
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - ((v - min) / span) * (H - 3) - 1.5] as const)
  const dPath = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const col = up ? tk.goal : '#C45A00'
  const lastPt = pts[pts.length - 1]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', flexShrink: 0 }} aria-hidden="true">
      <path d={dPath} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastPt[0]} cy={lastPt[1]} r={2.4} fill={col} />
    </svg>
  )
}

/** Grille 2×2 de cartes KPI (valeur + delta + sparkline). */
function Kpis({ d, tk }: { d: AxPeriodData; tk: MobileTokens }) {
  return (
    <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-lg)' }}>
      {d.kpis.map((k, i) => (
        <div key={i} style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-2xl)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', boxShadow: tk.shadowSm, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--crm-space-sm)', minHeight: 28 }}>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, lineHeight: 1.25 }}>{k.label}</span>
            <Delta v={k.delta} pts={k.pts} abs={k.abs} tk={tk} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 'var(--crm-space-sm)' }}>
            <span style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.6, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{k.value}</span>
            <Spark data={k.spark} up={k.delta >= 0} tk={tk} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Ce qui se signe bientôt ──────────────────────────────────────────────
/** « Ce qui se signe bientôt » : deals proches du closing (probabilité, bien, commission estimée). */
function Closing({ d, t, tk }: { d: AxPeriodData; t: TFunction; tk: MobileTokens }) {
  const deals = d.closing ?? []
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ margin: '0 0 11px', fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.4, padding: '0 var(--crm-space-2xs)' }}>{t('analytics.closing.title')}</h3>
      {deals.length === 0 ? (
        <EmptyRow text={t('analytics.closing.empty')} tk={tk} />
      ) : (
        <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-3xl)', boxShadow: tk.shadowSm, overflow: 'hidden' }}>
          {deals.map((dl, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', boxShadow: i === deals.length - 1 ? 'none' : `inset 0 -1px 0 ${tk.hair}` }}>
              <div style={{ width: 44, flexShrink: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, fontVariantNumeric: 'tabular-nums' }}>{dl.prob}%</div>
                <div style={{ height: 4, borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, overflow: 'hidden', marginTop: 4 }}>
                  <div style={{ height: '100%', width: `${dl.prob}%`, background: tk.ink, borderRadius: 'var(--crm-radius-pill)' }} />
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[dl.prop, dl.loc].filter(Boolean).join(' · ')}</div>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, marginTop: 1 }}>{[dl.stage, dl.when].filter(Boolean).join(' · ')}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{dl.comm > 0 ? noCHF(axCHF(dl.comm)) : 'CHF —'}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted }}>{t('analytics.deal.commission')}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Composition (drill différé : records null en prod) ───────────────────
/** Composition du pipeline (sécurisé / probable / possible) en barre empilée + détail ; drill-down différé (`records` null en prod). */
function Composition({ d, t, tk }: { d: AxPeriodData; t: TFunction; tk: MobileTokens }) {
  const total = d.composition.reduce((s, c) => s + c.v, 0)
  /**
   * La rampe monochrome de « De quoi est fait le projeté » — trois valeurs
   * d'une même grandeur, donc une famille qui ENCODE. Elle reste hors direction ;
   * ce qui a changé, c'est qu'elle DÉRIVE maintenant dans les deux thèmes.
   *
   * ⛔ La branche sombre portait `#F3F4F6 / #878D98 / #41454D` — des copies
   * faites à la main de l'ancienne `AX_DARK` du bureau, dont le chantier
   * « Analytics en MEGGA X » a supprimé la source. Le clair dérivait déjà : une
   * moitié suivait l'échelle, l'autre était figée sur des valeurs orphelines.
   *
   * ⚠ LE MIROIR LITTÉRAL DU CLAIR N'ÉTAIT PAS LA RÉPONSE. `n1000/n600/n400`
   * donne des pas de 2,52 puis 7,04 — un petit pas puis un gouffre, qui fait
   * lire « Probable » comme un « Sécurisé » un peu terne. L'échelle MEGGA X
   * n'est pas régulière dans sa moitié claire ; le clair ne marche que parce que
   * `n100/n500/n700` tombe sur trois crans bien espacés (3,70 / 3,47).
   *
   * Des trois triplets dérivés qui tiennent, `n800/n600/n500` est le plus
   * régulier — pas de 2,15 et 2,21, soit la régularité du clair. Le prix est
   * assumé : « Sécurisé » n'est plus le blanc pur mais `n800`.
   * Gardé par `tests/unit/mobile-palette.spec.ts`.
   */
  const ramp: Record<string, string> = tk.mode === 'dark'
    ? { secured: MXC_COLOR.n800, probable: MXC_COLOR.n600, possible: MXC_COLOR.n500 }
    : { secured: MXC_COLOR.n100, probable: MXC_COLOR.n500, possible: MXC_COLOR.n700 }
  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--crm-space-lg)', marginBottom: 11, padding: '0 var(--crm-space-2xs)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.4 }}>{t('analytics.composition.title')}</h3>
        {total > 0 ? <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{noCHF(axCHF(total))}</span> : null}
      </div>
      {total === 0 ? (
        <EmptyRow text={t('analytics.composition.empty')} tk={tk} />
      ) : (
        <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-3xl)', boxShadow: tk.shadowSm, padding: 'var(--crm-space-3xl) var(--crm-space-2xl) var(--crm-space-md)' }}>
          <div style={{ display: 'flex', height: 14, borderRadius: 'var(--crm-radius-pill)', overflow: 'hidden', gap: 'var(--crm-space-2xs)', marginBottom: 14 }}>
            {d.composition.map((c, i) => (
              <div key={i} style={{ width: `${(c.v / total) * 100}%`, background: ramp[c.k], transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
            ))}
          </div>
          {d.composition.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-lg) var(--crm-space-xs)', boxShadow: i === d.composition.length - 1 ? 'none' : `inset 0 -1px 0 ${tk.hair}` }}>
              <span style={{ width: 11, height: 11, borderRadius: 'var(--crm-radius-xs)', background: ramp[c.k], flexShrink: 0, boxShadow: c.k === 'possible' ? `inset 0 0 0 1px ${tk.ghost}` : 'none' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink }}>{c.label}</div>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted }}>{c.hint}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{noCHF(axCHF(c.v))}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted, fontVariantNumeric: 'tabular-nums' }}>{Math.round((c.v / total) * 100)} %</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sources des leads (comm toujours 0 en prod → on montre le volume) ────
/** Sources des leads classées par volume — la commission par source valant toujours 0 en prod, on affiche le nombre de deals. */
function Sources({ d, t, tk }: { d: AxPeriodData; t: TFunction; tk: MobileTokens }) {
  const opac = [1, 0.72, 0.52, 0.38, 0.28]
  return (
    <div style={{ marginTop: 24 }}>
      <h3 style={{ margin: '0 0 3px', fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: tk.ink, letterSpacing: -0.4, padding: '0 var(--crm-space-2xs)' }}>{t('analytics.sources.title')}</h3>
      <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, padding: '0 var(--crm-space-2xs)', marginBottom: 11 }}>{t('mobile.analytics.sourcesSubtitle')}</div>
      {d.sources.length === 0 ? (
        <EmptyRow text={t('analytics.sources.empty')} tk={tk} />
      ) : (
        <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-3xl)', boxShadow: tk.shadowSm, padding: 'var(--crm-space-md) var(--crm-space-2xl)' }}>
          {d.sources.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-lg) 0', boxShadow: i === d.sources.length - 1 ? 'none' : `inset 0 -1px 0 ${tk.hair}` }}>
              <span style={{ width: 16, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                <div style={{ height: 7, borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, overflow: 'hidden', marginTop: 6 }}>
                  <div style={{ height: '100%', width: `${s.pct}%`, background: tk.ink, opacity: opac[i] ?? 0.3, borderRadius: 'var(--crm-radius-pill)', transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 64 }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{s.deals}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: tk.muted }}>{t('analytics.sources.leadCount', { count: s.deals })} · {s.pct}%</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── États / atomes partagés ──────────────────────────────────────────────
/** Carte « vide » générique : une ligne de texte centrée. */
function EmptyRow({ text, tk }: { text: string; tk: MobileTokens }) {
  return (
    <div style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-3xl)', boxShadow: tk.shadowSm, padding: 'var(--crm-space-6xl) var(--crm-space-4xl)', textAlign: 'center', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.muted }}>{text}</div>
  )
}

/** Placeholder de chargement (hero + trajectoire + grille KPI). */
function Skeleton({ tk }: { tk: MobileTokens }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)', marginTop: 18 }}>
      <div style={{ height: 190, borderRadius: 'var(--crm-radius-5xl)', background: tk.cardSubtle, boxShadow: tk.shadowSm }} />
      <div style={{ height: 180, borderRadius: 'var(--crm-radius-3xl)', background: tk.cardSubtle, boxShadow: tk.shadowSm }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-lg)' }}>
        {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 86, borderRadius: 'var(--crm-radius-2xl)', background: tk.cardSubtle, boxShadow: tk.shadowSm }} />)}
      </div>
    </div>
  )
}

/** Carte d'erreur avec bouton « réessayer » (échec du fetch). */
function ErrorCard({ t, tk, onRetry }: { t: TFunction; tk: MobileTokens; onRetry: () => void }) {
  return (
    <div style={{ marginTop: 24, textAlign: 'center', padding: '40px 24px', background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
      <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: tk.ink }}>{t('analytics.error.title')}</div>
      <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.muted, marginTop: 6, lineHeight: 1.45, maxWidth: 280, marginInline: 'auto' }}>{t('analytics.error.body')}</div>
      <button type="button" onClick={onRetry} style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.accent, color: tk.accentInk }}>{t('analytics.error.retry')}</button>
    </div>
  )
}

// Vrai état « aucune donnée » (chargement OK, pas d'erreur, mais data null =
// agence absente / payload vide). On NE prétend PAS qu'un objectif manque (ça,
// c'est géré dans le Hero avec un d non-null) : message honnête + réessayer.
function NoData({ t, tk, onRetry }: { t: TFunction; tk: MobileTokens; onRetry: () => void }) {
  return (
    <div style={{ marginTop: 24, textAlign: 'center', padding: '40px 24px', background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
      <div style={{ width: 52, height: 52, borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
        <MEIcon name="trending-up" size={24} color={tk.muted} strokeWidth={1.8} />
      </div>
      <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink, marginTop: 14 }}>{t('mobile.analytics.noData')}</div>
      <button type="button" onClick={onRetry} style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: tk.accent, color: tk.accentInk }}>{t('analytics.error.retry')}</button>
    </div>
  )
}
