// MEGGA CRM — Dashboard Analytics « Le Cockpit Commission » — assemblage UI.
// Port 1:1 du handoff `analytics-app.jsx`. Consomme les tokens AX + le graphe.
// Différences prod assumées :
//  - icônes statiques = AxIcon inline (mêmes glyphes que la maquette) ;
//  - boutons toolbar animés = AnimatedTopIcon du shell (pop + self-draw au survol,
//    même grammaire que la sidebar / top-nav) ;
//  - les rows sont extraites en sous-composants (le proto appelait useState dans
//    des .map — interdit par les règles des hooks).

import { useState, useEffect, useRef, useCallback, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatedTopIcon } from '@/components/crm-sugar/LiquidGlassRail'
import { TrajectoryChart, Sparkline } from './TrajectoryChart'
import { useAxDashboardData } from '@/hooks/useAxDashboardData'
import {
  useAX, axCHF, axPace, type AxTheme, type AxPeriodId, type AxPeriodData,
  type AxDeal, type AxBucketId, type AxRecord, type AxKpi, type AxCompositionItem, type AxSource,
} from './tokens'

// ── Icônes statiques (mêmes tracés que la maquette) ──────────────────────────
type AxIconName = 'refresh' | 'download' | 'arrow' | 'up' | 'down' | 'spark' | 'sun' | 'moon' | 'close' | 'pencil' | 'check' | 'target' | 'lock'

const AX_ICON_PATHS: Record<AxIconName, ReactNode> = {
  refresh: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 21h14" /></>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  up: <path d="M5 15l7-7 7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  spark: <path d="m12 4 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>,
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  check: <path d="M4 12l5 5L20 6" />,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>,
}

function AxIcon({ name, size = 16, stroke = 'currentColor', sw = 1.8 }: { name: AxIconName; size?: number; stroke?: string; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {AX_ICON_PATHS[name]}
    </svg>
  )
}

// ── Compteur animé (défaut = valeur finale ; anime au changement ; filet timer) ──
function useCountUp(value: number, dur = 700): number {
  const [disp, setDisp] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const from = prev.current
    const to = value
    prev.current = value
    if (from === to) { setDisp(to); return }
    let raf = 0
    let done = false
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      setDisp(Math.round(from + (to - from) * e))
      if (p < 1) raf = requestAnimationFrame(tick); else done = true
    }
    raf = requestAnimationFrame(tick)
    const fb = window.setTimeout(() => { if (!done) setDisp(to) }, dur + 120)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(fb) }
  }, [value, dur])
  return disp
}

// ── Segmented control ────────────────────────────────────────────────────────
function AxSeg<T extends string>({ items, value, onChange }: { items: { id: T; label: string }[]; value: T; onChange: (id: T) => void }) {
  const A = useAX()
  return (
    <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: A.cardSubtle, boxShadow: `inset 0 0 0 1px ${A.hairline}`, gap: 2 }}>
      {items.map(o => {
        const on = value === o.id
        return (
          <button key={o.id} onClick={() => onChange(o.id)} style={{
            height: 36, padding: '0 16px', borderRadius: 999, border: 0,
            background: on ? A.ink : 'transparent', color: on ? A.onAccent : A.inkSoft,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            letterSpacing: -0.1, whiteSpace: 'nowrap', transition: 'background .15s ease',
            boxShadow: on ? '0 4px 12px rgba(11,12,14,0.20)' : 'none',
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}

// ── Pilule de delta ──────────────────────────────────────────────────────────
function AxDelta({ v, pts, abs }: { v: number; pts?: boolean; abs?: boolean }) {
  const A = useAX()
  if (v === 0) return <span style={{ fontSize: 11, fontWeight: 700, color: A.muted }}>—</span>
  const up = v > 0
  const p = up ? A.pillAhead : A.pillBehind
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, background: p.bg, color: p.fg, boxShadow: p.sh, fontSize: 10.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      <AxIcon name={up ? 'up' : 'down'} size={9} stroke="#fff" sw={3} />
      {up ? '+' : ''}{v}{pts ? ' pt' : abs ? '' : '%'}
    </span>
  )
}

// ── Pace bar ─────────────────────────────────────────────────────────────────
function AxPaceBar({ d }: { d: AxPeriodData }) {
  const A = useAX()
  const realW = Math.min(100, (d.realizedNow / d.target) * 100)
  const projW = Math.min(100, (d.projectedEnd / d.target) * 100)
  const paceX = Math.min(100, d.paceFrac * 100)
  const legend: { sw: string | null | 'hatch'; t: string; v: string }[] = [
    { sw: A.ink, t: 'Réalisé', v: axCHF(d.realizedNow) },
    { sw: 'hatch', t: 'Projeté', v: axCHF(d.projectedEnd) },
    { sw: null, t: 'Objectif', v: axCHF(d.target) },
  ]
  return (
    <div>
      <div style={{ position: 'relative', height: 18, borderRadius: 999, background: A.cardSubtle, overflow: 'visible', boxShadow: `inset 0 0 0 1px ${A.hairline}` }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${projW}%`, borderRadius: 999, backgroundImage: `repeating-linear-gradient(45deg, ${A.probable} 0 5px, ${A.cardSubtle} 5px 10px)`, opacity: 0.55 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${realW}%`, borderRadius: 999, background: A.ink, transition: 'width .8s cubic-bezier(.2,.8,.2,1)' }} />
        <div style={{ position: 'absolute', left: `${paceX}%`, top: -6, bottom: -6, width: 2, background: A.inkSoft, transform: 'translateX(-1px)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: `${paceX}%`, top: -22, transform: 'translateX(-50%)', fontSize: 9.5, fontWeight: 700, color: A.muted, letterSpacing: 0.3, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>rythme</div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {legend.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              width: 11, height: 11, borderRadius: 3, flexShrink: 0,
              background: l.sw === 'hatch' ? undefined : (l.sw || 'transparent'),
              backgroundImage: l.sw === 'hatch' ? `repeating-linear-gradient(45deg, ${A.probable} 0 3px, ${A.card} 3px 6px)` : undefined,
              boxShadow: l.sw ? 'none' : `inset 0 0 0 1.5px ${A.ghost}`,
            }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, color: A.muted }}>{l.t}</span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: A.ink, fontVariantNumeric: 'tabular-nums' }}>{l.v}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Hero ─────────────────────────────────────────────────────────────────────
function AxHero({ d, onGoSettings }: { d: AxPeriodData; onGoSettings: (() => void) | null }) {
  const A = useAX()
  const targetIsSet = d.targetIsSet ?? d.target > 0
  const pace = axPace(d)
  const num = useCountUp(d.projectedEnd)
  const verdict = pace.ahead ? A.pillAhead : A.pillBehind
  return (
    <div style={{ background: A.card, borderRadius: 26, padding: '30px 34px', boxShadow: A.shadowLg, display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,0.95fr)', gap: 30, alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', color: A.muted, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          Commission projetée · {d.label}
          {/* estimation : projection pondérée par probabilité de réalisation */}
          <span title="Estimation pondérée par probabilité de réalisation" style={{ display: 'inline-flex' }}>
            <AxIcon name="spark" size={12} stroke={A.muted} sw={1.6} />
          </span>
        </div>
        <div style={{ marginTop: 12, fontSize: 52, fontWeight: 800, letterSpacing: -2, color: A.ink, lineHeight: 0.96, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {axCHF(num)}
        </div>
        {targetIsSet ? (
          <>
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: verdict.bg, color: verdict.fg, boxShadow: verdict.sh, fontSize: 12, fontWeight: 800, letterSpacing: -0.1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                <AxIcon name={pace.ahead ? 'up' : 'down'} size={11} stroke="#fff" sw={2.6} />
                {pace.ahead ? 'En avance' : 'En retard'} {axCHF(Math.abs(pace.diff))} vs rythme
              </span>
            </div>
            <p style={{ margin: '16px 0 0', fontSize: 14.5, color: A.inkSoft, fontWeight: 500, lineHeight: 1.5, maxWidth: 440 }}>
              À ce rythme, tu finis {d.period} à <strong style={{ color: A.ink, fontWeight: 800 }}>{axCHF(d.projectedEnd)}</strong><br />soit <strong style={{ color: A.ink, fontWeight: 800 }}>{pace.projPct} %</strong> de ton objectif.
            </p>
          </>
        ) : (
          <p style={{ margin: '16px 0 0', fontSize: 14.5, color: A.inkSoft, fontWeight: 500, lineHeight: 1.5, maxWidth: 440 }}>
            Aucun objectif commercial n'est défini pour {d.period}.{' '}
            {onGoSettings ? (
              <button onClick={onGoSettings} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, color: A.ink, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                Le fixer dans Réglages
              </button>
            ) : (
              <strong style={{ color: A.ink, fontWeight: 800 }}>Le fixer dans Réglages › Agence.</strong>
            )}
          </p>
        )}
      </div>
      <div>
        {targetIsSet ? (
          <>
            <AxPaceBar d={d} />
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: A.muted }}>
              <AxIcon name="lock" size={12} stroke={A.muted} />
              <span>Objectif fixé par l'agence</span>
              {onGoSettings && (
                <button onClick={onGoSettings} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 800, color: A.ink, textDecoration: 'underline', textUnderlineOffset: 2 }}>
                  Modifier dans Réglages
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 96, borderRadius: 16, background: A.cardSubtle, boxShadow: `inset 0 0 0 1px ${A.hairline}`, padding: '20px 22px', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: A.muted }}>
              <AxIcon name="target" size={16} stroke={A.muted} />
              <span>Objectif non défini · le fixer dans Réglages</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Bandeau d'honnêteté commission (fallback taux 3% / prix manquant) ────────
function AxFallbackBanner({ d }: { d: AxPeriodData }) {
  const A = useAX()
  const flags = d.commissionFlags
  if (!flags || (flags.nDefaultPct === 0 && flags.nMissingPrice === 0)) return null
  const parts: string[] = []
  if (flags.nDefaultPct > 0) parts.push(`${flags.nDefaultPct} bien${flags.nDefaultPct > 1 ? 's' : ''} au taux 3 % par défaut`)
  if (flags.nMissingPrice > 0) parts.push(`${flags.nMissingPrice} sans prix`)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: A.cardSubtle, borderRadius: 14, padding: '12px 16px', boxShadow: `inset 0 0 0 1px ${A.hairline}` }}>
      <AxIcon name="spark" size={14} stroke={A.muted} sw={1.6} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: A.inkSoft }}>
        Commission estimée : {parts.join(' · ')}. Renseigne le taux de mandat sur tes biens pour affiner.
      </span>
    </div>
  )
}

// ── Bandeau KPI ──────────────────────────────────────────────────────────────
function AxKpiTile({ k }: { k: AxKpi }) {
  const A = useAX()
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      background: A.card, borderRadius: 18, padding: '16px 18px', boxShadow: h ? A.shadow : A.shadowSm,
      transform: h ? 'translateY(-2px)' : 'none', transition: 'transform .18s ease, box-shadow .18s ease',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, minHeight: 30 }}>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: A.muted, lineHeight: 1.25 }}>{k.label}</span>
        <AxDelta v={k.delta} pts={k.pts} abs={k.abs} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: k.value.length > 14 ? 15 : 23, fontWeight: 800, color: A.ink, letterSpacing: -0.7, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.value}</span>
        {/* Sparkline rendue seulement si la série live a ≥2 points (sinon Sparkline crashe). */}
        {k.spark.length >= 2 && <Sparkline data={k.spark} up={k.delta >= 0} />}
      </div>
    </div>
  )
}

function AxKpiStrip({ d }: { d: AxPeriodData }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {d.kpis.map((k, i) => <AxKpiTile key={i} k={k} />)}
    </div>
  )
}

// ── Ce qui se signe bientôt ──────────────────────────────────────────────────
function AxDealRow({ dl, onDrill }: { dl: AxDeal; onDrill: (x: Drill) => void }) {
  const A = useAX()
  const [h, setH] = useState(false)
  return (
    <button onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={() => onDrill({ type: 'deal', deal: dl })} style={{
      border: 0, background: h ? A.cardSubtle : 'transparent', borderRadius: 14, padding: '13px 14px',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'grid',
      gridTemplateColumns: '1.5fr 1fr 0.9fr auto', gap: 14, alignItems: 'center', transition: 'background .14s ease',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: A.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dl.loc ? `${dl.prop} · ${dl.loc}` : dl.prop}</div>
        {(dl.gmv > 0 || dl.when) && (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: A.muted, marginTop: 2 }}>{[dl.gmv > 0 ? axCHF(dl.gmv) : null, dl.when || null].filter(Boolean).join(' · ')}</div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: A.ink, fontVariantNumeric: 'tabular-nums' }}>{dl.comm > 0 ? axCHF(dl.comm) : 'CHF —'}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: A.muted, marginTop: 2 }}>{dl.comm > 0 ? 'commission' : 'prix manquant'}</div>
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{ flex: 1, height: 5, borderRadius: 999, background: A.cardSubtle, overflow: 'hidden', minWidth: 30 }}>
            <div style={{ height: '100%', width: `${dl.prob}%`, background: A.ink, borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 800, color: A.ink, fontVariantNumeric: 'tabular-nums' }}>{dl.prob}%</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: A.muted, marginTop: 4 }}>{dl.stage}</div>
      </div>
      <span style={{ display: 'inline-flex', opacity: h ? 1 : 0.25, transform: h ? 'translateX(2px)' : 'none', transition: 'all .14s ease' }}>
        <AxIcon name="arrow" size={16} stroke={A.ink} />
      </span>
    </button>
  )
}

function AxClosing({ deals, onDrill }: { deals: AxDeal[]; onDrill: (x: Drill) => void }) {
  const A = useAX()
  return (
    <div style={{ background: A.card, borderRadius: 22, padding: '22px 24px', boxShadow: A.shadow }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: A.ink, letterSpacing: -0.4 }}>Ce qui se signe bientôt</h3>
      </div>
      {deals.length === 0 ? (
        <div style={{ padding: '28px 8px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: A.muted }}>
          Aucun deal en cours
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {deals.map((dl, i) => <AxDealRow key={i} dl={dl} onDrill={onDrill} />)}
        </div>
      )}
    </div>
  )
}

// ── De quoi est fait le projeté ──────────────────────────────────────────────
function AxCompRow({ c, total, color, onDrill }: { c: AxCompositionItem; total: number; color: string; onDrill: (x: Drill) => void }) {
  const A = useAX()
  const [h, setH] = useState(false)
  return (
    <button onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={() => onDrill({ type: 'bucket', bucket: c.k })} style={{
      border: 0, background: h ? A.cardSubtle : 'transparent', borderRadius: 12, padding: '11px 12px',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12, transition: 'background .14s ease',
    }}>
      <span style={{ width: 12, height: 12, borderRadius: 4, background: color, flexShrink: 0, boxShadow: c.k === 'possible' ? `inset 0 0 0 1px ${A.ghost}` : 'none' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: A.ink }}>{c.label}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: A.muted }}>{c.hint}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: A.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{axCHF(c.v)}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: A.muted, fontVariantNumeric: 'tabular-nums' }}>{total > 0 ? Math.round((c.v / total) * 100) : 0} %</div>
      </div>
      <span style={{ display: 'inline-flex', opacity: h ? 0.9 : 0.2, transition: 'opacity .14s ease' }}>
        <AxIcon name="arrow" size={15} stroke={A.ink} />
      </span>
    </button>
  )
}

function AxComposition({ d, onDrill }: { d: AxPeriodData; onDrill: (x: Drill) => void }) {
  const A = useAX()
  const total = d.composition.reduce((s, c) => s + c.v, 0)
  const colOf: Record<AxBucketId, string> = { secured: A.secured, probable: A.probable, possible: A.possible }
  return (
    <div style={{ background: A.card, borderRadius: 22, padding: '22px 24px', boxShadow: A.shadow }}>
      <h3 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 17, fontWeight: 800, color: A.ink, letterSpacing: -0.4 }}>
        De quoi est fait le projeté
        <span title="Estimation pondérée par probabilité de réalisation" style={{ display: 'inline-flex' }}>
          <AxIcon name="spark" size={12} stroke={A.muted} sw={1.6} />
        </span>
      </h3>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: A.muted, marginBottom: 16 }}>{axCHF(total)} au total</div>
      {total === 0 ? (
        <div style={{ padding: '22px 8px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: A.muted }}>
          Aucune commission projetée sur la période
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', height: 16, borderRadius: 999, overflow: 'hidden', gap: 2, marginBottom: 18 }}>
            {d.composition.map((c, i) => (
              <div key={i} title={c.label} style={{ width: `${(c.v / total) * 100}%`, background: colOf[c.k], transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {d.composition.map((c, i) => <AxCompRow key={i} c={c} total={total} color={colOf[c.k]} onDrill={onDrill} />)}
          </div>
        </>
      )}
    </div>
  )
}

// ── Carte graphe ─────────────────────────────────────────────────────────────
function AxChartCard({ d, chartKey }: { d: AxPeriodData; chartKey: number }) {
  const A = useAX()
  return (
    <div style={{ background: A.card, borderRadius: 22, padding: '22px 24px 16px', boxShadow: A.shadow }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: A.ink, letterSpacing: -0.4 }}>Trajectoire vers l'objectif</h3>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: A.inkSoft }}>
            <span style={{ width: 16, height: 3, borderRadius: 2, background: A.ink }} /> Réalisé
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, color: A.inkSoft }}>
            <span style={{ width: 16, height: 0, borderTop: `2px dashed ${A.goal}` }} /> Objectif
          </span>
        </div>
      </div>
      <TrajectoryChart key={chartKey} d={d} />
    </div>
  )
}

// ── Sources des deals ────────────────────────────────────────────────────────
const SRC_OPAC = [1, 0.74, 0.54, 0.4, 0.3]

function AxSourceRow({ s, rank }: { s: AxSource; rank: number }) {
  const A = useAX()
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display: 'grid', gridTemplateColumns: 'minmax(240px,1.7fr) minmax(110px,1.4fr) auto',
      gap: 16, alignItems: 'center', padding: '12px 12px', borderRadius: 12,
      background: h ? A.cardSubtle : 'transparent', transition: 'background .14s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
        <span style={{ width: 22, fontSize: 12, fontWeight: 800, color: A.muted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{rank + 1}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: A.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: A.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{s.sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, height: 10, borderRadius: 999, background: A.cardSubtle, overflow: 'hidden', minWidth: 40 }}>
          <div style={{ height: '100%', width: `${s.pct}%`, background: A.ink, opacity: SRC_OPAC[rank] ?? 0.3, borderRadius: 999, transition: 'width .7s cubic-bezier(.2,.8,.2,1)' }} />
        </div>
        <span style={{ fontSize: 12.5, fontWeight: 800, color: A.ink, fontVariantNumeric: 'tabular-nums', width: 34, textAlign: 'right' }}>{s.pct}%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: A.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{s.deals}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: A.muted, whiteSpace: 'nowrap' }}>lead{s.deals > 1 ? 's' : ''}</div>
        </div>
        <AxDelta v={s.delta} />
      </div>
    </div>
  )
}

function AxSources({ d }: { d: AxPeriodData }) {
  const A = useAX()
  const srcs = d.sources || []
  const top = srcs[0]
  return (
    <div style={{ background: A.card, borderRadius: 22, padding: '22px 24px', boxShadow: A.shadow }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: A.ink, letterSpacing: -0.4 }}>Sources des leads</h3>
          {/* commission par canal non stockée en DB → on affiche le volume de leads */}
          <div style={{ fontSize: 12, fontWeight: 600, color: A.muted, marginTop: 3 }}>D'où viennent tes contacts · périmètre agence · {d.label}</div>
        </div>
        {top && (
          <span style={{ fontSize: 12.5, fontWeight: 600, color: A.inkSoft }}>
            <strong style={{ color: A.ink, fontWeight: 800 }}>{top.label}</strong> = ton meilleur canal
          </span>
        )}
      </div>
      {srcs.length === 0 ? (
        <div style={{ padding: '24px 8px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: A.muted }}>
          Aucune source sur la période
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {srcs.map((s, i) => <AxSourceRow key={i} s={s} rank={i} />)}
        </div>
      )}
    </div>
  )
}

// ── Drawer de drill-down ─────────────────────────────────────────────────────
type Drill = { type: 'deal'; deal: AxDeal } | { type: 'bucket'; bucket: AxBucketId }

function AxRecRow({ r }: { r: AxRecord }) {
  const A = useAX()
  const [h, setH] = useState(false)
  return (
    <button onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      border: 0, background: h ? A.cardSubtle : 'transparent', borderRadius: 14, padding: '13px 14px',
      cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', transition: 'background .14s ease',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: A.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.prop} · {r.loc}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: A.inkSoft, background: A.cardSubtle, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{r.state}</span>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: A.muted, fontVariantNumeric: 'tabular-nums' }}>{axCHF(r.gmv)}</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: A.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{axCHF(r.comm)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, justifyContent: 'flex-end' }}>
          <div style={{ width: 44, height: 5, borderRadius: 999, background: A.cardSubtle, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${r.prob}%`, background: A.ink, borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: A.ink, fontVariantNumeric: 'tabular-nums' }}>{r.prob}%</span>
        </div>
      </div>
    </button>
  )
}

const AX_BUCKET_META: Record<AxBucketId, { label: string; hint: string }> = {
  secured: { label: 'Sécurisé', hint: 'Actes signés + compromis fermes' },
  probable: { label: 'Probable', hint: 'Offres déposées en cours de négociation' },
  possible: { label: 'Possible', hint: 'Mandats actifs & visites en cours' },
}

function AxDrawer({ drill, records: recordsByBucket, onClose }: {
  drill: Drill
  records: Record<AxBucketId, { label: string; hint: string; items: AxRecord[] }> | null | undefined
  onClose: () => void
}) {
  const A = useAX()
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => { setClosing(true); window.setTimeout(onClose, 240) }, [onClose])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  let eyebrow: string
  let title: string
  let records: AxRecord[]
  let hint: string
  let total: number
  let count: number | null
  const isDeal = drill.type === 'deal'
  if (drill.type === 'bucket') {
    const meta = AX_BUCKET_META[drill.bucket]
    const b = recordsByBucket?.[drill.bucket] ?? null
    eyebrow = 'Composition · ' + (b?.label ?? meta.label)
    title = b?.label ?? meta.label
    records = b?.items ?? []
    hint = b?.hint ?? meta.hint
    total = records.reduce((s, x) => s + x.comm, 0)
    count = records.length
  } else {
    const dl = drill.deal
    eyebrow = 'Deal · ' + dl.stage
    title = dl.loc ? `${dl.prop} ${dl.loc}` : dl.prop
    records = []
    hint = 'Autres deals comparables'
    total = dl.comm
    count = null
  }

  // Drill-down par dossier différé V1 : si aucun record n'est fourni, on dégrade
  // honnêtement (« détails indisponibles ») plutôt que d'afficher une fixture.
  const detailsUnavailable = records.length === 0

  const overlay = (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 2000, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: 24, boxSizing: 'border-box' }}>
      <div onClick={close} style={{ position: 'absolute', inset: 0, background: A.scrim, opacity: closing ? 0 : 1, transition: 'opacity .24s ease', backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)' }} />
      <div style={{
        position: 'relative', width: 460, maxWidth: '92vw', height: '100%', maxHeight: '100%', background: A.card,
        boxShadow: A.shadowLg, borderRadius: 24, display: 'flex', flexDirection: 'column',
        transform: closing ? 'translateX(108%)' : 'translateX(0)',
        transition: 'transform .26s cubic-bezier(.2,.85,.25,1)', overflow: 'hidden',
      }}>
        <div style={{ padding: '24px 26px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.1, textTransform: 'uppercase', color: A.muted }}>{eyebrow}</div>
            <h3 style={{ margin: '8px 0 0', fontSize: 24, fontWeight: 800, letterSpacing: -0.7, color: A.ink, lineHeight: 1.1 }}>{title}</h3>
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: A.ink, fontVariantNumeric: 'tabular-nums' }}>{total > 0 ? axCHF(total) : 'CHF —'}</span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: A.muted }}>{isDeal ? 'commission' : `${count ?? 0} dossier${(count ?? 0) > 1 ? 's' : ''} · commission`}</span>
            </div>
          </div>
          <button onClick={close} title="Fermer" style={{ width: 34, height: 34, borderRadius: 999, border: 0, background: A.cardSubtle, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <AxIcon name="close" size={16} stroke={A.inkSoft} />
          </button>
        </div>

        {drill.type === 'deal' && (
          <div style={{ padding: '0 26px 6px' }}>
            <div style={{ background: A.cardSubtle, borderRadius: 16, padding: '16px 18px', display: 'flex', flexWrap: 'wrap', gap: 18 }}>
              {[
                { l: 'Commission', v: drill.deal.comm > 0 ? axCHF(drill.deal.comm) : 'CHF —' },
                { l: 'Probabilité', v: drill.deal.prob + ' %' },
                { l: 'Étape', v: drill.deal.stage },
              ].map((x, i) => (
                <div key={i}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: A.muted, letterSpacing: 0.4, textTransform: 'uppercase' }}>{x.l}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: A.ink, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{x.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 18px 18px' }}>
          {detailsUnavailable ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: A.muted, lineHeight: 1.5 }}>
              Détails indisponibles<br />
              <span style={{ fontSize: 12, fontWeight: 500, color: A.muted }}>Le détail par dossier arrive bientôt — ouvre le Pipeline filtré pour le suivi.</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 600, color: A.muted, padding: '8px 8px 4px' }}>{hint}</div>
              {records.map((r, i) => <AxRecRow key={i} r={r} />)}
            </>
          )}
        </div>

        <div style={{ padding: '16px 26px 22px', borderTop: `1px solid ${A.hairline}` }}>
          <button style={{
            width: '100%', height: 46, borderRadius: 999, border: 0, background: A.ink, color: A.onAccent,
            fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer', letterSpacing: -0.1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: A.shadow,
          }}>
            Ouvrir dans le Pipeline filtré
            <AxIcon name="arrow" size={15} stroke={A.onAccent} />
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(overlay, document.body)
}

// ── Skeleton de transition de période ────────────────────────────────────────
function axEnsureKeyframes() {
  if (typeof document === 'undefined' || document.getElementById('ax-kf')) return
  const s = document.createElement('style')
  s.id = 'ax-kf'
  s.textContent =
    '@keyframes axRise{from{transform:translateY(12px)}to{transform:translateY(0)}}' +
    '@keyframes axShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
    '@keyframes axSkIn{from{opacity:0}to{opacity:1}}'
  document.head.appendChild(s)
}

function AxSk({ h = 14, w = '100%', r = 8, style }: { h?: number; w?: number | string; r?: number; style?: CSSProperties }) {
  const A = useAX()
  return (
    <div style={{
      height: h, width: w, borderRadius: r,
      background: `linear-gradient(90deg, ${A.skBase} 25%, ${A.skShine} 50%, ${A.skBase} 75%)`,
      backgroundSize: '200% 100%', animation: 'axShimmer 1.25s ease-in-out infinite', ...style,
    }} />
  )
}

function AxSkCard({ children, pad = '22px 24px', style }: { children: ReactNode; pad?: string; style?: CSSProperties }) {
  const A = useAX()
  return <div style={{ background: A.card, borderRadius: 22, padding: pad, boxShadow: A.shadow, ...style }}>{children}</div>
}

function AxSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'axSkIn .2s ease both' }}>
      <AxSkCard pad="26px 28px" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 28, alignItems: 'center' }}>
        <div>
          <AxSk h={12} w={150} r={6} />
          <AxSk h={46} w={300} r={12} style={{ marginTop: 16 }} />
          <AxSk h={26} w={200} r={999} style={{ marginTop: 18 }} />
          <AxSk h={14} w="80%" r={6} style={{ marginTop: 18 }} />
          <AxSk h={14} w="60%" r={6} style={{ marginTop: 8 }} />
        </div>
        <div>
          <AxSk h={10} w="100%" r={999} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 10 }}>
            {[0, 1, 2].map(i => <AxSk key={i} h={12} w={70} r={6} />)}
          </div>
        </div>
      </AxSkCard>
      <AxSkCard pad="24px 26px">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 22 }}>
          <AxSk h={16} w={180} r={6} />
          <AxSk h={28} w={150} r={999} />
        </div>
        <AxSk h={230} w="100%" r={14} />
      </AxSkCard>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[0, 1, 2, 3].map(i => (
          <AxSkCard key={i} pad="18px 20px">
            <AxSk h={11} w="70%" r={6} />
            <AxSk h={24} w="55%" r={8} style={{ marginTop: 14 }} />
            <AxSk h={28} w="100%" r={8} style={{ marginTop: 16 }} />
          </AxSkCard>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, alignItems: 'start' }}>
        <AxSkCard>
          <AxSk h={16} w={200} r={6} style={{ marginBottom: 18 }} />
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0' }}>
              <div style={{ flex: 1.5 }}><AxSk h={13} w="80%" r={6} /><AxSk h={10} w="50%" r={6} style={{ marginTop: 7 }} /></div>
              <div style={{ flex: 1 }}><AxSk h={13} w="60%" r={6} /></div>
              <div style={{ flex: 0.9 }}><AxSk h={6} w="100%" r={999} /></div>
            </div>
          ))}
        </AxSkCard>
        <AxSkCard>
          <AxSk h={16} w={160} r={6} style={{ marginBottom: 18 }} />
          <AxSk h={16} w="100%" r={999} style={{ marginBottom: 20 }} />
          {[0, 1, 2].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0' }}>
              <AxSk h={12} w={12} r={999} />
              <div style={{ flex: 1 }}><AxSk h={12} w="55%" r={6} /></div>
              <AxSk h={12} w={70} r={6} />
            </div>
          ))}
        </AxSkCard>
      </div>
    </div>
  )
}

// ── Bouton toolbar animé (pop + self-draw au survol, via AnimatedTopIcon) ─────
function AxToolBtn({ name, title, onClick, disabled, iconRef, A }: {
  name: string; title: string; onClick?: () => void; disabled?: boolean; iconRef?: React.Ref<HTMLSpanElement>; A: AxTheme
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => { if (!disabled) setHover(true) }}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 36, height: 36, borderRadius: 999, border: 0, background: A.card,
        display: 'grid', placeItems: 'center', boxShadow: A.shadowSm,
        cursor: disabled ? 'wait' : 'pointer',
        transition: 'transform 200ms cubic-bezier(.34,1.4,.5,1), box-shadow .2s ease',
        transform: hover && !disabled ? 'scale(1.08)' : 'scale(1)',
      }}
    >
      <span ref={iconRef} style={{ display: 'inline-flex', lineHeight: 0 }}>
        {/* size 17 = 23 × 0.74 et signature scale-0.6 pure : pop identique à la maquette
            (la maquette n'a pas de signature dédiée pour refresh/download/sun/moon). */}
        <AnimatedTopIcon name={name} color={A.inkSoft} size={17} signature={{ scale: 0.6 }} />
      </span>
    </button>
  )
}

// ── Body du dashboard (partagé standalone / embed CRM) ───────────────────────
const AX_PERIODS: { id: AxPeriodId; label: string }[] = [
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
  { id: 'year', label: 'Année' },
]

export interface AxDashboardBodyProps {
  embedded?: boolean
  dark?: boolean
  setDark?: (fn: (v: boolean) => boolean) => void
  onNavigate?: (id: string) => void
}

export default function AxDashboardBody({ embedded = false, dark = false, setDark, onNavigate }: AxDashboardBodyProps) {
  const A = useAX()
  const [period, setPeriod] = useState<AxPeriodId>('year')
  const [chartKey, setChartKey] = useState(0)
  const [spin, setSpin] = useState(false)
  const [drill, setDrill] = useState<Drill | null>(null)
  const spinRef = useRef<HTMLSpanElement>(null)

  // Données live via les 3 RPC d'agrégation (scope figé 'me' en V1 — la page est
  // le cockpit de l'agent ; toggle scope = backlog quand l'agence devient multi-agents).
  const { data: d, isLoading } = useAxDashboardData(period, 'me')

  useEffect(() => { axEnsureKeyframes() }, [])

  const refresh = () => {
    if (spin) return
    const el = spinRef.current
    if (el && el.animate) el.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-720deg)' }], { duration: 1100, easing: 'cubic-bezier(.2,.8,.2,1)' })
    setSpin(true); setChartKey(k => k + 1)
    window.setTimeout(() => setSpin(false), 1100)
  }
  const onPeriod = (p: AxPeriodId) => {
    if (p === period) return
    setPeriod(p); setChartKey(k => k + 1)
  }

  return (
    <div style={{ minHeight: embedded ? 'auto' : '100vh', paddingBottom: embedded ? 0 : 56, fontFamily: "'Manrope', system-ui, sans-serif" }}>
      {/* toolbar */}
      <div style={{ position: embedded ? 'static' : 'sticky', top: 0, zIndex: 30, background: embedded ? 'transparent' : A.appBlur, backdropFilter: embedded ? 'none' : 'saturate(160%) blur(14px)', WebkitBackdropFilter: embedded ? 'none' : 'saturate(160%) blur(14px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: embedded ? '0 0 16px' : '20px 36px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.6, color: A.ink }}>Performance</h1>
          </div>
          <div style={{ flex: 1 }} />
          <AxSeg items={AX_PERIODS} value={period} onChange={onPeriod} />
          <div style={{ display: 'inline-flex', gap: 6 }}>
            {!embedded && (
              <AxToolBtn name={dark ? 'sun' : 'moon'} title={dark ? 'Mode clair' : 'Mode sombre'} onClick={() => setDark && setDark(v => !v)} A={A} />
            )}
            <AxToolBtn name="refresh" title="Rafraîchir" onClick={refresh} disabled={spin} iconRef={spinRef} A={A} />
            <AxToolBtn name="download" title="Exporter PDF" A={A} />
          </div>
        </div>
      </div>

      {/* content */}
      {isLoading || !d ? (
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: embedded ? 0 : '16px 36px 0' }}>
          <AxSkeleton />
        </div>
      ) : (
        <div key={period} style={{ maxWidth: 1280, margin: '0 auto', padding: embedded ? 0 : '16px 36px 0', display: 'flex', flexDirection: 'column', gap: 18, animation: 'axRise .45s cubic-bezier(.2,.8,.2,1) both' }}>
          <AxHero d={d} onGoSettings={onNavigate ? () => onNavigate('settings') : null} />
          <AxFallbackBanner d={d} />
          <AxChartCard d={d} chartKey={chartKey} />
          <AxKpiStrip d={d} />
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, alignItems: 'start' }}>
            <AxClosing deals={d.closing ?? []} onDrill={setDrill} />
            <AxComposition d={d} onDrill={setDrill} />
          </div>
          <AxSources d={d} />
        </div>
      )}

      {drill && <AxDrawer drill={drill} records={d?.records ?? null} onClose={() => setDrill(null)} />}
    </div>
  )
}
