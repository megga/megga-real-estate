// MEGGA CRM Sugar v2 — Calendar Month view
// 1:1 port from `crm-calendar-sugar-week-month.jsx` (CalMonthView).

import { CAL_EVENT_TYPES, eventTypeColors, useCalPalette, type CalEvent } from './data'
import { fmtTime, sameDay } from './helpers'

interface CalMonthViewProps {
  events: CalEvent[]
  currentDate: Date
  now: Date
  onDateChange: (d: Date) => void
}

export function CalMonthView({ events, currentDate, now, onDateChange }: CalMonthViewProps) {
  const SP = useCalPalette()
  const TYPES = CAL_EVENT_TYPES

  const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const last = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const startOffset = (first.getDay() + 6) % 7

  interface Cell {
    d: Date
    mute: boolean
  }
  const cells: Cell[] = []
  for (let i = 0; i < startOffset; i++) {
    const d = new Date(first)
    d.setDate(d.getDate() - (startOffset - i))
    cells.push({ d, mute: true })
  }
  for (let i = 1; i <= last.getDate(); i++) {
    cells.push({
      d: new Date(currentDate.getFullYear(), currentDate.getMonth(), i),
      mute: false,
    })
  }
  while (cells.length % 7) {
    const d = new Date(cells[cells.length - 1].d)
    d.setDate(d.getDate() + 1)
    cells.push({ d, mute: true })
  }

  return (
    <div
      style={{
        flex: 1,
        background: SP.card,
        borderRadius: 24,
        boxShadow: SP.shadow,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          borderBottom: `1px solid ${SP.line}`,
        }}
      >
        {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map(d => (
          <div
            key={d}
            style={{
              padding: '14px 16px',
              fontSize: 11,
              fontWeight: 700,
              color: SP.muted,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              minWidth: 0,
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gridAutoRows: '1fr',
          overflow: 'hidden',
        }}
      >
        {cells.map((c, i) => {
          const dayEvents = events
            .filter(e => sameDay(e.start, c.d))
            .sort((a, b) => a.start.getTime() - b.start.getTime())
          const isToday = sameDay(c.d, now)
          const isSelected = sameDay(c.d, currentDate)
          return (
            <button
              key={i}
              onClick={() => onDateChange(c.d)}
              style={{
                border: 0,
                borderTop: `1px solid ${SP.line}`,
                borderLeft: i % 7 ? `1px solid ${SP.line}` : 0,
                background: isSelected ? SP.cardSubtle : 'transparent',
                padding: 8,
                fontFamily: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                minHeight: 100,
                minWidth: 0,
                opacity: c.mute ? 0.4 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 999,
                    display: 'grid',
                    placeItems: 'center',
                    background: isToday ? SP.accent : 'transparent',
                    color: isToday ? SP.onAccent : SP.ink,
                    fontSize: 11,
                    fontWeight: 700,
                  }}
                >
                  {c.d.getDate()}
                </div>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  overflow: 'hidden',
                }}
              >
                {dayEvents.slice(0, 3).map(e => {
                  const tc = eventTypeColors(TYPES[e.type], SP.isDark)
                  const muted = e.status === 'done' || e.status === 'cancelled'
                  return (
                    <div
                      key={e.id}
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: tc.bg,
                        color: tc.ink,
                        fontSize: 10,
                        fontWeight: 700,
                        lineHeight: 1.3,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        opacity: muted ? 0.5 : 1,
                        textDecoration: e.status === 'cancelled' ? 'line-through' : 'none',
                      }}
                    >
                      {fmtTime(e.start)} {e.title}
                    </div>
                  )
                })}
                {dayEvents.length > 3 && (
                  <div
                    style={{
                      fontSize: 10,
                      color: SP.muted,
                      fontWeight: 600,
                    }}
                  >
                    + {dayEvents.length - 3} autres
                  </div>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
