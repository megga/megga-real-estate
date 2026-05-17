// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — Étage 1 : COCKPIT
// Port pixel-près de sprint-4/crm-dashboard-cockpit.jsx (variante C — Vitals
// reconstruits). Hero adaptatif 4 tons + 4 cartes décompo + stats supports
// + coach IA.

import { useState } from 'react'
import { DB_SP, dbFmtCHF, dbFmtTarget } from './tokens'
import {
  CK_DECOMP_STAGES,
  CK_DATA,
  ckMapPeriod,
  ckTone,
  type CockpitDataset,
  type CockpitTone,
  type DecompStage,
  type PeriodKey,
} from './data'

// ─── Hero adaptatif pleine largeur ─────────────────────────────────────
function CockpitHero({ data, tone }: { data: CockpitDataset; tone: CockpitTone }) {
  const ratio = data.projected / data.target
  const ratioPct = Math.round(ratio * 100)
  const gap = Math.max(0, data.target - data.projected)
  const over = Math.max(0, data.projected - data.target)
  const ahead = data.projected >= data.target

  return (
    <div
      style={{
        background: DB_SP.card,
        borderRadius: 28,
        padding: '32px 36px',
        boxShadow: DB_SP.shadowLg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 32,
        flexWrap: 'wrap',
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      {/* LEFT — tone + chiffre + delta + copy adaptatif */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          minWidth: 0,
          flex: '1 1 380px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: tone.pill.bg,
              color: tone.pill.fg,
              boxShadow: tone.pill.shadow,
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.7,
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: 999, background: tone.pill.dot }} />
            {tone.kicker}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: DB_SP.muted,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Commission projetée · {data.short}
          </span>
        </div>

        <div>
          <div
            style={{
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: -2.6,
              color: DB_SP.ink,
              lineHeight: 0.95,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {dbFmtCHF(data.projected)}
          </div>
          <div
            style={{
              marginTop: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 11px',
                borderRadius: 999,
                background: DB_SP.pill.ok.bg,
                color: DB_SP.pill.ok.fg,
                boxShadow: DB_SP.pill.ok.shadow,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: -0.1,
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 15l7-7 7 7" />
              </svg>
              +{data.deltaPct} % {data.compareLabel}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: DB_SP.muted,
                whiteSpace: 'nowrap',
              }}
            >
              objectif {dbFmtTarget(data.target)}
            </span>
          </div>
        </div>

        <div
          style={{
            fontSize: 14.5,
            fontWeight: 600,
            color: tone.color,
            lineHeight: 1.4,
            letterSpacing: -0.2,
            maxWidth: 460,
          }}
        >
          {tone.title}
        </div>
      </div>

      {/* RIGHT — barre de progression */}
      <div
        style={{
          flex: '0 0 380px',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: DB_SP.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            Avancement vs objectif
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: tone.color,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {ratioPct} %
          </span>
        </div>
        <div
          style={{
            height: 14,
            borderRadius: 999,
            background: DB_SP.cardSubtle,
            position: 'relative',
            overflow: 'visible',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${Math.min(100, ratioPct)}%`,
              background: tone.color,
              borderRadius: 999,
              transformOrigin: 'left center',
              animation: 'sgGrow 1s cubic-bezier(.2,.8,.2,1) both',
              boxShadow: `0 2px 8px ${tone.color}55`,
            }}
          />
          {ahead && over > 0 && (
            <div
              style={{
                position: 'absolute',
                left: '100%',
                top: 0,
                bottom: 0,
                width: `${Math.min(40, (over / data.target) * 100)}%`,
                background: `repeating-linear-gradient(45deg, ${tone.color} 0 5px, ${tone.color}88 5px 10px)`,
                borderRadius: '0 999px 999px 0',
              }}
            />
          )}
          <div
            style={{
              position: 'absolute',
              left: '100%',
              top: -6,
              bottom: -6,
              width: 3,
              background: DB_SP.ink,
              transform: 'translateX(-1.5px)',
              borderRadius: 2,
            }}
          />
        </div>
        <div
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: DB_SP.inkSoft,
            lineHeight: 1.5,
          }}
        >
          {ahead ? (
            <>
              Tu dépasses de{' '}
              <strong style={{ color: tone.color, fontWeight: 800 }}>{dbFmtCHF(over)}</strong>.
              Reste{' '}
              <strong style={{ color: DB_SP.ink, fontWeight: 700 }}>
                {data.daysLeft} jours
              </strong>
              .
            </>
          ) : (
            <>
              Il te reste{' '}
              <strong style={{ color: DB_SP.ink, fontWeight: 700 }}>{dbFmtCHF(gap)}</strong> en{' '}
              <strong style={{ color: DB_SP.ink, fontWeight: 700 }}>
                {data.daysLeft} jours
              </strong>{' '}
              pour boucler.
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Carte décompo (4 tranches de revenu) ──────────────────────────────
interface DecompCardProps {
  k: number
  stage: DecompStage
  amount: number
  total: number
  dealsCount: number
  contributors: Array<{ name: string }>
  onClick?: () => void
}

function CockpitDecompCard({
  k,
  stage,
  amount,
  total,
  dealsCount,
  contributors,
  onClick,
}: DecompCardProps) {
  const [hover, setHover] = useState(false)
  const pct = Math.round((amount / total) * 100)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'left',
        border: 0,
        fontFamily: 'inherit',
        background: DB_SP.card,
        borderRadius: 22,
        padding: 22,
        boxShadow: hover
          ? '0 16px 40px rgba(11,12,14,0.10), 0 4px 12px rgba(11,12,14,0.06)'
          : DB_SP.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0,
        cursor: 'pointer',
        animation: `sgFadeUp .5s cubic-bezier(.2,.8,.2,1) ${0.1 + k * 0.06}s both`,
        transition: 'all .2s ease',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: stage.color,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: stage.color,
              flexShrink: 0,
            }}
          />
          {stage.label}
        </span>
        <span
          style={{
            padding: '3px 9px',
            borderRadius: 999,
            background: DB_SP.cardSubtle,
            color: DB_SP.inkSoft,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {stage.certainty}
        </span>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: -1.1,
              color: DB_SP.ink,
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {dbFmtCHF(amount)}
          </span>
        </div>
        <div
          style={{
            marginTop: 6,
            fontSize: 11.5,
            fontWeight: 600,
            color: DB_SP.muted,
            letterSpacing: -0.1,
          }}
        >
          {dealsCount} deal{dealsCount > 1 ? 's' : ''} · {pct} % du total
        </div>
      </div>

      <div
        style={{
          height: 4,
          borderRadius: 999,
          background: DB_SP.cardSubtle,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: stage.color,
            borderRadius: 999,
            transformOrigin: 'left',
            animation: `sgGrow .9s cubic-bezier(.2,.8,.2,1) ${0.3 + k * 0.08}s both`,
          }}
        />
      </div>

      <div
        style={{
          fontSize: 11.5,
          fontWeight: 500,
          color: DB_SP.inkSoft,
          lineHeight: 1.4,
        }}
      >
        {stage.hint}
        {contributors && contributors.length > 0 && (
          <>
            {' '}·{' '}
            <strong style={{ fontWeight: 700, color: DB_SP.ink }}>
              {contributors[0].name.split(' · ')[0]}
            </strong>
            {contributors.length > 1 ? ` + ${contributors.length - 1}` : ''}
          </>
        )}
      </div>

      <div
        style={{
          marginTop: 'auto',
          paddingTop: 8,
          borderTop: `1px solid ${DB_SP.hairline}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: hover ? DB_SP.ink : DB_SP.muted,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            transition: 'color .15s ease',
          }}
        >
          → Pipeline · {stage.label}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={hover ? DB_SP.ink : DB_SP.muted}
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transition: 'stroke .15s ease, transform .15s ease',
            transform: hover ? 'translateX(3px)' : 'translateX(0)',
          }}
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </button>
  )
}

// ─── Stats supports (anciens vitals demotés) ───────────────────────────
function CockpitSupportStats({ data, onClickStat }: { data: CockpitDataset; onClickStat?: (id: string) => void }) {
  const v = data.vitals
  const stats: Array<{
    id: string
    label: string
    value: string
    sub?: string
    delta: { v: number; s: string; invert?: boolean } | null
  }> = [
    { id: 'deals', label: 'Deals actifs', value: String(v.deals), sub: 'deals', delta: { v: v.deltaDeals, s: '%' } },
    { id: 'conversion', label: 'Taux conversion', value: v.conversion, delta: { v: v.deltaConv, s: ' pts' } },
    { id: 'velocity', label: 'Vélocité', value: String(v.velocity), sub: 'jours', delta: { v: v.deltaVel, s: ' j', invert: true } },
    {
      id: 'kyc',
      label: 'KYC à risque',
      value: String(v.kycRisk),
      sub: 'vendeurs',
      delta: v.kycUrgent > 0 ? { v: v.kycUrgent, s: ' urgent', invert: true } : null,
    },
  ]
  return (
    <div
      style={{
        background: DB_SP.card,
        borderRadius: 22,
        padding: '18px 24px',
        boxShadow: DB_SP.shadow,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) .18s both',
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: DB_SP.muted,
          letterSpacing: 0.7,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        Stats supports
      </span>
      <div style={{ width: 1, alignSelf: 'stretch', background: DB_SP.hairline }} />
      {stats.map((s, i) => {
        const isNegative = s.delta && (s.delta.invert ? s.delta.v > 0 : s.delta.v < 0)
        return (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
            <button
              onClick={() => onClickStat?.(s.id)}
              style={{
                border: 0,
                background: 'transparent',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'baseline',
                gap: 8,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span style={{ fontSize: 11.5, fontWeight: 600, color: DB_SP.muted, whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
              <span
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: DB_SP.ink,
                  letterSpacing: -0.4,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.value}
              </span>
              {s.sub && (
                <span style={{ fontSize: 11, fontWeight: 600, color: DB_SP.muted, whiteSpace: 'nowrap' }}>
                  {s.sub}
                </span>
              )}
              {s.delta && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: isNegative ? DB_SP.pill.danger.bg : DB_SP.pill.ok.bg,
                    color: '#fff',
                    boxShadow: isNegative ? DB_SP.pill.danger.shadow : DB_SP.pill.ok.shadow,
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: -0.1,
                    whiteSpace: 'nowrap',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={s.delta.v > 0 ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} />
                  </svg>
                  {s.delta.v > 0 ? '+' : ''}
                  {s.delta.v}
                  {s.delta.s || '%'}
                </span>
              )}
            </button>
            {i < stats.length - 1 && (
              <div style={{ width: 1, alignSelf: 'stretch', background: DB_SP.hairline, marginLeft: 12 }} />
            )}
          </span>
        )
      })}
    </div>
  )
}

// ─── Coach IA (carte noire CTA) ────────────────────────────────────────
function CockpitCoachBand({ data, onCta }: { data: CockpitDataset; onCta?: () => void }) {
  const ai = data.aiHint
  return (
    <div
      style={{
        background: DB_SP.black,
        color: '#fff',
        borderRadius: 24,
        padding: '22px 26px',
        boxShadow: '0 24px 60px rgba(11,12,14,0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap',
        animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) .2s both',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          background: 'rgba(255,255,255,0.1)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 4 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 240 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
          <span
            style={{
              padding: '3px 9px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.15)',
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            MEGGA AI · Coach
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{ai.label}</span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: -0.3,
            lineHeight: 1.35,
          }}
        >
          <strong style={{ fontWeight: 800 }}>{ai.title}</strong> {ai.desc}
        </p>
      </div>
      <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={onCta}
          style={{
            height: 40,
            padding: '0 16px',
            borderRadius: 999,
            border: 0,
            background: '#fff',
            color: DB_SP.black,
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            letterSpacing: -0.1,
            whiteSpace: 'nowrap',
          }}
        >
          {ai.cta}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke={DB_SP.black}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <button
          style={{
            height: 40,
            padding: '0 14px',
            borderRadius: 999,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}

// ─── DBCockpit (étage 1 complet) ───────────────────────────────────────
interface DBCockpitProps {
  period: PeriodKey
  onDrilldownStage?: (id: DecompStage['id']) => void
  onDrilldownVital?: (id: string) => void
  onCoachCta?: () => void
}

export function DBCockpit({
  period: shellPeriod,
  onDrilldownStage,
  onDrilldownVital,
  onCoachCta,
}: DBCockpitProps) {
  const period = ckMapPeriod(shellPeriod)
  const data = CK_DATA[period]
  const tone = ckTone(data.projected, data.target, data.periodWord)
  const stages = CK_DECOMP_STAGES

  // Match contributors to stages
  const stageContribMap: Record<DecompStage['id'], Array<{ name: string }>> = {
    signed: [],
    compromis: data.contributors.filter((c) => c.stage === 'Compromis'),
    offres: data.contributors.filter((c) => c.stage === 'Offre'),
    pipeline: data.contributors.filter((c) => c.stage === 'Visite'),
  }

  // Deal counts per stage (approx pour la démo)
  const signedCount = Math.max(1, Math.round(data.vitals.deals * 0.25))
  const compromisCount = stageContribMap.compromis.length || 2
  const offresCount = stageContribMap.offres.length || 2
  const dealsPerStage: Record<DecompStage['id'], number> = {
    signed: signedCount,
    compromis: compromisCount,
    offres: offresCount,
    pipeline: Math.max(
      2,
      data.vitals.deals - compromisCount - offresCount - signedCount,
    ),
  }

  const total =
    data.decomp.signed + data.decomp.compromis + data.decomp.offres + data.decomp.pipeline

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
      <CockpitHero data={data} tone={tone} />

      <div className="db-cockpit-decomp-grid">
        {stages.map((s, i) => (
          <CockpitDecompCard
            key={s.id}
            k={i}
            stage={s}
            amount={data.decomp[s.id]}
            total={total}
            dealsCount={dealsPerStage[s.id]}
            contributors={stageContribMap[s.id]}
            onClick={() => onDrilldownStage?.(s.id)}
          />
        ))}
      </div>

      <CockpitSupportStats data={data} onClickStat={onDrilldownVital} />
      <CockpitCoachBand data={data} onCta={onCoachCta} />
    </section>
  )
}
