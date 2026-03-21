import { Sparkles, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopilotSummaryProps {
  summary: string
  isRefreshing: boolean
  onRefresh: () => void
  className?: string
}

export default function CopilotSummary({ summary, isRefreshing, onRefresh, className }: CopilotSummaryProps) {
  return (
    <div className={cn('bg-accent/5 border border-accent/10 rounded-card p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-primary-900">Résumé IA</h3>
              <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded-badge cursor-help" title="Confiance IA : 85% — basé sur les données CRM disponibles">
                Estimation IA
              </span>
            </div>
            <p className={cn('text-sm text-primary-700 leading-relaxed', isRefreshing && 'opacity-50')}>
              {summary}
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex-shrink-0 h-8 w-8 rounded-lg border border-border hover:bg-theme-hover flex items-center justify-center transition-colors disabled:opacity-50"
          title="Rafraîchir l'analyse"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-primary-500', isRefreshing && 'animate-spin')} />
        </button>
      </div>
    </div>
  )
}
