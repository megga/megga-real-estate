// MEGGA CRM Sugar v2 — Calendar Week view
// 1:1 port from `crm-calendar-sugar-week-month.jsx` (CalWeekView).

import { CAL_EVENT_TYPES, calLayout, eventTypeColors, useCalPalette, type CalEvent } from './data'
import { CAL_DAYS, fmtTime, sameDay } from './helpers'

interface CalWeekViewProps {
  events: CalEvent[]
  currentDate: Date
  now: Date
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit?: (id: string) => void
  onDateChange: (d: Date) => void
}

export function CalWeekView({
  events,
  currentDate,
  now,
  selectedId,
  onSelect,
  onEdit,
  onDateChange,
}: CalWeekViewProps) {
  const SP = useCalPalette()
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
  const HOURS = HOUR_END - HOUR_START

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
                  background: isToday ? SP.accent : isSelected ? SP.cardSubtle : 'transparent',
                  color: isToday ? SP.onAccent : SP.ink,
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

      {/* Grid — hauteur FLUIDE (#3) : la grille remplit toute la hauteur dispo
          (cellules flex:1), events positionnés en %. Plancher 760px, scroll si
          la fenêtre est trop courte. Chevauchement (#4) géré par jour via
          calLayout (col/cols). Statut (#10) : opacité + titre barré. */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '60px repeat(7, minmax(0, 1fr))',
            gridTemplateRows: '1fr',
            position: 'relative',
            flex: 1,
            minHeight: 760,
          }}
        >
          {/* Hour col */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: HOURS }).map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
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
            const layout = calLayout(dayEvents)
            const isToday = sameDay(d, now)
            return (
              <div
                key={i}
                style={{
                  position: 'relative',
                  borderLeft: `1px solid ${SP.line}`,
                  background: isToday ? SP.todayCol : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {Array.from({ length: HOURS }).map((_, h) => (
                  <div
                    key={h}
                    style={{ flex: 1, borderTop: `1px solid ${SP.line}` }}
                  />
                ))}
                {/* "now" line — positionnée en % */}
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
                          top: `${((nh - HOUR_START) / HOURS) * 100}%`,
                          height: 2,
                          background: SP.nowColor,
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
                            background: SP.nowColor,
                          }}
                        />
                      </div>
                    )
                  })()}
                {dayEvents.map(e => {
                  const tc = eventTypeColors(TYPES[e.type], SP.isDark)
                  const startH = e.start.getHours() + e.start.getMinutes() / 60
                  const durH = (e.end.getTime() - e.start.getTime()) / 3600000
                  const slot = layout.get(e.id) ?? { col: 0, cols: 1 }
                  const widthPct = 100 / slot.cols
                  const isSelected = e.id === selectedId
                  const cancelled = e.status === 'cancelled'
                  const muted = cancelled || e.status === 'done'
                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e.id)}
                      onDoubleClick={() => onEdit?.(e.id)}
                      style={{
                        position: 'absolute',
                        top: `${((startH - HOUR_START) / HOURS) * 100}%`,
                        height: `calc(${(durH / HOURS) * 100}% - 4px)`,
                        minHeight: 34,
                        left: `calc(${slot.col * widthPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                        borderRadius: 8,
                        border: 0,
                        background: tc.bg,
                        color: tc.ink,
                        padding: '5px 8px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        opacity: muted ? 0.5 : 1,
                        boxShadow: isSelected
                          ? `0 0 0 2px ${SP.ring}`
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
                          textDecoration: cancelled ? 'line-through' : 'none',
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
