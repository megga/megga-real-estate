import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopilotSummaryProps {
  summary: string
  isRefreshing: boolean
  onRefresh: () => void
  className?: string
}

export default function CopilotSummary({ summary, isRefreshing, onRefresh, className }: CopilotSummaryProps) {
  return (
    <div className={cn('rounded-xl border border-theme-border p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-theme-primary">Résumé IA</h3>
            <span className="text-[10px] text-theme-muted">estimation IA</span>
          </div>
          <p className={cn('text-sm text-theme-secondary leading-relaxed', isRefreshing && 'opacity-50')}>
            {summary}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex-shrink-0 h-8 w-8 rounded-lg border border-theme-border hover:bg-theme-hover flex items-center justify-center transition-colors disabled:opacity-50"
          title="Rafraîchir l'analyse"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-theme-tertiary', isRefreshing && 'animate-spin')} />
        </button>
      </div>
    </div>
  )
}
