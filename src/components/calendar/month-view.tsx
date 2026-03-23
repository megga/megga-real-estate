import { useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { eventColorStyles } from '@/components/calendar/calendar-event-item'
import type { CalendarEvent } from '@/components/calendar/week-view-types'
import { isMultiDayEvent } from '@/lib/event-utils'

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MAX_VISIBLE_EVENTS = 3

interface MonthViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onEventClick?: (event: CalendarEvent) => void
  selectedEventId?: string
  onBackgroundClick?: () => void
  onSlotClick?: (date: Date) => void
  className?: string
}

/** Get events that fall on a given day (all-day, multi-day, or timed) */
function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => {
      if (e.isAllDay || isMultiDayEvent(e)) {
        // Multi-day: check if day is within start..end range
        const eventStart = new Date(e.start.getFullYear(), e.start.getMonth(), e.start.getDate())
        const eventEnd = new Date(e.end.getFullYear(), e.end.getMonth(), e.end.getDate())
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate())
        return dayStart >= eventStart && dayStart <= eventEnd
      }
      return isSameDay(e.start, day)
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay || isMultiDayEvent(event)) return ''
  const h = event.start.getHours()
  const m = event.start.getMinutes()
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

export function MonthView({
  currentDate,
  events,
  onEventClick,
  selectedEventId,
  onBackgroundClick,
  onSlotClick,
  className,
}: MonthViewProps) {
  // Compute the 6-week grid of days
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(currentDate)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentDate])

  // Split into rows of 7
  const weeks = useMemo(() => {
    const result: Date[][] = []
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7))
    }
    return result
  }, [days])

  // Pre-compute events per day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const day of days) {
      const key = format(day, 'yyyy-MM-dd')
      map.set(key, getEventsForDay(events, day))
    }
    return map
  }, [days, events])

  return (
    <div
      className={cn('flex h-full flex-col', className)}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (!target.closest('[data-event-pill]')) {
          onBackgroundClick?.()
        }
      }}
    >
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-theme-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-xs font-medium text-theme-tertiary uppercase tracking-wider"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="flex-1 grid grid-rows-[repeat(auto-fill,minmax(0,1fr))]" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-theme-border/50 last:border-b-0">
            {week.map((day) => {
              const key = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDay.get(key) ?? []
              const inMonth = isSameMonth(day, currentDate)
              const today = isToday(day)
              const isWeekend = day.getDay() === 0 || day.getDay() === 6

              return (
                <div
                  key={key}
                  className={cn(
                    'border-r border-theme-border/50 last:border-r-0 px-1 py-1 min-h-0 overflow-hidden cursor-pointer transition-colors hover:bg-theme-hover/30',
                    !inMonth && 'opacity-40',
                    isWeekend && inMonth && 'bg-theme-hover/20',
                  )}
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest('[data-event-pill]')) {
                      onSlotClick?.(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0))
                    }
                  }}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-center mb-0.5">
                    <span
                      className={cn(
                        'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full',
                        today && 'bg-accent text-white',
                        !today && inMonth && 'text-theme-primary',
                        !today && !inMonth && 'text-theme-tertiary',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Event pills */}
                  <div className="space-y-px">
                    {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => {
                      const color = event.color ?? 'blue'
                      const styles = eventColorStyles[color]
                      const isSelected = event.id === selectedEventId
                      const time = formatEventTime(event)

                      return (
                        <button
                          key={event.id}
                          data-event-pill
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick?.(event)
                          }}
                          className={cn(
                            'w-full text-left text-[10px] leading-tight px-1.5 py-0.5 rounded truncate transition-all',
                            isSelected
                              ? cn(styles.border, 'text-white')
                              : cn(styles.bg, styles.text, 'hover:brightness-90'),
                          )}
                        >
                          {time && <span className="font-medium">{time} </span>}
                          {event.title}
                        </button>
                      )
                    })}
                    {dayEvents.length > MAX_VISIBLE_EVENTS && (
                      <span className="text-[10px] text-theme-tertiary px-1.5">
                        +{dayEvents.length - MAX_VISIBLE_EVENTS} de plus
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
