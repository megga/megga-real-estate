import { cn } from '@/lib/utils'
import { EVENT_CONFIG, type CalendarEvent } from './calendar.types'
import { formatTime } from './calendarHelpers'

interface CalendarDragOverlayProps {
  event: CalendarEvent
}

export default function CalendarDragOverlay({ event }: CalendarDragOverlayProps) {
  const config = EVENT_CONFIG[event.type]

  return (
    <div className={cn(
      'px-2.5 py-2 rounded-lg border text-xs opacity-90 pointer-events-none max-w-[200px]',
      config.bg, config.color,
    )}>
      <div className="font-semibold truncate">{event.title}</div>
      <div className="text-[10px] opacity-70 mt-0.5">
        {formatTime(event.date)} — {formatTime(event.endDate)}
      </div>
    </div>
  )
}
