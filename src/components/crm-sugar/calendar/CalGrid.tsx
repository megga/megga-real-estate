// MEGGA CRM Sugar — Calendar — pièces de grille partagées (Semaine / Jour)
// Port fidèle de `crm-calendar-sugar-week-month.jsx` :
//   · CalEventBlock  — bloc événement (glisser = déplacer, bord bas = redimensionner, snap 15 min)
//   · CalDayColumn   — colonne timeline d'un jour
//   · CalHourGutter  — gouttière des heures
//   · CalAllDayBand  — bande « journée entière » / multi-jours (hors grille horaire)
// Aucune animation de survol (préférence MEGGA).

import { memo, useMemo, useRef, useState } from 'react'
import { calLayout, calTypeStyle, useCalPalette, type CalEvent } from './data'
import { CAL_HOUR_END, CAL_HOUR_START, calSetBodyDrag, fmtTime, sameDay } from './helpers'

// Heure (snap 30 min) à partir d'un clic dans une colonne de jour.
function calSlotFromClick(e: React.MouseEvent<HTMLElement>, day: Date): Date {
  const rect = e.currentTarget.getBoundingClientRect()
  const frac = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
  let mins = CAL_HOUR_START * 60 + frac * (CAL_HOUR_END - CAL_HOUR_START) * 60
  mins = Math.round(mins / 30) * 30
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  d.setMinutes(mins)
  return d
}

// ─── Bloc événement (partagé Semaine / Jour) ────────────────────────────────
interface CalEventBlockProps {
  e: CalEvent
  topCss: string
  heightCss: string
  left: string
  width: string
  selected: boolean
  past: boolean
  onSelect: (id: string, rect: DOMRect) => void
  onUpdate?: (id: string, start: Date, end: Date) => void
  onCommit?: (id: string, mode: 'move' | 'resize', start: Date, end: Date, title: string) => void
  roomy: boolean
  durH: number
}

interface DragState {
  mode: 'move' | 'resize',
  startY: number
  pxPerMin: number
  origStartMin: number
  origEndMin: number
  dur: number
  base: Date
  moved: boolean
  lastKey: string
  lastStart?: Date
  lastEnd?: Date
}

export const CalEventBlock = memo(function CalEventBlock({
  e, topCss, heightCss, left, width, selected, past, onSelect, onUpdate, onCommit, roomy, durH,
}: CalEventBlockProps) {
  const SP = useCalPalette()
  const t = calTypeStyle(e, SP)
  const ext = !!e.external
  const hasStatus = e.status === 'done' || e.status === 'cancelled'
  const short = durH < 0.75 // ≤ 30 min → une seule ligne (heure + titre)
  const dk = SP.isDark
  const surface = t.bg
  const titleCol = t.ink
  const timeCol = t.ink

  const btnRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [dragging, setDragging] = useState(false)

  const DAY_MIN = CAL_HOUR_START * 60
  const DAY_END = CAL_HOUR_END * 60
  const minutesOf = (d: Date) => d.getHours() * 60 + d.getMinutes()

  const onDragMove = (ev: PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dyPx = ev.clientY - d.startY
    if (!d.moved && Math.abs(dyPx) > 3) { d.moved = true; setDragging(true) }
    if (!d.moved) return
    const deltaMin = Math.round((dyPx / d.pxPerMin) / 15) * 15
    let ns = d.origStartMin
    let ne = d.origEndMin
    if (d.mode === 'move') {
      ns = Math.max(DAY_MIN, Math.min(d.origStartMin + deltaMin, DAY_END - d.dur))
      ne = ns + d.dur
    } else {
      ne = Math.max(d.origStartMin + 15, Math.min(d.origEndMin + deltaMin, DAY_END))
      ns = d.origStartMin
    }
    const key = ns + ':' + ne
    if (key === d.lastKey) return
    d.lastKey = key
    const start = new Date(d.base); start.setMinutes(ns)
    const end = new Date(d.base); end.setMinutes(ne)
    d.lastStart = start; d.lastEnd = end
    onUpdate?.(e.id, start, end)
  }

  const onDragEnd = () => {
    const d = dragRef.current
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
    calSetBodyDrag(null)
    dragRef.current = null
    setDragging(false)
    if (d && d.moved) {
      // Avale le clic de fin de glissé (ne pas ouvrir la bulle / créer un créneau).
      const swallow = (cev: MouseEvent) => { cev.stopPropagation(); cev.preventDefault() }
      window.addEventListener('click', swallow, true)
      setTimeout(() => window.removeEventListener('click', swallow, true), 0)
      if (onCommit && d.lastStart && d.lastEnd) onCommit(e.id, d.mode, d.lastStart, d.lastEnd, e.title)
    }
  }

  const beginDrag = (mode: 'move' | 'resize') => (ev: React.PointerEvent) => {
    if (!onUpdate || ev.button === 1 || ev.button === 2) return
    const col = btnRef.current && (btnRef.current.offsetParent as HTMLElement | null)
    const colH = col ? col.getBoundingClientRect().height : 0
    if (!colH) return
    ev.preventDefault()
    ev.stopPropagation()
    dragRef.current = {
      mode,
      startY: ev.clientY,
      pxPerMin: colH / ((CAL_HOUR_END - CAL_HOUR_START) * 60),
      origStartMin: minutesOf(e.start),
      origEndMin: minutesOf(e.end),
      dur: minutesOf(e.end) - minutesOf(e.start),
      base: (() => { const b = new Date(e.start); b.setHours(0, 0, 0, 0); return b })(),
      moved: false,
      lastKey: '',
    }
    calSetBodyDrag(mode === 'resize' ? 'ns-resize' : 'grabbing')
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
  }

  const boxShadow = dragging
    ? `0 0 0 2px ${SP.ring}, ${SP.shadowHover}`
    : selected
      ? `0 0 0 2px ${SP.ring}, ${SP.shadow}`
      : SP.shadowSm
  const gripCol = dk ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.72)'

  return (
    <button
      ref={btnRef}
      onPointerDown={onUpdate ? beginDrag('move') : undefined}
      onClick={ev => { ev.stopPropagation(); onSelect(e.id, ev.currentTarget.getBoundingClientRect()) }}
      style={{
        position: 'absolute', left, width, top: topCss, height: heightCss, minHeight: 20,
        borderRadius: 'var(--crm-radius-sm)',
        border: ext ? `1.4px dashed ${dk ? 'rgba(255,255,255,0.30)' : '#C4CAD2'}` : 0,
        background: surface, color: titleCol,
        padding: short ? '0 10px' : '5px 11px', textAlign: 'left', fontFamily: 'inherit',
        cursor: onUpdate ? (dragging ? 'grabbing' : 'grab') : 'pointer',
        touchAction: 'none', userSelect: 'none',
        boxShadow: ext && !selected ? 'none' : boxShadow,
        overflow: 'hidden', zIndex: dragging ? 30 : selected ? 6 : 3,
        opacity: (past || hasStatus) && !dragging ? 0.55 : 1,
        display: 'flex', flexDirection: short ? 'row' : 'column',
        alignItems: short ? 'center' : 'stretch', gap: short ? 6 : 1,
      }}
    >
      <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: timeCol, opacity: dk ? 0.82 : 0.72, flexShrink: 0 }}>
        {fmtTime(e.start)}
      </span>
      <span style={{
        fontSize: 'var(--crm-text-sm)', fontWeight: 500, letterSpacing: -0.2, lineHeight: 1.15, color: titleCol,
        textDecoration: hasStatus ? 'line-through' : 'none',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {e.title}
      </span>
      {roomy && !short && e.location && (
        <span style={{
          fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: t.ink, opacity: dk ? 0.82 : 0.78, marginTop: 1,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {e.location}
        </span>
      )}
      {onUpdate && !short && (
        <div
          onPointerDown={beginDrag('resize')}
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 11, cursor: 'ns-resize',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center', touchAction: 'none',
          }}
        >
          <div style={{
            width: 22, height: 3, borderRadius: 'var(--crm-radius-pill)', marginBottom: 2,
            background: gripCol, opacity: selected || dragging ? 1 : 0.55,
          }} />
        </div>
      )}
    </button>
  )
})

// ─── Colonne de jour (timeline) ─────────────────────────────────────────────
interface CalDayColumnProps {
  day: Date
  events: CalEvent[]
  now: Date
  selectedId: string | null
  onSelect: (id: string, rect: DOMRect) => void
  onUpdate: (id: string, start: Date, end: Date) => void
  onCommit: (id: string, mode: 'move' | 'resize', start: Date, end: Date, title: string) => void
  onCreateAt: (d: Date) => void
  isToday: boolean
  showLocation: boolean
}

export function CalDayColumn({
  day, events, now, selectedId, onSelect, onUpdate, onCommit, onCreateAt, isToday, showLocation,
}: CalDayColumnProps) {
  const SP = useCalPalette()
  const totalHours = CAL_HOUR_END - CAL_HOUR_START
  const dayKey = day.getFullYear() + '-' + day.getMonth() + '-' + day.getDate()
  const dayEvents = useMemo(
    () => events.filter(e => sameDay(e.start, day) && !e.allDay && sameDay(e.start, e.end)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, dayKey],
  )
  const layout = useMemo(() => calLayout(dayEvents), [dayEvents])
  const nowFrac = (now.getHours() + now.getMinutes() / 60 - CAL_HOUR_START) / totalHours

  return (
    <div
      onClick={e => onCreateAt(calSlotFromClick(e, day))}
      style={{
        position: 'relative', borderLeft: `1px solid ${SP.line}`,
        background: isToday ? SP.todayCol : 'transparent',
        display: 'flex', flexDirection: 'column', cursor: 'pointer', minWidth: 0,
      }}
    >
      {Array.from({ length: totalHours }).map((_, h) => (
        <div key={h} style={{ flex: 1, borderTop: h ? `1px solid ${SP.line}` : 0 }} />
      ))}

      {isToday && nowFrac >= 0 && nowFrac <= 1 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: `${nowFrac * 100}%`, height: 0, zIndex: 7, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', left: -4, top: -4, width: 9, height: 9, borderRadius: 'var(--crm-radius-pill)', background: SP.nowColor }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: -1, height: 2, background: SP.nowColor }} />
        </div>
      )}

      {dayEvents.map(e => {
        const startH = e.start.getHours() + e.start.getMinutes() / 60
        const durH = (e.end.getTime() - e.start.getTime()) / 3600000
        const topPct = ((startH - CAL_HOUR_START) / totalHours) * 100
        const hPct = (durH / totalHours) * 100
        const lo = layout.get(e.id) || { col: 0, cols: 1 }
        const left = `calc(3px + (100% - 6px) * ${lo.col} / ${lo.cols})`
        const width = `calc((100% - 6px) / ${lo.cols} - 3px)`
        const past = isToday && e.end < now
        const locked = e.isOccurrence || e.external
        return (
          <CalEventBlock
            key={e.id} e={e} topCss={`${topPct}%`} heightCss={`calc(${hPct}% - 3px)`}
            left={left} width={width} selected={e.id === selectedId} past={past}
            onSelect={onSelect}
            onUpdate={locked ? undefined : onUpdate}
            onCommit={locked ? undefined : onCommit}
            roomy={showLocation} durH={durH}
          />
        )
      })}
    </div>
  )
}

// ─── Gouttière des heures ───────────────────────────────────────────────────
export function CalHourGutter() {
  const SP = useCalPalette()
  const totalHours = CAL_HOUR_END - CAL_HOUR_START
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: totalHours }).map((_, i) => (
        <div key={i} style={{ flex: 1, position: 'relative', borderTop: i ? '1px solid transparent' : 0 }}>
          <div style={{ position: 'absolute', top: -7, right: 10, fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: SP.muted, letterSpacing: 0.2 }}>
            {String(CAL_HOUR_START + i).padStart(2, '0')}:00
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Bande « journée entière » / multi-jours ────────────────────────────────
interface CalAllDayBandProps {
  days: Date[]
  events: CalEvent[]
  selectedId: string | null
  onSelect: (id: string, rect: DOMRect) => void
}

interface BandSeg { e: CalEvent; sC: number; eC: number; lane: number }

export function CalAllDayBand({ days, events, selectedId, onSelect }: CalAllDayBandProps) {
  const SP = useCalPalette()
  const n = days.length
  const rangeStart = new Date(days[0]); rangeStart.setHours(0, 0, 0, 0)
  const rangeEnd = new Date(days[n - 1]); rangeEnd.setHours(23, 59, 59, 999)
  const items = events.filter(
    e => (e.allDay || !sameDay(e.start, e.end)) && e.start <= rangeEnd && e.end >= rangeStart,
  )
  if (items.length === 0) return null

  const colOf = (date: Date) => {
    for (let i = 0; i < n; i++) if (sameDay(days[i], date)) return i
    return date < rangeStart ? 0 : n - 1
  }
  const segs: BandSeg[] = items
    .map(e => {
      const sC = e.start < rangeStart ? 0 : colOf(e.start)
      const eC = e.end > rangeEnd ? n - 1 : colOf(e.end)
      return { e, sC: Math.max(0, sC), eC: Math.max(Math.max(0, sC), eC), lane: 0 }
    })
    .sort((a, b) => a.sC - b.sC || a.e.start.getTime() - b.e.start.getTime())

  // Affectation gloutonne en « couloirs » pour éviter les recouvrements.
  const lanes: BandSeg[][] = []
  segs.forEach(seg => {
    let li = 0
    while (true) {
      const lane = lanes[li] || (lanes[li] = [])
      if (lane.every(o => seg.sC > o.eC || seg.eC < o.sC)) { lane.push(seg); seg.lane = li; break }
      li++
    }
  })

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `64px repeat(${n}, minmax(0,1fr))`,
      gridTemplateRows: `repeat(${lanes.length}, 24px)`, rowGap: 3, padding: 'var(--crm-space-sm) var(--crm-space-lg)',
      borderBottom: `1px solid ${SP.line}`, flexShrink: 0,
    }}>
      {segs.map(seg => {
        const t = calTypeStyle(seg.e, SP)
        const done = seg.e.status === 'done' || seg.e.status === 'cancelled'
        const contFrom = seg.e.start < rangeStart
        const contTo = seg.e.end > rangeEnd
        return (
          <button
            key={seg.e.id} title={seg.e.title}
            onClick={ev => { ev.stopPropagation(); onSelect(seg.e.id, ev.currentTarget.getBoundingClientRect()) }}
            style={{
              gridColumn: `${seg.sC + 2} / span ${seg.eC - seg.sC + 1}`, gridRow: seg.lane + 1,
              margin: '0 3px', height: 22, border: 0, cursor: 'pointer', background: t.bg, color: t.ink,
              borderTopLeftRadius: contFrom ? 0 : 6, borderBottomLeftRadius: contFrom ? 0 : 6,
              borderTopRightRadius: contTo ? 0 : 6, borderBottomRightRadius: contTo ? 0 : 6,
              display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: '0 var(--crm-space-md)',
              boxShadow: seg.e.id === selectedId ? `0 0 0 2px ${SP.ring}` : 'none',
              opacity: done ? 0.55 : 1, overflow: 'hidden', fontFamily: 'inherit', textAlign: 'left',
            }}
          >
            <span style={{
              fontSize: 'var(--crm-text-sm)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              textDecoration: done ? 'line-through' : 'none',
            }}>
              {seg.e.title}
            </span>
          </button>
        )
      })}
    </div>
  )
}
