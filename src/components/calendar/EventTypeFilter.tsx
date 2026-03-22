import { cn } from '@/lib/utils'
import { EVENT_TYPES, EVENT_CONFIG, type EventType } from './calendar.types'

interface EventTypeFilterProps {
  activeFilters: Set<EventType>
  onToggle: (type: EventType) => void
  className?: string
}

export default function EventTypeFilter({ activeFilters, onToggle, className }: EventTypeFilterProps) {
  return (
    <div className={cn('flex items-center gap-4 text-xs text-theme-tertiary', className)}>
      {EVENT_TYPES.map(type => {
        const config = EVENT_CONFIG[type]
        const active = activeFilters.has(type)
        return (
          <button
            key={type}
            onClick={() => onToggle(type)}
            className={cn(
              'flex items-center gap-1.5 transition-opacity',
              !active && 'opacity-30 line-through',
            )}
          >
            <div className={cn('w-2.5 h-2.5 rounded-full transition-opacity', config.dot)} />
            <span>{config.label}</span>
          </button>
        )
      })}
    </div>
  )
}
