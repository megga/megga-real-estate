import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from './calendar.types'

interface DraggableEventProps {
  event: CalendarEvent
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent) => void
}

export default function DraggableEvent({ event, children, className, onClick }: DraggableEventProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event-${event.id}`,
    data: { event },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={cn(className, isDragging && 'opacity-30')}
      style={{ touchAction: 'none' }}
    >
      {/* Drag handle layer — captures pointer events for dnd-kit */}
      <div
        {...listeners}
        className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing"
      />
      {/* Content layer — click events go here, above the drag handle */}
      <div className="relative z-[1]" onClick={onClick}>
        {children}
      </div>
    </div>
  )
}
