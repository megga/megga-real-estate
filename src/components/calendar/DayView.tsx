import { format, isToday, getHours } from 'date-fns'
import { fr } from 'date-fns/locale'
import { User, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EVENT_CONFIG, HOURS, type CalendarEvent } from './calendar.types'
import { getEventsForDay, formatTime } from './calendarHelpers'

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
  onClickSlot?: (date: Date) => void
}

export default function DayView({ currentDate, events, onSelectEvent, onClickSlot }: DayViewProps) {
  const dayEvents = getEventsForDay(events, currentDate)

  return (
    <div className="rounded-xl border border-theme-border overflow-hidden">
      {/* Header */}
      <div className={cn(
        'px-5 py-4 border-b border-theme-border',
        isToday(currentDate) && 'bg-accent/5',
      )}>
        <div className="text-sm text-theme-tertiary capitalize">{format(currentDate, 'EEEE', { locale: fr })}</div>
        <div className={cn(
          'text-2xl font-bold',
          isToday(currentDate) ? 'text-accent' : 'text-theme-primary',
        )}>
          {format(currentDate, 'd MMMM yyyy', { locale: fr })}
        </div>
        <div className="text-sm text-theme-tertiary mt-1">
          {dayEvents.length === 0 ? 'Aucun événement' : `${dayEvents.length} événement${dayEvents.length > 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Timeline */}
      <div className="max-h-[600px] overflow-y-auto">
        {HOURS.map(hour => {
          const hourEvents = dayEvents.filter(e => getHours(e.date) === hour)

          return (
            <div key={hour} className="flex border-b border-theme-border/30">
              <div className="w-16 shrink-0 py-3 pr-3 text-right">
                <span className="text-xs text-theme-tertiary">{hour}:00</span>
              </div>
              <div
                onClick={() => onClickSlot?.(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, 0))}
                className="flex-1 py-1.5 pr-4 min-h-[64px] border-l border-theme-border/50 pl-3 space-y-1.5 cursor-pointer hover:bg-theme-hover/30"
              >
                {hourEvents.map(event => {
                  const config = EVENT_CONFIG[event.type]
                  const Icon = config.icon

                  return (
                    <button
                      key={event.id}
                      onClick={(e) => { e.stopPropagation(); onSelectEvent(event) }}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-all hover:brightness-95',
                        config.bg,
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={cn('w-4 h-4 shrink-0', config.color)} />
                        <span className={cn('text-xs font-medium', config.color)}>{config.label}</span>
                        <span className="text-xs text-theme-tertiary ml-auto">
                          {formatTime(event.date)} — {formatTime(event.endDate)}
                        </span>
                      </div>
                      <div className="font-medium text-sm text-theme-primary mt-1">{event.title}</div>
                      {event.contact && (
                        <div className="text-xs text-theme-tertiary mt-0.5 flex items-center gap-1">
                          <User className="w-3 h-3" /> {event.contact}
                        </div>
                      )}
                      {event.address && (
                        <div className="text-xs text-theme-tertiary mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {event.address}
                        </div>
                      )}
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
