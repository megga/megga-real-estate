// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — Étage 2 : ENTONNOIR
// Port pixel-près de sprint-4/crm-dashboard-entonnoir.jsx.
//
// Funnel 5 paliers + bottleneck IA + sources de leads + forecast 60/90j.
// Le bottleneck déclenche l'overlay `RelanceSession` (refonte « Aujourd'hui »).

import { useMemo, useState } from 'react'
import { DB_SP, dbFmtCHF } from './tokens'
import { DbIcon } from './icons'
import type { DashboardData, ScenarioKey, SourceItem, ForecastHorizon } from './data'
import { OV_SCENARIOS_FACTORS } from './data'
import { RelanceSession } from '@/components/crm-sugar/today/RelanceSession'

// ─── Mini delta pill (réutilisée funnel + sources) ─────────────────────
// Pilule premium fond solide foncé (vert/bordeaux selon le signe).
function DeltaPill({
  value,
  suffix = '%',
  invert = false,
  size = 'sm',
}: {
  value: number
  suffix?: string
  invert?: boolean
  size?: 'sm' | 'xs'
}) {
  const up = value > 0
  const positive = invert ? !up : up
  const pill = positive ? DB_SP.pill.ok : DB_SP.pill.danger
  const fs = size === 'xs' ? 9.5 : 10.5
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: size === 'xs' ? '1px 6px' : '2px 7px',
        borderRadius: 999,
        background: pill.bg,
        color: pill.fg,
        boxShadow: pill.shadow,
        fontSize: fs,
        fontWeight: 800,
        letterSpacing: -0.1,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <svg
        width={size === 'xs' ? 7 : 8}
        height={size === 'xs' ? 7 : 8}
        viewBox="0 0 24 24"
        fill="none"
        stroke={pill.fg}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={up ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} />
      </svg>
      {up ? '+' : ''}
      {value}
      {suffix}
    </span>
  )
}

// ─── Funnel principal ──────────────────────────────────────────────────
function EntonnoirFunnel({ data }: { data: DashboardData }) {
  const stages = data.funnel
  const endToEnd = ((stages[stages.length - 1].v / stages[0].v) * 100).toFixed(1)
  const heroV = stages[0].v
  const tailV = stages[stages.length - 1].v

  return (
    <div
      style={{
        background: DB_SP.card,
        borderRadius: 28,
        padding: 32,
        boxShadow: DB_SP.shadowLg,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
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
              marginBottom: 8,
            }}
          >
            Funnel de conversion · {data.period.label}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: DB_SP.ink,
              letterSpacing: -0.6,
            }}
          >
            De {heroV} leads à {tailV} compromis signés.
          </h3>
        </div>
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 14,
            background: DB_SP.cardSubtle,
            textAlign: 'right',
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: DB_SP.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            End-to-end
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: DB_SP.ink,
              letterSpacing: -0.6,
              fontVariantNumeric: 'tabular-nums',
              marginTop: 2,
            }}
          >
            {endToEnd} %
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingRight: 72 }}>
        {stages.map((s, i) => {
          const prev = stages[i - 1]
          const dropPct = prev ? Math.round((1 - s.v / prev.v) * 100) : 0
          const isBottleneck = s.bottleneck
          return (
            <div key={i} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ minWidth: 140 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: DB_SP.ink,
                      letterSpacing: -0.2,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      flexWrap: 'wrap',
                    }}
                  >
                    {s.n}
                    {typeof s.delta === 'number' && <DeltaPill value={s.delta} size="xs" />}
                    {isBottleneck && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          background: DB_SP.pill.danger.bg,
                          color: DB_SP.pill.danger.fg,
                          boxShadow: DB_SP.pill.danger.shadow,
                          fontSize: 8.5,
                          fontWeight: 800,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                        }}
                      >
                        Bottleneck
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 500, color: DB_SP.muted, marginTop: 2 }}>
                    {s.desc}
                  </div>
                </div>

                <div style={{ flex: 1, height: 44, position: 'relative', minWidth: 0 }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${s.w}%`,
                      background: s.c,
                      borderRadius: 10,
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: 16,
                      color: '#fff',
                      transition: 'width .4s cubic-bezier(.2,.8,.2,1)',
                      animation: `sgGrow .9s cubic-bezier(.2,.8,.2,1) ${0.1 + i * 0.08}s both`,
                      transformOrigin: 'left',
                      boxShadow: isBottleneck
                        ? `0 0 0 2px ${DB_SP.err}, 0 6px 18px rgba(239,68,68,0.18)`
                        : 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        letterSpacing: -0.4,
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1,
                      }}
                    >
                      {s.v}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        marginLeft: 8,
                        opacity: 0.7,
                        letterSpacing: 0.5,
                        textTransform: 'uppercase',
                      }}
                    >
                      {Math.round((s.v / stages[0].v) * 100)} % des leads
                    </span>
                  </div>

                  {prev && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `calc(${s.w}% + 14px)`,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 800,
                          color: dropPct >= 50 ? DB_SP.err : dropPct >= 35 ? DB_SP.warn : DB_SP.muted,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        −{dropPct} %
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: DB_SP.muted,
                          letterSpacing: 0.4,
                        }}
                      >
                        de perte
                      </span>
                      {typeof s.convDelta === 'number' && (
                        <DeltaPill value={s.convDelta} suffix=" pts" size="xs" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div
        style={{
          marginTop: 4,
          padding: '12px 16px',
          borderRadius: 14,
          background: DB_SP.cardSubtle,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 12,
          fontWeight: 500,
          color: DB_SP.inkSoft,
          lineHeight: 1.5,
        }}
      >
        <DbIcon name="info" size={14} stroke={DB_SP.muted} />
        Une conversion end-to-end de {endToEnd} % te place dans le top 12 % des agents MEGGA en Romandie.
      </div>
    </div>
  )
}

// ─── Bottleneck IA card ────────────────────────────────────────────────
function EntonnoirBottleneck() {
  const [sessionOpen, setSessionOpen] = useState(false)

  return (
    <>
      <div
        style={{
          background: DB_SP.black,
          color: '#fff',
          borderRadius: 28,
          padding: 28,
          boxShadow: '0 24px 60px rgba(11,12,14,0.18)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          minWidth: 0,
          animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) .1s both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.15)',
              fontSize: 9.5,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            MEGGA AI · Bottleneck
          </span>
        </div>

        <h3
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: -0.7,
            lineHeight: 1.15,
          }}
        >
          Tu perds 59 % entre Qualifiés et Visites.
        </h3>

        <p
          style={{
            margin: 0,
            fontSize: 13.5,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.55,
          }}
        >
          92 leads qualifiés n'ont pas pris RDV de visite. Délai moyen de relance actuel : 4,2 j (médiane MEGGA : 1,8 j).
        </p>

        <div
          style={{
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            Session de relance préparée
          </span>
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 700,
              letterSpacing: -0.2,
              lineHeight: 1.4,
            }}
          >
            47 leads dormants · brouillons personnalisés par MEGGA AI · estimé 35 min.
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.55)',
                }}
              >
                Gain attendu
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: '#fff',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: -0.3,
                  whiteSpace: 'nowrap',
                }}
              >
                +9 visites
              </div>
            </div>
            <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.15)' }} />
            <div>
              <div
                style={{
                  fontSize: 9.5,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.55)',
                }}
              >
                Mode
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: '#fff',
                  letterSpacing: -0.3,
                  whiteSpace: 'nowrap',
                }}
              >
                Tu valides chaque envoi
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setSessionOpen(true)}
          style={{
            height: 44,
            borderRadius: 999,
            border: 0,
            background: '#fff',
            color: DB_SP.black,
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: -0.1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 'auto',
            whiteSpace: 'nowrap',
            transition: 'all .2s ease',
          }}
        >
          Commencer la session
          <DbIcon name="arrow" size={13} stroke={DB_SP.black} sw={2.2} />
        </button>
      </div>

      {sessionOpen && <RelanceSession onClose={() => setSessionOpen(false)} />}
    </>
  )
}

// ─── Sources de leads ──────────────────────────────────────────────────
// Slug stable utilisé pour l'URL `/dashboard/contacts?source=<slug>`.
const SOURCE_SLUGS: Record<string, string> = {
  'Marketplace MEGGA': 'marketplace',
  'Site agence': 'agency-site',
  'Recommandations': 'referral',
  'Réseaux sociaux': 'social',
  'Importé manuel': 'manual',
}

function EntonnoirSources({
  data,
  onSourceClick,
}: {
  data: DashboardData
  onSourceClick?: (slug: string, source: SourceItem) => void
}) {
  const sources = data.sources
  const total = sources.reduce((a, s) => a + s.v, 0)
  return (
    <div
      style={{
        background: DB_SP.card,
        borderRadius: 24,
        padding: 26,
        boxShadow: DB_SP.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
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
          Sources de leads · tendance {data.compareLabel}
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
          D'où viennent tes {total} leads.
        </h3>
      </div>

      <div
        style={{
          display: 'flex',
          height: 10,
          borderRadius: 999,
          overflow: 'hidden',
          background: DB_SP.cardSubtle,
        }}
      >
        {sources.map((s, i) => (
          <div
            key={i}
            style={{
              width: `${(s.v / total) * 100}%`,
              background: s.c,
              transformOrigin: 'left',
              animation: `sgGrow .8s cubic-bezier(.2,.8,.2,1) ${0.2 + i * 0.06}s both`,
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {sources.map((s, i) => {
          const slug = SOURCE_SLUGS[s.n] ?? 'unknown'
          return (
            <button
              key={i}
              onClick={() => onSourceClick?.(slug, s)}
              style={{
                border: 0,
                background: 'transparent',
                fontFamily: 'inherit',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 0',
                borderBottom: i < sources.length - 1 ? `1px solid ${DB_SP.hairline}` : 'none',
                cursor: onSourceClick ? 'pointer' : 'default',
                width: '100%',
                transition: 'background-color .15s ease',
              }}
              onMouseEnter={(e) => {
                if (onSourceClick)
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor = DB_SP.cardSubtle
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: s.c,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: DB_SP.ink,
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {s.n}
                {typeof s.delta === 'number' && <DeltaPill value={s.delta} size="xs" />}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: DB_SP.muted,
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 36,
                  textAlign: 'right',
                }}
              >
                {s.v}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: s.hot ? DB_SP.pill.ok.fg : DB_SP.inkSoft,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: s.hot ? DB_SP.pill.ok.bg : DB_SP.cardSubtle,
                  boxShadow: s.hot ? DB_SP.pill.ok.shadow : 'none',
                  fontVariantNumeric: 'tabular-nums',
                  minWidth: 60,
                  textAlign: 'center',
                }}
              >
                {s.conv}% conv.
              </span>
            </button>
          )
        })}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 12,
          fontWeight: 500,
          color: DB_SP.inkSoft,
          lineHeight: 1.5,
          padding: '10px 12px',
          borderRadius: 10,
          background: DB_SP.cardSubtle,
        }}
      >
        Les{' '}
        <strong style={{ color: DB_SP.ink, fontWeight: 700 }}>recommandations</strong> convertissent à
        52 % — ton meilleur canal. Lance une campagne parrainage&nbsp;?
      </div>
    </div>
  )
}

// ─── Forecast 30/60/90j ────────────────────────────────────────────────
// Slug horizon → days range pour le drilldown Pipeline (close date ≤ N j).
const HORIZON_DAYS: Record<string, number> = {
  '30 jours': 30,
  '60 jours': 60,
  '90 jours': 90,
}

function EntonnoirForecast({
  data,
  onHorizonClick,
}: {
  data: DashboardData
  onHorizonClick?: (days: number, horizon: ForecastHorizon) => void
}) {
  const [scenario, setScenario] = useState<ScenarioKey>('median')
  const factor = OV_SCENARIOS_FACTORS.find((s) => s.v === scenario) ?? OV_SCENARIOS_FACTORS[1]

  // Le scénario affecte la valeur "mid" affichée :
  //   - prudent  : mid = low (limite basse)
  //   - médian   : mid = mid  (estimation centrale)
  //   - agressif : mid = high (limite haute)
  const horizons = useMemo<ForecastHorizon[]>(() => {
    return data.forecast.map((h) => {
      const adjusted =
        factor.curve === 'lowCurve' ? h.low : factor.curve === 'highCurve' ? h.high : h.mid
      return { ...h, mid: adjusted }
    })
  }, [data.forecast, factor.curve])

  return (
    <div
      style={{
        background: DB_SP.card,
        borderRadius: 24,
        padding: 26,
        boxShadow: DB_SP.shadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        minWidth: 0,
        animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) .2s both',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 12,
          flexWrap: 'wrap',
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
            Forecast pondéré · scénario {factor.l.toLowerCase()}
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
            Ce que ton pipeline va te rapporter.
          </h3>
        </div>

        {/* Scenario toggle — local au forecast (cf. handoff §"Polish") */}
        <div
          role="tablist"
          aria-label="Scénario du forecast"
          style={{
            display: 'inline-flex',
            padding: 3,
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
                role="tab"
                aria-selected={active}
                onClick={() => setScenario(o.v)}
                style={{
                  height: 28,
                  padding: '0 11px',
                  borderRadius: 999,
                  border: 0,
                  background: active ? DB_SP.black : 'transparent',
                  color: active ? '#fff' : DB_SP.inkSoft,
                  fontFamily: 'inherit',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  letterSpacing: -0.1,
                  boxShadow: active ? '0 4px 10px rgba(11,12,14,0.18)' : 'none',
                  transition: 'all .18s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {o.l}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {horizons.map((h, i) => {
          const range = h.high - h.low
          const days = HORIZON_DAYS[h.h] ?? 90
          return (
            <button
              key={i}
              onClick={() => onHorizonClick?.(days, h)}
              style={{
                border: 0,
                fontFamily: 'inherit',
                textAlign: 'left',
                background: DB_SP.cardSubtle,
                borderRadius: 16,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                cursor: onHorizonClick ? 'pointer' : 'default',
                transition: 'all .15s ease',
              }}
              onMouseEnter={(e) => {
                if (onHorizonClick) {
                  ;(e.currentTarget as HTMLButtonElement).style.boxShadow = DB_SP.shadowSm
                  ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
                }
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'
                ;(e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: DB_SP.muted,
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + {h.h}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: DB_SP.muted,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h.n} {h.label}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: -0.6,
                    color: DB_SP.ink,
                    fontVariantNumeric: 'tabular-nums',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dbFmtCHF(h.mid)}
                </span>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: DB_SP.muted,
                    fontVariantNumeric: 'tabular-nums',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dbFmtCHF(h.low)} – {dbFmtCHF(h.high)}
                </span>
              </div>

              <div
                style={{
                  position: 'relative',
                  height: 6,
                  borderRadius: 999,
                  background: '#fff',
                  overflow: 'visible',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    left: '10%',
                    right: '10%',
                    background: DB_SP.black,
                    opacity: 0.16,
                    borderRadius: 999,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -3,
                    bottom: -3,
                    left: `${((h.mid - h.low) / range) * 80 + 10}%`,
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: DB_SP.black,
                    transform: 'translateX(-50%)',
                    boxShadow: '0 2px 8px rgba(11,12,14,0.3)',
                  }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── DBEntonnoir (étage 2 complet) ─────────────────────────────────────
interface DBEntonnoirProps {
  /** Conservé pour rétro-compat ; rempli depuis le hook live si non fourni. */
  data?: DashboardData
  /** Drilldown source → Contacts filtrés (handoff §"Polish Entonnoir"). */
  onSourceClick?: (slug: string, source: SourceItem) => void
  /** Drilldown horizon → Pipeline trié par close date. */
  onHorizonClick?: (days: number, horizon: ForecastHorizon) => void
}

export function DBEntonnoir({ data, onSourceClick, onHorizonClick }: DBEntonnoirProps) {
  // `data` est passé par DashboardApp (fallback DashboardData fixture).
  // DBCockpit suit déjà le pattern hook live — ici on reste sur le data
  // injecté pour ne pas dupliquer la query côté composant. La PR Sprint B
  // appelle useDashboardFunnel depuis DashboardApp et le passe en prop.
  const fallback = useMemo<DashboardData>(() => ({
    period: { mult: 1, label: 'Période' } as DashboardData['period'],
    scope: { mult: 1, label: 'Moi' } as DashboardData['scope'],
    M: 1,
    funnel: [],
    sources: [],
    forecast: [],
    funnelMult: 1,
    compareLabel: '',
  }), [])
  const effectiveData = data ?? fallback
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
      <div className="db-entonnoir-row1">
        <EntonnoirFunnel data={effectiveData} />
        <EntonnoirBottleneck />
      </div>
      <div className="db-entonnoir-row2">
        <EntonnoirSources data={effectiveData} onSourceClick={onSourceClick} />
        <EntonnoirForecast data={effectiveData} onHorizonClick={onHorizonClick} />
      </div>
    </section>
  )
}
