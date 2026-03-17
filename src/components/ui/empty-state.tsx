import { cn } from '@/lib/utils'
import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      <div className="h-12 w-12 rounded-full bg-section flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-primary-300" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-primary-700 mb-1">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-button transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
