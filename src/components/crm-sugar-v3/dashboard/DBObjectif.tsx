// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — Étage 3 : OBJECTIF
// Port pixel-près de sprint-4/crm-dashboard-objectif.jsx
// + sprint-4/crm-dashboard-objectif-graph.jsx (V2 — Cône d'incertitude).
//
// Graph SVG 760×320 avec :
// — Cône d'incertitude rempli entre lowCurve/highCurve, opacité 7 %
// — Ligne réelle pleine noire + dots + glow vert "aujourd'hui"
// — Ligne projection dashed selon scénario (Prudent / Médian / Agressif)
// — Ligne objectif dashed + label
// — 3 cartes secondaires : Leviers / Jalons / Nudges

import { useState } from 'react'
import { DB_SP, dbFmtCHF, dbFmtK, dbFmtTarget } from './tokens'
import {
  OV_DATA,
  OV_MILESTONES,
  OV_SCENARIOS_FACTORS,
  objMapPeriod,
  type ObjectifDataset,
  type PeriodKey,
  type ScenarioKey,
} from './data'
import { useDashboardObjectif } from '@/hooks/useDashboardObjectif'

// ─── Données locales : leviers + nudges (statiques pour V1) ────────────
const OBJ_LEVERS = [
  {
    n: 'Volume de mandats',
    cur: '8',
    ref: 'vs 6 (T1)',
    gain: '+2 mandats',
    action: 'Activer 3 prospects vendeurs',
  },
  {
    n: 'Ticket moyen',
    cur: '1.42 M',
    ref: 'vs 1.18 M (T1)',
    gain: '+20 %',
    action: 'Pousser segment haut de gamme',
  },
  {
    n: 'Taux conversion',
    cur: '34 %',
    ref: 'vs 28 % (T1)',
    gain: '+6 pts',
    action: 'Lancer la session de relance',
  },
]

const OBJ_NUDGES = [
  {
    emph: true,
    title: 'Cible 2 visites de plus.',
    desc: 'Ton ticket moyen est très haut. Une visite supplémentaire ≈ CHF 18 k de commission espérée.',
    cta: 'Voir leads à relancer',
  },
  {
    title: "Tu prends 3 jours d'avance.",
    desc: 'À ce rythme tu finis à 104 % de l\'objectif. Vise 108 % en accélérant les KYC.',
  },
  {
    title: 'Réseau parrainage à activer.',
    desc: 'Tes recommandations convertissent à 52 %. Demande 3 intros à tes 5 derniers vendeurs.',
  },
]

// ─── Header dynamique ──────────────────────────────────────────────────
function ObjectifHeader({ d, endVal }: { d: ObjectifDataset; endVal: number }) {
  const overshootPct = ((endVal - d.target) / d.target) * 100
  const ahead = overshootPct >= 0
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 4,
        padding: '0 4px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: DB_SP.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          Trajectoire · {d.label}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            color: DB_SP.ink,
            letterSpacing: -0.7,
            lineHeight: 1.1,
          }}
        >
          Atterrissage projeté{' '}
          <span style={{ color: ahead ? DB_SP.ok : DB_SP.warn }}>
            {ahead ? '+' : ''}
            {overshootPct.toFixed(0)} %
          </span>{' '}
          vs objectif.
        </h2>
      </div>
    </header>
  )
}

// ─── Sélecteur scénario (Prudent / Médian / Agressif) ─────────────────
function ObjScenarioPill({
  scenario,
  setScenario,
}: {
  scenario: ScenarioKey
  setScenario: (s: ScenarioKey) => void
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        borderRadius: 999,
        background: DB_SP.cardSubtle,
        boxShadow: `inset 0 0 0 1px ${DB_SP.hairline}`,
      }}
    >
      {OV_SCENARIOS_FACTORS.map((o) => {
        const active = scenario === o.v
        return (
          <button
            key={o.v}
            onClick={() => setScenario(o.v)}
            style={{
              height: 30,
              padding: '0 12px',
              borderRadius: 999,
              border: 0,
              background: active ? DB_SP.black : 'transparent',
              color: active ? '#fff' : DB_SP.inkSoft,
              fontFamily: 'inherit',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: -0.1,
              boxShadow: active ? '0 4px 12px rgba(11,12,14,0.20)' : 'none',
              transition: 'all .18s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {o.l}
          </button>
        )
      })}
    </div>
  )
}

// ─── Graph SVG cône d'incertitude ──────────────────────────────────────
function ObjGraph({
  period,
  scenario,
}: {
  period: 'month' | 'quarter' | 'year'
  scenario: ScenarioKey
}) {
  const d = OV_DATA[period]
  if (!d) return null

  const W = 760
  const H = 320
  const padL = 64
  const padR = 32
  const padT = 44
  const padB = 40
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const totalX = d.xLabels.length
  const realIdx = d.realIdx

  const maxY = Math.max(d.target, d.high) * 1.08
  const xAt = (i: number): number => padL + (i / (totalX - 1)) * innerW
  const yAt = (v: number): number => padT + (1 - v / maxY) * innerH
  const targetY = yAt(d.target)

  const realPts = d.real.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')

  const factor = OV_SCENARIOS_FACTORS.find((s) => s.v === scenario)!
  const projCurve = d[factor.curve] || d.median
  const projPts = projCurve.map((v, i) => `${xAt(realIdx + i)},${yAt(v)}`).join(' ')

  const lowPts = d.lowCurve.map((v, i) => `${xAt(realIdx + i)},${yAt(v)}`)
  const highPts = d.highCurve.map((v, i) => `${xAt(realIdx + i)},${yAt(v)}`)
  const conePath = `M ${lowPts.join(' L ')} L ${[...highPts].reverse().join(' L ')} Z`

  const step = period === 'year' ? 300000 : period === 'quarter' ? 100000 : 40000
  const ticks: number[] = []
  for (let v = 0; v <= maxY; v += step) ticks.push(v)

  const xTickEvery = period === 'month' ? 5 : 1

  const endVal = projCurve[projCurve.length - 1]
  const todayX = xAt(realIdx)
  const todayY = yAt(d.real[d.real.length - 1])
  const endX = xAt(totalX - 1)
  const endY = yAt(endVal)
  const overshootPct = ((endVal - d.target) / d.target) * 100

  return (
    <div style={{ overflow: 'visible' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        {ticks.map((y, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={W - padR}
              y1={yAt(y)}
              y2={yAt(y)}
              stroke={DB_SP.hairline}
              strokeWidth="1"
            />
            <text
              x={padL - 10}
              y={yAt(y) + 4}
              fontSize="10"
              fontWeight="700"
              fill={DB_SP.muted}
              textAnchor="end"
              fontFamily="Inter Tight"
            >
              {y === 0 ? '0' : dbFmtK(y)}
            </text>
          </g>
        ))}

        {/* Cône d'incertitude (low → high) */}
        <path d={conePath} fill={DB_SP.black} opacity="0.07" />
        <polyline
          points={lowPts.join(' ')}
          fill="none"
          stroke={DB_SP.black}
          strokeWidth="1"
          strokeDasharray="2,3"
          opacity="0.18"
        />
        <polyline
          points={highPts.join(' ')}
          fill="none"
          stroke={DB_SP.black}
          strokeWidth="1"
          strokeDasharray="2,3"
          opacity="0.18"
        />

        {/* Ligne objectif (horizontale dashed + label) */}
        <line
          x1={padL}
          x2={W - padR}
          y1={targetY}
          y2={targetY}
          stroke={DB_SP.black}
          strokeWidth="1.4"
          strokeDasharray="5,5"
          opacity="0.55"
        />
        <text
          x={W - padR}
          y={targetY - 8}
          fontSize="10"
          fontWeight="800"
          fill={DB_SP.ink}
          textAnchor="end"
          fontFamily="Inter Tight"
          letterSpacing="0.5"
        >
          OBJECTIF · {dbFmtTarget(d.target)}
        </text>

        {/* Vertical aujourd'hui */}
        <line
          x1={todayX}
          x2={todayX}
          y1={padT}
          y2={padT + innerH}
          stroke={DB_SP.muted}
          strokeWidth="1"
          strokeDasharray="2,4"
          opacity="0.5"
        />
        <text
          x={todayX + 6}
          y={padT + 14}
          fontSize="9.5"
          fontWeight="800"
          fill={DB_SP.ink}
          fontFamily="Inter Tight"
          letterSpacing="0.6"
        >
          AUJOURD'HUI
        </text>

        {/* Aire sous la courbe réelle */}
        <polygon
          points={`${padL},${padT + innerH} ${realPts} ${todayX},${padT + innerH}`}
          fill={DB_SP.black}
          opacity="0.06"
        />

        {/* Ligne réelle */}
        <polyline
          points={realPts}
          fill="none"
          stroke={DB_SP.black}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Ligne projection scénario */}
        <polyline
          points={projPts}
          fill="none"
          stroke={DB_SP.black}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5,5"
          opacity="0.7"
        />

        {/* Points sur ligne réelle */}
        {d.real.map((v, i) =>
          i % Math.max(1, Math.floor(d.real.length / 6)) === 0 || i === d.real.length - 1 ? (
            <circle key={i} cx={xAt(i)} cy={yAt(v)} r="3.5" fill={DB_SP.black} stroke="#fff" strokeWidth="2" />
          ) : null,
        )}

        {/* Cercle pulsant aujourd'hui */}
        <circle cx={todayX} cy={todayY} r="9" fill="none" stroke={DB_SP.black} strokeWidth="2" opacity="0.2">
          <animate attributeName="r" values="8;14;8" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2.4s" repeatCount="indefinite" />
        </circle>
        <circle cx={todayX} cy={todayY} r="6.5" fill={DB_SP.black} stroke="#fff" strokeWidth="3" />

        {/* Point projection finale */}
        <circle cx={endX} cy={endY} r="5" fill="#fff" stroke={DB_SP.black} strokeWidth="2.4" />
        <text
          x={endX - 6}
          y={endY - 12}
          fontSize="11"
          fontWeight="800"
          fill={overshootPct >= 0 ? DB_SP.ok : DB_SP.warn}
          textAnchor="end"
          fontFamily="Inter Tight"
        >
          {dbFmtCHF(endVal)}
        </text>

        {/* Labels X */}
        {d.xLabels.map((l, i) => {
          const visible = i % xTickEvery === 0 || i === totalX - 1 || i === realIdx
          if (!visible) return null
          const isToday = i === realIdx
          return (
            <text
              key={i}
              x={xAt(i)}
              y={H - 12}
              fontSize="10"
              fontWeight={isToday ? 800 : 600}
              fill={isToday ? DB_SP.ink : DB_SP.muted}
              textAnchor="middle"
              fontFamily="Inter Tight"
            >
              {l}
            </text>
          )
        })}
      </svg>
    </div>
  )
}

// ─── Carte Leviers ─────────────────────────────────────────────────────
function ObjectifLeviersCard() {
  return (
    <div
      style={{
        background: DB_SP.card,
        borderRadius: 24,
        padding: 26,
        boxShadow: DB_SP.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 0,
        animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) .12s both',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: DB_SP.muted,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Les 3 leviers
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: DB_SP.ink,
            letterSpacing: -0.4,
          }}
        >
          Comment tu progresses.
        </h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {OBJ_LEVERS.map((l, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: '12px 14px',
              borderRadius: 14,
              background: DB_SP.cardSubtle,
              cursor: 'pointer',
              transition: 'background .15s ease',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.background = '#EEF0F4'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.background = DB_SP.cardSubtle
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: DB_SP.ink,
                  letterSpacing: -0.1,
                  lineHeight: 1.3,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                {l.n}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: DB_SP.pill.ok.fg,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: DB_SP.pill.ok.bg,
                  boxShadow: DB_SP.pill.ok.shadow,
                  letterSpacing: -0.1,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {l.gain}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: DB_SP.ink,
                  letterSpacing: -0.5,
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {l.cur}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: DB_SP.muted, whiteSpace: 'nowrap' }}>
                {l.ref}
              </span>
            </div>
            <button
              style={{
                alignSelf: 'flex-start',
                height: 28,
                padding: '0 12px',
                borderRadius: 999,
                border: 0,
                background: DB_SP.black,
                color: '#fff',
                fontFamily: 'inherit',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: -0.1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                whiteSpace: 'nowrap',
              }}
            >
              {l.action}
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Carte Jalons (T1/T2/T3/T4 ou Avril/Mai/Juin selon période) ───────
function ObjectifJalonsCard({
  period,
  milestones,
}: {
  period: 'month' | 'quarter' | 'year'
  milestones?: import('./data').Milestone[]
}) {
  const resolvedMilestones = milestones ?? OV_MILESTONES[period] ?? OV_MILESTONES.year
  const unitLabel = period === 'month' ? 'Semaines' : period === 'quarter' ? 'Mois' : 'Trimestres'
  return (
    <div
      style={{
        background: DB_SP.card,
        borderRadius: 24,
        padding: 26,
        boxShadow: DB_SP.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 0,
        animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) .15s both',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: DB_SP.muted,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Jalons · {unitLabel}
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: DB_SP.ink,
            letterSpacing: -0.4,
          }}
        >
          Étapes vers le sommet.
        </h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {resolvedMilestones.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 14px',
              borderRadius: 14,
              background: m.current ? DB_SP.black : DB_SP.cardSubtle,
              color: m.current ? '#fff' : DB_SP.ink,
              boxShadow: m.current ? '0 6px 18px rgba(11,12,14,0.18)' : 'none',
              transition: 'all .2s ease',
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                flexShrink: 0,
                background: m.done ? DB_SP.ok : m.current ? 'rgba(255,255,255,0.15)' : '#fff',
                color: m.done ? '#fff' : m.current ? '#fff' : DB_SP.muted,
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: -0.2,
                boxShadow: !m.done && !m.current ? DB_SP.shadowSm : 'none',
              }}
            >
              {m.done ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 13 4 4 10-12" />
                </svg>
              ) : (
                m.title
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.1 }}>
                {m.title}{' '}
                <span style={{ fontWeight: 500, opacity: m.current ? 0.7 : 0.6, fontSize: 11.5 }}>
                  · {m.status}
                </span>
              </div>
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 500,
                  color: m.current ? 'rgba(255,255,255,0.7)' : DB_SP.muted,
                  marginTop: 2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {m.value != null ? dbFmtCHF(m.value) : `≈ ${dbFmtCHF(m.valueProjected ?? 0)}`}{' '}
                <span style={{ opacity: 0.7 }}>sur {dbFmtCHF(m.target)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Carte Nudges ──────────────────────────────────────────────────────
function ObjectifNudgesCard({ period }: { period: 'month' | 'quarter' | 'year' }) {
  const cadence =
    period === 'month' ? 'du jour' : period === 'quarter' ? 'de la semaine' : 'de la quinzaine'
  return (
    <div
      style={{
        background: DB_SP.card,
        borderRadius: 24,
        padding: 26,
        boxShadow: DB_SP.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 0,
        animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) .18s both',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: 999,
              background: DB_SP.black,
              color: '#fff',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            MEGGA AI
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: DB_SP.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Nudges
          </span>
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: DB_SP.ink,
            letterSpacing: -0.4,
          }}
        >
          Micro-actions {cadence}.
        </h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {OBJ_NUDGES.map((n, i) => (
          <div
            key={i}
            style={{
              background: n.emph ? DB_SP.cardSubtle : 'transparent',
              borderRadius: 14,
              padding: n.emph ? '14px 16px' : '10px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              borderTop: !n.emph && i > 0 ? `1px solid ${DB_SP.hairline}` : 'none',
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: DB_SP.ink,
                letterSpacing: -0.2,
                lineHeight: 1.35,
              }}
            >
              {n.title}
            </span>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 500,
                color: DB_SP.inkSoft,
                lineHeight: 1.5,
              }}
            >
              {n.desc}
            </p>
            {n.emph && n.cta && (
              <button
                style={{
                  alignSelf: 'flex-start',
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: 0,
                  background: DB_SP.black,
                  color: '#fff',
                  fontFamily: 'inherit',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  letterSpacing: -0.1,
                  whiteSpace: 'nowrap',
                  marginTop: 4,
                }}
              >
                {n.cta}
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── DBObjectif (étage 3 complet) ──────────────────────────────────────
export function DBObjectif({ period: shellPeriod }: { period: PeriodKey }) {
  const period = objMapPeriod(shellPeriod)
  const [scenario, setScenario] = useState<ScenarioKey>('median')

  // Source de vérité : Supabase via useDashboardObjectif.
  // Fallback fixture OV_DATA pendant le chargement initial.
  // Sprint C : milestones live (T1/T2/T3/T4, mois, semaines) dérivées du
  // target proportionnel + real[] + median[].
  const { data: liveData, milestones: liveMilestones } = useDashboardObjectif(shellPeriod)
  const d = liveData ?? OV_DATA[period]
  const milestones = liveMilestones.length > 0 ? liveMilestones : OV_MILESTONES[period] ?? OV_MILESTONES.year
  const factor = OV_SCENARIOS_FACTORS.find((s) => s.v === scenario)!
  const projCurve = d[factor.curve] || d.median
  const endVal = projCurve[projCurve.length - 1]

  return (
    <section
      style={{
        maxWidth: 1320,
        margin: '0 auto',
        padding: '0 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <ObjectifHeader d={d} endVal={endVal} />

      {/* Big graph card */}
      <div
        style={{
          background: DB_SP.card,
          borderRadius: 28,
          padding: 32,
          boxShadow: DB_SP.shadowLg,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 14,
                background: DB_SP.cardSubtle,
                minWidth: 130,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: DB_SP.muted,
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                }}
              >
                Réalisé
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: DB_SP.ink,
                  letterSpacing: -0.5,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {dbFmtCHF(d.realized)}
              </div>
            </div>
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 14,
                background: DB_SP.cardSubtle,
                minWidth: 130,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: DB_SP.muted,
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                }}
              >
                Projeté médian
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: DB_SP.ink,
                  letterSpacing: -0.5,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {dbFmtCHF(d.projected)}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: DB_SP.muted,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {dbFmtK(d.low)} – {dbFmtK(d.high)}
              </div>
            </div>
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 14,
                background: DB_SP.cardSubtle,
                minWidth: 130,
              }}
            >
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  color: DB_SP.muted,
                  letterSpacing: 0.7,
                  textTransform: 'uppercase',
                }}
              >
                Objectif
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: DB_SP.ink,
                  letterSpacing: -0.5,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {dbFmtTarget(d.target)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div
              style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: DB_SP.muted,
                letterSpacing: 0.7,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Scénario
            </div>
            <ObjScenarioPill scenario={scenario} setScenario={setScenario} />
          </div>
        </div>

        <ObjGraph period={period} scenario={scenario} />

        {/* Legend + scénario explication */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 22,
            paddingTop: 14,
            borderTop: `1px solid ${DB_SP.hairline}`,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              <span style={{ width: 18, height: 3, background: DB_SP.black, borderRadius: 2 }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: DB_SP.inkSoft }}>Réalisé</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              <span
                style={{
                  width: 18,
                  height: 2.5,
                  background: `repeating-linear-gradient(to right, ${DB_SP.black} 0 4px, transparent 4px 8px)`,
                  opacity: 0.7,
                  borderRadius: 2,
                }}
              />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: DB_SP.inkSoft }}>
                Projection ({factor.l.toLowerCase()})
              </span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
              <span
                style={{
                  width: 18,
                  height: 10,
                  background: DB_SP.black,
                  opacity: 0.07,
                  borderRadius: 3,
                }}
              />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: DB_SP.inkSoft }}>
                Intervalle de confiance
              </span>
            </div>
          </div>
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 500,
              color: DB_SP.muted,
              maxWidth: 360,
              textAlign: 'right',
              lineHeight: 1.4,
            }}
          >
            {factor.desc}
          </span>
        </div>
      </div>

      {/* 3 cartes secondaires */}
      <div className="db-objectif-cards-grid">
        <ObjectifLeviersCard />
        <ObjectifJalonsCard period={period} milestones={milestones} />
        <ObjectifNudgesCard period={period} />
      </div>
    </section>
  )
}
