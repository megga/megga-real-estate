import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NextBestActionProps {
  title: string
  description: string
  actionLabel: string
  score?: number
  className?: string
  onAction?: () => void
}

export default function NextBestAction({ title, description, actionLabel, score, className, onAction }: NextBestActionProps) {
  return (
    <div className={cn('bg-success/5 border border-success/10 rounded-card p-4', className)}>
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
          <Zap className="h-4 w-4 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-primary-900">{title}</h3>
            {score != null && (
              <span className="text-[10px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-badge">
                {score}% compatible
              </span>
            )}
          </div>
          <p className="text-sm text-primary-600 leading-relaxed mb-3">{description}</p>
          <button
            onClick={onAction}
            className="inline-flex items-center gap-1.5 bg-success hover:bg-success/90 text-white text-xs font-medium px-3 py-1.5 rounded-button transition-colors"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
