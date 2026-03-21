import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from './calendar.types'

interface DraggableEventProps {
  event: CalendarEvent
  children: React.ReactNode
  className?: string
}

export default function DraggableEvent({ event, children, className }: DraggableEventProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event-${event.id}`,
    data: { event },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(className, isDragging && 'opacity-30')}
      style={{ touchAction: 'none' }}
    >
      {children}
    </div>
  )
}
