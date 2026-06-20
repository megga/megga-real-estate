// Graphe « Trajectoire vers l'objectif » (SVG cumulatif scrubbable) + mini Sparkline.
// Port 1:1 du handoff `analytics-chart.jsx`. SVG viewBox fixe scalé à 100%.

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAX, axShort, axCHF, type AxPeriodData } from './tokens'

const AX_VB_W = 1000
const AX_VB_H = 340
const AX_PAD = { l: 60, r: 16, t: 18, b: 30 }

export function TrajectoryChart({ d }: { d: AxPeriodData }) {
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  const s = d.series
  const plotW = AX_VB_W - AX_PAD.l - AX_PAD.r
  const plotH = AX_VB_H - AX_PAD.t - AX_PAD.b
  const baseY = AX_PAD.t + plotH

  const x = (i: number) => AX_PAD.l + (i / (s.n - 1)) * plotW
  const y = (v: number) => AX_PAD.t + (1 - v / s.yMax) * plotH

  const valAt = (i: number) => (i <= s.elapsed ? s.real[i] : s.proj[i - s.elapsed])

  const realPts = s.real.map((v, i) => [x(i), y(v)] as [number, number])
  const projPts = s.proj.map((v, i) => [x(s.elapsed + i), y(v)] as [number, number])
  const goalPts = s.goal.map((v, i) => [x(i), y(v)] as [number, number])
  const toPath = (pts: [number, number][]) =>
    pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const realPath = toPath(realPts)
  const projPath = toPath(projPts)
  const goalPath = toPath(goalPts)
  const areaPath = realPath + ` L ${x(s.elapsed).toFixed(1)} ${baseY} L ${AX_PAD.l} ${baseY} Z`

  const ticks = 4
  const gy = Array.from({ length: ticks + 1 }, (_, i) => (s.yMax * i) / ticks)

  const wrapRef = useRef<HTMLDivElement>(null)
  const [hi, setHi] = useState<number | null>(null)

  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const cx = clientX - r.left
    const frac = (cx / r.width) * AX_VB_W
    const idx = Math.max(0, Math.min(s.n - 1, Math.round(((frac - AX_PAD.l) / plotW) * (s.n - 1))))
    setHi(idx)
  }
  const onLeave = () => setHi(null)

  const hiVal = hi == null ? null : valAt(hi)
  const hiGoal = hi == null ? null : s.goal[hi]
  const hiDiff = hi == null || hiVal == null || hiGoal == null ? null : hiVal - hiGoal

  return (
    <div
      ref={wrapRef}
      style={{ position: 'relative', width: '100%', cursor: 'crosshair' }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onTouchStart={onMove}
      onTouchMove={onMove}
      onTouchEnd={onLeave}
    >
      {/* height via CSS (`height="auto"` n'est pas une longueur SVG valide → erreur console) */}
      <svg viewBox={`0 0 ${AX_VB_W} ${AX_VB_H}`} width="100%" style={{ display: 'block', width: '100%', height: 'auto' }}>
        {/* gridlines + y labels */}
        {gy.map((v, i) => (
          <g key={i}>
            <line x1={AX_PAD.l} x2={AX_VB_W - AX_PAD.r} y1={y(v)} y2={y(v)} stroke={A.grid} strokeWidth="1" />
            <text x={AX_PAD.l - 10} y={y(v) + 4} textAnchor="end" fontSize="13" fontWeight="600" fill={A.muted} fontFamily="Manrope">{axShort(v)}</text>
          </g>
        ))}

        {/* x axis labels */}
        {d.axisLabels.map((lab, i) => (lab ? (
          <text key={i} x={x(i)} y={AX_VB_H - 8} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={A.muted} fontFamily="Manrope">{lab}</text>
        ) : null))}

        {/* goal pace line */}
        <path d={goalPath} fill="none" stroke={A.goal} strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
        <text x={x(s.n - 1)} y={y(s.goal[s.n - 1]) - 8} textAnchor="end" fontSize="12.5" fontWeight="700" fill={A.muted} fontFamily="Manrope">{tr('analytics.trajectory.goalLabel')}</text>

        {/* realized area + line */}
        <path d={areaPath} fill={A.area} stroke="none" />
        <path d={realPath} fill="none" stroke={A.line} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* projection */}
        <path d={projPath} fill="none" stroke={A.line} strokeWidth="2.4" strokeDasharray="2 7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }} />

        {/* today marker */}
        <line x1={x(s.elapsed)} x2={x(s.elapsed)} y1={AX_PAD.t} y2={baseY} stroke={A.hairlineSt} strokeWidth="1.5" strokeDasharray="2 4" />
        <circle cx={x(s.elapsed)} cy={y(s.real[s.elapsed])} r="5.5" fill={A.line} />
        <circle cx={x(s.elapsed)} cy={y(s.real[s.elapsed])} r="5.5" fill="none" stroke={A.card} strokeWidth="2" />

        {/* hover crosshair */}
        {hi != null && hiVal != null && (
          <g>
            <line x1={x(hi)} x2={x(hi)} y1={AX_PAD.t} y2={baseY} stroke={A.ink} strokeWidth="1.2" opacity="0.35" />
            <circle cx={x(hi)} cy={y(hiVal)} r="5" fill={A.card} stroke={A.ink} strokeWidth="2.5" />
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hi != null && hiVal != null && hiDiff != null && (
        <div
          style={{
            position: 'absolute', top: 6, left: `${(x(hi) / AX_VB_W) * 100}%`,
            transform: `translateX(${hi > s.n * 0.7 ? '-108%' : hi < s.n * 0.3 ? '8%' : '-50%'})`,
            background: '#1A1C20', color: '#FFFFFF', borderRadius: 12, padding: '10px 13px',
            boxShadow: '0 14px 34px rgba(0,0,0,0.40)', border: '1px solid rgba(255,255,255,0.10)',
            pointerEvents: 'none', whiteSpace: 'nowrap', fontFamily: 'Manrope',
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
            {d.axisLabels[hi] || (d.pointWord ? `${d.pointWord} ${hi + 1}` : tr('analytics.trajectory.pointFallback', { n: hi + 1 }))}{hi > s.elapsed ? ` · ${tr('analytics.trajectory.projected')}` : ''}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>{axCHF(hiVal)}</div>
          <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 999, background: hiDiff >= 0 ? '#1C7A4E' : '#B4612A', color: '#FFFFFF' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={hiDiff >= 0 ? 'M5 15l7-7 7 7' : 'M5 9l7 7 7-7'} /></svg>
              {hiDiff >= 0 ? '+' : '−'}{axCHF(Math.abs(hiDiff))}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{tr('analytics.trajectory.vsPace')}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Mini sparkline pour les tuiles KPI ───────────────────────────────────────
export function Sparkline({ data, up = true, w = 88, h = 30 }: { data: number[]; up?: boolean; w?: number; h?: number }) {
  const A = useAX()
  const min = Math.min(...data)
  const max = Math.max(...data)
  const sx = (i: number) => (i / (data.length - 1)) * w
  const sy = (v: number) => h - 3 - ((v - min) / (max - min || 1)) * (h - 6)
  const path = data.map((v, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(v).toFixed(1)).join(' ')
  const col = up ? A.ink : A.probable
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <path d={`${path} L ${w} ${h} L 0 ${h} Z`} fill={A.area} stroke="none" />
      <path d={path} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx(data.length - 1)} cy={sy(data[data.length - 1])} r="2.6" fill={col} />
    </svg>
  )
}
