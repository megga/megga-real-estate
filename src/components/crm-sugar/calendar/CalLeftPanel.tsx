// MEGGA CRM Sugar v2 — Calendar left panel (mini-month + filters + hot buyers + AI insights)
// 1:1 port from `crm-calendar-sugar-panels.jsx` (CalLeftPanel + sub-cards).

import { useEffect, useRef, useState } from 'react'
import { CalIcon } from './CalIcon'
import {
  CAL_EVENT_TYPES, eventTypeColors, useCalPalette,
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
  const SP = useCalPalette()
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
                background: isSelected ? SP.accent : 'transparent',
                color: isSelected ? SP.onAccent : SP.ink,
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
  const SP = useCalPalette()
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
                  background: ((c) => (c.dark ? c.bg : c.accent))(eventTypeColors(t, SP.isDark)),
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

// ── Mécanique commune des widgets « stack » iOS (#11/#12) ───────────────────
// Une carte visible à la fois ; molette native {passive:false} qui cycle l'index
// sans scroller la page (anti-rebond ~320ms) ; pagination verticale cliquable.
function useCardStack(count: number) {
  const [index, setIndex] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const lastWheel = useRef(0)

  useEffect(() => {
    const el = viewportRef.current
    if (!el || count <= 1) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const now = Date.now()
      if (now - lastWheel.current < 320) return
      lastWheel.current = now
      setIndex(prev => Math.max(0, Math.min(count - 1, prev + (e.deltaY > 0 ? 1 : -1))))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [count])

  // Clamp dérivé au render (si la liste raccourcit) — évite un setState-in-effect.
  return { index: Math.min(index, Math.max(0, count - 1)), setIndex, viewportRef }
}

function CalStackDots({
  count,
  active,
  onPick,
}: {
  count: number
  active: number
  onPick: (i: number) => void
}) {
  const SP = useCalPalette()
  if (count <= 1) return null
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {Array.from({ length: count }).map((_, k) => (
        <button
          key={k}
          onClick={() => onPick(k)}
          aria-label={`Carte ${k + 1}`}
          style={{
            width: 6,
            height: k === active ? 18 : 6,
            borderRadius: 999,
            border: 0,
            padding: 0,
            background: k === active ? SP.ink : SP.ghost,
            cursor: 'pointer',
            transition: 'all .25s ease',
          }}
        />
      ))}
    </div>
  )
}

function CalHotBuyers({ buyers }: { buyers: CalHotBuyer[] }) {
  const SP = useCalPalette()
  const H = 116
  const { index, setIndex, viewportRef } = useCardStack(buyers.length)
  if (buyers.length === 0) return null
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
            background: SP.accent,
            color: SP.onAccent,
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: 0.4,
          }}
        >
          AI
        </div>
      </div>
      {/* Stack iOS : une carte à la fois, molette + pagination verticale. */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div ref={viewportRef} style={{ flex: 1, overflow: 'hidden', height: H }}>
          <div
            style={{
              transform: `translateY(-${index * H}px)`,
              transition: 'transform .42s cubic-bezier(.2,.8,.2,1)',
            }}
          >
            {buyers.map(b => (
              <div
                key={b.id}
                style={{
                  height: H,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 14,
                  borderRadius: 12,
                  background: SP.cardSubtle,
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 999,
                    background: SP.accent,
                    color: SP.onAccent,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 15,
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
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: SP.ink,
                        letterSpacing: -0.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {b.name}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: SP.muted,
                      fontWeight: 500,
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {b.reason}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <CalStackDots count={buyers.length} active={index} onPick={setIndex} />
      </div>
    </div>
  )
}

interface CalAIInsightsProps {
  insights: CalAIInsight[]
  onSelectEvent: (id: string) => void
}

function CalAIInsights({ insights, onSelectEvent }: CalAIInsightsProps) {
  const SP = useCalPalette()
  const H = 150
  const { index, setIndex, viewportRef } = useCardStack(insights?.length ?? 0)
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
      <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
        <div ref={viewportRef} style={{ flex: 1, overflow: 'hidden', height: H }}>
          <div
            style={{
              transform: `translateY(-${index * H}px)`,
              transition: 'transform .42s cubic-bezier(.2,.8,.2,1)',
            }}
          >
            {insights.map(ins => {
              const isWarn = ins.severity === 'warning'
              return (
                <div
                  key={ins.id}
                  style={{
                    height: H,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    padding: 12,
                    borderRadius: 12,
                    background: isWarn ? SP.warnBg : SP.cardSubtle,
                    border: isWarn ? `1px solid ${SP.warnBorder}` : 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 6,
                    }}
                  >
                    <CalIcon
                      name={isWarn ? 'warn' : 'sparkle'}
                      size={12}
                      stroke={isWarn ? SP.warnIcon : SP.ink}
                      sw={2.2}
                    />
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: isWarn ? SP.warnInk : SP.ink,
                        letterSpacing: -0.2,
                      }}
                    >
                      {ins.title}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13.5,
                      color: SP.inkSoft,
                      fontWeight: 500,
                      lineHeight: 1.4,
                      marginBottom: 'auto',
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {ins.detail}
                  </div>
                  <button
                    onClick={() => ins.events && ins.events[0] && onSelectEvent(ins.events[0])}
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: isWarn ? SP.warnInk : SP.ink,
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
        <CalStackDots count={insights.length} active={index} onPick={setIndex} />
      </div>
    </div>
  )
}
