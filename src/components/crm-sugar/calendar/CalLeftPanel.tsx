// MEGGA CRM Sugar v2 — Calendar left panel (mini-month + filters + hot buyers + AI insights)
// 1:1 port from `crm-calendar-sugar-panels.jsx` (CalLeftPanel + sub-cards).

import { useEffect, useState } from 'react'
import { CalIcon } from './CalIcon'
import {
  CAL_EVENT_TYPES, CAL_PALETTE,
  type CalAIInsight, type CalEvent, type CalHotBuyer,
} from './data'
import { CAL_MONTHS, sameDay } from './helpers'

interface CalLeftPanelProps {
  currentDate: Date
  onDateChange: (d: Date) => void
  events: CalEvent[]
  filters: Record<string, boolean>
  onFilters: (f: Record<string, boolean>) => void
  hotBuyers: CalHotBuyer[]
  aiInsights: CalAIInsight[]
  onSelectEvent: (id: string) => void
}

export function CalLeftPanel({
  currentDate,
  onDateChange,
  events,
  filters,
  onFilters,
  hotBuyers,
  aiInsights,
  onSelectEvent,
}: CalLeftPanelProps) {
  return (
    <aside
      style={{
        width: 280,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        overflowY: 'auto',
        paddingRight: 4,
      }}
    >
      <CalMiniMonth
        currentDate={currentDate}
        onDateChange={onDateChange}
        events={events}
      />
      <CalTypeFilters filters={filters} onFilters={onFilters} />
      <CalHotBuyers buyers={hotBuyers} />
      <CalAIInsights insights={aiInsights} onSelectEvent={onSelectEvent} />
    </aside>
  )
}

interface CalMiniMonthProps {
  currentDate: Date
  onDateChange: (d: Date) => void
  events: CalEvent[]
}

function CalMiniMonth({ currentDate, onDateChange, events }: CalMiniMonthProps) {
  const SP = CAL_PALETTE
  const [viewMonth, setViewMonth] = useState(
    () => new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
  )

  useEffect(() => {
    setViewMonth(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
  }, [currentDate])

  const firstDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1)
  const lastDay = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = lastDay.getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)

  const eventDays = new Set(
    events
      .filter(
        e =>
          e.start.getFullYear() === viewMonth.getFullYear() &&
          e.start.getMonth() === viewMonth.getMonth(),
      )
      .map(e => e.start.getDate()),
  )

  const miniNav: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: 6,
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    display: 'grid',
    placeItems: 'center',
  }

  return (
    <div
      style={{
        background: SP.card,
        borderRadius: 18,
        padding: 16,
        boxShadow: SP.shadowSm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: SP.ink,
            letterSpacing: -0.2,
          }}
        >
          {CAL_MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() =>
              setViewMonth(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1),
              )
            }
            style={miniNav}
          >
            <CalIcon name="chevL" size={12} stroke={SP.inkSoft} />
          </button>
          <button
            onClick={() =>
              setViewMonth(
                new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1),
              )
            }
            style={miniNav}
          >
            <CalIcon name="chevR" size={12} stroke={SP.inkSoft} />
          </button>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          marginBottom: 4,
        }}
      >
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <div
            key={i}
            style={{
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: SP.muted,
              letterSpacing: 0.6,
              padding: '4px 0',
            }}
          >
            {d}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
        }}
      >
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />
          const dt = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d)
          const isSelected = sameDay(dt, currentDate)
          const hasEvent = eventDays.has(d)
          return (
            <button
              key={i}
              onClick={() => onDateChange(dt)}
              style={{
                aspectRatio: '1/1',
                border: 0,
                background: isSelected ? SP.black : 'transparent',
                color: isSelected ? '#fff' : SP.ink,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
                borderRadius: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                transition: 'background .15s',
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.background = SP.cardSubtle
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.background = 'transparent'
              }}
            >
              {d}
              {hasEvent && !isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: SP.ink,
                  }}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface CalTypeFiltersProps {
  filters: Record<string, boolean>
  onFilters: (f: Record<string, boolean>) => void
}

function CalTypeFilters({ filters, onFilters }: CalTypeFiltersProps) {
  const SP = CAL_PALETTE
  const TYPES = CAL_EVENT_TYPES
  return (
    <div
      style={{
        background: SP.card,
        borderRadius: 18,
        padding: 14,
        boxShadow: SP.shadowSm,
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: SP.muted,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 10,
        }}
      >
        Filtrer par type
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {Object.values(TYPES).map(t => {
          const active = filters[t.id] !== false
          return (
            <button
              key={t.id}
              onClick={() => onFilters({ ...filters, [t.id]: !active })}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 10px',
                border: 0,
                borderRadius: 10,
                fontFamily: 'inherit',
                background: active ? SP.cardSubtle : 'transparent',
                color: active ? SP.ink : SP.muted,
                opacity: active ? 1 : 0.5,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all .15s',
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: t.dark ? t.bg : t.accent,
                }}
              />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CalHotBuyers({ buyers }: { buyers: CalHotBuyer[] }) {
  const SP = CAL_PALETTE
  return (
    <div
      style={{
        background: SP.card,
        borderRadius: 18,
        padding: 16,
        boxShadow: SP.shadowSm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 10,
        }}
      >
        <CalIcon name="flame" size={12} stroke={SP.ink} sw={2.2} />
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: SP.ink,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Acheteurs chauds
        </div>
        <div
          style={{
            marginLeft: 'auto',
            padding: '2px 7px',
            borderRadius: 999,
            background: SP.black,
            color: '#fff',
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: 0.4,
          }}
        >
          AI
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {buyers.map(b => (
          <button
            key={b.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: 10,
              border: 0,
              borderRadius: 12,
              background: SP.cardSubtle,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
              transition: 'all .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#EBEEF2')}
            onMouseLeave={e => (e.currentTarget.style.background = SP.cardSubtle)}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 999,
                background: SP.black,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 10.5,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {b.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: SP.ink,
                    letterSpacing: -0.1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {b.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: SP.ink,
                    flexShrink: 0,
                  }}
                >
                  {b.warm}%
                </span>
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: SP.muted,
                  fontWeight: 500,
                  lineHeight: 1.35,
                }}
              >
                {b.reason}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

interface CalAIInsightsProps {
  insights: CalAIInsight[]
  onSelectEvent: (id: string) => void
}

function CalAIInsights({ insights, onSelectEvent }: CalAIInsightsProps) {
  const SP = CAL_PALETTE
  if (!insights || insights.length === 0) return null
  return (
    <div
      style={{
        background: SP.card,
        borderRadius: 18,
        padding: 16,
        boxShadow: SP.shadowSm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 10,
        }}
      >
        <CalIcon name="sparkle" size={12} stroke={SP.ink} sw={2.2} />
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: SP.ink,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          MEGGA AI
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {insights.map(ins => {
          const isWarn = ins.severity === 'warning'
          return (
            <div
              key={ins.id}
              style={{
                padding: 11,
                borderRadius: 12,
                background: isWarn ? '#FBF1E6' : SP.cardSubtle,
                border: isWarn ? '1px solid #F2D2A8' : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <CalIcon
                  name={isWarn ? 'warn' : 'sparkle'}
                  size={11}
                  stroke={isWarn ? '#A8631C' : SP.ink}
                  sw={2.2}
                />
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: isWarn ? '#7A4A14' : SP.ink,
                    letterSpacing: -0.1,
                  }}
                >
                  {ins.title}
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: SP.inkSoft,
                  fontWeight: 500,
                  lineHeight: 1.4,
                  marginBottom: 6,
                }}
              >
                {ins.detail}
              </div>
              <button
                onClick={() => ins.events && ins.events[0] && onSelectEvent(ins.events[0])}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: SP.ink,
                  background: 'transparent',
                  border: 0,
                  padding: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                {ins.suggestion}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
