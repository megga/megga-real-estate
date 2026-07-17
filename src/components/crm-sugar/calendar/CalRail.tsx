// MEGGA CRM Sugar — Calendar — Rail gauche (transparent sur le fond du bento)
// Mini-mois navigable + filtres par type. La config des agendas externes ne vit
// PAS ici (choix produit) — uniquement dans Réglages › Intégrations.

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalIcon } from './CalIcon'
import { CAL_EVENT_TYPES, eventTypeColors, useCalPalette, type CalEvent } from './data'
import { calDays, calMonths, sameDay } from './helpers'

// ─── Mini-mois navigable ────────────────────────────────────────────────────
interface CalMiniMonthProps {
  currentDate: Date
  now: Date
  onDateChange: (d: Date) => void
  events: CalEvent[]
}

function CalMiniMonth({ currentDate, now, onDateChange, events }: CalMiniMonthProps) {
  const SP = useCalPalette()
  const months = calMonths()
  // Lettres jour, lundi en tête.
  const dayLetters = [1, 2, 3, 4, 5, 6, 0].map(i => (calDays()[i] || '')[0])
  const [viewMonth, setViewMonth] = useState(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
  useEffect(() => { setViewMonth(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)) }, [currentDate])

  const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
  const startOffset = (first.getDay() + 6) % 7
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  const eventDays = new Set(
    events
      .filter(e => e.start.getFullYear() === viewMonth.getFullYear() && e.start.getMonth() === viewMonth.getMonth())
      .map(e => e.start.getDate()),
  )

  const navBtn: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 999, border: 0, background: 'transparent',
    cursor: 'pointer', display: 'grid', placeItems: 'center',
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontSize: 13.5, fontWeight: 800, color: SP.ink, letterSpacing: -0.2 }}>
          {months[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button
            style={navBtn}
            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
            onMouseEnter={e => { e.currentTarget.style.background = SP.cardSubtle }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <CalIcon name="chevL" size={13} stroke={SP.inkSoft} />
          </button>
          <button
            style={navBtn}
            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
            onMouseEnter={e => { e.currentTarget.style.background = SP.cardSubtle }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <CalIcon name="chevR" size={13} stroke={SP.inkSoft} />
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1, marginBottom: 3 }}>
        {dayLetters.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: SP.muted, padding: '3px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />
          const dt = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d)
          const isSelected = sameDay(dt, currentDate)
          const isToday = sameDay(dt, now)
          const hasEvent = eventDays.has(d)
          return (
            <button
              key={i}
              onClick={() => onDateChange(dt)}
              style={{
                aspectRatio: '1 / 1', border: 0, cursor: 'pointer', fontFamily: 'inherit',
                background: isSelected ? '#6F8CFF' : 'transparent',
                color: isSelected ? '#FFFFFF' : SP.ink,
                boxShadow: !isSelected && isToday ? `inset 0 0 0 1.5px ${SP.ring}` : 'none',
                fontSize: 11.5, fontWeight: 700, borderRadius: 999, position: 'relative',
                display: 'grid', placeItems: 'center',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = SP.cardSubtle }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
            >
              {d}
              {hasEvent && !isSelected && (
                <span style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 3.5, height: 3.5, borderRadius: 999, background: SP.ink }} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Filtres par type (afficher / masquer) ──────────────────────────────────
interface CalTypeFiltersProps {
  filters: Record<string, boolean>
  onFilters: (f: Record<string, boolean>) => void
  events: CalEvent[]
}

function CalTypeFilters({ filters, onFilters, events }: CalTypeFiltersProps) {
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  const countOf = (id: string) => events.filter(e => e.type === id).length
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: SP.muted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, paddingLeft: 4 }}>
        {t('panel.eventTypes')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Object.values(CAL_EVENT_TYPES).map(type => {
          const shown = filters[type.id] !== false
          const dotColor = eventTypeColors(type, SP.isDark).accent
          return (
            <button
              key={type.id}
              onClick={() => onFilters({ ...filters, [type.id]: !shown })}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: 0,
                background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', width: '100%',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = SP.cardSubtle }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{
                width: 13, height: 13, borderRadius: 4, flexShrink: 0,
                background: shown ? dotColor : 'transparent',
                boxShadow: shown ? 'none' : `inset 0 0 0 1.5px ${SP.ghost}`,
              }} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, color: shown ? SP.ink : SP.muted }}>{type.label}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: SP.muted, fontVariantNumeric: 'tabular-nums' }}>{countOf(type.id)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Rail (assemblage) ──────────────────────────────────────────────────────
interface CalRailProps {
  currentDate: Date
  now: Date
  onDateChange: (d: Date) => void
  events: CalEvent[]
  filters: Record<string, boolean>
  onFilters: (f: Record<string, boolean>) => void
}

export function CalRail({ currentDate, now, onDateChange, events, filters, onFilters }: CalRailProps) {
  const SP = useCalPalette()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <CalMiniMonth currentDate={currentDate} now={now} onDateChange={onDateChange} events={events} />
      <div style={{ height: 1, background: SP.line }} />
      <CalTypeFilters filters={filters} onFilters={onFilters} events={events} />
    </div>
  )
}
