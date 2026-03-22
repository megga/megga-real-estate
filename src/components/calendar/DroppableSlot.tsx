import { useDroppable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'

interface DroppableSlotProps {
  id: string
  children: React.ReactNode
  className?: string
}

export default function DroppableSlot({ id, children, className }: DroppableSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && 'bg-accent/10 ring-2 ring-accent/30 ring-inset')}
    >
      {children}
    </div>
  )
}
