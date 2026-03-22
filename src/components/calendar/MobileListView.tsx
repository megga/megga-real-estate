import { format, isToday, startOfMonth } from 'date-fns'
import { fr } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { EVENT_CONFIG, type CalendarEvent } from './calendar.types'
import { formatTime } from './calendarHelpers'

interface MobileListViewProps {
  events: CalendarEvent[]
  onSelectEvent: (event: CalendarEvent) => void
}

export default function MobileListView({ events, onSelectEvent }: MobileListViewProps) {
  const upcoming = [...events]
    .filter(e => e.date >= startOfMonth(new Date()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  let lastDate = ''

  return (
    <div className="space-y-2">
      {upcoming.map(event => {
        const config = EVENT_CONFIG[event.type]
        const Icon = config.icon
        const dateStr = format(event.date, 'EEEE d MMMM', { locale: fr })
        const showHeader = dateStr !== lastDate
        lastDate = dateStr

        return (
          <div key={event.id}>
            {showHeader && (
              <div className={cn(
                'text-sm font-semibold capitalize px-1 pt-3 pb-1',
                isToday(event.date) ? 'text-accent' : 'text-theme-primary',
              )}>
                {isToday(event.date) ? "Aujourd'hui" : dateStr}
              </div>
            )}
            <button
              onClick={() => onSelectEvent(event)}
              className="w-full text-left rounded-xl border border-theme-border p-3 flex items-start gap-3 hover:bg-theme-hover/50 transition-colors"
            >
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center shrink-0', config.bg)}>
                <Icon className={cn('w-5 h-5', config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge', config.bg, config.color)}>
                    {config.label}
                  </span>
                  <span className="text-xs text-theme-tertiary ml-auto shrink-0">
                    {formatTime(event.date)} — {formatTime(event.endDate)}
                  </span>
                </div>
                <div className="font-medium text-sm text-theme-primary mt-1 truncate">{event.title}</div>
                {event.contact && (
                  <div className="text-xs text-theme-tertiary mt-0.5 truncate">{event.contact}</div>
                )}
              </div>
            </button>
          </div>
        )
      })}
    </div>
  )
}
