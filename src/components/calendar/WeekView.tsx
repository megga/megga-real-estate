import { format, startOfWeek, addDays, isToday, getHours, getMinutes } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { EVENT_CONFIG, HOURS, type CalendarEvent } from './calendar.types'
import { getEventsForDay, formatTime } from './calendarHelpers'
import DraggableEvent from './DraggableEvent'
import DroppableSlot from './DroppableSlot'
import TodayIndicator from './TodayIndicator'

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
  onClickSlot?: (date: Date) => void
}

export default function WeekView({ currentDate, events, onSelectEvent, onClickSlot }: WeekViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const todayInView = weekDays.some(d => isToday(d))

  return (
    <div className="rounded-xl border border-theme-border overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-theme-border">
        <div className="border-r border-theme-border" />
        {weekDays.map((day, i) => (
          <div key={i} className={cn(
            'px-2 py-3 text-center border-r border-theme-border/50',
            isToday(day) && 'bg-accent/5',
          )}>
            <div className="text-xs text-theme-tertiary uppercase">{format(day, 'EEE', { locale: fr })}</div>
            <div className={cn(
              'text-lg font-semibold mt-0.5 w-9 h-9 mx-auto flex items-center justify-center rounded-full',
              isToday(day) && 'bg-accent text-white',
              !isToday(day) && 'text-theme-primary',
            )}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[60px_repeat(7,1fr)] overflow-y-auto max-h-[600px] relative">
        {todayInView && <TodayIndicator />}
        {HOURS.map(hour => (
          <div key={hour} className="contents">
            <div className="h-16 border-r border-b border-theme-border/50 flex items-start justify-end pr-2 pt-0.5">
              <span className="text-xs text-theme-tertiary">{hour}:00</span>
            </div>
            {weekDays.map((day, di) => {
              const dayEvents = getEventsForDay(events, day)
              const hourEvents = dayEvents.filter(e => getHours(e.date) === hour)
              const slotId = `week-${format(day, 'yyyy-MM-dd')}-${hour.toString().padStart(2, '0')}-00`

              return (
                <DroppableSlot
                  key={di}
                  id={slotId}
                  className={cn(
                    'h-16 border-r border-b border-theme-border/50 relative cursor-pointer hover:bg-theme-hover/50',
                    isToday(day) && 'bg-accent/[0.02]',
                  )}
                >
                  <div
                    className="absolute inset-0"
                    onClick={() => onClickSlot?.(new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0))}
                  />
                  {hourEvents.map(event => {
                    const config = EVENT_CONFIG[event.type]
                    const startMin = getMinutes(event.date)
                    const durationMin = (event.endDate.getTime() - event.date.getTime()) / 60000
                    const topPx = (startMin / 60) * 64
                    const heightPx = Math.max((durationMin / 60) * 64, 20)

                    return (
                      <DraggableEvent key={event.id} event={event} className="absolute left-0.5 right-0.5 z-10">
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectEvent(event) }}
                          style={{ height: `${heightPx}px`, top: `${topPx}px` }}
                          className={cn(
                            'w-full px-1.5 py-0.5 rounded border text-[10px] leading-tight overflow-hidden transition-all hover:z-20 hover:brightness-95 cursor-grab active:cursor-grabbing absolute',
                            config.bg, config.color,
                          )}
                        >
                          <div className="font-medium truncate">{formatTime(event.date)}</div>
                          <div className="truncate opacity-80">{event.title.split(' — ')[0]}</div>
                        </button>
                      </DraggableEvent>
                    )
                  })}
                </DroppableSlot>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
