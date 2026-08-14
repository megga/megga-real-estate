// MEGGA CRM — Dashboard « Cockpit Commission » — écran FUSION (mono-écran).
// Port du handoff `analytics-fusion.jsx` (refonte juillet 2026) : Performance +
// Analyse sur un seul écran, zéro-scroll, l'ancien pager 2 pages est supprimé.
//   Rangée haute  : héro « double stat » (commission projetée) · trajectoire
//                   immersive + cône (sélecteur de période intégré).
//   Rangée basse  : treemap de composition (drill = popover ancré) · sources en
//                   colonnes · 4 KPI sparkline.
// Accent dataviz : périwinkle #6F8CFF — RÉSERVÉ aux graphiques. L'UI reste Sugar
//   Pure : titres noirs, sélection noire, ombres douces, zéro bordure décorative.
//
// Différences prod assumées vs la maquette :
//  - données 100 % live via useAxDashboardData (3 RPC analytics_*), jamais de fixture ;
//  - parcours « compte neuf » piloté par les VRAIS signaux (objectif défini ? activité ?),
//    pas par des flags window.* de démo : porte AxGate → cockpit fantôme AxFirstRun → réel ;
//  - la porte écrit l'objectif via useAgencyTargets().saveYearly (RPC analytics_set_target),
//    PAS en localStorage (l'ancien 'megga-analytics-target' a été supprimé).

import EtatVide from '@/components/crm-sugar/EtatVide'
import { sgVoileEncre } from '@/components/crm-sugar/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { useState, useEffect, useRef, useLayoutEffect, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAxDashboardData } from '@/hooks/useAxDashboardData'
import { useAgencyTargets } from '@/hooks/useAgencyTargets'
import AxGate from './AxGate'
import AxFirstRun from './AxFirstRun'
import {
  useAX, useAxDark, axCHF, axShort, axPace, type AxPeriodId, type AxPeriodData,
  type AxBucketId, type AxBucket,
} from './tokens'

// ── Accent dataviz périwinkle (déclinaisons) — jamais en accent UI ────────────
export interface AxfAccent { accent: string; soft: string; ghost: string; area: string }
const AXF_ACCENTS: { light: AxfAccent; dark: AxfAccent } = {
  light: { accent: '#6F8CFF', soft: '#A9BBFF', ghost: '#DDE5FF', area: 'rgba(111,140,255,0.13)' },
  dark: { accent: '#8CA3FF', soft: '#5B70C9', ghost: '#2E3552', area: 'rgba(140,163,255,0.16)' },
}

// Couleur de pilule d'état dans le popover (couleurs de phase MEGGA, par bucket).
const AXF_BUCKET_TONE: Record<AxBucketId, string> = { secured: '#059669', probable: '#C45A00', possible: '#1E5BC6' }

// ── Icônes statiques (mêmes tracés que la maquette) ──────────────────────────
type AxIconName = 'up' | 'down' | 'arrow' | 'check'
const AX_ICON_PATHS: Record<AxIconName, ReactNode> = {
  up: <path d="M5 15l7-7 7 7" />,
  down: <path d="M5 9l7 7 7-7" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  check: <path d="M4 13l5 5 11-12" />,
}
function AxIcon({ name, size = 16, stroke = 'currentColor', sw = 1.8 }: { name: AxIconName; size?: number; stroke?: string; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      {AX_ICON_PATHS[name]}
    </svg>
  )
}

// ── Compteur animé (défaut = valeur finale ; anime au changement ; filet timer) ──
function useCountUp(value: number, dur = 750): number {
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

// ── Keyframes injectées une fois (fondu du graphe + montée des blocs) ─────────
function axEnsureKeyframes() {
  if (typeof document === 'undefined' || document.getElementById('axf-kf')) return
  const s = document.createElement('style')
  s.id = 'axf-kf'
  s.textContent =
    '@keyframes axfFade{from{opacity:0}to{opacity:1}}' +
    '@keyframes axRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}' +
    '@keyframes axShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}' +
    '@keyframes axSkIn{from{opacity:0}to{opacity:1}}'
  document.head.appendChild(s)
}

// ── Pilule de delta (statique, couleurs sémantiques) ─────────────────────────
function AxfDelta({ v, pts, abs }: { v: number; pts?: boolean; abs?: boolean }) {
  const A = useAX()
  if (v === 0) return <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: A.muted }}>—</span>
  const up = v > 0
  const p = up ? A.pillAhead : A.pillBehind
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', background: p.bg, color: p.fg, boxShadow: p.sh, fontSize: 'var(--crm-text-xs)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>
      <AxIcon name={up ? 'up' : 'down'} size={9} stroke="#fff" sw={3} />
      {up ? '+' : ''}{v}{pts ? ' pt' : abs ? '' : '%'}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   HÉRO — commission projetée (double stat) : projeté en grand, verdict,
//   colonnes Réalisé/Reste, pace bar muette + objectif éditable.
// ═══════════════════════════════════════════════════════════════════════════
function AxfHero({ d, acc, onGoSettings }: { d: AxPeriodData; acc: AxfAccent; onGoSettings: (() => void) | null }) {
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  const pace = axPace(d)
  const num = useCountUp(d.projectedEnd)
  const verdict = pace.ahead ? A.pillAhead : A.pillBehind
  const reste = Math.max(0, d.target - d.projectedEnd)
  const realPct = d.target > 0 ? Math.min(100, (d.realizedNow / d.target) * 100) : 0
  const projPct = d.target > 0 ? Math.min(100, (d.projectedEnd / d.target) * 100) : 0
  const pacePct = d.target > 0 ? Math.min(100, (pace.paceNow / d.target) * 100) : 0
  const [on, setOn] = useState(false)
  useEffect(() => { const t = window.setTimeout(() => setOn(true), 60); return () => window.clearTimeout(t) }, [])
  return (
    <div style={{ background: A.card, borderRadius: 'var(--crm-radius-6xl)', padding: '24px 28px', boxShadow: A.shadowLg, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--crm-space-4xl)', minHeight: 0, minWidth: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
      <div>
        <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: A.muted }}>{tr('analytics.hero.eyebrow')}</div>
        <div style={{ marginTop: 12, fontSize: 'clamp(30px, 2.45vw, 46px)', fontWeight: 600, letterSpacing: -1.6, color: A.ink, lineHeight: 0.96, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {axCHF(num)}
        </div>
        <div style={{ marginTop: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-xs) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', background: verdict.bg, color: verdict.fg, boxShadow: verdict.sh, fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.1, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            <AxIcon name={pace.ahead ? 'up' : 'down'} size={11} stroke="#fff" sw={2.6} />
            {axCHF(Math.abs(pace.diff))} {pace.ahead ? tr('analytics.hero.aheadShort') : tr('analytics.hero.behindShort')} · {pace.projPct} %
          </span>
        </div>
      </div>
      {/* colonnes Réalisé / Reste */}
      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 'var(--crm-space-4xl)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: A.muted }}>{tr('analytics.hero.realized')}</div>
          <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: A.ink, marginTop: 4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{axCHF(d.realizedNow)}</div>
        </div>
        <div style={{ width: 1, background: A.hairline, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0, paddingLeft: 'var(--crm-space-4xl)' }}>
          <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: A.muted }}>{tr('analytics.hero.remaining')}</div>
          <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: acc.accent, marginTop: 4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{axCHF(reste)}</div>
        </div>
      </div>
      {/* pace bar muette + objectif */}
      <div>
        <div style={{ position: 'relative', height: 12, borderRadius: 'var(--crm-radius-pill)', background: A.cardSubtle }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--crm-radius-pill)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: on ? `${projPct}%` : 0, background: acc.ghost, borderRadius: 'var(--crm-radius-pill)', transition: 'width .9s cubic-bezier(.2,.8,.2,1) .15s' }} />
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: on ? `${realPct}%` : 0, background: acc.accent, borderRadius: 'var(--crm-radius-pill)', transition: 'width .9s cubic-bezier(.2,.8,.2,1)' }} />
          </div>
          <div title={tr('analytics.hero.paceMarkerTitle')} style={{ position: 'absolute', top: -4, bottom: -4, left: `${pacePct}%`, width: 2.5, borderRadius: 'var(--crm-radius-2xs)', background: A.ink }} />
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: A.muted }}>
          <span>{tr('analytics.hero.objectiveLabel')} <span style={{ color: A.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{axCHF(d.target)}</span></span>
          {onGoSettings && (
            <button onClick={onGoSettings} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: A.ink, textDecoration: 'underline', textUnderlineOffset: 2 }}>
              · {tr('analytics.hero.modify')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   TRAJECTOIRE — sélecteur de période intégré (thumb qui glisse)
// ═══════════════════════════════════════════════════════════════════════════
function AxfSeg({ items, value, onChange, dark }: { items: { id: AxPeriodId; label: string }[]; value: AxPeriodId; onChange: (id: AxPeriodId) => void; dark: boolean }) {
  const A = useAX()
  const idx = Math.max(0, items.findIndex(it => it.id === value))
  const n = items.length
  return (
    <div role="tablist" style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, background: A.cardSubtle, borderRadius: 'var(--crm-radius-pill)', padding: 'var(--crm-space-2xs)', boxShadow: dark ? 'inset 0 1px 3px rgba(0,0,0,.35)' : `inset 0 1px 3px ${sgVoileEncre(false, .07)}` }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: 3, bottom: 3, left: 3, width: `calc((100% - 6px) / ${n})`, transform: `translateX(${idx * 100}%)`, transition: 'transform .38s cubic-bezier(.2,.8,.2,1)', borderRadius: 'var(--crm-radius-pill)', background: A.accent, boxShadow: dark ? '0 2px 8px rgba(0,0,0,.30)' : `0 2px 8px ${sgVoileEncre(false, .18)}` }} />
      {items.map(it => {
        const active = it.id === value
        return (
          <button key={it.id} role="tab" aria-selected={active} onClick={() => onChange(it.id)} className="axf-seg-btn" style={{
            position: 'relative', zIndex: 1, border: 0, background: 'transparent', fontFamily: 'inherit',
            padding: 'var(--crm-space-sm) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', cursor: active ? 'default' : 'pointer',
            fontSize: 'var(--crm-text-md)', fontWeight: active ? 600 : 500, letterSpacing: -0.1, whiteSpace: 'nowrap',
            color: active ? A.accentInk : A.muted,
          }}>{it.label}</button>
        )
      })}
    </div>
  )
}

// Trajectoire immersive + cône : zéro grille, aire + courbe réalisé, projection
// pointillée + cône d'incertitude, ligne objectif, survol fluide (écart coloré).
function AxfTrajectory({ d, vbH, acc, dark }: { d: AxPeriodData; vbH: number; acc: AxfAccent; dark: boolean }) {
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  const s = d.series
  const VBW = 1000
  const VBH = vbH || 400
  const PAD = { l: 22, r: 22, t: 34, b: 30 }
  const plotW = VBW - PAD.l - PAD.r
  const plotH = VBH - PAD.t - PAD.b
  const baseY = PAD.t + plotH
  const nSafe = Math.max(2, s.n)
  const x = (i: number) => PAD.l + (i / (nSafe - 1)) * plotW
  const y = (v: number) => PAD.t + (1 - v / (s.yMax || 1)) * plotH
  const realAt = (i: number) => s.real[i] ?? 0
  const valAt = (i: number) => (i <= s.elapsed ? realAt(i) : (s.proj[i - s.elapsed] ?? d.projectedEnd))
  const toPath = (pts: [number, number][]) => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')

  const realLen = Math.min(s.real.length, s.elapsed + 1) || s.real.length
  const realPts = s.real.slice(0, realLen > 0 ? realLen : s.real.length).map((v, i) => [x(i), y(v)] as [number, number])
  const realPath = realPts.length ? toPath(realPts) : ''
  const eIdx = Math.min(Math.max(0, s.elapsed), Math.max(0, s.real.length - 1))
  const realNow = s.real.length ? realAt(eIdx) : d.realizedNow
  const areaPath = realPath ? `${realPath} L ${x(eIdx).toFixed(1)} ${baseY.toFixed(1)} L ${PAD.l} ${baseY.toFixed(1)} Z` : ''

  const xEnd = x(nSafe - 1)
  const px0 = x(eIdx)
  const py0 = y(realNow)
  const hasProj = s.elapsed < s.n - 1 && d.projectedEnd > 0
  const coneHi = Math.min(s.yMax * 0.985, d.projectedEnd * 1.115)
  const coneLo = Math.max(0, d.projectedEnd * 0.885)

  const rv = axCHF(realNow)
  const rw = rv.length * 7.4 + 24
  const rx0 = Math.max(PAD.l, Math.min(VBW - PAD.r - rw, px0 - rw / 2))
  const pv = axCHF(d.projectedEnd)
  const pw = pv.length * 7.4 + 24

  const goalEnd = s.goal[nSafe - 1] ?? d.target
  const labs = d.axisLabels.map((lab, i) => ({ lab, i })).filter(o => o.lab && (s.n !== 12 || [0, 3, 6, 9, 11].includes(o.i)))

  const wrapRef = useRef<HTMLDivElement>(null)
  const [hov, setHov] = useState<number | null>(null)
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const cx = clientX - r.left
    const frac = (cx / r.width) * VBW
    setHov(Math.max(0, Math.min(nSafe - 1, Math.round(((frac - PAD.l) / plotW) * (nSafe - 1)))))
  }
  const hovVal = hov == null ? null : valAt(hov)
  const hovGoal = hov == null ? null : (s.goal[hov] ?? goalEnd)
  const hovDiff = hov == null || hovVal == null || hovGoal == null ? null : hovVal - hovGoal

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: '100%', cursor: 'crosshair' }}
      onMouseMove={onMove} onMouseLeave={() => setHov(null)} onTouchStart={onMove} onTouchMove={onMove} onTouchEnd={() => setHov(null)}>
      <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" style={{ display: 'block', width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="axfArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={acc.accent} stopOpacity="0.38" />
            <stop offset="1" stopColor={acc.accent} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="axfCone" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={acc.accent} stopOpacity="0.20" />
            <stop offset="1" stopColor={acc.accent} stopOpacity="0.07" />
          </linearGradient>
        </defs>
        {/* objectif */}
        <path d={`M ${x(0)} ${y(s.goal[0] ?? 0)} L ${xEnd} ${y(goalEnd)}`} fill="none" stroke={A.goal} strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" opacity="0.85" />
        <text x={xEnd - 2} y={y(goalEnd) - 9} textAnchor="end" fontSize="12" fontWeight="700" fill={A.muted} fontFamily="Manrope">{tr('analytics.trajectory.objectiveShort', { amount: axShort(d.target) })}</text>
        {/* cône d'incertitude + projection */}
        {hasProj && (
          <>
            <path d={`M ${px0} ${py0} L ${xEnd} ${y(coneHi)} L ${xEnd} ${y(coneLo)} Z`} fill="url(#axfCone)" />
            <path d={`M ${px0} ${py0} L ${xEnd} ${y(d.projectedEnd)}`} fill="none" stroke={acc.accent} strokeWidth="2.4" strokeDasharray="2 8" strokeLinecap="round" opacity="0.6" />
            <text x={xEnd - 2} y={y(coneLo) + 17} textAnchor="end" fontSize="11" fontWeight="700" fill={A.muted} fontFamily="Manrope">{tr('analytics.trajectory.prudent', { amount: axShort(coneLo) })}</text>
          </>
        )}
        {/* réalisé */}
        {areaPath && <path d={areaPath} fill="url(#axfArea)" stroke="none" />}
        {realPath && <path d={realPath} fill="none" stroke={acc.accent} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />}
        {/* aujourd'hui */}
        <circle cx={px0} cy={py0} r="11" fill={acc.accent} opacity="0.22" />
        <circle cx={px0} cy={py0} r="5.5" fill={acc.accent} />
        <circle cx={px0} cy={py0} r="5.5" fill="none" stroke={A.card} strokeWidth="2" />
        <g>
          <rect x={rx0} y={py0 - 46} width={rw} height={26} rx="13" fill="#1A1C20" stroke="rgba(255,255,255,0.12)" />
          <text x={rx0 + rw / 2} y={py0 - 28} textAnchor="middle" fontSize="12" fontWeight="800" fill="#FFFFFF" fontFamily="Manrope">{rv}</text>
        </g>
        {/* projeté (fin de période) */}
        {hasProj && (
          <g>
            <rect x={xEnd - pw} y={y(d.projectedEnd) - 13} width={pw} height={26} rx="13" fill="#1A1C20" stroke="rgba(255,255,255,0.12)" />
            <text x={xEnd - pw / 2} y={y(d.projectedEnd) + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill={acc.accent} fontFamily="Manrope">{pv}</text>
          </g>
        )}
        {/* repères X épars */}
        {labs.map(o => (
          <text key={o.i} x={x(o.i)} y={VBH - 8} textAnchor={o.i === 0 ? 'start' : o.i === nSafe - 1 ? 'end' : 'middle'} fontSize="12.5" fontWeight={hov === o.i ? '800' : '600'} fill={hov === o.i ? A.ink : A.muted} fontFamily="Manrope">{o.lab}</text>
        ))}
        {/* crosshair fluide : écart vs objectif */}
        {hov != null && hovVal != null && hovGoal != null && hovDiff != null && (
          <g style={{ transform: `translateX(${x(hov)}px)`, transition: 'transform .16s cubic-bezier(.2,.8,.2,1)' }}>
            <line x1="0" x2="0" y1={PAD.t} y2={baseY} stroke={A.ink} strokeWidth="1.2" opacity="0.3" />
            <rect x="-1.25" width="2.5" rx="1.25"
              y={Math.min(y(hovVal), y(hovGoal))}
              height={Math.max(2, Math.abs(y(hovVal) - y(hovGoal)))}
              fill={hovDiff >= 0 ? (dark ? '#3FCF8E' : '#1C7A4E') : (dark ? '#F0A05A' : '#B4612A')}
              style={{ transition: 'y .16s cubic-bezier(.2,.8,.2,1), height .16s cubic-bezier(.2,.8,.2,1)' }} />
            <circle cx="0" cy={y(hovGoal)} r="4.5" fill={A.card} stroke={A.goal} strokeWidth="2" style={{ transition: 'cy .16s cubic-bezier(.2,.8,.2,1)' }} />
            <circle cx="0" cy={y(hovVal)} r="5.5" fill={A.card} stroke={acc.accent} strokeWidth="2.5" style={{ transition: 'cy .16s cubic-bezier(.2,.8,.2,1)' }} />
          </g>
        )}
      </svg>
      {hov != null && hovVal != null && hovDiff != null && (
        <div style={{
          position: 'absolute', top: 6, left: `${(x(hov) / VBW) * 100}%`,
          transform: `translateX(${hov > nSafe * 0.7 ? '-104%' : hov < nSafe * 0.3 ? '4%' : '-50%'})`,
          transition: 'left .16s cubic-bezier(.2,.8,.2,1), transform .16s cubic-bezier(.2,.8,.2,1)',
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
          background: '#1A1C20', borderRadius: 'var(--crm-radius-pill)', padding: 'var(--crm-space-sm) var(--crm-space-xl)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.38)', border: '1px solid rgba(255,255,255,0.10)',
          pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'Manrope',
        }}>
          <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: 'rgba(255,255,255,0.55)' }}>
            {(d.axisLabels[hov] || `${d.pointWord || tr('analytics.trajectory.pointWordFallback')} ${hov + 1}`)}{hov > s.elapsed ? ` · ${tr('analytics.trajectory.projectedShort')}` : ''}
          </span>
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>{axCHF(hovVal)}</span>
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: hovDiff >= 0 ? '#3FCF8E' : '#F0A05A', fontVariantNumeric: 'tabular-nums' }}>
            {hovDiff >= 0 ? '▲ +' : '▼ −'}{axCHF(Math.abs(hovDiff)).replace('CHF ', '')}
          </span>
        </div>
      )}
    </div>
  )
}

function AxfChartCard({ d, acc, dark, seg }: { d: AxPeriodData; acc: AxfAccent; dark: boolean; seg: ReactNode }) {
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  const bodyRef = useRef<HTMLDivElement>(null)
  const [vbH, setVbH] = useState(400)
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const fit = () => {
      const r = el.getBoundingClientRect()
      if (r.width > 80 && r.height > 80) setVbH(Math.max(300, Math.min(640, Math.round((r.height / r.width) * 1000))))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div style={{ background: A.card, borderRadius: 'var(--crm-radius-6xl)', padding: '20px 26px 12px', boxShadow: A.shadow, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-2xl)', flexWrap: 'wrap', flexShrink: 0 }}>
        <h3 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: A.ink, letterSpacing: -0.4 }}>{tr('analytics.chart.title')}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: A.inkSoft }}>
            <span style={{ width: 16, height: 3, borderRadius: 'var(--crm-radius-2xs)', background: acc.accent }} /> {tr('analytics.chart.realized')}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: A.inkSoft }}>
            <span style={{ width: 16, height: 0, borderTop: `2px dashed ${A.goal}` }} /> {tr('analytics.chart.target')}
          </span>
          {seg}
        </div>
      </div>
      <div ref={bodyRef} style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
        <div key={d.key} style={{ height: '100%', animation: 'axfFade .35s ease both' }}>
          <AxfTrajectory key={vbH} d={d} vbH={vbH} acc={acc} dark={dark} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   COMPOSITION — treemap vertical (le % EST le bloc, clic → popover ancré)
// ═══════════════════════════════════════════════════════════════════════════
export interface AxDrill { bucket: AxBucketId; rect: DOMRect }
function AxfCompositionCard({ d, acc, dark, onDrill }: { d: AxPeriodData; acc: AxfAccent; dark: boolean; onDrill: (x: AxDrill) => void }) {
  const axDark = useAxDark()
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  const total = d.composition.reduce((s, c) => s + c.v, 0)
  const colOf: Record<AxBucketId, string> = { secured: acc.accent, probable: acc.soft, possible: acc.ghost }
  const txtOf: Record<AxBucketId, string> = dark
    ? { secured: MXC_COLOR.n100, probable: '#FFFFFF', possible: A.ink }
    : { secured: MXC_COLOR.n100, probable: MXC_COLOR.n100, possible: MXC_COLOR.n100 }
  return (
    <div style={{ background: A.card, borderRadius: 'var(--crm-radius-6xl)', padding: 'var(--crm-space-4xl) var(--crm-space-6xl) var(--crm-space-5xl)', boxShadow: A.shadow, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: A.ink, letterSpacing: -0.4, flexShrink: 0 }}>{tr('analytics.composition.title')}</h3>
      {total === 0 ? (
        <EtatVide dark={axDark} titre={tr('analytics.composition.empty')} />
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', marginTop: 14 }}>
          {d.composition.map((c, i) => {
            const pct = Math.round((c.v / total) * 100)
            const big = i === 0
            return (
              <button key={c.k} className="axf-block" onClick={e => onDrill({ bucket: c.k, rect: e.currentTarget.getBoundingClientRect() })} style={{
                flexGrow: Math.max(0.0001, c.v), flexShrink: 1, flexBasis: '0%', minHeight: 40, border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                transition: 'flex-grow .65s cubic-bezier(.2,.8,.2,1)',
                background: colOf[c.k], color: txtOf[c.k], borderRadius: 'var(--crm-radius-2xl)',
                padding: big ? '13px 16px' : '8px 16px',
                display: 'flex', flexDirection: big ? 'column' : 'row', justifyContent: 'space-between',
                alignItems: big ? 'stretch' : 'center', gap: big ? 4 : 10,
                minWidth: 0, overflow: 'hidden',
                animation: `axRise .5s cubic-bezier(.2,.8,.2,1) ${0.16 + i * 0.08}s both`,
              }}>
                {big ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
                      <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                      <span style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{pct} %</span>
                    </div>
                    <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, opacity: 0.72, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{axCHF(c.v)}</div>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                    <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{pct} %</span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   DRILL — popover ancré contre le bloc cliqué (Échap / clic dehors ferme)
// ═══════════════════════════════════════════════════════════════════════════
// Total = valeur de composition du bucket (source unique, IDENTIQUE au treemap) —
// PAS la somme des items listés : les contributeurs cockpit sont un top-5 GLOBAL,
// donc un sous-ensemble par bucket. La liste est explicitement « principaux dossiers »
// (jamais présentée comme exhaustive), et un bucket dont aucun deal n'entre dans le
// top-5 n'est PAS affiché « vide » — le total réel reste au bandeau.
function AxfDrillPopover({ drill, bucket, compValue, onClose, onNavigate }: {
  drill: AxDrill
  bucket: AxBucket
  compValue: number
  onClose: () => void
  onNavigate?: (id: string) => void
}) {
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  const items = bucket.items
  const tone = AXF_BUCKET_TONE[drill.bucket]
  const W = 390
  const H = Math.min(460, 132 + Math.max(1, items.length) * 44)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const r = drill.rect
  const fitsRight = r.right + 14 + W <= vw - 12
  const left = fitsRight ? r.right + 14 : Math.max(12, r.left - W - 14)
  const top = Math.max(12, Math.min(r.top + r.height / 2 - H / 3, vh - H - 12))
  const arrowY = Math.max(18, Math.min(r.top + r.height / 2 - top - 7, H - 32))
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'transparent' }} />
      <div style={{ position: 'absolute', left, top, width: W, maxHeight: H, background: A.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: A.shadowLg, padding: 'var(--crm-space-4xl) var(--crm-space-5xl)', display: 'flex', flexDirection: 'column', animation: 'axRise .3s cubic-bezier(.2,.8,.2,1) both' }}>
        <div style={{ position: 'absolute', [fitsRight ? 'left' : 'right']: -7, top: arrowY, width: 14, height: 14, background: A.card, transform: 'rotate(45deg)', borderRadius: 'var(--crm-radius-2xs)' } as CSSProperties} />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 'var(--crm-space-lg)', flexShrink: 0 }}>
          <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: A.ink, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bucket.label}</span>
          {compValue > 0 && <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: A.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>{axCHF(compValue)}</span>}
        </div>
        {items.length === 0 ? (
          <div style={{ marginTop: 12, marginBottom: 6, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: A.muted, lineHeight: 1.5 }}>
            {bucket.hint ? `${bucket.hint}. ` : ''}{tr('analytics.drill.emptyBucket')}
          </div>
        ) : (
          <>
            <div style={{ marginTop: 12, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: A.muted, flexShrink: 0 }}>{tr('analytics.drill.topFiles')}</div>
            <div style={{ marginTop: 4, overflowY: 'auto', minHeight: 0 }}>
              {items.map((x, i) => (
                <div key={i} className="axf-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', minWidth: 0 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: A.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.prop}</span>
                  <span style={{ padding: 'var(--crm-space-2xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: tone, color: '#FFFFFF', fontSize: 'var(--crm-text-xs)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{x.state}</span>
                  <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: A.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>{x.comm > 0 ? axCHF(x.comm).replace('CHF ', '') : '—'}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, flexShrink: 0 }}>
          <button onClick={() => { onClose(); onNavigate?.('pipeline') }} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: A.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>
            {tr('analytics.drill.openInPipeline')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   COMMISSION PAR CANAL — colonnes = commission RÉALISÉE attribuée par canal
//   (décompose le « Réalisé » du héro ; hauteur relative au meilleur canal)
// ═══════════════════════════════════════════════════════════════════════════
function AxfSourcesCard({ d, acc }: { d: AxPeriodData; acc: AxfAccent }) {
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  const opac = [1, 0.76, 0.56, 0.42, 0.3]
  // Seuls les canaux ayant produit de la commission réalisée (tri par commission
  // décroissante ; le RPC trie déjà ainsi, on reste défensif).
  const chans = (d.sources || []).filter(s => (s.comm ?? 0) > 0).sort((a, b) => (b.comm ?? 0) - (a.comm ?? 0))
  const maxComm = Math.max(1, ...chans.map(s => s.comm))
  const [on, setOn] = useState(false)
  useEffect(() => { const t = window.setTimeout(() => setOn(true), 60); return () => window.clearTimeout(t) }, [])
  return (
    <div style={{ background: A.card, borderRadius: 'var(--crm-radius-6xl)', padding: 'var(--crm-space-4xl) var(--crm-space-6xl) var(--crm-space-3xl)', boxShadow: A.shadow, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, width: '100%', height: '100%', overflow: 'hidden' }}>
      <h3 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: A.ink, letterSpacing: -0.4, flexShrink: 0 }}>{tr('analytics.sources.commissionTitle')}</h3>
      {chans.length === 0 ? (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: A.muted }}>
          {tr('analytics.sources.commissionEmpty')}
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch', gap: 'var(--crm-space-2xl)', paddingTop: 'var(--crm-space-xl)' }}>
          {chans.map((s, i) => (
            <div key={i} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-sm)' }} title={`${s.label} · ${axCHF(s.comm)} · ${tr('analytics.sources.wonDeals', { count: s.won ?? 0 })}`}>
              <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: A.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{axShort(s.comm)}</span>
              <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', borderRadius: 'var(--crm-radius-md)', background: A.cardSubtle, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: on ? `${Math.max(5, (s.comm / maxComm) * 100)}%` : 0, background: acc.accent, opacity: opac[i] ?? 0.3, borderRadius: 'var(--crm-radius-md)', transition: `height .8s cubic-bezier(.2,.8,.2,1) ${i * 0.07}s` }} />
              </div>
              <span style={{ maxWidth: '100%', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: A.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   KPI — 4 tuiles (sparkline « aire » en bandeau bas)
// ═══════════════════════════════════════════════════════════════════════════
function AxfAreaSpark({ data, acc, h = 40 }: { data: number[]; acc: AxfAccent; h?: number }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const n = data.length
  const W = 160
  const H = 42
  const sx = (i: number) => (i / (n - 1)) * W
  const sy = (v: number) => H - 5 - ((v - min) / (max - min || 1)) * (H - 14)
  const line = data.map((v, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(v).toFixed(1)).join(' ')
  return (
    <svg style={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', display: 'block' }} height={h} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line} L ${W} ${H} L 0 ${H} Z`} fill={acc.area} />
      <path d={line} fill="none" stroke={acc.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function AxfKpiGrid({ d, acc }: { d: AxPeriodData; acc: AxfAccent }) {
  const A = useAX()
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 'var(--crm-space-xl)', minHeight: 0, minWidth: 0, width: '100%', height: '100%' }}>
      {d.kpis.map((k, i) => (
        <div key={i} style={{ position: 'relative', background: A.card, borderRadius: 'var(--crm-radius-3xl)', boxShadow: A.shadowSm, minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ position: 'relative', zIndex: 1, padding: 'var(--crm-space-xl) var(--crm-space-2xl) 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
              <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: A.muted, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={k.label}>{k.label}</span>
              <AxfDelta v={k.delta} pts={k.pts} abs={k.abs} />
            </div>
            <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: A.ink, letterSpacing: -0.6, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 8 }}>{k.value}</div>
          </div>
          {k.spark.length >= 2 && <AxfAreaSpark data={k.spark} acc={acc} h={40} />}
        </div>
      ))}
    </div>
  )
}

// ── Squelette de la grille fusion ─────────────────────────────────────────────
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
function AxSkeleton() {
  const A = useAX()
  const card = (children: ReactNode, extra?: CSSProperties): ReactNode => (
    <div style={{ background: A.card, borderRadius: 'var(--crm-radius-6xl)', boxShadow: A.shadow, padding: 'var(--crm-space-5xl) var(--crm-space-7xl)', display: 'flex', flexDirection: 'column', minHeight: 0, ...extra }}>{children}</div>
  )
  return (
    <div className="axf-grid" style={{ height: '100%', width: '100%', display: 'flex', gap: 'var(--crm-space-3xl)', animation: 'axSkIn .2s ease both' }}>
      <div className="axf-col-left" style={{ flex: '0 0 clamp(300px, 27%, 396px)', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
        <div style={{ flex: '0.86 1 0', minHeight: 0, display: 'grid' }}>{card(<><AxSk h={12} w={140} r={6} /><AxSk h={42} w="70%" r={12} style={{ marginTop: 16 }} /><AxSk h={22} w={180} r={999} style={{ marginTop: 16 }} /><AxSk h={12} w="100%" r={999} style={{ marginTop: 'auto' }} /></>, { justifyContent: 'center' })}</div>
        <div style={{ flex: '1.14 1 0', minHeight: 0, display: 'grid' }}>{card(<><AxSk h={14} w={160} r={6} /><div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', marginTop: 14 }}><AxSk h={0} w="100%" r={16} style={{ flex: 58 }} /><AxSk h={0} w="100%" r={16} style={{ flex: 28 }} /><AxSk h={0} w="100%" r={16} style={{ flex: 14 }} /></div></>)}</div>
      </div>
      <div className="axf-col-right" style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
        <div style={{ flex: '1.9 1 0', minHeight: 0, display: 'grid' }}>{card(<><div style={{ display: 'flex', justifyContent: 'space-between' }}><AxSk h={16} w={180} r={6} /><AxSk h={28} w={200} r={999} /></div><AxSk h={0} w="100%" r={14} style={{ flex: 1, marginTop: 16 }} /></>)}</div>
        <div className="axf-strip" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', gap: 'var(--crm-space-3xl)' }}>
          <div style={{ flex: '1.42 1 0', minWidth: 0, display: 'grid' }}>{card(<><AxSk h={14} w={140} r={6} /><div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', gap: 'var(--crm-space-xl)', marginTop: 14 }}>{[100, 68, 44, 27, 15].map((hh, i) => <AxSk key={i} h={0} w="100%" r={10} style={{ flex: 1, alignSelf: 'stretch', minHeight: `${hh}%` }} />)}</div></>)}</div>
          <div style={{ flex: '1.05 1 0', minWidth: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
            {[0, 1, 2, 3].map(i => <div key={i} style={{ background: A.card, borderRadius: 'var(--crm-radius-3xl)', boxShadow: A.shadowSm, padding: 'var(--crm-space-xl) var(--crm-space-2xl)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}><AxSk h={9} w="55%" r={999} /><AxSk h={16} w="72%" r={999} /></div>)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Styles locaux de la grille (hover statiques + responsive) ────────────────
export function AxfStyles({ dark }: { dark: boolean }) {
  const A = useAX()
  return (
    <style>{`
      /* Pas d'outline: none ici. .axf-block et .axf-seg-btn sont des <button>
         (l'un ouvre le tiroir de détail, l'autre est un onglet role="tab") : les
         priver d'outline les privait de tout repère de focus clavier. L'anneau
         vient de globals.css, en :focus-visible — donc jamais au clic souris,
         qui était le seul motif légitime de couper l'outline.
         .axf-row est un <div> non focusable : la déclaration n'y servait à rien. */
      .axf-row { -webkit-tap-highlight-color: transparent; }
      .axf-row:hover { background: ${dark ? 'rgba(255,255,255,0.05)' : `${sgVoileEncre(false, 0.035)}`} !important; }
      .axf-block { -webkit-tap-highlight-color: transparent; }
      .axf-block:hover { filter: brightness(${dark ? '1.07' : '0.97'}); }
      .axf-seg-btn { -webkit-tap-highlight-color: transparent; }
      .axf-seg-btn:not([aria-selected="true"]):hover { color: ${A.inkSoft} !important; }
      @media (max-width: 1180px) {
        .axf-grid { flex-direction: column !important; overflow-y: auto !important; }
        .axf-col-left, .axf-col-right { flex: none !important; }
        .axf-col-left { flex-direction: row !important; }
        .axf-col-left > * { flex: 1 1 0 !important; min-height: 260px; }
        .axf-col-right > *:first-child { min-height: 340px; }
        .axf-strip { flex-direction: column !important; }
        .axf-strip > * { min-height: 220px; }
      }
      @media (max-width: 760px) {
        .axf-col-left { flex-direction: column !important; }
      }
    `}</style>
  )
}

// ── Grille fusion présentationnelle (drill interne) — réutilisable/testable ───
export function AxFusionGrid({ d, dark, acc, seg, onNavigate }: {
  d: AxPeriodData; dark: boolean; acc: AxfAccent; seg: ReactNode; onNavigate?: (id: string) => void
}) {
  const [drill, setDrill] = useState<AxDrill | null>(null)
  const goSettings = onNavigate ? () => onNavigate('settings') : null
  const compItem = drill ? d.composition.find(c => c.k === drill.bucket) : null
  const bucket = drill
    ? (d.records?.[drill.bucket] ?? ({ label: compItem?.label ?? '', hint: compItem?.hint ?? '', items: [] } as AxBucket))
    : null
  return (
    <>
      <div className="axf-grid" style={{ height: '100%', width: '100%', display: 'flex', gap: 'var(--crm-space-3xl)' }}>
        <div className="axf-col-left" style={{ flex: '0 0 clamp(300px, 27%, 396px)', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
          <div style={{ flex: '0.86 1 0', minHeight: 0, minWidth: 0, display: 'grid' }}>
            <AxfHero d={d} acc={acc} onGoSettings={goSettings} />
          </div>
          <div style={{ flex: '1.14 1 0', minHeight: 0, minWidth: 0, display: 'grid' }}>
            <AxfCompositionCard d={d} acc={acc} dark={dark} onDrill={setDrill} />
          </div>
        </div>
        <div className="axf-col-right" style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)' }}>
          <div style={{ flex: '1.9 1 0', minHeight: 0, minWidth: 0, display: 'grid' }}>
            <AxfChartCard d={d} acc={acc} dark={dark} seg={seg} />
          </div>
          <div className="axf-strip" style={{ flex: '1 1 0', minHeight: 0, minWidth: 0, display: 'flex', gap: 'var(--crm-space-3xl)' }}>
            <div style={{ flex: '1.42 1 0', minWidth: 0, minHeight: 0, display: 'grid' }}>
              <AxfSourcesCard d={d} acc={acc} />
            </div>
            <div style={{ flex: '1.05 1 0', minWidth: 0, minHeight: 0, display: 'grid' }}>
              <AxfKpiGrid d={d} acc={acc} />
            </div>
          </div>
        </div>
      </div>
      {drill && bucket && <AxfDrillPopover drill={drill} bucket={bucket} compValue={compItem?.v ?? 0} onClose={() => setDrill(null)} onNavigate={onNavigate} />}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   BODY — écran fusion (mono-écran), embarqué dans le shell CRM (page)
// ═══════════════════════════════════════════════════════════════════════════
const AX_PERIODS: { id: AxPeriodId; labelKey: string }[] = [
  { id: 'month', labelKey: 'analytics.selector.month' },
  { id: 'quarter', labelKey: 'analytics.selector.quarter' },
  { id: 'year', labelKey: 'analytics.selector.year' },
]

export interface AxDashboardBodyProps {
  embedded?: boolean
  dark?: boolean
  setDark?: (fn: (v: boolean) => boolean) => void
  onNavigate?: (id: string) => void
}

export default function AxDashboardBody({ dark = false, onNavigate }: AxDashboardBodyProps) {
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  const acc = dark ? AXF_ACCENTS.dark : AXF_ACCENTS.light
  const [period, setPeriod] = useState<AxPeriodId>('year')

  const { data: d, isLoading, isError, refetch } = useAxDashboardData(period, 'me')
  const { saveYearly, isSaving } = useAgencyTargets()

  useEffect(() => { axEnsureKeyframes() }, [])
  const onPeriod = (p: AxPeriodId) => { if (p !== period) setPeriod(p) }
  const goSettings = onNavigate ? () => onNavigate('settings') : null

  const seg = <AxfSeg items={AX_PERIODS.map(p => ({ id: p.id, label: tr(p.labelKey) }))} value={period} onChange={onPeriod} dark={dark} />

  // ── États : erreur · chargement · porte (objectif absent) · fantôme · réel ──
  let content: ReactNode
  if (isError && !d) {
    content = (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-3xl)', textAlign: 'center', color: A.ink }}>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>{tr('analytics.error.title')}</div>
        <div style={{ fontSize: 'var(--crm-text-lg)', opacity: 0.7, lineHeight: 1.5, maxWidth: 360 }}>{tr('analytics.error.body')}</div>
        <button onClick={() => refetch()} style={{ height: 40, padding: '0 var(--crm-space-5xl)', borderRadius: 'var(--crm-radius-pill)', background: A.accent, color: A.accentInk, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{tr('analytics.error.retry')}</button>
      </div>
    )
  } else if (isLoading || !d) {
    content = <AxSkeleton />
  } else {
    const targetSet = d.targetIsSet ?? d.target > 0
    const hasActivity = d.realizedNow > 0 || d.projectedEnd > 0 || d.composition.some(c => c.v > 0)
    if (!targetSet) {
      content = <AxGate dark={dark} saving={isSaving} onDone={saveYearly} />
    } else if (!hasActivity) {
      content = <AxFirstRun acc={acc} dark={dark} target={d.target} onGoSettings={goSettings} />
    } else {
      content = <AxFusionGrid d={d} dark={dark} acc={acc} seg={seg} onNavigate={onNavigate} />
    }
  }

  return (
    <div style={{ height: '100%', width: '100%', minHeight: 0, minWidth: 0, fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <AxfStyles dark={dark} />
      {content}
    </div>
  )
}
