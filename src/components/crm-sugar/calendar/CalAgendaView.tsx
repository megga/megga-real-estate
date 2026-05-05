// MEGGA CRM Sugar v2 — Calendar Agenda view
// 1:1 port from `crm-calendar-sugar-week-month.jsx` (CalAgendaView).

import { useMemo } from 'react'
import { CalIcon } from './CalIcon'
import { CAL_EVENT_TYPES, CAL_PALETTE, type CalEvent } from './data'
import { CAL_DAYS_FULL, CAL_MONTHS, fmtTime, sameDay } from './helpers'

interface CalAgendaViewProps {
  events: CalEvent[]
  now: Date
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CalAgendaView({ events, now, selectedId, onSelect }: CalAgendaViewProps) {
  const SP = CAL_PALETTE
  const TYPES = CAL_EVENT_TYPES

  const grouped = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime())
    const map = new Map<string, CalEvent[]>()
    sorted.forEach(e => {
      const k = e.start.toDateString()
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(e)
    })
    return Array.from(map.entries())
  }, [events])

  return (
    <div
      style={{
        flex: 1,
        background: SP.card,
        borderRadius: 24,
        boxShadow: SP.shadow,
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {grouped.map(([k, list]) => {
          const d = new Date(k)
          const isToday = sameDay(d, now)
          return (
            <div key={k}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: `1px solid ${SP.line}`,
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: SP.ink,
                    letterSpacing: -0.6,
                  }}
                >
                  {d.getDate()}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: isToday ? SP.ink : SP.muted,
                    letterSpacing: -0.1,
                  }}
                >
                  {CAL_DAYS_FULL[d.getDay()]} {CAL_MONTHS[d.getMonth()].toLowerCase()}
                </div>
                {isToday && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      padding: '2px 7px',
                      borderRadius: 999,
                      background: SP.black,
                      color: '#fff',
                      letterSpacing: 0.6,
                    }}
                  >
                    AUJOURD'HUI
                  </span>
                )}
                <div
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    color: SP.muted,
                    fontWeight: 600,
                  }}
                >
                  {list.length} événement{list.length > 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {list.map(e => {
                  const t = TYPES[e.type]
                  const isSelected = e.id === selectedId
                  return (
                    <button
                      key={e.id}
                      onClick={() => onSelect(e.id)}
                      style={{
                        border: 0,
                        background: isSelected ? SP.cardSubtle : 'transparent',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        padding: '10px 14px',
                        borderRadius: 12,
                        textAlign: 'left',
                        display: 'grid',
                        gridTemplateColumns: '100px 4px 1fr auto',
                        gap: 14,
                        alignItems: 'center',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: SP.ink,
                        }}
                      >
                        {fmtTime(e.start)}
                        <span style={{ color: SP.muted, fontWeight: 500 }}>
                          {' '}
                          – {fmtTime(e.end)}
                        </span>
                      </div>
                      <div
                        style={{
                          width: 4,
                          height: 32,
                          borderRadius: 4,
                          background: t.dark ? t.bg : t.accent,
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: SP.ink,
                            letterSpacing: -0.2,
                          }}
                        >
                          {e.title}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: SP.muted,
                            fontWeight: 500,
                            marginTop: 2,
                          }}
                        >
                          {t.label}
                          {e.location && <> · {e.location}</>}
                        </div>
                      </div>
                      <CalIcon name="chevR" size={14} stroke={SP.muted} sw={2} />
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
