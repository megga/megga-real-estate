// MEGGA CRM Sugar v2 — Calendar Week view
// 1:1 port from `crm-calendar-sugar-week-month.jsx` (CalWeekView).

import { CAL_EVENT_TYPES, CAL_PALETTE, type CalEvent } from './data'
import { CAL_DAYS, fmtTime, sameDay } from './helpers'

interface CalWeekViewProps {
  events: CalEvent[]
  currentDate: Date
  now: Date
  selectedId: string | null
  onSelect: (id: string) => void
  onDateChange: (d: Date) => void
}

export function CalWeekView({
  events,
  currentDate,
  now,
  selectedId,
  onSelect,
  onDateChange,
}: CalWeekViewProps) {
  const SP = CAL_PALETTE
  const TYPES = CAL_EVENT_TYPES

  const monday = new Date(currentDate)
  const dow = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - dow)
  monday.setHours(0, 0, 0, 0)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    return d
  })

  const HOUR_START = 7
  const HOUR_END = 21
  const ROW_H = 48
  const TOTAL_H = (HOUR_END - HOUR_START) * ROW_H

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
      {/* Days header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '60px repeat(7, minmax(0, 1fr))',
          borderBottom: `1px solid ${SP.line}`,
          padding: '14px 8px 10px',
        }}
      >
        <div />
        {days.map((d, i) => {
          const isToday = sameDay(d, now)
          const isSelected = sameDay(d, currentDate)
          return (
            <button
              key={i}
              onClick={() => onDateChange(d)}
              style={{
                border: 0,
                background: 'transparent',
                fontFamily: 'inherit',
                cursor: 'pointer',
                padding: '6px 4px',
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: SP.muted,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {CAL_DAYS[d.getDay()]}
              </div>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  background: isToday ? SP.black : isSelected ? SP.cardSubtle : 'transparent',
                  color: isToday ? '#fff' : SP.ink,
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {d.getDate()}
              </div>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '60px repeat(7, minmax(0, 1fr))',
            position: 'relative',
            height: TOTAL_H,
          }}
        >
          {/* Hour col */}
          <div>
            {Array.from({ length: HOUR_END - HOUR_START }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: ROW_H,
                  position: 'relative',
                  borderTop: `1px solid ${SP.line}`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -7,
                    left: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    color: SP.muted,
                  }}
                >
                  {String(HOUR_START + i).padStart(2, '0')}:00
                </div>
              </div>
            ))}
          </div>
          {/* Day columns */}
          {days.map((d, i) => {
            const dayEvents = events.filter(e => sameDay(e.start, d))
            const isToday = sameDay(d, now)
            return (
              <div
                key={i}
                style={{
                  position: 'relative',
                  borderLeft: `1px solid ${SP.line}`,
                  background: isToday ? 'rgba(11,12,14,0.015)' : 'transparent',
                }}
              >
                {Array.from({ length: HOUR_END - HOUR_START }).map((_, h) => (
                  <div
                    key={h}
                    style={{ height: ROW_H, borderTop: `1px solid ${SP.line}` }}
                  />
                ))}
                {/* "now" line */}
                {isToday &&
                  (() => {
                    const nh = now.getHours() + now.getMinutes() / 60
                    if (nh < HOUR_START || nh > HOUR_END) return null
                    return (
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: (nh - HOUR_START) * ROW_H,
                          height: 2,
                          background: '#E54D38',
                          zIndex: 5,
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: -3,
                            top: -3,
                            width: 8,
                            height: 8,
                            borderRadius: 999,
                            background: '#E54D38',
                          }}
                        />
                      </div>
                    )
                  })()}
                {dayEvents.map(e => {
                  const t = TYPES[e.type]
                  const top =
                    (e.start.getHours() + e.start.getMinutes() / 60 - HOUR_START) * ROW_H
                  const h = Math.max(
                    28,
                    ((e.end.getTime() - e.start.getTime()) / 3600000) * ROW_H - 4,
                  )
                  const isSelected = e.id === selectedId
                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e.id)}
                      style={{
                        position: 'absolute',
                        left: 4,
                        right: 4,
                        top,
                        height: h,
                        borderRadius: 8,
                        border: 0,
                        background: t.bg,
                        color: t.ink,
                        padding: '5px 8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        boxShadow: isSelected
                          ? `0 0 0 2px ${SP.black}`
                          : '0 1px 2px rgba(0,0,0,0.04)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          opacity: 0.7,
                          marginBottom: 2,
                        }}
                      >
                        {fmtTime(e.start)}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {e.title}
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
