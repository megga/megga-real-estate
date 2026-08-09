// MEGGA CRM Sugar — Calendar — Vue Semaine (refonte « façon Google »)
// Grille aérée : en-tête des jours (clic n° → vue Jour), bande journée entière,
// corps scrollable 24 h (cadré sur ~7 h au montage), 7 colonnes timeline.

import { useEffect, useRef } from 'react'
import { useCalPalette, type CalEvent } from './data'
import { CAL_HOUR_END, CAL_HOUR_START, calDays, sameDay } from './helpers'
import { CalAllDayBand, CalDayColumn, CalHourGutter } from './CalGrid'

export interface CalViewProps {
  events: CalEvent[]
  currentDate: Date
  now: Date
  selectedId: string | null
  onSelectEvent: (id: string, rect: DOMRect) => void
  onUpdateEvent: (id: string, start: Date, end: Date) => void
  onCommitEvent: (id: string, mode: 'move' | 'resize', start: Date, end: Date, title: string) => void
  onCreateAt: (d: Date) => void
  onDateChange: (d: Date) => void
  onOpenDay: (d: Date) => void
}

const MIN_H = 1680 // 24 h → timeline haute (≈70px/heure), le corps scrolle

export function CalWeekView({
  events, currentDate, now, selectedId, onSelectEvent, onUpdateEvent, onCommitEvent, onCreateAt, onOpenDay,
}: CalViewProps) {
  const SP = useCalPalette()
  const days = calDays()

  const monday = new Date(currentDate)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  // Au montage, cadrer sur le matin (~7 h) pour ne pas ouvrir sur la nuit vide.
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let r1 = 0
    let r2 = 0
    const doScroll = () => {
      const el = bodyRef.current
      if (!el || !el.scrollHeight) return
      const th = CAL_HOUR_END - CAL_HOUR_START
      el.scrollTop = Math.max(0, ((7 - CAL_HOUR_START) / th) * el.scrollHeight - 10)
    }
    r1 = requestAnimationFrame(() => { doScroll(); r2 = requestAnimationFrame(doScroll) })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [])

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* En-tête des jours */}
      <div style={{
        display: 'grid', gridTemplateColumns: '64px repeat(7, minmax(0,1fr))',
        padding: 'var(--crm-space-md) var(--crm-space-lg) var(--crm-space-sm)', borderBottom: `1px solid ${SP.line}`, flexShrink: 0,
      }}>
        <div />
        {weekDays.map((d, i) => {
          const isToday = sameDay(d, now)
          return (
            <button
              key={i}
              onClick={() => onOpenDay(d)}
              style={{
                border: 0, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer',
                padding: 'var(--crm-space-xs) 0 var(--crm-space-2xs)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-2xs)',
              }}
            >
              <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 700, color: SP.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                {days[d.getDay()]}
              </span>
              <span style={{
                width: 34, height: 34, borderRadius: 'var(--crm-radius-pill)', display: 'grid', placeItems: 'center',
                background: isToday ? SP.accent : 'transparent', color: isToday ? SP.onAccent : SP.ink,
                fontSize: 'var(--crm-text-2xl)', fontWeight: 700, letterSpacing: -0.3,
              }}>
                {d.getDate()}
              </span>
            </button>
          )
        })}
      </div>

      <CalAllDayBand days={weekDays} events={events} selectedId={selectedId} onSelect={onSelectEvent} />

      {/* Corps scrollable */}
      <div ref={bodyRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 'var(--crm-space-md) var(--crm-space-lg) var(--crm-space-xl)' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '64px repeat(7, minmax(0,1fr))',
          height: '100%', minHeight: MIN_H, position: 'relative',
        }}>
          <CalHourGutter />
          {weekDays.map((d, i) => (
            <CalDayColumn
              key={i} day={d} events={events} now={now} selectedId={selectedId}
              onSelect={onSelectEvent} onUpdate={onUpdateEvent} onCommit={onCommitEvent}
              onCreateAt={onCreateAt} isToday={sameDay(d, now)} showLocation={false}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
