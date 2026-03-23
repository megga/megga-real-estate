import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { EVENT_CONFIG, type CalendarEvent } from './calendar.types'
import { getEventsForDay, formatTime } from './calendarHelpers'
import DraggableEvent from './DraggableEvent'
import DroppableSlot from './DroppableSlot'

interface MonthViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
  onClickSlot?: (date: Date) => void
}

export default function MonthView({ currentDate, events, onSelectEvent, onClickSlot }: MonthViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

  return (
    <div className="rounded-xl border border-theme-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-theme-border">
        {weekDays.map(day => (
          <div key={day} className="px-2 py-3 text-center text-xs font-medium text-theme-tertiary uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const dayEvents = getEventsForDay(events, day)
          const inMonth = isSameMonth(day, currentDate)
          const today = isToday(day)
          const slotId = `month-${format(day, 'yyyy-MM-dd')}`

          return (
            <DroppableSlot
              key={idx}
              id={slotId}
              className={cn(
                'min-h-[100px] lg:min-h-[120px] border-b border-r border-theme-border/50 p-1.5 transition-colors cursor-pointer hover:bg-theme-hover/30',
                !inMonth && 'bg-theme-hover/50',
                today && 'bg-accent/5',
              )}
            >
              <div
                onClick={() => onClickSlot?.(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10, 0))}
              >
                <div className={cn(
                  'text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full',
                  today && 'bg-accent text-white',
                  !today && inMonth && 'text-theme-primary',
                  !today && !inMonth && 'text-theme-tertiary',
                )}>
                  {format(day, 'd')}
                </div>
              </div>

              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(event => {
                  const config = EVENT_CONFIG[event.type]
                  return (
                    <DraggableEvent
                      key={event.id}
                      event={event}
                      onClick={(e) => { e.stopPropagation(); onSelectEvent(event) }}
                    >
                      <div
                        className={cn(
                          'w-full text-left text-[11px] leading-tight px-1.5 py-1 rounded-lg truncate border transition-all hover:brightness-95',
                          config.bg, config.color,
                        )}
                      >
                        {formatTime(event.date)} {event.title.split(' — ')[0].split(' ').slice(0, 3).join(' ')}
                      </div>
                    </DraggableEvent>
                  )
                })}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-theme-tertiary px-1.5">+{dayEvents.length - 3} de plus</span>
                )}
              </div>
            </DroppableSlot>
          )
        })}
      </div>
    </div>
  )
}
